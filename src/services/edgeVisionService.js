/**
 * AGRIO Edge Vision Service — on-device crop leaf analysis.
 *
 * Runs FULLY in the browser with zero network and zero dependencies, so it
 * works offline / on intermittent connectivity — the core edge-AI requirement
 * of the problem statement. It inspects the actual leaf pixels (HSV colour
 * segmentation + lesion / chlorosis / necrosis / dark-speckle ratios) to
 * estimate three health vectors:
 *   1. Disease        (rust, fungal leaf spot / blight, or healthy)
 *   2. Nutrient status (nitrogen / chlorosis)
 *   3. Pest pressure   (chewing damage / speckling)
 *
 * v2 is a deterministic classical-CV engine. Beyond HSV colour ratios it also
 * runs a lightweight spatial pass — enclosed background "gaps" (holes / chewed
 * notches / missing leaf area) and local value-contrast (texture) — so pest
 * chewing damage is caught even when it exposes the bright backdrop instead of
 * leaving dark pixels (the v1 blind spot). The async signature and output shape
 * intentionally match ./geminiService, so a trained TF.js / ONNX CNN can later
 * be dropped in behind analyzeLeafImageOnDevice() without touching the UI.
 *
 * @param {string} base64Data - Base64 image (with or without data URI prefix)
 * @param {string} lang - 'en' | 'hi'
 * @returns {Promise<Object>} same shape as geminiService.analyzeLeafImage
 */

import { CATEGORY, CONFIDENCE_BASIS, makeFinding, assembleResult } from './visionSchema';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const EDGE_SIZE = 160; // analysis raster; also the row width used by the spatial passes

/** Convert 8-bit RGB to HSV — h in [0,360), s & v in [0,1]. */
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

/** Load a base64 image and return its downscaled pixel buffer via canvas. */
function loadPixels(base64Data, size = EDGE_SIZE) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Edge vision requires a browser environment.'));
      return;
    }
    const src = base64Data.startsWith('data:')
      ? base64Data
      : `data:image/jpeg;base64,${base64Data}`;

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        resolve(ctx.getImageData(0, 0, size, size).data);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Could not load image for on-device analysis.'));
    img.src = src;
  });
}

/**
 * Segment leaf pixels into colour buckets AND run a spatial pass for pest damage.
 *
 * Colour buckets alone miss the commonest pest signature — holes and chewed
 * notches — because a hole exposes the bright backdrop, which we drop as
 * background. So we also measure:
 *   • holeRatio    — background pixels fully enclosed by leaf (row AND column),
 *                    i.e. interior holes / chewed notches / missing leaf area.
 *   • textureScore — mean local value-contrast among leaf pixels; chewing,
 *                    speckling and lesions all raise it above a smooth canopy.
 *
 * `data` is the row-major RGBA buffer from a size×size canvas.
 */
function segment(data, size = EDGE_SIZE) {
  const N = size * size;
  const label = new Uint8Array(N); // 0 bg · 1 green · 2 yellow · 3 brown · 4 rust · 5 dark
  const val = new Float32Array(N); // HSV value per leaf pixel (used for texture)
  let green = 0, yellow = 0, brown = 0, rust = 0, dark = 0, leaf = 0;

  // ── Pass 1: per-pixel colour classification ──
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const p = idx * 4;
      if (data[p + 3] < 32) continue; // transparent → background

      const [h, s, v] = rgbToHsv(data[p], data[p + 1], data[p + 2]);

      // Drop the near-white/grey or near-black backdrop common in leaf photos.
      // A leaf hole shows this bright backdrop through it — exactly the signal
      // the spatial pass below recovers, so dropping it as colour is fine.
      if ((s < 0.12 && v > 0.55) || v < 0.08) continue;

      val[idx] = v;
      leaf++;
      if (v < 0.18) { label[idx] = 5; dark++; continue; }                          // necrosis / bite marks / deep shadow
      if (h >= 65 && h <= 175 && s > 0.15) { label[idx] = 1; green++; continue; }  // healthy chlorophyll
      if (h >= 38 && h < 65 && s > 0.18) { label[idx] = 2; yellow++; continue; }   // chlorosis / yellowing
      if (h >= 8 && h < 38) {                                                       // orange → brown band
        if (s > 0.45 && v > 0.40) { label[idx] = 4; rust++; }                      // bright rust / orange pustule
        else { label[idx] = 3; brown++; }                                          // brown necrotic lesion
        continue;
      }
      // Dull / desaturated leaf tissue — count as structural green so it does
      // not silently dilute every ratio (a latent bug in v1's leaf++ counting).
      label[idx] = 1; green++;
    }
  }

  // ── Pass 2: enclosed-gap detection (holes / chewed notches) ──
  // A background pixel counts as damage only if it sits BETWEEN leaf pixels
  // both horizontally and vertically — enclosed by the leaf silhouette, not
  // part of the outer margin. This ignores serrated edges and the surrounding
  // backdrop while capturing true holes and interior chewing.
  const rowLo = new Int16Array(size).fill(-1);
  const rowHi = new Int16Array(size).fill(-1);
  const colLo = new Int16Array(size).fill(-1);
  const colHi = new Int16Array(size).fill(-1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (label[y * size + x] !== 0) {
        if (rowLo[y] < 0) rowLo[y] = x;
        rowHi[y] = x;
        if (colLo[x] < 0) colLo[x] = y;
        colHi[x] = y;
      }
    }
  }
  let gap = 0;
  for (let y = 0; y < size; y++) {
    if (rowLo[y] < 0 || rowHi[y] <= rowLo[y]) continue;
    for (let x = rowLo[y] + 1; x < rowHi[y]; x++) {
      if (label[y * size + x] !== 0) continue;
      if (colLo[x] >= 0 && y > colLo[x] && y < colHi[x]) gap++; // enclosed vertically too
    }
  }

  // ── Pass 3: local texture (mean neighbour value-contrast among leaf pixels) ──
  let texAccum = 0, texN = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (label[idx] === 0) continue;
      const c = val[idx];
      if (x + 1 < size && label[idx + 1] !== 0) { texAccum += Math.abs(c - val[idx + 1]); texN++; }
      if (y + 1 < size && label[idx + size] !== 0) { texAccum += Math.abs(c - val[idx + size]); texN++; }
    }
  }

  const denom = leaf || 1;
  const silhouette = leaf + gap;
  return {
    leaf,
    coverage: leaf / N,                        // fraction of the frame that is leaf
    greenRatio: green / denom,
    yellowRatio: yellow / denom,
    brownRatio: brown / denom,
    rustRatio: rust / denom,
    darkRatio: dark / denom,
    lesionRatio: (brown + rust) / denom,
    holeRatio: gap / (silhouette || 1),        // missing / chewed area vs. leaf silhouette
    textureScore: texN ? texAccum / texN : 0,  // 0 = smooth canopy, higher = damaged / speckled
  };
}

/** Turn segmentation ratios into a bilingual diagnostic report. */
function buildReport(r, lang) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const RANK = { Low: 0, Moderate: 1, High: 2, Critical: 3 };
  const NAME = ['Low', 'Moderate', 'High', 'Critical'];
  const worst = (...s) => NAME[Math.max(...s.map((x) => RANK[x] ?? 0))];

  // ---- Guard: not enough leaf in frame → ask for a better photo ----
  // Prevents a blank / far-away shot from being scored as a healthy green leaf.
  if (r.coverage < 0.04) {
    const flat = {
      disease: L('Leaf Not Clearly Detected', 'पत्ती स्पष्ट रूप से नहीं मिली'),
      confidence: 40,
      severity: 'Low',
      description: L(
        'The image did not contain a clear, close-up leaf. Fill the frame with a single leaf on a plain background.',
        'छवि में स्पष्ट, नज़दीकी पत्ती नहीं मिली। सादे बैकग्राउंड पर एक ही पत्ती से फ्रेम भरें।'
      ),
      treatment_steps: [
        L('1. Move closer so the leaf fills most of the frame.',
          '1. पास जाएँ ताकि पत्ती अधिकांश फ्रेम भर दे।'),
        L('2. Use even lighting and a plain background, then re-scan.',
          '2. एक समान रोशनी और सादा बैकग्राउंड रखें, फिर दोबारा स्कैन करें।'),
      ],
      nutrientDeficiency: {
        status: L('Not Assessed', 'आकलन नहीं हुआ'),
        confidence: 40,
        symptoms: L('Leaf area too small to assess.', 'आकलन हेतु पत्ती क्षेत्र बहुत छोटा है।'),
        recommendation: L('Re-scan a clear close-up of the leaf.', 'पत्ती की स्पष्ट नज़दीकी तस्वीर दोबारा स्कैन करें।'),
      },
      pestPressure: {
        status: L('Not Assessed', 'आकलन नहीं हुआ'),
        severity: 'Low',
        action: L('Re-scan a clear close-up of the leaf.', 'पत्ती की स्पष्ट नज़दीकी तस्वीर दोबारा स्कैन करें।'),
      },
      advisory: {
        sprayStatus: L('Spray Status: Re-scan Required', 'स्प्रे स्थिति: दोबारा स्कैन आवश्यक'),
        fertilizerAction: L('Fertilizer: Re-scan Required', 'उर्वरक: दोबारा स्कैन आवश्यक'),
        nextInspection: L('Next Inspection: Re-scan Now', 'अगला निरीक्षण: अभी दोबारा स्कैन करें'),
      },
      onDevice: true,
      engine: 'legacy-heuristic',
      engineLabel: L('Legacy Heuristic — On-device', 'लीगेसी ह्युरिस्टिक — डिवाइस पर'),
      demoNotice: L(
        '📱 Analyzed via legacy heuristic (on-device). Reconnect for a full cloud diagnosis.',
        '📱 लीगेसी ह्युरिस्टिक (डिवाइस पर) द्वारा विश्लेषण। पूर्ण क्लाउड निदान हेतु दोबारा कनेक्ट करें।'
      ),
    };

    // Insufficient evidence → an explicit UNKNOWN outcome. Never "healthy".
    const imageQuality = {
      code: 'insufficient',
      usable: false,
      coverage: round2(r.coverage),
      note: L('Leaf area too small or unclear to assess.',
        'आकलन हेतु पत्ती क्षेत्र बहुत छोटा या अस्पष्ट है।'),
    };
    const findings = [
      makeFinding({
        id: 'unknown-image',
        category: CATEGORY.UNKNOWN,
        title: flat.disease,
        severity: 'Info',
        confidence: 40,
        confidenceBasis: CONFIDENCE_BASIS.HEURISTIC,
        description: flat.description,
        recommendations: flat.treatment_steps,
        evidence: { coverage: round2(r.coverage) },
      }),
    ];
    return assembleResult({ flat, findings, imageQuality, engine: 'legacy-heuristic', onDevice: true, lang });
  }

  // ---- Combined pest signal ----
  // Holes / chewed notches (holeRatio) are the dominant pest signature and
  // matter even at small area, so they are weighted up; dark bite-marks
  // (darkRatio) and elevated texture (speckling / fine feeding) add to it.
  const pestSignal = clamp(
    Math.max(r.darkRatio, r.holeRatio * 1.6) + Math.max(0, r.textureScore - 0.13) * 0.7,
    0,
    1
  );
  const pestSeverity =
    pestSignal >= 0.18 ? 'Critical' :
    pestSignal >= 0.09 ? 'High' :
    pestSignal >= 0.04 ? 'Moderate' : 'Low';

  // ---- Health gate (now also blocked by holes / chewing / pest damage) ----
  const healthy =
    r.greenRatio >= 0.70 &&
    r.lesionRatio < 0.05 &&
    r.yellowRatio < 0.14 &&
    r.darkRatio < 0.06 &&
    r.holeRatio < 0.03 &&
    pestSignal < 0.04;

  const damage = Math.max(r.lesionRatio, r.darkRatio * 0.6);
  const diseaseSeverity = healthy
    ? 'Low'
    : damage > 0.45 ? 'Critical' : damage > 0.28 ? 'High' : damage > 0.12 ? 'Moderate' : 'Low';

  // ---- Disease vector ----
  let disease, description, treatment_steps, confidence;
  if (healthy) {
    disease = L('Healthy Leaf — No Disease Detected', 'स्वस्थ पत्ती — कोई रोग नहीं मिला');
    confidence = round1(clamp(72 + r.greenRatio * 23, 72, 96));
    description = L(
      'Uniform green canopy detected on-device; no lesions, holes or pustules found.',
      'डिवाइस पर एक समान हरी पत्ती मिली; कोई घाव, छेद या फफोले नहीं मिले।'
    );
    treatment_steps = [
      L('1. Maintain regular irrigation and balanced crop nutrition.',
        '1. नियमित सिंचाई और संतुलित फसल पोषण जारी रखें।'),
      L('2. Continue routine field scouting every 3–5 days.',
        '2. हर 3–5 दिन में नियमित खेत निरीक्षण जारी रखें।'),
    ];
  } else if (r.rustRatio >= 0.06 && r.rustRatio >= r.brownRatio) {
    disease = L('Leaf Rust (fungal) — orange pustules', 'पत्ती रतुआ (फफूंद) — नारंगी फफोले');
    confidence = round1(clamp(62 + r.rustRatio * 130, 62, 90));
    description = L(
      'Orange/yellow rust-coloured pustules detected across the leaf surface.',
      'पत्ती की सतह पर नारंगी/पीले रतुआ रंग के फफोले पाए गए।'
    );
    treatment_steps = [
      L('1. Inspect affected leaves and follow crop-specific local extension guidance.',
        '1. प्रभावित पत्तियों का निरीक्षण करें और स्थानीय कृषि विस्तार मार्गदर्शन का पालन करें।'),
      L('2. Improve field drainage to reduce leaf-surface humidity.',
        '2. पत्ती की सतह की नमी घटाने हेतु खेत जल निकासी सुधारें।'),
      L('3. Re-inspect the surrounding 50 m within 48 hours.',
        '3. 48 घंटों में आसपास के 50 मीटर क्षेत्र की पुनः जाँच करें।'),
    ];
  } else if (r.lesionRatio >= 0.06) {
    disease = L('Fungal Leaf Spot / Blight', 'फफूंद पत्ती धब्बा / झुलसा');
    confidence = round1(clamp(60 + r.lesionRatio * 110, 60, 90));
    description = L(
      'Brown necrotic lesions detected — typical of fungal leaf spot or early blight.',
      'भूरे परिगलित घाव मिले — फफूंद पत्ती धब्बा या प्रारंभिक झुलसा के विशिष्ट लक्षण।'
    );
    treatment_steps = [
      L('1. Inspect affected leaves; destroy severely infected leaf debris where appropriate.',
        '1. प्रभावित पत्तियों का निरीक्षण करें; जहाँ उचित हो अत्यधिक संक्रमित पत्तियाँ नष्ट करें।'),
      L('2. Follow crop-specific local extension guidance and the product label.',
        '2. फसल-विशिष्ट स्थानीय कृषि विस्तार मार्गदर्शन और उत्पाद लेबल का पालन करें।'),
      L('3. Avoid overhead irrigation; keep foliage dry where possible.',
        '3. ऊपर से सिंचाई से बचें; पत्तियों को यथासंभव सूखा रखें।'),
    ];
  } else if (pestSignal >= 0.04) {
    // Damage present but no fungal colour signature → mechanical / pest feeding.
    disease = L('No Fungal Disease — Pest / Mechanical Leaf Damage',
      'कोई फफूंद रोग नहीं — कीट / यांत्रिक पत्ती क्षति');
    confidence = round1(clamp(60 + pestSignal * 120, 60, 90));
    description = L(
      'Holes, chewed notches or missing leaf area detected — consistent with pest feeding rather than fungal infection.',
      'पत्ती में छेद, कुतरे किनारे या गायब हिस्सा मिला — यह फफूंद संक्रमण नहीं बल्कि कीट भक्षण जैसा प्रतीत होता है।'
    );
    treatment_steps = [
      L('1. Scout leaf undersides for caterpillars / beetles and egg masses.',
        '1. पत्तियों के नीचे इल्ली/भृंग और अंडों के समूह की जाँच करें।'),
      L('2. Follow crop-specific extension guidance and the product label for targeted treatment.',
        '2. लक्षित उपचार हेतु फसल-विशिष्ट विस्तार मार्गदर्शन और उत्पाद लेबल का पालन करें।'),
      L('3. Remove badly damaged leaves and re-inspect within 48 hours.',
        '3. अत्यधिक क्षतिग्रस्त पत्तियाँ हटाएँ और 48 घंटों में पुनः जाँच करें।'),
    ];
  } else {
    disease = L('Minor Leaf Stress — early symptoms', 'हल्का पत्ती तनाव — प्रारंभिक लक्षण');
    confidence = round1(clamp(58 + damage * 90, 58, 82));
    description = L(
      'Slight discolouration detected; no strong disease signature on-device.',
      'हल्की रंगहीनता मिली; डिवाइस पर रोग का स्पष्ट संकेत नहीं मिला।'
    );
    treatment_steps = [
      L('1. Re-scan a clear, well-lit close-up of the affected leaf.',
        '1. प्रभावित पत्ती की स्पष्ट, अच्छी रोशनी वाली नज़दीकी तस्वीर दोबारा स्कैन करें।'),
      L('2. Monitor the plot and re-inspect within 48 hours.',
        '2. खेत की निगरानी करें और 48 घंटों में पुनः जाँच करें।'),
    ];
  }

  // ---- Nutrient vector ----
  let nutrientDeficiency;
  if (r.yellowRatio >= 0.18) {
    nutrientDeficiency = {
      status: L('Nitrogen (N) Deficiency — Interveinal Chlorosis',
        'नाइट्रोजन (N) की कमी — शिराओं के बीच पीलापन'),
      confidence: round1(clamp(60 + r.yellowRatio * 100, 60, 90)),
      symptoms: L('Widespread yellowing of foliage detected on-device.',
        'डिवाइस पर पत्तियों में व्यापक पीलापन पाया गया।'),
      recommendation: L('Monitor foliage and consult soil test results before applying nitrogen.',
        'पत्तियों की निगरानी करें और नाइट्रोजन देने से पहले मृदा परीक्षण की सलाह लें।'),
    };
  } else if (r.yellowRatio >= 0.08) {
    nutrientDeficiency = {
      status: L('Mild Chlorosis — possible N/S deficiency',
        'हल्का क्लोरोसिस — संभावित N/S की कमी'),
      confidence: round1(clamp(55 + r.yellowRatio * 90, 55, 82)),
      symptoms: L('Patchy pale-green areas on some leaves.',
        'कुछ पत्तियों पर हल्के हरे धब्बेदार क्षेत्र।'),
      recommendation: L('Apply balanced NPK and confirm with a soil test.',
        'संतुलित एनपीके दें और मृदा परीक्षण से पुष्टि करें।'),
    };
  } else {
    nutrientDeficiency = {
      status: L('Nutrient Levels: Optimal', 'पोषक तत्व स्तर: अनुकूल'),
      confidence: round1(clamp(70 + r.greenRatio * 20, 70, 93)),
      symptoms: L('No visible deficiency symptoms observed.',
        'कोई दृश्य कमी लक्षण नहीं देखा गया।'),
      recommendation: L('Maintain balanced NPK fertigation schedule.',
        'संतुलित एनपीके फर्टिगेशन कार्यक्रम बनाए रखें।'),
    };
  }

  // ---- Pest vector (driven by the combined pestSignal, not darkRatio alone) ----
  let pestPressure;
  if (pestSeverity === 'Critical') {
    pestPressure = {
      status: L('Heavy Pest Activity — holes / chewing / speckling detected',
        'भारी कीट गतिविधि — छेद / कुतरना / धब्बे पाए गए'),
      severity: 'Critical',
      action: L('Scout immediately; remove badly damaged leaves and follow local extension recommendations.',
        'तुरंत निरीक्षण करें; अत्यधिक क्षतिग्रस्त पत्तियाँ हटाएँ और स्थानीय विस्तार सिफारिशों का पालन करें।'),
    };
  } else if (pestSeverity === 'High') {
    pestPressure = {
      status: L('Significant Pest Damage — holes / chewing detected',
        'महत्वपूर्ण कीट क्षति — छेद / कुतरना पाया गया'),
      severity: 'High',
      action: L('Scout leaf undersides for larvae; follow crop-specific extension guidance and the product label.',
        'पत्तियों के नीचे लार्वा की जाँच करें; फसल-विशिष्ट विस्तार मार्गदर्शन और उत्पाद लेबल का पालन करें।'),
    };
  } else if (pestSeverity === 'Moderate') {
    pestPressure = {
      status: L('Moderate Pest Pressure — early chewing / speckling',
        'मध्यम कीट दबाव — प्रारंभिक कुतरना / धब्बे'),
      severity: 'Moderate',
      action: L('Inspect leaf undersides and monitor closely; avoid blanket pesticide use.',
        'पत्तियों के निचले हिस्से की जाँच करें और बारीकी से निगरानी करें; अंधाधुंध कीटनाशक से बचें।'),
    };
  } else if (pestSignal >= 0.015) {
    pestPressure = {
      status: L('Low Pest Pressure — monitor', 'कम कीट दबाव — निगरानी करें'),
      severity: 'Low',
      action: L('Set up yellow sticky traps and re-scan in 3 days.',
        'पीले चिपचिपे ट्रैप लगाएं और 3 दिन में दोबारा स्कैन करें।'),
    };
  } else {
    pestPressure = {
      status: L('None Detected', 'कोई कीट नहीं पाया गया'),
      severity: 'Low',
      action: L('Maintain routine plot inspection.', 'नियमित खेत निरीक्षण जारी रखें।'),
    };
  }

  // ---- Overall severity = worst of disease & pest ----
  // Heuristic never claims clinical 'High' unless supported by multiple severe signals
  const rawSeverity = worst(diseaseSeverity, pestSeverity);
  const severity = (diseaseSeverity === 'High' && pestSeverity === 'High')
    ? 'High'
    : (rawSeverity === 'High' || rawSeverity === 'Critical')
      ? 'Moderate'
      : rawSeverity;

  const severityLabel = (diseaseSeverity === 'High' && pestSeverity === 'High')
    ? L('High concern', 'गंभीर चिंता')
    : (damage > 0.28 || pestSignal >= 0.09)
      ? L('Moderate concern', 'मध्यम चिंता')
      : (damage > 0.12 || pestSignal >= 0.04)
        ? L('Attention', 'ध्यान दें')
        : L('Monitor', 'निगरानी');

  // ---- Actionable advisory ----
  const needsSpray =
    severity === 'Moderate' || severity === 'High' || severity === 'Critical' ||
    pestPressure.severity === 'Moderate' || pestPressure.severity === 'High' ||
    pestPressure.severity === 'Critical';

  const fertilizerAction = r.yellowRatio >= 0.18
    ? L('Fertilizer: Consult Soil Test', 'उर्वरक: मृदा परीक्षण की सलाह लें')
    : r.yellowRatio >= 0.08
      ? L('Fertilizer: Balanced Nutrition + Soil Test', 'उर्वरक: संतुलित पोषण + मृदा परीक्षण')
      : L('Fertilizer: Maintain Standard Nutrition', 'उर्वरक: मानक पोषण बनाए रखें');

  const nextInspection = severity === 'High' || severity === 'Critical'
    ? L('Next Inspection: 24 Hours', 'अगला निरीक्षण: 24 घंटे')
    : severity === 'Moderate'
      ? L('Next Inspection: 48 Hours', 'अगला निरीक्षण: 48 घंटे')
      : L('Next Inspection: 5 Days', 'अगला निरीक्षण: 5 दिन');

  const advisory = {
    sprayStatus: needsSpray
      ? L('Spray Status: Verify Diagnosis First', 'स्प्रे स्थिति: पहले निदान सत्यापित करें')
      : L('Spray Status: Preventive Only', 'स्प्रे स्थिति: केवल निवारक'),
    fertilizerAction,
    nextInspection,
  };

  // ---- Flat contract (Dashboard / diagnosis views read these) ----
  const flat = {
    disease,
    confidence,
    severity,
    severityLabel,
    evidenceStrength: 'Moderate',
    description,
    treatment_steps,
    nutrientDeficiency,
    pestPressure,
    advisory,
    onDevice: true,
    engine: 'legacy-heuristic',
    engineLabel: L('Legacy Heuristic — On-device', 'लीगेसी ह्युरिस्टिक — डिवाइस पर'),
    demoNotice: L(
      '📱 Analyzed via legacy heuristic (on-device). Reconnect for a full cloud diagnosis.',
      '📱 लीगेसी ह्युरिस्टिक (डिवाइस पर) द्वारा विश्लेषण। पूर्ण क्लाउड निदान हेतु दोबारा कनेक्ट करें।'
    ),
  };

  // ---- Structured findings[] (same signals as the flat vectors, made explicit) ----
  // A single leaf can carry several at once — a disease AND pest damage AND a
  // nutrient symptom — so findings is an array, not one label. Every edge finding
  // is `confidenceBasis: 'heuristic'` and carries the raw ratios in `evidence`.
  const HEUR = CONFIDENCE_BASIS.HEURISTIC;
  const findings = [];

  // Primary vector — mirrors the disease if/else chain above, so the categories
  // stay in lock-step with the flat `disease` string.
  let primaryCategory;
  if (healthy) {
    primaryCategory = CATEGORY.HEALTHY; // healthy finding appended last, only if nothing else fired
  } else if (r.rustRatio >= 0.06 && r.rustRatio >= r.brownRatio) {
    primaryCategory = CATEGORY.DISEASE;
    findings.push(makeFinding({
      id: 'disease-rust', category: CATEGORY.DISEASE, title: disease,
      severity: diseaseSeverity, confidence, confidenceBasis: HEUR,
      description, recommendations: treatment_steps,
      evidence: { rustRatio: round2(r.rustRatio), lesionRatio: round2(r.lesionRatio), greenRatio: round2(r.greenRatio) },
    }));
  } else if (r.lesionRatio >= 0.06) {
    primaryCategory = CATEGORY.DISEASE;
    findings.push(makeFinding({
      id: 'disease-fungal', category: CATEGORY.DISEASE, title: disease,
      severity: diseaseSeverity, confidence, confidenceBasis: HEUR,
      description, recommendations: treatment_steps,
      evidence: { lesionRatio: round2(r.lesionRatio), brownRatio: round2(r.brownRatio) },
    }));
  } else if (pestSignal >= 0.04) {
    // Damage with no fungal colour signature → pest / mechanical (schema also
    // has a distinct PHYSICAL_DAMAGE category for engines that can separate them).
    primaryCategory = CATEGORY.PEST;
    findings.push(makeFinding({
      id: 'pest-damage', category: CATEGORY.PEST, title: disease,
      severity: pestSeverity, confidence, confidenceBasis: HEUR,
      description, recommendations: treatment_steps,
      evidence: { holeRatio: round2(r.holeRatio), darkRatio: round2(r.darkRatio), textureScore: round2(r.textureScore), pestSignal: round2(pestSignal) },
    }));
  } else {
    // Discolouration but no strong signature → explicit LOW-CONFIDENCE outcome,
    // not "healthy". Category 'stress' (image is usable; evidence is just weak).
    primaryCategory = CATEGORY.STRESS;
    findings.push(makeFinding({
      id: 'stress-low-confidence', category: CATEGORY.STRESS, title: disease,
      severity: 'Low', confidence, confidenceBasis: HEUR,
      description, recommendations: treatment_steps,
      evidence: { greenRatio: round2(r.greenRatio), yellowRatio: round2(r.yellowRatio), lesionRatio: round2(r.lesionRatio), pestSignal: round2(pestSignal) },
    }));
  }

  // Secondary vector — nutrient (co-occurs with any of the above).
  if (r.yellowRatio >= 0.08) {
    findings.push(makeFinding({
      id: 'nutrient-chlorosis', category: CATEGORY.NUTRIENT, title: nutrientDeficiency.status,
      severity: r.yellowRatio >= 0.18 ? 'Moderate' : 'Low',
      confidence: nutrientDeficiency.confidence, confidenceBasis: HEUR,
      description: nutrientDeficiency.symptoms, recommendations: [nutrientDeficiency.recommendation],
      evidence: { yellowRatio: round2(r.yellowRatio), greenRatio: round2(r.greenRatio) },
    }));
  }

  // Secondary vector — pest pressure alongside a disease/nutrient primary (skip
  // when pest damage is already the primary finding, to avoid double-counting).
  if (primaryCategory !== CATEGORY.PEST && pestSeverity !== 'Low') {
    findings.push(makeFinding({
      id: 'pest-pressure', category: CATEGORY.PEST, title: pestPressure.status,
      severity: pestPressure.severity,
      confidence: round1(clamp(55 + pestSignal * 130, 55, 88)), confidenceBasis: HEUR,
      description: pestPressure.status, recommendations: [pestPressure.action],
      evidence: { holeRatio: round2(r.holeRatio), darkRatio: round2(r.darkRatio), textureScore: round2(r.textureScore), pestSignal: round2(pestSignal) },
    }));
  }

  // Nothing flagged → a single healthy finding.
  if (findings.length === 0) {
    findings.push(makeFinding({
      id: 'healthy', category: CATEGORY.HEALTHY, title: disease,
      severity: 'Info', confidence, confidenceBasis: HEUR,
      description, recommendations: treatment_steps,
      evidence: { greenRatio: round2(r.greenRatio), lesionRatio: round2(r.lesionRatio), holeRatio: round2(r.holeRatio) },
    }));
  }

  const imageQuality = {
    code: r.coverage >= 0.12 ? 'ok' : 'low',
    usable: true,
    coverage: round2(r.coverage),
    note: r.coverage >= 0.12
      ? L('Leaf clearly detected in frame.', 'फ्रेम में पत्ती स्पष्ट रूप से मिली।')
      : L('Leaf is small in frame — results may be less reliable.',
          'फ्रेम में पत्ती छोटी है — परिणाम कम विश्वसनीय हो सकते हैं।'),
  };

  return assembleResult({ flat, findings, imageQuality, engine: 'legacy-heuristic', onDevice: true, lang });
}

export { buildReport };

export function runHeuristicDiagnosis(ratios, cropName = null, lang = 'en') {
  const result = buildReport(ratios, lang);
  if (cropName && result) {
    result.cropName = cropName;
  }
  return result;
}

export async function analyzeLeafImageOnDevice(base64Data, lang = 'en') {
  const pixels = await loadPixels(base64Data);
  const ratios = segment(pixels, EDGE_SIZE);
  return buildReport(ratios, lang);
}
