// ─────────────────────────────────────────────────────────────────────────────
// AGRIO Risk & Alert Engine  (Phase 5)
// ─────────────────────────────────────────────────────────────────────────────
// Turns "here is the current crop condition" into "condition + emerging risk +
// why it matters + what to do." This is a PURE, deterministic reshaping layer:
// it does NOT re-run vision, re-measure sensors, or re-decide irrigation.
//
//        VISION + TELEMETRY + WEATHER + CROP PROFILE + FRESHNESS
//                              │
//                     generateAdvisory()          ← Phase 3/4 engine (unchanged)
//                              │
//                    ┌─────────┴─────────┐
//                    │   generateRisks   │        ← THIS FILE
//                    └─────────┬─────────┘
//                              │
//              prioritized risk/alert objects → AdviceBoard → farmer action
//
// Because the risk engine CONSUMES advisory.irrigationRecommendation rather than
// recomputing it, one system can never say REQUIRED while another says DELAY for
// the same inputs (req §18). Everything the advisory left null/absent stays that
// way here — we never fabricate a moisture %, rainfall amount, pest count, or
// N-P-K value (req §4, §6, §12, §13).
//
// Localization (req §24): dynamic risk prose (titles, descriptions, evidence,
// recommendations) is localized INSIDE this service via the bilingual `t(en,hi)`
// helper — exactly the pattern advisoryService already uses. Only the static
// section headers/labels live in i18n.js. No English-only alert text is hard-
// coded into JSX.
//
// Safety language (req §25): cautious throughout — "may", "possible", "monitor",
// "scout", "verify". Never "guaranteed / will cause / definitely". No pesticide
// or fertilizer dosing/rates ever appear here.
// ─────────────────────────────────────────────────────────────────────────────

import { SEVERITY, CATEGORY } from './visionSchema';
import { IRRIGATION_STATE } from './advisoryService';

// ── Risk taxonomy (only the data-justified types from req §3) ──
export const RISK_TYPE = {
  SOIL_MOISTURE: 'soil_moisture',   // 💧 from irrigation engine (soil vs crop band)
  RAIN_WATER: 'rain_water',         // 🌧 excess-moisture / waterlogging context
  HEAT_STRESS: 'heat_stress',       // 🌡 temperature beyond crop-config threshold
  HUMIDITY_FUNGAL: 'humidity_fungal', // 💦 conditions that MAY favor fungal development
  PEST: 'pest',                     // 🐛 observed leaf damage (vision)
  DISEASE: 'disease',               // 🦠 vision disease finding (detected, not env-guessed)
  NUTRIENT: 'nutrient',             // 🌱 visual nutrient observation (NOT a soil test)
  DATA_QUALITY: 'data_quality',     // 📡 missing / stale sensor or weather data
};

// Practical priority status (req §5 — priority, not scientific certainty).
export const RISK_STATUS = {
  ACTION: 'action',    // do something now
  MONITOR: 'monitor',  // keep watching
  WATCH: 'watch',      // low-priority context
  INFO: 'info',        // informational
  DATA: 'data',        // data-quality / decision-limiting warning
};

// req §4: confidenceBasis is honest about HOW a score was derived. A heuristic is
// never presented as a calibrated probability.
export const CONFIDENCE_BASIS = {
  HEURISTIC: 'heuristic',
  MODEL_ESTIMATE: 'model_estimate',
  RULE_BASED: 'rule_based',
};

// Ordering weight ONLY (req §4/§15) — decides tie-breaks between equal-severity
// risks. This is NOT a probability and is never shown as one. Actionable field
// risks outrank environmental context, which outranks data-quality notes.
const TYPE_WEIGHT = {
  [RISK_TYPE.SOIL_MOISTURE]: 9,
  [RISK_TYPE.DISEASE]: 8,
  [RISK_TYPE.PEST]: 7,
  [RISK_TYPE.RAIN_WATER]: 6,
  [RISK_TYPE.HEAT_STRESS]: 5,
  [RISK_TYPE.HUMIDITY_FUNGAL]: 4,
  [RISK_TYPE.NUTRIENT]: 3,
  [RISK_TYPE.DATA_QUALITY]: 1,
};

const SEVERITY_ORDER = SEVERITY; // {Info:0, Low:1, Moderate:2, High:3, Critical:4}

// ── Local helpers ──
/** Bilingual literal picker (mirrors advisoryService.t). */
const pick = (lang, en, hi) => (lang === 'hi' ? hi : en);

/** Advisory env issues use basis 'rule'; the risk schema uses 'rule_based'. */
function normalizeBasis(basis) {
  if (basis === 'rule') return CONFIDENCE_BASIS.RULE_BASED;
  return basis || null;
}

/** Map a source-freshness descriptor → a reliability tier for weather/telemetry risks (req §19). */
function reliabilityFromWeather(wf) {
  if (!wf || !wf.available) return 'low';
  if (wf.stale) return 'low';
  if (wf.live) return 'high';
  return 'medium'; // cached but not stale
}
function reliabilityFromTelemetry(tf) {
  if (!tf || !tf.available) return 'low';
  return tf.stale ? 'medium' : 'high';
}

/** status derived from severity unless the caller overrides it. */
function statusForSeverity(severity) {
  switch (severity) {
    case 'Critical':
    case 'High':
      return RISK_STATUS.ACTION;
    case 'Moderate':
      return RISK_STATUS.MONITOR;
    case 'Low':
      return RISK_STATUS.WATCH;
    default:
      return RISK_STATUS.INFO;
  }
}

/**
 * Build a normalized risk object with schema defaults + the ordering score.
 * Keeps every risk shaped identically for the UI (req §4).
 */
function makeRisk(partial) {
  const severity = partial.severity || 'Info';
  const status = partial.status || statusForSeverity(severity);
  const score = (SEVERITY_ORDER[severity] ?? 0) * 100 + (TYPE_WEIGHT[partial.type] || 0);
  return {
    id: partial.id,
    type: partial.type,
    title: partial.title,
    severity,
    status,
    score,                                  // ordering weight — NOT a probability
    confidence: partial.confidence ?? null, // null unless a real model score exists
    confidenceBasis: partial.confidenceBasis ?? null,
    description: partial.description || '',  // the "why it matters"
    evidence: partial.evidence ?? null,      // factual basis (values, ratios, %)
    affectedArea: partial.affectedArea ?? null,
    recommendations: partial.recommendations || [], // the "what to do"
    dataSources: partial.dataSources || [],
    dataQuality: partial.dataQuality ?? null, // 'simulated' | 'live' | null (req §20)
    reliability: partial.reliability ?? null, // 'high'|'medium'|'low' (req §19)
    freshness: partial.freshness ?? null,     // { source, ageMinutes, stale } (req §19)
    generatedAt: partial.generatedAt,
  };
}

/**
 * Generate prioritized risk/alert objects from an already-fused advisory.
 *
 * @param {Object}  input
 * @param {Object}  input.advisory       generateAdvisory() output (PRIMARY source)
 * @param {Object}  [input.telemetry]    raw snapshot (for humidity evidence only)
 * @param {Object}  [input.weather]      weatherData (for humidity evidence only)
 * @param {Object}  [input.cropProfile]  crop thresholds (heat/fungal severity nuance)
 * @param {string}  [input.telemetryMode] 'simulated' | 'connected' | ... (req §20)
 * @param {string}  [input.lang]         'en' | 'hi'
 * @param {number}  [input.now]          epoch ms — injectable for determinism
 * @returns {Array<Object>} risk objects, sorted highest-priority first (req §15)
 */
export function generateRisks({
  advisory = null,
  telemetry = null,
  weather = null,
  cropProfile = null,
  telemetryMode = null,
  lang = 'en',
  now = Date.now(),
} = {}) {
  if (!advisory) return [];

  const t = (en, hi) => pick(lang, en, hi);
  const generatedAt = advisory.generatedAt || new Date(now).toISOString();
  const isSimulated = telemetryMode === 'simulated';

  const detected = Array.isArray(advisory.detectedIssues) ? advisory.detectedIssues : [];
  const nutrientRecs = Array.isArray(advisory.nutrientRecommendations) ? advisory.nutrientRecommendations : [];
  const irr = advisory.irrigationRecommendation || null;
  const fresh = advisory.dataFreshness || {};
  const wf = fresh.weather || null;
  const tf = fresh.telemetry || null;
  const vf = fresh.vision || null;
  const profile = cropProfile || null;
  const fieldArea = t('Current Field', 'वर्तमान खेत');

  // Does a vision DISEASE finding exist? If so we surface it directly and SUPPRESS
  // the separate environmental fungal-condition card, to avoid two overlapping
  // messages for one situation (req §11, §29).
  const hasDiseaseFinding = detected.some((i) => i.category === CATEGORY.DISEASE);

  const risks = [];

  // Weather/telemetry freshness → a compact per-risk descriptor (req §19).
  const weatherFreshness = wf && wf.available
    ? { source: 'weather', ageMinutes: wf.ageMinutes ?? null, stale: !!wf.stale, live: !!wf.live }
    : null;
  const telemetryFreshness = tf && tf.available
    ? { source: 'telemetry', ageMinutes: tf.ageMinutes ?? null, stale: !!tf.stale }
    : null;

  // ── (1) 💧 SOIL-MOISTURE RISK — consumes the irrigation engine's decision ──
  // We NEVER re-derive irrigation here; we reshape its verdict into a risk so the
  // two can never disagree (req §7, §18).
  if (irr) {
    const sm = irr.soilMoisture;
    const smEvidence = sm
      ? `${sm.value}${sm.unit || '%'} · ${t('target', 'लक्ष्य')} ${sm.targetMin}–${sm.targetMax}${sm.unit || '%'}`
      : null;
    const smQuality = telemetryFreshness && isSimulated ? 'simulated' : (telemetryFreshness ? 'live' : null);

    if (irr.state === IRRIGATION_STATE.REQUIRED) {
      const critical = sm && sm.value != null && sm.value < sm.criticalLow;
      risks.push(makeRisk({
        id: 'risk-soil-field',
        type: RISK_TYPE.SOIL_MOISTURE,
        severity: critical ? 'High' : 'Moderate',
        title: critical
          ? t('Critical soil-moisture stress', 'गंभीर मृदा-नमी तनाव')
          : t('Soil-moisture stress', 'मृदा-नमी तनाव'),
        description: irr.reason, // already localized + states value vs band (the "why")
        evidence: smEvidence,
        affectedArea: fieldArea,
        confidenceBasis: CONFIDENCE_BASIS.RULE_BASED,
        recommendations: [
          t('Follow the irrigation recommendation below.', 'नीचे दी गई सिंचाई सिफ़ारिश का पालन करें।'),
          t('Re-check soil moisture after watering.', 'सिंचाई के बाद मृदा-नमी पुनः जाँचें।'),
        ],
        dataSources: ['telemetry', 'cropProfile'],
        dataQuality: smQuality,
        reliability: reliabilityFromTelemetry(tf),
        freshness: telemetryFreshness,
        generatedAt,
      }));
    } else if (irr.state === IRRIGATION_STATE.DELAY) {
      // Below target BUT meaningful rain is expected — this is the SAME situation
      // the irrigation card already frames as "hold for rain". Surface it as a
      // low-priority context card that AGREES with that decision (req §8, §18).
      risks.push(makeRisk({
        id: 'risk-soil-field',
        type: RISK_TYPE.SOIL_MOISTURE,
        severity: 'Low',
        status: RISK_STATUS.WATCH,
        title: t('Soil below target — irrigation on hold for rain', 'मृदा लक्ष्य से कम — वर्षा हेतु सिंचाई स्थगित'),
        description: irr.reason, // localized: explains the hold + expected rain
        evidence: smEvidence,
        affectedArea: fieldArea,
        confidenceBasis: CONFIDENCE_BASIS.RULE_BASED,
        recommendations: [
          t('Hold irrigation for now; incoming rain may cover the deficit.', 'फ़िलहाल सिंचाई रोकें; आने वाली वर्षा कमी पूरी कर सकती है।'),
          t('Re-check moisture after the forecast rain.', 'पूर्वानुमानित वर्षा के बाद नमी पुनः जाँचें।'),
        ],
        dataSources: ['telemetry', 'weather', 'cropProfile'],
        dataQuality: smQuality,
        reliability: irr.reliability || reliabilityFromWeather(wf),
        freshness: weatherFreshness || telemetryFreshness,
        generatedAt,
      }));
    }
    // MONITOR (in band) / NOT_REQUIRED / INSUFFICIENT_DATA → no soil-moisture-stress
    // risk here. Excess-moisture is handled below; missing sensor by data-quality.

    // ── (2) 🌧 RAIN / WATERLOGGING RISK ──
    // Only when the field is ALREADY well-watered (engine said NOT_REQUIRED, i.e.
    // moisture ≥ targetMax) AND meaningful rain is genuinely expected. We do NOT
    // raise waterlogging on probability alone or on soil moisture alone (req §8).
    const rain = irr.rainOutlook;
    if (irr.state === IRRIGATION_STATE.NOT_REQUIRED && rain && rain.meaningful) {
      const weatherStale = !wf || !wf.available || wf.stale;
      const rainBits = [];
      if (rain.amountMm != null) rainBits.push(`≈${rain.amountMm} mm`);
      if (rain.pop != null) rainBits.push(`${rain.pop}%`);
      if (rain.timingHours != null) rainBits.push(`~${rain.timingHours}h`);
      risks.push(makeRisk({
        id: 'risk-rain-field',
        type: RISK_TYPE.RAIN_WATER,
        // Stale weather weakens the case — cap at Low + caveat (req §19).
        severity: weatherStale ? 'Low' : 'Moderate',
        title: t('Possible excess moisture / waterlogging', 'संभावित अत्यधिक नमी / जलभराव'),
        description: weatherStale
          ? t('Soil is already well-watered and rain is in the forecast, but the weather data is not fresh — monitor drainage and verify the forecast.',
              'मिट्टी पहले से पर्याप्त सिंचित है और वर्षा का पूर्वानुमान है, पर मौसम डेटा ताज़ा नहीं — जल-निकासी पर नज़र रखें और पूर्वानुमान की पुष्टि करें।')
          : t('Soil is already well-watered and meaningful rain is expected — monitor for excess moisture or waterlogging.',
              'मिट्टी पहले से पर्याप्त सिंचित है और पर्याप्त वर्षा संभावित — अत्यधिक नमी या जलभराव पर नज़र रखें।'),
        evidence: [
          sm ? `${sm.value}${sm.unit || '%'} ≥ ${sm.targetMax}${sm.unit || '%'}` : null,
          rainBits.length ? rainBits.join(' · ') : null,
        ].filter(Boolean).join(' · ') || null,
        affectedArea: fieldArea,
        confidenceBasis: CONFIDENCE_BASIS.RULE_BASED,
        recommendations: [
          t('Ensure field drainage is clear.', 'सुनिश्चित करें कि खेत की जल-निकासी खुली है।'),
          t('Do not irrigate; re-assess after the rain passes.', 'सिंचाई न करें; वर्षा के बाद पुनः आकलन करें।'),
        ],
        dataSources: ['telemetry', 'weather', 'cropProfile'],
        dataQuality: telemetryFreshness && isSimulated ? 'simulated' : null,
        reliability: reliabilityFromWeather(wf),
        freshness: weatherFreshness,
        generatedAt,
      }));
    }
  }

  // ── Walk the advisory's detected issues → the remaining risk types ──
  for (const issue of detected) {
    // Soil-moisture stress issues are already represented by the irrigation-derived
    // risk above — skip to avoid a duplicate card (req §29).
    if (issue.source === 'telemetry:soil-moisture') continue;

    // ── (3) 🌡 HEAT / TEMPERATURE STRESS ──
    if (issue.source === 'environment:temperature') {
      const demoNote = profile?.isDemoDefault
        ? t(' The stress threshold is a configurable demo default.', ' तनाव सीमा एक विन्यास-योग्य डेमो डिफ़ॉल्ट है।')
        : '';
      const isHeat = /heat|गर्मी/i.test(issue.title || '');
      risks.push(makeRisk({
        id: `risk-temp`,
        type: RISK_TYPE.HEAT_STRESS,
        severity: issue.severity || 'Moderate',
        title: issue.title, // already localized + carries the value, e.g. "Heat stress risk (39°C)"
        description: (isHeat
          ? t('Temperature is at or above the configured crop heat-stress threshold, which may increase water demand and crop stress.',
              'तापमान विन्यस्त फसल ताप-तनाव सीमा पर या उससे ऊपर है, जिससे जल-मांग और फसल तनाव बढ़ सकता है।')
          : t('Temperature is at or below the configured cold-stress threshold, which may stress the crop.',
              'तापमान विन्यस्त शीत-तनाव सीमा पर या उससे नीचे है, जो फसल को तनाव दे सकता है।')) + demoNote,
        evidence: issue.detail || null,
        affectedArea: t('Field-wide', 'पूरे खेत में'),
        confidenceBasis: normalizeBasis(issue.confidenceBasis) || CONFIDENCE_BASIS.RULE_BASED,
        recommendations: isHeat
          ? [
              t('Keep the crop adequately watered and consider mulching to buffer root-zone temperature.', 'फसल को पर्याप्त सिंचित रखें और जड़-क्षेत्र तापमान संतुलित करने हेतु मल्चिंग पर विचार करें।'),
              t('Check the field again sooner than usual.', 'खेत की सामान्य से जल्दी पुनः जाँच करें।'),
            ]
          : [
              t('Protect the crop from cold where practical and monitor closely.', 'जहाँ संभव हो फसल को ठंड से बचाएँ और निकटता से निगरानी करें।'),
            ],
        dataSources: [fresh.tempSource === 'sensor' ? 'telemetry' : 'weather', 'cropProfile'],
        dataQuality: fresh.tempSource === 'sensor' && isSimulated ? 'simulated' : null,
        reliability: fresh.tempSource === 'sensor' ? reliabilityFromTelemetry(tf) : reliabilityFromWeather(wf),
        freshness: fresh.tempSource === 'sensor' ? telemetryFreshness : weatherFreshness,
        generatedAt,
      }));
      continue;
    }

    // ── (4) 💦 HUMIDITY / FUNGAL-CONDITION RISK (a CONDITION, not a diagnosis) ──
    if (issue.source === 'environment:humidity') {
      if (hasDiseaseFinding) continue; // disease already surfaced — don't double up (req §29)
      // Read the real humidity value for severity nuance + evidence (never invented).
      const humidity = numFrom(telemetry?.weather?.humidity) ?? numFrom(weather?.current?.humidity);
      const fungalHigh = profile?.humidity?.fungalRiskHigh ?? null;
      const veryHumid = humidity != null && fungalHigh != null && humidity >= fungalHigh + 10;
      const weatherStale = !wf || !wf.available || wf.stale;
      const severity = weatherStale ? 'Low' : (veryHumid ? 'Moderate' : 'Low');
      risks.push(makeRisk({
        id: `risk-humidity`,
        type: RISK_TYPE.HUMIDITY_FUNGAL,
        severity,
        title: t('Fungal-condition risk', 'फफूंद-अनुकूल परिस्थिति जोखिम'),
        description: t(
          `High humidity${humidity != null ? ` (${humidity}%)` : ''} may favor fungal development. This is an environmental condition, not a confirmed disease.`,
          `उच्च आर्द्रता${humidity != null ? ` (${humidity}%)` : ''} फफूंद वृद्धि को बढ़ावा दे सकती है। यह एक पर्यावरणीय परिस्थिति है, कोई पुष्ट रोग नहीं।`
        ) + (weatherStale ? t(' Weather data is not fresh — reliability is reduced.', ' मौसम डेटा ताज़ा नहीं — विश्वसनीयता कम है।') : ''),
        evidence: issue.detail || (humidity != null ? `${humidity}%` : null),
        affectedArea: t('Field-wide', 'पूरे खेत में'),
        confidenceBasis: CONFIDENCE_BASIS.RULE_BASED,
        recommendations: [
          t('Scout leaves for early symptoms over the next few days.', 'अगले कुछ दिनों में पत्तियों में शुरुआती लक्षणों की जाँच करें।'),
          t('Improve canopy airflow and avoid overhead watering late in the day.', 'कैनोपी वायु-संचार सुधारें और दिन के अंत में ऊपर से सिंचाई न करें।'),
          t('If symptoms appear, verify the diagnosis before any treatment.', 'यदि लक्षण दिखें, तो किसी उपचार से पहले निदान की पुष्टि करें।'),
        ],
        dataSources: [fresh.tempSource === 'sensor' ? 'telemetry' : 'weather', 'cropProfile'],
        dataQuality: fresh.tempSource === 'sensor' && isSimulated ? 'simulated' : null,
        reliability: reliabilityFromWeather(wf),
        freshness: weatherFreshness,
        generatedAt,
      }));
      continue;
    }

    // ── (6) 🦠 DISEASE RISK — a vision finding: surface the detection directly ──
    if (issue.category === CATEGORY.DISEASE) {
      risks.push(makeRisk({
        id: `risk-disease-${risks.length}`,
        type: RISK_TYPE.DISEASE,
        severity: issue.severity || 'Moderate',
        title: issue.title, // localized from the vision engine
        description: t(
          'Detected from the leaf scan. Verify the diagnosis before acting.',
          'पत्ती स्कैन से पहचाना गया। कार्रवाई से पहले निदान की पुष्टि करें।'
        ),
        evidence: issue.detail || (issue.confidence != null ? `${issue.confidence}%` : null),
        affectedArea: t('Scanned plant', 'स्कैन किया गया पौधा'),
        confidence: issue.confidence ?? null,
        confidenceBasis: normalizeBasis(issue.confidenceBasis),
        recommendations: [
          t('Confirm the diagnosis before any treatment.', 'किसी उपचार से पहले निदान की पुष्टि करें।'),
          t('See the treatment & control guidance below.', 'नीचे उपचार व नियंत्रण मार्गदर्शन देखें।'),
          t('Scout nearby plants to gauge spread.', 'प्रसार आँकने हेतु आस-पास के पौधे जाँचें।'),
        ],
        dataSources: ['vision'],
        reliability: normalizeBasis(issue.confidenceBasis) === CONFIDENCE_BASIS.MODEL_ESTIMATE ? 'medium' : 'low',
        freshness: vf && vf.available ? { source: 'vision', ageMinutes: vf.ageMinutes ?? null, stale: false } : null,
        generatedAt,
      }));
      continue;
    }

    // ── (5) 🐛 PEST RISK — observed leaf damage: surface finding, no fabricated count ──
    if (issue.category === CATEGORY.PEST || issue.category === CATEGORY.PHYSICAL_DAMAGE) {
      risks.push(makeRisk({
        id: `risk-pest-${risks.length}`,
        type: RISK_TYPE.PEST,
        severity: issue.severity || 'Moderate',
        title: issue.title,
        description: t(
          'Possible pest pressure based on observed leaf damage from the scan. Population and species are not measured.',
          'स्कैन में देखे गए पत्ती-क्षति के आधार पर संभावित कीट दबाव। संख्या व प्रजाति मापी नहीं गई।'
        ),
        evidence: issue.detail || (issue.confidence != null ? `${issue.confidence}%` : null),
        affectedArea: t('Scanned plant', 'स्कैन किया गया पौधा'),
        confidence: issue.confidence ?? null,
        confidenceBasis: normalizeBasis(issue.confidenceBasis),
        recommendations: [
          t('Scout neighbouring plants to gauge spread.', 'प्रसार आँकने हेतु आस-पास के पौधे जाँचें।'),
          t('Remove badly damaged leaves and prefer targeted, non-chemical control first.', 'अत्यधिक क्षतिग्रस्त पत्तियाँ हटाएँ और पहले लक्षित, गैर-रासायनिक नियंत्रण चुनें।'),
          t('Verify before using any pesticide; follow locally approved guidance.', 'किसी कीटनाशक से पहले पुष्टि करें; स्थानीय अनुमोदित मार्गदर्शन अपनाएँ।'),
        ],
        dataSources: ['vision'],
        reliability: normalizeBasis(issue.confidenceBasis) === CONFIDENCE_BASIS.MODEL_ESTIMATE ? 'medium' : 'low',
        freshness: vf && vf.available ? { source: 'vision', ageMinutes: vf.ageMinutes ?? null, stale: false } : null,
        generatedAt,
      }));
      continue;
    }

    // ── (7) 🌱 NUTRIENT OBSERVATION — visual only, NEVER a soil measurement ──
    if (issue.category === CATEGORY.NUTRIENT) {
      // Enrich with the advisory's nutrient guidance (already dosing-free, localized).
      const nr = nutrientRecs.find((n) => n.source === 'image-visual') || null;
      risks.push(makeRisk({
        id: `risk-nutrient-${risks.length}`,
        type: RISK_TYPE.NUTRIENT,
        severity: issue.severity || 'Low',
        status: RISK_STATUS.WATCH,
        title: nr?.title || issue.title,
        description: (nr?.symptomStatement
          || t('Visual symptoms consistent with a possible nutrient issue.', 'संभावित पोषक समस्या के अनुरूप दृश्य लक्षण।'))
          + ' ' + t('This is a visual observation only — NOT a soil test. No N-P-K values are measured.',
                    'यह केवल एक दृश्य अवलोकन है — मृदा जाँच नहीं। कोई N-P-K मान मापा नहीं गया।'),
        evidence: issue.detail || (issue.confidence != null ? `${issue.confidence}%` : null),
        affectedArea: t('Scanned plant', 'स्कैन किया गया पौधा'),
        confidence: issue.confidence ?? null,
        confidenceBasis: normalizeBasis(issue.confidenceBasis),
        recommendations: Array.isArray(nr?.guidance) && nr.guidance.length
          ? nr.guidance
          : [
              t('Confirm with a soil test before applying any fertilizer.', 'कोई उर्वरक देने से पहले मृदा जाँच से पुष्टि करें।'),
              t('Follow crop-specific, locally approved nutrition guidance.', 'फसल-विशिष्ट, स्थानीय अनुमोदित पोषण मार्गदर्शन अपनाएँ।'),
            ],
        dataSources: ['vision'],
        reliability: 'low',
        freshness: vf && vf.available ? { source: 'vision', ageMinutes: vf.ageMinutes ?? null, stale: false } : null,
        generatedAt,
      }));
      continue;
    }

    // ── Any OTHER vision-sourced finding (e.g. a general "stress" observation) ──
    // Surface it honestly rather than dropping it. Typed as stress purely for the
    // icon (this app already uses a thermometer as its stress glyph); the title
    // carries the real finding, and the wording stays cautious (req §11/§25).
    if (typeof issue.source === 'string' && issue.source.startsWith('vision:')) {
      risks.push(makeRisk({
        id: `risk-vision-${risks.length}`,
        type: RISK_TYPE.HEAT_STRESS,
        severity: issue.severity || 'Low',
        title: issue.title,
        description: t(
          'Observed in the leaf scan. Monitor the crop and verify against field conditions before acting.',
          'पत्ती स्कैन में देखा गया। फसल की निगरानी करें और कार्रवाई से पहले खेत की परिस्थितियों से पुष्टि करें।'
        ),
        evidence: issue.detail || (issue.confidence != null ? `${issue.confidence}%` : null),
        affectedArea: t('Scanned plant', 'स्कैन किया गया पौधा'),
        confidence: issue.confidence ?? null,
        confidenceBasis: normalizeBasis(issue.confidenceBasis),
        recommendations: [
          t('Monitor the crop over the next few days.', 'अगले कुछ दिनों में फसल की निगरानी करें।'),
          t('Cross-check with soil moisture and weather before acting.', 'कार्रवाई से पहले मृदा-नमी व मौसम से मिलान करें।'),
        ],
        dataSources: ['vision'],
        reliability: normalizeBasis(issue.confidenceBasis) === CONFIDENCE_BASIS.MODEL_ESTIMATE ? 'medium' : 'low',
        freshness: vf && vf.available ? { source: 'vision', ageMinutes: vf.ageMinutes ?? null, stale: false } : null,
        generatedAt,
      }));
      continue;
    }
  }

  // ── (8) 📡 SENSOR / DATA-QUALITY RISKS — never hide missing data (req §14) ──
  // These flag when DECISION QUALITY is limited. Simulated telemetry is NOT itself
  // one of these (it IS available) — it is marked per-risk via dataQuality instead,
  // so healthy simulated runs don't nag (req §20, §29).
  if (!tf || !tf.available) {
    risks.push(makeRisk({
      id: 'risk-data-telemetry',
      type: RISK_TYPE.DATA_QUALITY,
      severity: 'Low',
      status: RISK_STATUS.DATA,
      title: t('Soil sensor unavailable', 'मृदा सेंसर अनुपलब्ध'),
      description: t(
        'No live field-sensor reading, so soil-moisture-based guidance is limited until a sensor is connected. AGRIO does not guess soil moisture.',
        'कोई लाइव क्षेत्र-सेंसर रीडिंग नहीं, इसलिए सेंसर जुड़ने तक मृदा-नमी आधारित मार्गदर्शन सीमित है। AGRIO मृदा-नमी का अनुमान नहीं लगाता।'
      ),
      evidence: null,
      affectedArea: fieldArea,
      confidenceBasis: CONFIDENCE_BASIS.RULE_BASED,
      recommendations: [
        t('Connect the ESP32 field sensor to enable moisture guidance.', 'नमी मार्गदर्शन सक्षम करने हेतु ESP32 क्षेत्र सेंसर जोड़ें।'),
      ],
      dataSources: ['telemetry'],
      reliability: 'low',
      generatedAt,
    }));
  } else if (tf.stale) {
    risks.push(makeRisk({
      id: 'risk-data-telemetry',
      type: RISK_TYPE.DATA_QUALITY,
      severity: 'Info',
      status: RISK_STATUS.DATA,
      title: t('Sensor data is not fresh', 'सेंसर डेटा ताज़ा नहीं'),
      description: t(
        `The latest field-sensor reading is about ${tf.ageMinutes ?? '?'} min old, so current guidance may be less reliable.`,
        `नवीनतम क्षेत्र-सेंसर रीडिंग लगभग ${tf.ageMinutes ?? '?'} मिनट पुरानी है, इसलिए वर्तमान मार्गदर्शन कम विश्वसनीय हो सकता है।`
      ),
      evidence: tf.ageMinutes != null ? `${tf.ageMinutes} min` : null,
      affectedArea: fieldArea,
      confidenceBasis: CONFIDENCE_BASIS.RULE_BASED,
      recommendations: [
        t('Check the sensor connection to restore fresh readings.', 'ताज़ा रीडिंग बहाल करने हेतु सेंसर कनेक्शन जाँचें।'),
      ],
      dataSources: ['telemetry'],
      dataQuality: isSimulated ? 'simulated' : null,
      reliability: 'medium',
      freshness: telemetryFreshness,
      generatedAt,
    }));
  }

  if (!wf || !wf.available) {
    risks.push(makeRisk({
      id: 'risk-data-weather',
      type: RISK_TYPE.DATA_QUALITY,
      severity: 'Low',
      status: RISK_STATUS.DATA,
      title: t('Weather data unavailable', 'मौसम डेटा अनुपलब्ध'),
      description: t(
        'Live weather is unavailable, so rain-aware advice is limited. No rainfall values are assumed.',
        'लाइव मौसम अनुपलब्ध है, इसलिए वर्षा-सचेत सलाह सीमित है। कोई वर्षा मान नहीं माना गया।'
      ),
      evidence: null,
      affectedArea: t('Field-wide', 'पूरे खेत में'),
      confidenceBasis: CONFIDENCE_BASIS.RULE_BASED,
      recommendations: [
        t('Reconnect weather to enable rain-aware irrigation guidance.', 'वर्षा-सचेत सिंचाई मार्गदर्शन हेतु मौसम पुनः जोड़ें।'),
      ],
      dataSources: ['weather'],
      reliability: 'low',
      generatedAt,
    }));
  } else if (wf.stale) {
    risks.push(makeRisk({
      id: 'risk-data-weather',
      type: RISK_TYPE.DATA_QUALITY,
      severity: 'Info',
      status: RISK_STATUS.DATA,
      title: t('Weather data is not fresh', 'मौसम डेटा ताज़ा नहीं'),
      description: t(
        `Weather data is about ${wf.ageMinutes ?? '?'} min old, so rainfall-based decisions have reduced reliability.`,
        `मौसम डेटा लगभग ${wf.ageMinutes ?? '?'} मिनट पुराना है, इसलिए वर्षा-आधारित निर्णयों की विश्वसनीयता कम है।`
      ),
      evidence: wf.ageMinutes != null ? `${wf.ageMinutes} min` : null,
      affectedArea: t('Field-wide', 'पूरे खेत में'),
      confidenceBasis: CONFIDENCE_BASIS.RULE_BASED,
      recommendations: [
        t('Refresh weather for more reliable rain-aware guidance.', 'अधिक विश्वसनीय वर्षा-सचेत मार्गदर्शन हेतु मौसम रीफ़्रेश करें।'),
      ],
      dataSources: ['weather'],
      reliability: 'low',
      freshness: weatherFreshness,
      generatedAt,
    }));
  }

  // ── Prioritize: severity desc, then ordering weight desc (req §15) ──
  risks.sort((a, b) => (b.score - a.score) || 0);
  return risks;
}

/** Local numeric coercion (kept private; mirrors advisoryService.numOrNull). */
function numFrom(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default generateRisks;
