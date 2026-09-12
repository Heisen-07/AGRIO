/**
 * AGRIO Advisory Service — the central intelligence layer
 * ───────────────────────────────────────────────────────
 * This is where AGRIO stops *observing* and starts *advising*. It fuses every
 * signal we have into ONE normalized, farmer-facing advisory:
 *
 *     vision findings  ┐
 *     ESP32 telemetry  │
 *     weather + age    ├──▶  advisoryService  ──▶  one AGRIO advisory
 *     crop profile     │
 *     agronomic rules  ┘
 *
 * Design contract (these are deliberate, not incidental):
 *
 *  1. DETECTION ≠ RECOMMENDATION. The vision engines *observe* (findings[]);
 *     this service decides what those observations *mean operationally*. It
 *     never re-runs detection and never mutates its inputs.
 *
 *  2. PURE & DETERMINISTIC. `generateAdvisory` is a pure function of its inputs.
 *     The only ambient value — "now" — is injectable, so the same inputs always
 *     produce the same output (testable; see advisoryService.samples.js).
 *
 *  3. NEVER FABRICATE. If a sensor is missing we return an explicit
 *     insufficient-data state — we do NOT invent moisture, weather, confidence,
 *     or exact water quantities. Image-based nutrient signals are phrased as
 *     "possible / visual symptoms consistent with", never as a soil measurement.
 *
 *  4. HONEST RELIABILITY. Every weather-dependent recommendation carries a
 *     reliability that drops when the weather feed is stale or offline, and the
 *     data's age/source is always exposed (dataFreshness / dataSources).
 *
 *  5. ONE ADVISORY. Multiple simultaneous findings (disease + pest + nutrient +
 *     stress) are combined into a single coherent advisory, not a pile of
 *     disconnected messages.
 */

import { worstSeverity, SEVERITY, CATEGORY } from './visionSchema';
import { DEFAULT_CROP_PROFILE } from '../config/cropProfiles';

// ── Public enums ─────────────────────────────────────────────────
export const IRRIGATION_STATE = {
  REQUIRED: 'required',
  NOT_REQUIRED: 'not_required',
  DELAY: 'delay',
  MONITOR: 'monitor',
  INSUFFICIENT_DATA: 'insufficient_data',
};

export const ADVISORY_STATUS = {
  HEALTHY: 'healthy',
  MONITOR: 'monitor',
  ACTION_NEEDED: 'action_needed',
  INSUFFICIENT_DATA: 'insufficient_data',
};

export const RELIABILITY = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

// ── Tunable thresholds (transport / freshness, NOT agronomic) ────
// Agronomic thresholds live in cropProfiles.js. These are about data plumbing.
const RAIN_POP_THRESHOLD = 60; // % probability of precipitation ⇒ "rain likely soon"
// Prefer AMOUNT + timing + probability over probability alone (Phase 4). These
// gate what counts as rain worth DELAYING irrigation for — data-plumbing
// heuristics, deliberately conservative, NOT agronomist-calibrated.
const RAIN_MEANINGFUL_MM = 2.5; // ≥ this much forecast rain in the window can actually water the soil
const RAIN_MIN_POP_FOR_AMOUNT = 40; // don't trust a forecast amount below this confidence
const RAIN_WINDOW_HOURS = 24; // how far ahead rain is relevant to today's irrigation call
const WEATHER_LIVE_MS = 15 * 60 * 1000; // ≤15 min old ⇒ effectively current
const WEATHER_STALE_MS = 60 * 60 * 1000; // >60 min old ⇒ degrade weather-based advice
const TELEMETRY_STALE_MS = 2 * 60 * 1000; // >2 min without a snapshot ⇒ likely disconnected

const RAIN_RE = /rain|storm|drizzle|thunder|shower/i;

// ── Tiny pure helpers ────────────────────────────────────────────
/** Pick a language string. */
function t(lang, en, hi) {
  return lang === 'hi' ? hi : en;
}

/** Finite number or null (never NaN / undefined leaking through). */
function numOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const RELIABILITY_RANK = { high: 3, medium: 2, low: 1 };
/** The lower (more cautious) of two reliability levels. */
function minReliability(a, b) {
  return RELIABILITY_RANK[a] <= RELIABILITY_RANK[b] ? a : b;
}

function toEpoch(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function minutesBetween(ageMs) {
  return ageMs == null ? null : Math.round(ageMs / 60000);
}

// ── Freshness descriptors ────────────────────────────────────────
function describeWeatherFreshness(weather, now) {
  if (!weather || !weather.current) {
    return { available: false, live: false, stale: true, source: null, asOf: null, ageMs: null, ageMinutes: null };
  }
  const at = toEpoch(weather.updatedAt) ?? toEpoch(weather.current.timestamp);
  const ageMs = at == null ? null : Math.max(0, now - at);
  return {
    available: true,
    source: weather.source || 'OpenWeatherMap',
    asOf: at == null ? null : new Date(at).toISOString(),
    ageMs,
    ageMinutes: minutesBetween(ageMs),
    live: ageMs != null && ageMs <= WEATHER_LIVE_MS,
    stale: ageMs == null || ageMs > WEATHER_STALE_MS,
  };
}

function describeTelemetryFreshness(telemetry, now) {
  if (!telemetry) {
    return { available: false, stale: true, source: null, asOf: null, ageMs: null, ageMinutes: null };
  }
  const at = toEpoch(telemetry.timestamp);
  const ageMs = at == null ? null : Math.max(0, now - at);
  return {
    available: true,
    source: telemetry.source || 'unknown',
    asOf: at == null ? null : new Date(at).toISOString(),
    ageMs,
    ageMinutes: minutesBetween(ageMs),
    stale: ageMs != null && ageMs > TELEMETRY_STALE_MS,
  };
}

function describeVisionFreshness(vision, now) {
  if (!vision) return { available: false, asOf: null, ageMs: null, ageMinutes: null, engine: null, onDevice: null };
  const at = toEpoch(vision.timestamp);
  const ageMs = at == null ? null : Math.max(0, now - at);
  return {
    available: true,
    engine: vision.engine ?? null,
    onDevice: vision.onDevice ?? null,
    asOf: at == null ? null : new Date(at).toISOString(),
    ageMs,
    ageMinutes: minutesBetween(ageMs),
  };
}

// ── Signal extraction ────────────────────────────────────────────
/** Live soil-moisture reading for the field, or null (never guessed). */
function pickZoneMoisture(telemetry, zone) {
  if (!telemetry || !telemetry.soilMoisture) return null;
  // 1. Authoritative single-field reading (canonical Phase 8A schema)
  if (typeof telemetry.soilMoisture.current === 'number') {
    return telemetry.soilMoisture.current;
  }
  if (typeof telemetry.soilMoisture === 'number') {
    return telemetry.soilMoisture;
  }
  if (typeof telemetry.soilMoisture.value === 'number') {
    return telemetry.soilMoisture.value;
  }
  // 2. Legacy zone fallback for backwards compatibility
  if (zone && typeof telemetry.soilMoisture[zone] === 'number') {
    return telemetry.soilMoisture[zone];
  }
  if (typeof telemetry.soilMoisture.zoneA === 'number') {
    return telemetry.soilMoisture.zoneA;
  }
  return null;
}

/**
 * Rain outlook from the OWM feed. Prefers forecast rainfall AMOUNT + timing +
 * probability (weatherService.rainOutlook) and falls back to probability alone
 * (forecast[0].pop) only when the amount channel is unavailable — so a stale or
 * older cached payload still yields a usable, if weaker, signal.
 *
 * `meaningful` = enough water is actually expected soon to be worth delaying
 * irrigation for (currently raining, OR a measurable amount at decent
 * confidence, OR — with no amount channel — a high probability). This is
 * deliberately stricter than `imminent` (any likely rain), so a forecast of a
 * light trace never talks us out of watering a dry field.
 *
 * @param {Object} weather  weatherService weatherData or null
 * @param {number} now      epoch ms — for timing math (keeps the fn pure)
 */
function readRainOutlook(weather, now = Date.now()) {
  if (!weather || !weather.current) return { available: false };
  const next = Array.isArray(weather.forecast) ? weather.forecast[0] : null;
  const outlook = weather.rainOutlook || null;

  // Probability: prefer the near-term window max, else the first forecast day's pop.
  const pop = numOrNull(outlook?.maxPop) ?? numOrNull(next?.pop);
  // Amount (mm) expected within the near-term window — null when the feed lacks it.
  const amountMm = numOrNull(outlook?.totalMm);
  const hasAmount = amountMm != null;
  // Timing: hours until the next meaningful slot, from an absolute ts (purity).
  const nextRainAt = toEpoch(outlook?.nextRainAt);
  const timingHours = nextRainAt != null ? Math.max(0, Math.round((nextRainAt - now) / 3600000)) : null;
  const windowHours = numOrNull(outlook?.windowHours) ?? RAIN_WINDOW_HOURS;

  const currentlyRaining =
    RAIN_RE.test(weather.current.condition || '') || RAIN_RE.test(weather.current.description || '');

  // Rain must land inside our look-ahead window to bear on today's decision.
  const withinWindow = timingHours == null || timingHours <= windowHours;
  // Meaningful by AMOUNT (the preferred path): measurable rain at decent confidence.
  const meaningfulByAmount =
    hasAmount && amountMm >= RAIN_MEANINGFUL_MM && (pop == null || pop >= RAIN_MIN_POP_FOR_AMOUNT) && withinWindow;
  // Fallback when the feed carries NO amount: a high probability alone.
  const meaningfulByProb = !hasAmount && pop != null && pop >= RAIN_POP_THRESHOLD && withinWindow;
  const meaningful = currentlyRaining || meaningfulByAmount || meaningfulByProb;

  // `imminent` = ANY likely rain (kept for messaging; distinct from meaningful).
  const imminent = currentlyRaining || (pop != null && pop >= RAIN_POP_THRESHOLD);

  return {
    available: true,
    pop,
    amountMm,
    hasAmount,
    timingHours,
    windowHours,
    currentlyRaining,
    imminent,
    meaningful,
    label: next?.rainChance ?? null,
    source: weather.source || 'OpenWeatherMap',
  };
}

/**
 * Map vision findings[] → advisory "detected issues" (detection layer only).
 * Healthy / unknown findings are dropped here (they are not *issues*); the
 * unknown case is surfaced separately as a warning + nextAction.
 */
function mapVisionIssues(vision) {
  if (!vision || !Array.isArray(vision.findings)) return [];
  const engineTag = vision.onDevice ? 'vision:on-device' : `vision:${vision.engine || 'cloud'}`;
  return vision.findings
    .filter((f) => f && f.category !== CATEGORY.HEALTHY && f.category !== CATEGORY.UNKNOWN)
    .map((f) => ({
      category: f.category,
      title: f.title || f.category,
      severity: f.severity || 'Low',
      // Confidence is passed through verbatim WITH its basis — we never turn a
      // categorical label into a fake continuous score (honesty req).
      confidence: numOrNull(f.confidence),
      confidenceBasis: f.confidenceBasis || null,
      source: engineTag,
      // NOTE: raw finding.recommendations are intentionally NOT carried here.
      // They can contain chemical dosing (from Gemini output); treatment guidance
      // is regenerated safely by deriveTreatments/safeTreatmentSteps instead.
    }));
}

/** Environmental issues derived by deterministic rules from telemetry/weather. */
function deriveEnvIssues({ moistureValue, temperature, humidity, cropProfile, zone: _zone, lang }) {
  const issues = [];
  const sm = cropProfile.soilMoisture;

  if (moistureValue != null) {
    if (moistureValue < sm.criticalLow) {
      issues.push({
        category: 'stress',
        title: t(lang, 'Soil critically dry in field', 'खेत में मिट्टी अत्यधिक सूखी'),
        severity: 'High',
        confidence: null, // rule-based flag — no fabricated confidence
        confidenceBasis: 'rule',
        source: 'telemetry:soil-moisture',
        detail: `${moistureValue}% < critical ${sm.criticalLow}%`,
      });
    } else if (moistureValue < sm.targetMin) {
      issues.push({
        category: 'stress',
        title: t(lang, 'Soil below target in field', 'खेत में मिट्टी लक्ष्य से कम'),
        severity: 'Low',
        confidence: null,
        confidenceBasis: 'rule',
        source: 'telemetry:soil-moisture',
        detail: `${moistureValue}% < target ${sm.targetMin}%`,
      });
    }
  }

  if (temperature != null && temperature >= cropProfile.temperature.heatStress) {
    issues.push({
      category: 'stress',
      title: t(lang, `Heat stress risk (${temperature}°C)`, `गर्मी तनाव जोखिम (${temperature}°C)`),
      severity: 'Moderate',
      confidence: null,
      confidenceBasis: 'rule',
      source: 'environment:temperature',
      detail: `${temperature}°C ≥ ${cropProfile.temperature.heatStress}°C`,
    });
  } else if (temperature != null && temperature <= cropProfile.temperature.coldStress) {
    issues.push({
      category: 'stress',
      title: t(lang, `Cold stress risk (${temperature}°C)`, `शीत तनाव जोखिम (${temperature}°C)`),
      severity: 'Moderate',
      confidence: null,
      confidenceBasis: 'rule',
      source: 'environment:temperature',
      detail: `${temperature}°C ≤ ${cropProfile.temperature.coldStress}°C`,
    });
  }

  if (humidity != null && humidity >= cropProfile.humidity.fungalRiskHigh) {
    issues.push({
      category: 'environment',
      title: t(lang, `High humidity (${humidity}%) — elevated fungal pressure`, `उच्च आर्द्रता (${humidity}%) — फफूंद जोखिम अधिक`),
      severity: 'Low',
      confidence: null,
      confidenceBasis: 'rule',
      source: 'environment:humidity',
      detail: `${humidity}% ≥ ${cropProfile.humidity.fungalRiskHigh}%`,
    });
  }

  return issues;
}

// ── Irrigation decision (rule / hybrid — exported for direct testing) ──
/**
 * Decide irrigation from soil moisture + crop target band + rain outlook.
 * Pure. Returns one of IRRIGATION_STATE with a reason, reliability, and NEVER a
 * water quantity (req: don't fabricate exact volumes).
 */
export function assessIrrigation({
  moistureValue,
  cropProfile,
  rain,
  weatherFresh,
  telemetryStale = false,
  temperature = null,
  zone = 'field',
  lang = 'en',
}) {
  const sm = cropProfile.soilMoisture;
  const band = `${sm.targetMin}–${sm.targetMax}%`;

  // (req 11) No sensor reading ⇒ explicit insufficient-data, not a guess.
  if (moistureValue == null) {
    return {
      state: IRRIGATION_STATE.INSUFFICIENT_DATA,
      zone,
      reason: t(
        lang,
        'No live soil-moisture reading for the field. Connect the ESP32 soil sensor to enable irrigation guidance.',
        'खेत के लिए कोई लाइव मृदा-नमी रीडिंग नहीं। सिंचाई मार्गदर्शन हेतु ESP32 सेंसर जोड़ें।'
      ),
      soilMoisture: null,
      rainOutlook: rain?.available ? summarizeRain(rain) : null,
      reliability: RELIABILITY.LOW,
      note: t(lang, 'AGRIO does not estimate soil moisture without a sensor.', 'बिना सेंसर के AGRIO मृदा-नमी का अनुमान नहीं लगाता।'),
      dataGaps: ['soil_moisture'],
    };
  }

  const rainMeaningful = !!(rain && rain.available && rain.meaningful);
  const rainImminent = !!(rain && rain.available && rain.imminent);
  const rainPhrase = describeRain(rain, lang);
  let state;
  let reason;
  const notes = [];

  if (moistureValue < sm.criticalLow) {
    state = IRRIGATION_STATE.REQUIRED;
    reason = t(
      lang,
      `Soil is critically dry (field: ${moistureValue}% vs critical ${sm.criticalLow}%).`,
      `मिट्टी अत्यधिक सूखी है (खेत: ${moistureValue}% बनाम अत्यंत ${sm.criticalLow}%)।`
    );
    if (rainMeaningful) {
      notes.push(
        t(
          lang,
          `Rain is forecast${rainPhrase ? ` (${rainPhrase})` : ''}, but moisture is critically low — do not wait on it; irrigate and re-check.`,
          `वर्षा का पूर्वानुमान है${rainPhrase ? ` (${rainPhrase})` : ''}, पर नमी अत्यधिक कम है — प्रतीक्षा न करें; सिंचाई कर पुनः जाँचें।`
        )
      );
    }
  } else if (moistureValue < sm.targetMin) {
    if (rainMeaningful) {
      // DELAY only when enough rain is genuinely expected soon (amount + timing +
      // probability), never on a bare chance of a trace.
      state = IRRIGATION_STATE.DELAY;
      reason = t(
        lang,
        `Soil is below target (${moistureValue}% vs ${band}) but meaningful rain is expected soon${rainPhrase ? ` (${rainPhrase})` : ''}. Hold irrigation and re-check after the rain.`,
        `मिट्टी लक्ष्य से कम है (${moistureValue}% बनाम ${band}) पर शीघ्र पर्याप्त वर्षा संभावित${rainPhrase ? ` (${rainPhrase})` : ''}। सिंचाई रोकें और वर्षा के बाद पुनः जाँचें।`
      );
    } else {
      state = IRRIGATION_STATE.REQUIRED;
      reason = t(
        lang,
        `Soil is below the target band (${moistureValue}% vs ${band}).`,
        `मिट्टी लक्ष्य सीमा से कम है (${moistureValue}% बनाम ${band})।`
      );
      // A light or low-confidence chance of rain is NOT a reason to skip watering
      // a dry field — call it out rather than silently ignoring it.
      if (rainImminent) {
        notes.push(
          t(
            lang,
            `Some rain is possible${rainPhrase ? ` (${rainPhrase})` : ''} but likely too little to meet the crop's need — irrigate unless a heavier fall is forecast.`,
            `कुछ वर्षा संभव है${rainPhrase ? ` (${rainPhrase})` : ''} पर फसल की आवश्यकता हेतु संभवतः अपर्याप्त — जब तक अधिक वर्षा का पूर्वानुमान न हो, सिंचाई करें।`
          )
        );
      }
    }
  } else if (moistureValue < sm.targetMax) {
    state = IRRIGATION_STATE.MONITOR;
    reason = t(
      lang,
      `Soil moisture is within the target band (${moistureValue}% in ${band}). No irrigation needed now; keep monitoring.`,
      `मृदा-नमी लक्ष्य सीमा में है (${moistureValue}% में ${band})। अभी सिंचाई आवश्यक नहीं; निगरानी रखें।`
    );
  } else {
    state = IRRIGATION_STATE.NOT_REQUIRED;
    reason = t(
      lang,
      `Soil is well-watered (${moistureValue}% ≥ ${sm.targetMax}%). Do not irrigate — waterlogging risk.`,
      `मिट्टी पर्याप्त सिंचित है (${moistureValue}% ≥ ${sm.targetMax}%)। सिंचाई न करें — जलभराव जोखिम।`
    );
  }

  // Heat raises evapotranspiration — advisory nudge only, never changes state.
  if (temperature != null && temperature >= cropProfile.temperature.heatStress &&
      (state === IRRIGATION_STATE.MONITOR || state === IRRIGATION_STATE.NOT_REQUIRED)) {
    notes.push(
      t(
        lang,
        `High temperature (${temperature}°C) raises water demand — check again sooner.`,
        `उच्च तापमान (${temperature}°C) से जल-मांग बढ़ती है — जल्दी पुनः जाँचें।`
      )
    );
  }

  // Reliability: sensor-driven decisions are high; rain-dependent ones degrade
  // with weather staleness; stale telemetry caps everything at medium.
  let reliability = RELIABILITY.HIGH;
  if (state === IRRIGATION_STATE.DELAY) {
    if (!weatherFresh || !weatherFresh.available) {
      reliability = RELIABILITY.LOW;
    } else if (weatherFresh.stale) {
      reliability = RELIABILITY.LOW;
      notes.push(
        t(
          lang,
          `Weather data is ${weatherFresh.ageMinutes ?? '?'} min old — this delay may be unreliable.`,
          `मौसम डेटा ${weatherFresh.ageMinutes ?? '?'} मिनट पुराना है — यह देरी अविश्वसनीय हो सकती है।`
        )
      );
    } else if (!weatherFresh.live) {
      reliability = RELIABILITY.MEDIUM;
    }
    // A delay decided on probability alone (no forecast amount) is weaker evidence
    // than an amount-backed one — cap reliability and say why (Phase 4 req).
    if (rain && rain.available && !rain.hasAmount) {
      reliability = minReliability(reliability, RELIABILITY.MEDIUM);
      notes.push(
        t(
          lang,
          'Delay is based on rain probability only (no forecast amount) — confirm before skipping irrigation.',
          'यह स्थगन केवल वर्षा संभावना पर आधारित है (मात्रा उपलब्ध नहीं) — सिंचाई टालने से पहले पुष्टि करें।'
        )
      );
    }
  }
  if (telemetryStale) {
    reliability = minReliability(reliability, RELIABILITY.MEDIUM);
    notes.push(t(lang, 'Sensor reading is not fresh — verify the connection.', 'सेंसर रीडिंग ताज़ा नहीं — कनेक्शन जाँचें।'));
  }

  // Actionable states get an explicit "how" that stays qualitative (no volumes).
  if (state === IRRIGATION_STATE.REQUIRED) {
    notes.push(
      t(
        lang,
        `Irrigate field until moisture returns to the ${band} band. AGRIO does not estimate exact water volume.`,
        `खेत की सिंचाई तब तक करें जब नमी ${band} सीमा में लौट आए। AGRIO सटीक जल-मात्रा का अनुमान नहीं देता।`
      )
    );
  }

  return {
    state,
    zone,
    reason,
    soilMoisture: {
      value: moistureValue,
      targetMin: sm.targetMin,
      targetMax: sm.targetMax,
      criticalLow: sm.criticalLow,
      unit: '%',
    },
    rainOutlook: rain?.available ? summarizeRain(rain) : null,
    reliability,
    note: notes.join(' '),
    dataGaps: [],
  };
}

/** Human phrase for a rain outlook: "≈4.2 mm, in ~6h, 80% chance" (omits nulls). */
function describeRain(rain, lang) {
  if (!rain || !rain.available) return '';
  const parts = [];
  if (rain.amountMm != null) parts.push(t(lang, `≈${rain.amountMm} mm`, `≈${rain.amountMm} मि.मी.`));
  if (rain.timingHours != null) parts.push(t(lang, `in ~${rain.timingHours}h`, `~${rain.timingHours}घं में`));
  if (rain.pop != null) parts.push(t(lang, `${rain.pop}% chance`, `${rain.pop}% संभावना`));
  return parts.join(', ');
}

function summarizeRain(rain) {
  return {
    pop: rain.pop ?? null,
    amountMm: rain.amountMm ?? null,
    hasAmount: !!rain.hasAmount,
    timingHours: rain.timingHours ?? null,
    windowHours: rain.windowHours ?? null,
    currentlyRaining: !!rain.currentlyRaining,
    imminent: !!rain.imminent,
    meaningful: !!rain.meaningful,
    label: rain.label ?? null,
    source: rain.source ?? null,
  };
}

/**
 * Convenience wrapper: assess irrigation for a single zone straight from raw
 * inputs, wiring the private freshness/rain helpers for you. Used by the
 * Irrigation tab to show a per-zone recommendation without re-running the full
 * vision advisory. Pure (inject `now` for determinism).
 *
 * @returns the same object shape as generateAdvisory().irrigationRecommendation
 */
export function assessIrrigationForZone({
  telemetry = null,
  weather = null,
  cropProfile = DEFAULT_CROP_PROFILE,
  zone = 'field',
  lang = 'en',
  now = Date.now(),
} = {}) {
  const profile = cropProfile || DEFAULT_CROP_PROFILE;
  const weatherFresh = describeWeatherFreshness(weather, now);
  const telemetryFresh = describeTelemetryFreshness(telemetry, now);
  const moistureValue = pickZoneMoisture(telemetry, zone);
  const rain = readRainOutlook(weather, now);
  const temperature = telemetry
    ? numOrNull(telemetry.weather?.temperature)
    : numOrNull(weather?.current?.temperature);
  return assessIrrigation({
    moistureValue,
    cropProfile: profile,
    rain,
    weatherFresh,
    telemetryStale: telemetryFresh.available && telemetryFresh.stale,
    temperature,
    zone,
    lang,
  });
}

// ── Recommendation builders ──────────────────────────────────────
function priorityForSeverity(severity) {
  if (severity === 'Critical') return 'urgent';
  if (severity === 'High') return 'high';
  if (severity === 'Moderate') return 'medium';
  return 'low';
}

function reliabilityForBasis(basis) {
  // Neither engine gives calibrated ML probability, so treatment reliability is
  // capped: classical-CV heuristics are 'low', model self-estimates 'medium'.
  if (basis === 'model_estimate') return RELIABILITY.MEDIUM;
  return RELIABILITY.LOW;
}

/**
 * SAFETY (Phase 4): the advisory engine must NOT emit dosing prescriptions such
 * as "neem oil 5 ml/L" or "Propiconazole 25% EC @ 1 ml/L". Vision-finding
 * `recommendations` CAN contain such strings (they flow from demo/live Gemini
 * output), so we deliberately do NOT pass them through here. Instead we return
 * qualitative, category-based control guidance — inspect/scout, remove affected
 * tissue where appropriate, follow crop-specific/local approved guidance, and
 * verify the diagnosis before any chemical treatment. Exact products and rates
 * are intentionally left to locally approved guidance / an agri-extension officer.
 */
function safeTreatmentSteps(category, lang) {
  if (category === CATEGORY.PEST) {
    return [
      t(lang, 'Scout this plant and its neighbours to confirm the pest and how widespread it is.', 'कीट व उसके फैलाव की पुष्टि हेतु इस पौधे व आस-पास के पौधों की जाँच करें।'),
      t(lang, 'Remove heavily damaged tissue and any visible egg masses.', 'अत्यधिक क्षतिग्रस्त भाग व दिखने वाले अंडे हटा दें।'),
      t(lang, 'Prefer targeted, non-chemical control first; avoid blanket spraying.', 'पहले लक्षित, गैर-रासायनिक नियंत्रण अपनाएँ; व्यापक छिड़काव से बचें।'),
      t(lang, 'Verify the pest and follow crop-specific, locally approved guidance before using any pesticide.', 'कोई कीटनाशक प्रयोग करने से पहले कीट की पुष्टि करें और फसल-विशिष्ट, स्थानीय अनुमोदित मार्गदर्शन का पालन करें।'),
    ];
  }
  if (category === CATEGORY.PHYSICAL_DAMAGE) {
    return [
      t(lang, 'Inspect closely to confirm the damage is mechanical/weather, not disease or pests.', 'पुष्टि करें कि क्षति यांत्रिक/मौसम जनित है, रोग या कीट नहीं।'),
      t(lang, 'Remove badly damaged tissue where practical to limit infection entry points.', 'संक्रमण रोकने हेतु जहाँ संभव हो अत्यधिक क्षतिग्रस्त भाग हटाएँ।'),
      t(lang, 'Protect the crop from the cause (wind, hail, handling) where possible.', 'जहाँ संभव हो फसल को कारण (हवा, ओला, रख-रखाव) से बचाएँ।'),
      t(lang, 'Monitor the wounds for secondary infection over the next few days.', 'अगले कुछ दिनों तक घावों में द्वितीयक संक्रमण की निगरानी करें।'),
    ];
  }
  // Disease (and any other treatable category) — conservative default.
  return [
    t(lang, 'Confirm the diagnosis before any treatment — a single photo can mislead.', 'किसी भी उपचार से पहले निदान की पुष्टि करें — एक फोटो भ्रामक हो सकती है।'),
    t(lang, 'Remove and safely dispose of affected leaves/tissue where practical.', 'जहाँ संभव हो प्रभावित पत्तियाँ/भाग हटाकर सुरक्षित रूप से नष्ट करें।'),
    t(lang, 'Improve canopy airflow and avoid overhead watering that keeps foliage wet.', 'कैनोपी वायु-संचार सुधारें और ऊपर से सिंचाई से बचें जिससे पत्तियाँ गीली रहती हैं।'),
    t(lang, 'Follow crop-specific, locally approved treatment guidance; consult your agri-extension officer before applying any chemical.', 'फसल-विशिष्ट, स्थानीय अनुमोदित उपचार मार्गदर्शन अपनाएँ; कोई रसायन प्रयोग से पहले कृषि-विस्तार अधिकारी से परामर्श करें।'),
  ];
}

function deriveTreatments(visionIssues, lang) {
  const treatable = new Set([CATEGORY.DISEASE, CATEGORY.PEST, CATEGORY.PHYSICAL_DAMAGE]);
  return visionIssues
    .filter((i) => treatable.has(i.category))
    .map((i) => {
      // SAFETY: qualitative, category-based steps only — never the raw vision
      // recommendations (which may carry chemical dosing). See safeTreatmentSteps.
      const steps = safeTreatmentSteps(i.category, lang);
      const reliability = reliabilityForBasis(i.confidenceBasis);
      const note =
        i.confidenceBasis === 'heuristic'
          ? t(lang, 'On-device heuristic detection — verify visually before chemical use.', 'ऑन-डिवाइस अनुमान — रासायनिक प्रयोग से पहले दृश्य पुष्टि करें।')
          : i.confidenceBasis === 'model_estimate'
            ? t(lang, 'AI estimate — confirm with a local expert before chemical use.', 'AI अनुमान — रासायनिक प्रयोग से पहले स्थानीय विशेषज्ञ से पुष्टि करें।')
            : '';
      return {
        forCategory: i.category,
        title: i.title,
        severity: i.severity,
        priority: priorityForSeverity(i.severity),
        steps,
        reliability,
        basis: i.confidenceBasis,
        note,
      };
    });
}

/**
 * Nutrient recommendations. (req 13) Image-derived signals are phrased as
 * "possible / visual symptoms consistent with" and explicitly NOT a soil test.
 * A sensor N/P/K path exists but only fires if a payload actually carries it —
 * the current telemetry schema has no N/P/K channel, so we never fabricate one.
 */
function deriveNutrient(visionIssues, telemetry, lang) {
  const recs = [];

  for (const i of visionIssues.filter((x) => x.category === CATEGORY.NUTRIENT)) {
    recs.push({
      source: 'image-visual',
      title: t(lang, `Possible nutrient issue: ${i.title}`, `संभावित पोषक समस्या: ${i.title}`),
      symptomStatement: t(lang, `Visual symptoms consistent with ${i.title}.`, `${i.title} के अनुरूप दृश्य लक्षण।`),
      basis: 'image-visual',
      reliability: RELIABILITY.LOW,
      note: t(
        lang,
        'Based on leaf appearance only — this is NOT a soil nutrient measurement. Confirm with a soil test before applying fertilizer.',
        'केवल पत्ती की दिखावट पर आधारित — यह मृदा पोषक माप नहीं है। उर्वरक से पहले मृदा जाँच कराएँ।'
      ),
      // SAFETY: qualitative guidance only — do NOT echo image recommendations
      // (they may carry fertilizer dosing like "foliar urea 1.5%").
      guidance: [
        t(lang, 'Confirm the deficiency with a soil test before applying any fertilizer.', 'कोई उर्वरक देने से पहले मृदा जाँच से कमी की पुष्टि करें।'),
        t(lang, 'Follow crop-specific, locally approved nutrition guidance for correction.', 'सुधार हेतु फसल-विशिष्ट, स्थानीय अनुमोदित पोषण मार्गदर्शन अपनाएँ।'),
      ],
    });
  }

  // Optional sensor N/P/K — only if a real channel is present (schema has none today).
  const npk = telemetry?.soilNutrients || telemetry?.npk || null;
  if (npk) {
    const n = numOrNull(npk.n ?? npk.nitrogen);
    const p = numOrNull(npk.p ?? npk.phosphorus);
    const k = numOrNull(npk.k ?? npk.potassium);
    if (n != null || p != null || k != null) {
      recs.push({
        source: 'sensor-npk',
        title: t(lang, 'Soil N-P-K reading available', 'मृदा N-P-K रीडिंग उपलब्ध'),
        basis: 'sensor-measurement',
        reliability: RELIABILITY.MEDIUM,
        readings: { n, p, k },
        note: t(
          lang,
          'Interpret with local guidance; AGRIO does not prescribe exact fertilizer quantities.',
          'स्थानीय मार्गदर्शन से व्याख्या करें; AGRIO सटीक उर्वरक मात्रा निर्धारित नहीं करता।'
        ),
      });
    }
  }

  return recs;
}

function derivePrevention({ visionIssues, humidity, cropProfile, hasHeatStress, lang }) {
  const prevention = [];
  const hasDisease = visionIssues.some((i) => i.category === CATEGORY.DISEASE);
  const hasPest = visionIssues.some((i) => i.category === CATEGORY.PEST || i.category === CATEGORY.PHYSICAL_DAMAGE);
  const humidHigh = humidity != null && humidity >= cropProfile.humidity.fungalRiskHigh;

  if (hasDisease || humidHigh) {
    prevention.push({
      title: t(lang, 'Reduce fungal spread', 'फफूंद प्रसार घटाएँ'),
      note: t(
        lang,
        'Improve canopy airflow and avoid overhead watering late in the day.',
        'कैनोपी वायु-संचार सुधारें और दिन के अंत में ऊपर से सिंचाई न करें।'
      ),
    });
  }
  if (hasPest) {
    prevention.push({
      title: t(lang, 'Contain pest pressure', 'कीट दबाव नियंत्रित करें'),
      note: t(
        lang,
        'Scout neighbouring plants, remove damaged leaves, and prefer targeted (not blanket) treatment.',
        'आस-पास के पौधे जाँचें, क्षतिग्रस्त पत्तियाँ हटाएँ, और लक्षित (न कि व्यापक) उपचार चुनें।'
      ),
    });
  }
  if (hasHeatStress) {
    prevention.push({
      title: t(lang, 'Buffer heat stress', 'गर्मी तनाव कम करें'),
      note: t(lang, 'Mulch to conserve soil moisture and moderate root-zone temperature.', 'मल्च से मृदा-नमी बचाएँ और जड़-क्षेत्र तापमान संतुलित रखें।'),
    });
  }
  return prevention;
}

const PRIORITY_RANK = { urgent: 4, high: 3, medium: 2, low: 1 };

// ── Main entry ───────────────────────────────────────────────────
/**
 * Fuse all signals into one normalized AGRIO advisory.
 *
 * @param {Object}  input
 * @param {Object}  [input.vision]       vision result (visionSchema shape) or null
 * @param {Object}  [input.telemetry]    TelemetrySnapshot or null
 * @param {Object}  [input.weather]      weatherService weatherData or null
 * @param {Object}  [input.cropProfile]  from getCropProfile(); defaults to generic
 * @param {string}  [input.zone]         'zoneA' | 'zoneB' | 'zoneC'
 * @param {string}  [input.lang]         'en' | 'hi'
 * @param {number}  [input.now]          epoch ms — injectable for determinism
 * @returns {Object} normalized advisory (see README block above)
 */
export function generateAdvisory({
  vision = null,
  telemetry = null,
  weather = null,
  cropProfile = DEFAULT_CROP_PROFILE,
  zone = 'field',
  lang = 'en',
  now = Date.now(),
} = {}) {
  const profile = cropProfile || DEFAULT_CROP_PROFILE;

  // ── Freshness / availability ──
  const weatherFresh = describeWeatherFreshness(weather, now);
  const telemetryFresh = describeTelemetryFreshness(telemetry, now);
  const visionFresh = describeVisionFreshness(vision, now);

  // ── Extract signals (no fabrication) ──
  const moistureValue = pickZoneMoisture(telemetry, zone);
  const rain = readRainOutlook(weather, now);
  // Prefer the on-board sensor for local microclimate; fall back to regional OWM.
  const temperature = telemetry
    ? numOrNull(telemetry.weather?.temperature)
    : numOrNull(weather?.current?.temperature);
  const humidity = telemetry
    ? numOrNull(telemetry.weather?.humidity)
    : numOrNull(weather?.current?.humidity);
  const tempSource = telemetry ? 'sensor' : weather?.current ? 'weather' : null;

  // ── Detection layer ──
  const visionProvided = !!vision && Array.isArray(vision.findings);
  const visionInconclusive = visionProvided && vision.overallStatus?.code === 'unknown';
  const visionUsable = visionProvided && !visionInconclusive;
  const visionIssues = mapVisionIssues(vision);
  const envIssues = deriveEnvIssues({ moistureValue, temperature, humidity, cropProfile: profile, zone, lang });
  const detectedIssues = [...visionIssues, ...envIssues];
  const hasHeatStress = envIssues.some((i) => i.source === 'environment:temperature' && i.severity === 'Moderate');

  // ── Recommendation layer ──
  const irrigation = assessIrrigation({
    moistureValue,
    cropProfile: profile,
    rain,
    weatherFresh,
    telemetryStale: telemetryFresh.available && telemetryFresh.stale,
    temperature,
    zone,
    lang,
  });
  const treatmentRecommendations = deriveTreatments(visionIssues, lang);
  const nutrientRecommendations = deriveNutrient(visionIssues, telemetry, lang);
  const preventionRecommendations = derivePrevention({ visionIssues, humidity, cropProfile: profile, hasHeatStress, lang });

  // ── Overall status (synthesis of everything) ──
  const actionableSeverities = detectedIssues.map((i) => i.severity);
  const worst = actionableSeverities.length ? worstSeverity(...actionableSeverities) : null;
  const noUsableSignal = !visionUsable && moistureValue == null && !(weather && weather.current);

  let statusCode;
  let statusSeverity;
  if (noUsableSignal) {
    statusCode = ADVISORY_STATUS.INSUFFICIENT_DATA;
    statusSeverity = 'Info';
  } else if ((worst && (SEVERITY[worst] >= SEVERITY.High)) || irrigation.state === IRRIGATION_STATE.REQUIRED) {
    statusCode = ADVISORY_STATUS.ACTION_NEEDED;
    statusSeverity = worst && SEVERITY[worst] >= SEVERITY.High ? worst : 'High';
  } else if (detectedIssues.length > 0 || irrigation.state === IRRIGATION_STATE.DELAY) {
    statusCode = ADVISORY_STATUS.MONITOR;
    statusSeverity = worst || 'Low';
  } else {
    statusCode = ADVISORY_STATUS.HEALTHY;
    statusSeverity = 'Low';
  }

  const overallStatus = {
    code: statusCode,
    severity: statusSeverity,
    headline: statusHeadline(statusCode, statusSeverity, lang),
    summary: buildSummary({ statusCode, visionUsable, visionProvided, visionInconclusive, detectedIssues, worst, irrigation, lang }),
  };

  // ── Next actions (prioritized, deduped by priority rank) ──
  const nextActions = buildNextActions({
    irrigation,
    treatmentRecommendations,
    nutrientRecommendations,
    visionIssueCount: visionIssues.length,
    visionInconclusive,
    weatherAvailable: weatherFresh.available,
    lang,
  });

  // ── Warnings (data gaps + honesty flags) ──
  const warnings = buildWarnings({
    telemetryFresh,
    weatherFresh,
    visionProvided,
    visionInconclusive,
    profile,
    nutrientRecommendations,
    treatmentRecommendations,
    lang,
  });

  // ── Data provenance ──
  const hasNpk = !!(telemetry?.soilNutrients || telemetry?.npk);
  const dataSources = [
    {
      key: 'vision',
      label: t(lang, 'Leaf scan', 'पत्ती स्कैन'),
      status: visionProvided ? (visionInconclusive ? 'inconclusive' : 'available') : 'absent',
      detail: visionProvided ? (vision.engine || 'unknown') : null,
    },
    {
      key: 'telemetry',
      label: t(lang, 'Field sensors (ESP32)', 'क्षेत्र सेंसर (ESP32)'),
      status: telemetryFresh.available ? (telemetryFresh.stale ? 'stale' : 'available') : 'absent',
      detail: telemetryFresh.available ? telemetryFresh.source : null,
    },
    {
      key: 'weather',
      label: t(lang, 'Weather', 'मौसम'),
      status: weatherFresh.available ? (weatherFresh.stale ? 'stale' : weatherFresh.live ? 'live' : 'cached') : 'absent',
      detail: weatherFresh.available ? `${weatherFresh.source} · ${weatherFresh.ageMinutes ?? '?'} min old` : null,
    },
    {
      key: 'soilNutrients',
      label: t(lang, 'Soil N-P-K', 'मृदा N-P-K'),
      status: hasNpk ? 'available' : 'absent',
      detail: hasNpk ? null : t(lang, 'no sensor channel', 'कोई सेंसर चैनल नहीं'),
    },
    {
      key: 'cropProfile',
      label: t(lang, 'Crop profile', 'फसल प्रोफ़ाइल'),
      status: 'available',
      detail: `${profile.cropName}${profile.isDemoDefault ? ' · demo defaults' : ''}`,
    },
  ];

  const dataFreshness = {
    vision: visionFresh,
    telemetry: telemetryFresh,
    weather: weatherFresh,
    tempSource,
  };

  return {
    version: '1.0',
    generatedAt: new Date(now).toISOString(),
    lang,
    zone,
    crop: {
      key: profile.cropKey,
      name: profile.cropName,
      growthStage: profile.growthStage,
      isDemoDefault: !!profile.isDemoDefault,
    },
    overallStatus,
    detectedIssues,
    treatmentRecommendations,
    nutrientRecommendations,
    irrigationRecommendation: irrigation,
    preventionRecommendations,
    nextActions,
    warnings,
    dataSources,
    dataFreshness,
  };
}

// ── Status text + synthesis helpers ──────────────────────────────
function statusHeadline(code, severity, lang) {
  const hi = lang === 'hi';
  switch (code) {
    case ADVISORY_STATUS.INSUFFICIENT_DATA:
      return hi ? 'अपर्याप्त डेटा — अधिक इनपुट चाहिए' : 'Insufficient data — more input needed';
    case ADVISORY_STATUS.ACTION_NEEDED:
      return hi ? 'कार्रवाई आवश्यक' : 'Action needed';
    case ADVISORY_STATUS.MONITOR:
      return hi ? 'निगरानी करें' : 'Monitor';
    default:
      return hi ? 'स्वस्थ — कोई कार्रवाई नहीं' : 'Healthy — no action needed';
  }
}

function buildSummary({ statusCode: _statusCode, visionUsable: _visionUsable, visionProvided, visionInconclusive, detectedIssues, worst, irrigation, lang }) {
  let visionPart;
  if (!visionProvided) {
    visionPart = t(lang, 'No leaf scan provided', 'कोई पत्ती स्कैन नहीं');
  } else if (visionInconclusive) {
    visionPart = t(lang, 'Leaf scan inconclusive', 'पत्ती स्कैन अनिर्णायक');
  } else if (detectedIssues.length > 0) {
    visionPart = t(lang, `${detectedIssues.length} issue(s) detected (worst: ${worst})`, `${detectedIssues.length} समस्या(एँ) पाई गईं (सबसे गंभीर: ${worst})`);
  } else {
    visionPart = t(lang, 'No crop-health issues detected', 'कोई फसल-स्वास्थ्य समस्या नहीं');
  }

  const irrigationLabel = {
    required: t(lang, 'irrigation required', 'सिंचाई आवश्यक'),
    not_required: t(lang, 'irrigation not required', 'सिंचाई आवश्यक नहीं'),
    delay: t(lang, 'delay irrigation (rain likely)', 'सिंचाई स्थगित (वर्षा संभावित)'),
    monitor: t(lang, 'soil moisture adequate', 'मृदा-नमी पर्याप्त'),
    insufficient_data: t(lang, 'no soil-moisture data', 'कोई मृदा-नमी डेटा नहीं'),
  }[irrigation.state];

  return `${visionPart}. ${irrigationLabel.charAt(0).toUpperCase()}${irrigationLabel.slice(1)}.`;
}

function buildNextActions({ irrigation, treatmentRecommendations, nutrientRecommendations, visionIssueCount, visionInconclusive, weatherAvailable, lang }) {
  const actions = [];

  if (irrigation.state === IRRIGATION_STATE.REQUIRED) {
    const urgent = irrigation.soilMoisture && irrigation.soilMoisture.value < irrigation.soilMoisture.criticalLow;
    actions.push({
      action: t(lang, 'Irrigate field', 'खेत की सिंचाई करें'),
      when: t(lang, 'now', 'अभी'),
      priority: urgent ? 'urgent' : 'high',
    });
  } else if (irrigation.state === IRRIGATION_STATE.DELAY) {
    actions.push({
      action: t(lang, 'Hold irrigation for field; re-check after rain', 'खेत की सिंचाई रोकें; वर्षा के बाद जाँचें'),
      when: t(lang, 'after forecast rain (~24h)', 'पूर्वानुमानित वर्षा के बाद (~24घं)'),
      priority: 'medium',
    });
  } else if (irrigation.state === IRRIGATION_STATE.INSUFFICIENT_DATA) {
    actions.push({
      action: t(lang, 'Connect the soil-moisture sensor', 'मृदा-नमी सेंसर जोड़ें'),
      when: t(lang, 'to enable irrigation guidance', 'सिंचाई मार्गदर्शन हेतु'),
      priority: 'medium',
    });
  }

  for (const tr of treatmentRecommendations) {
    actions.push({
      action: t(lang, `Treat: ${tr.title}`, `उपचार: ${tr.title}`),
      when: tr.priority === 'urgent' || tr.priority === 'high' ? t(lang, 'today', 'आज') : t(lang, 'within 48h', '48घं में'),
      priority: tr.priority,
    });
  }

  if (nutrientRecommendations.some((n) => n.source === 'image-visual')) {
    actions.push({
      action: t(lang, 'Confirm nutrient status with a soil test before fertilizing', 'उर्वरक से पहले मृदा जाँच से पोषक स्थिति की पुष्टि करें'),
      when: t(lang, 'before applying fertilizer', 'उर्वरक देने से पहले'),
      priority: 'medium',
    });
  }

  if (visionInconclusive) {
    actions.push({
      action: t(lang, 'Re-take a clearer leaf photo', 'स्पष्ट पत्ती फोटो पुनः लें'),
      when: t(lang, 'now', 'अभी'),
      priority: 'medium',
    });
  }

  if (visionIssueCount > 0) {
    actions.push({
      action: t(lang, 'Re-scan the affected area', 'प्रभावित क्षेत्र पुनः स्कैन करें'),
      when: t(lang, 'in 48 hours', '48 घंटे में'),
      priority: 'low',
    });
  }

  if (!weatherAvailable) {
    actions.push({
      action: t(lang, 'Enable weather (set location / API key)', 'मौसम सक्षम करें (स्थान / API कुंजी सेट करें)'),
      when: t(lang, 'to enable rain-aware timing', 'वर्षा-आधारित समय हेतु'),
      priority: 'low',
    });
  }

  return actions.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
}

function buildWarnings({ telemetryFresh, weatherFresh, visionProvided, visionInconclusive, profile, nutrientRecommendations, treatmentRecommendations, lang }) {
  const warnings = [];

  if (!telemetryFresh.available) {
    warnings.push({
      code: 'no_telemetry',
      severity: 'Low',
      message: t(lang, 'No live sensor data — irrigation and environmental advice are limited.', 'कोई लाइव सेंसर डेटा नहीं — सिंचाई व पर्यावरण सलाह सीमित।'),
    });
  } else if (telemetryFresh.stale) {
    warnings.push({
      code: 'stale_telemetry',
      severity: 'Low',
      message: t(lang, `Sensor data is ${telemetryFresh.ageMinutes ?? '?'} min old — check the connection.`, `सेंसर डेटा ${telemetryFresh.ageMinutes ?? '?'} मिनट पुराना — कनेक्शन जाँचें।`),
    });
  }

  if (!weatherFresh.available) {
    warnings.push({
      code: 'no_weather',
      severity: 'Low',
      message: t(lang, 'Weather unavailable — rain-aware irrigation timing is disabled.', 'मौसम अनुपलब्ध — वर्षा-आधारित सिंचाई समय बंद।'),
    });
  } else if (weatherFresh.stale) {
    warnings.push({
      code: 'stale_weather',
      severity: 'Low',
      message: t(lang, `Weather data is ${weatherFresh.ageMinutes ?? '?'} min old — rain-dependent advice may be unreliable.`, `मौसम डेटा ${weatherFresh.ageMinutes ?? '?'} मिनट पुराना — वर्षा-आधारित सलाह अविश्वसनीय हो सकती है।`),
    });
  }

  if (visionProvided && visionInconclusive) {
    warnings.push({
      code: 'vision_inconclusive',
      severity: 'Low',
      message: t(lang, 'Leaf scan was inconclusive — retake the photo for a reliable diagnosis.', 'पत्ती स्कैन अनिर्णायक — विश्वसनीय निदान हेतु फोटो पुनः लें।'),
    });
  }

  if (nutrientRecommendations.some((n) => n.source === 'image-visual')) {
    warnings.push({
      code: 'nutrient_visual_only',
      severity: 'Low',
      message: t(lang, 'Nutrient advice is from leaf appearance, not a soil test.', 'पोषक सलाह पत्ती की दिखावट से है, मृदा जाँच से नहीं।'),
    });
  }

  if (treatmentRecommendations.some((tr) => tr.basis === 'heuristic')) {
    warnings.push({
      code: 'heuristic_confidence',
      severity: 'Low',
      message: t(lang, 'On-device diagnosis is heuristic, not calibrated ML — verify before chemical use.', 'ऑन-डिवाइस निदान अनुमानित है, कैलिब्रेटेड ML नहीं — रासायनिक प्रयोग से पहले पुष्टि करें।'),
    });
  }

  if (profile.isDemoDefault) {
    warnings.push({
      code: 'demo_crop_thresholds',
      severity: 'Info',
      message: t(lang, 'Crop thresholds are demo defaults, not agronomist-calibrated.', 'फसल सीमाएँ डेमो डिफ़ॉल्ट हैं, कृषि-विशेषज्ञ द्वारा सत्यापित नहीं।'),
    });
  }

  return warnings;
}

export default generateAdvisory;
