/**
 * AGRIO Vision Guard Service — CropGuard safety-guardrail layer.
 *
 * Orchestrates the full CropGuard inference pipeline with strict safety:
 *
 *   Camera → imageValidation → cropValidation → ONNX inference →
 *   temperature scaling → probability analysis → crop compatibility →
 *   acceptance policy → visionSchema result
 *
 * KEY SAFETY PRINCIPLE:
 *   CropGuard is a closed-set classifier. It WILL produce logits for ANY image
 *   (cars, buildings, non-leaf objects). Confidence alone is NOT sufficient to
 *   accept a prediction. Multiple guardrails must pass before a result is shown.
 *
 * When guardrails reject:
 *   category = "unknown", guardrailStatus = "abstained"
 *   The rejected model label is NEVER shown to the user.
 *
 * All thresholds are configurable engineering safeguards — NOT scientifically
 * calibrated. They should be tuned with validation data as it becomes available.
 */

import { MODEL_META } from './onnxModelMeta.js';
import {
  getClassByIndex,
  SUPPORTED_CROPS,
  CROP_CLASS_INDICES,
} from './onnxLabels.js';
import {
  runOnnxInference,
  preprocessImage,
  extractImageMetrics,
  getOnnxModelReadiness,
} from './onnxVisionService.js';
import {
  CATEGORY,
  CONFIDENCE_BASIS,
  makeFinding,
  assembleResult,
} from './visionSchema.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURABLE SAFETY THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════════
//
// These are AGRIO operating safeguards, not scientifically calibrated values.
// They should be tuned using real-world validation data.

/** Minimum temperature-scaled probability to accept top-1 prediction. */
const CONFIDENCE_FLOOR = 0.55;

/** Minimum gap between top-1 and top-2 probability. */
const MARGIN_MINIMUM = 0.10;

/** Maximum predictive entropy (bits). Higher = more uncertain. */
const ENTROPY_CEILING = 2.5;

/** Minimum image dimension (pixels). */
const MIN_IMAGE_DIM = 64;

/** Mean brightness below this → too dark. */
const MIN_BRIGHTNESS = 25;

/** Mean brightness above this → too bright / washed out. */
const MAX_BRIGHTNESS = 235;

/** Brightness variance below this → image is nearly uniform (not a photo). */
const MIN_VARIANCE = 100;

/** Fraction of dark pixels above which → image is mostly black. */
const MAX_DARK_RATIO = 0.70;

/** Fraction of very bright pixels above which → image is washed out. */
const MAX_BRIGHT_RATIO = 0.70;

/** Fraction of uniform pixels above which → image is a blank/solid surface. */
const MAX_UNIFORM_RATIO = 0.80;

// ═══════════════════════════════════════════════════════════════════════════════
// CROP KEY NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize a user-facing crop name to a CropGuard crop key.
 * Must handle AGRIO's emoji-suffixed names, synonyms, and casing.
 *
 * @param {string} cropName  e.g. 'Tomato 🍅', 'Grape', 'Bell Pepper', 'Corn'
 * @returns {string|null}    Normalized key or null if unrecognized
 */
export function normalizeToCropGuardKey(cropName) {
  if (!cropName) return null;
  const slug = String(cropName)
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!slug) return null;

  // Direct matches
  for (const key of SUPPORTED_CROPS) {
    if (slug.includes(key)) return key;
  }

  // Synonyms / alternate names
  if (slug.includes('maize')) return 'corn';
  if (slug.includes('bellpepper') || slug.includes('capsicum') || slug.includes('shimla')) return 'pepper';
  if (slug.includes('citrus') || slug.includes('lemon') || slug.includes('lime')) return 'orange';
  if (slug.includes('brinjal') || slug.includes('eggplant')) return null; // not supported
  if (slug.includes('wheat') || slug.includes('rice') || slug.includes('mustard') || slug.includes('cotton')) return null;

  return null;
}

/**
 * Check if a crop is supported by CropGuard.
 * @param {string} cropName
 * @returns {boolean}
 */
export function isCropSupported(cropName) {
  return normalizeToCropGuardKey(cropName) !== null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROBABILITY MATH
// ═══════════════════════════════════════════════════════════════════════════════

/** Stable softmax over an array of logits. */
function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Apply temperature scaling: scaled = logit / T. */
function temperatureScale(logits, T) {
  return logits.map((l) => l / T);
}

/** Shannon entropy in bits. */
function entropy(probabilities) {
  let h = 0;
  for (const p of probabilities) {
    if (p > 1e-10) h -= p * Math.log2(p);
  }
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the CropGuard vision guard pipeline on a leaf image.
 *
 * Returns a visionSchema-compatible result (flat + findings[] + overallStatus)
 * that can be consumed by LeafDiagnosticCard, advisoryService, and riskService.
 *
 * @param {string} base64Data  Base64 image (with or without data URI prefix)
 * @param {string} cropName    The user's selected/active crop name
 * @param {string} lang        'en' | 'hi'
 * @returns {Promise<Object>}  visionSchema result
 */
export async function analyzeWithCropGuard(base64Data, cropName, lang = 'en', _deps = {}) {
  const {
    getReadiness = getOnnxModelReadiness,
    extractMetrics = extractImageMetrics,
    preprocess = preprocessImage,
    runInference = runOnnxInference,
  } = _deps;
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const cropKey = normalizeToCropGuardKey(cropName);

  // ── Guard 1: Supported crop ─────────────────────────────────────────────
  if (!cropKey) {
    return buildAbstainResult({
      reason: 'unsupported_crop',
      message: L(
        'Offline AI does not currently support this crop. Use cloud AI for diagnosis.',
        'ऑफ़लाइन AI वर्तमान में इस फसल का समर्थन नहीं करता। निदान के लिए क्लाउड AI का उपयोग करें।'
      ),
      supportedCrop: false,
      lang,
    });
  }

  // ── Guard 2: Model availability ─────────────────────────────────────────
  const readiness = getReadiness();
  if (readiness === 'unavailable' || readiness === 'error') {
    throw new Error(`CropGuard model ${readiness} — cannot run inference.`);
  }

  // ── Guard 3: Image quality ──────────────────────────────────────────────
  let metrics;
  try {
    metrics = await extractMetrics(base64Data);
  } catch (err) {
    return buildAbstainResult({
      reason: 'non_leaf_or_invalid_image',
      message: L(
        'Could not process this image. Please use a clear photo.',
        'इस छवि को संसाधित नहीं किया जा सका। कृपया स्पष्ट फ़ोटो का उपयोग करें।'
      ),
      supportedCrop: true,
      lang,
    });
  }

  const qualityCheck = checkImageQuality(metrics, lang);
  if (!qualityCheck.passed) {
    return buildAbstainResult({
      reason: qualityCheck.reason,
      message: qualityCheck.message,
      imageQuality: qualityCheck.details,
      supportedCrop: true,
      lang,
    });
  }

  // ── Run CropGuard inference ─────────────────────────────────────────────
  let rawLogits;
  try {
    const tensor = await preprocess(base64Data);
    rawLogits = await runInference(tensor);
  } catch (err) {
    console.error('[VisionGuard] ONNX inference failed:', err);
    return buildAbstainResult({
      reason: 'model_error',
      message: L(
        'On-device model encountered an error. Try cloud AI or retake photo.',
        'डिवाइस मॉडल में त्रुटि आई। क्लाउड AI आज़माएं या दोबारा फ़ोटो लें।'
      ),
      supportedCrop: true,
      lang,
    });
  }

  // ── Validate model output ───────────────────────────────────────────────
  if (!rawLogits || rawLogits.length !== MODEL_META.output.numClasses) {
    return buildAbstainResult({
      reason: 'model_error',
      message: L(
        'Model produced unexpected output. Please retry.',
        'मॉडल ने अप्रत्याशित आउटपुट दिया। कृपया पुनः प्रयास करें।'
      ),
      supportedCrop: true,
      lang,
    });
  }

  // Check for NaN/Infinity in logits
  const logitsArray = Array.from(rawLogits);
  if (logitsArray.some((v) => !isFinite(v))) {
    return buildAbstainResult({
      reason: 'model_error',
      message: L(
        'Model produced invalid values. Please retry with a different image.',
        'मॉडल ने अमान्य मान दिए। कृपया अलग छवि के साथ पुनः प्रयास करें।'
      ),
      supportedCrop: true,
      lang,
    });
  }

  // ── Temperature scaling + softmax ───────────────────────────────────────
  const T = MODEL_META.temperature;
  const scaledLogits = temperatureScale(logitsArray, T);
  const probabilities = softmax(scaledLogits);

  // ── Top-K analysis ──────────────────────────────────────────────────────
  const indexed = probabilities.map((p, i) => ({ index: i, probability: p }));
  indexed.sort((a, b) => b.probability - a.probability);

  const top1 = indexed[0];
  const top2 = indexed[1];
  const margin = top1.probability - top2.probability;
  const H = entropy(probabilities);

  const topPredictions = indexed.slice(0, 5).map((pred) => {
    const cls = getClassByIndex(pred.index);
    return {
      index: pred.index,
      classId: cls?.id || `unknown_${pred.index}`,
      label: cls?.label?.[lang === 'hi' ? 'hi' : 'en'] || `Class ${pred.index}`,
      crop: cls?.crop || 'Unknown',
      category: cls?.category || 'unknown',
      probability: Math.round(pred.probability * 10000) / 10000,
    };
  });

  const top1Class = getClassByIndex(top1.index);

  // ── Multi-Gate Acceptance Policy ─────────────────────────────────────────
  const failedReasons = [];
  let primaryMessage = null;

  // Guard 4: Confidence floor
  if (top1.probability < CONFIDENCE_FLOOR) {
    failedReasons.push('low_model_confidence');
    primaryMessage = primaryMessage || L(
      'Model confidence is too low to provide a reliable diagnosis. Try a clearer, well-lit close-up.',
      'मॉडल विश्वास विश्वसनीय निदान के लिए बहुत कम है। स्पष्ट, अच्छी रोशनी वाली नज़दीकी तस्वीर लें।'
    );
  }

  // Guard 5 & 6: Ambiguous prediction / high entropy
  if (margin < MARGIN_MINIMUM || H > ENTROPY_CEILING) {
    failedReasons.push('ambiguous_prediction');
    primaryMessage = primaryMessage || L(
      'Model is uncertain between multiple diagnoses. Try a different angle or better lighting.',
      'मॉडल कई निदानों के बीच अनिश्चित है। अलग कोण या बेहतर रोशनी से प्रयास करें।'
    );
  }

  // Guard 7: Crop compatibility
  const validIndices = CROP_CLASS_INDICES[cropKey] || [];
  if (!validIndices.includes(top1.index)) {
    failedReasons.push('crop_prediction_mismatch');
    primaryMessage = primaryMessage || L(
      `Model prediction does not match the selected crop (${cropName}). Verify the crop selection or retake the photo.`,
      `मॉडल भविष्यवाणी चयनित फसल (${cropName}) से मेल नहीं खाती। फसल चयन सत्यापित करें या दोबारा फ़ोटो लें।`
    );
  }

  if (failedReasons.length > 0) {
    return buildAbstainResult({
      reasons: failedReasons,
      reason: failedReasons[0],
      message: primaryMessage,
      confidence: Math.round(top1.probability * 100),
      topPredictions,
      imageQuality: qualityCheck.details,
      supportedCrop: true,
      lang,
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ALL GUARDRAILS PASSED — build accepted result
  // ═════════════════════════════════════════════════════════════════════════

  return buildAcceptedResult({
    top1Class,
    confidence: Math.round(top1.probability * 100),
    topPredictions,
    imageQuality: qualityCheck.details,
    cropName,
    lang,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE QUALITY CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run conservative image quality checks.
 * These are NOT formal computer-vision leaf segmentation — they are
 * conservative guardrails to reject obviously invalid images.
 */
function checkImageQuality(metrics, lang) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const details = {
    width: metrics.width,
    height: metrics.height,
    meanBrightness: metrics.meanBrightness,
    brightnessVariance: metrics.brightnessVariance,
    greenRatio: metrics.greenRatio,
    usable: true,
    code: 'ok',
  };

  // Too small
  if (metrics.width < MIN_IMAGE_DIM || metrics.height < MIN_IMAGE_DIM) {
    return {
      passed: false,
      reason: 'poor_image_quality',
      message: L('Image is too small. Use a higher resolution photo.', 'छवि बहुत छोटी है। उच्च रिज़ॉल्यूशन फ़ोटो का उपयोग करें।'),
      details: { ...details, usable: false, code: 'too_small' },
    };
  }

  // Too dark
  if (metrics.meanBrightness < MIN_BRIGHTNESS || metrics.darkRatio > MAX_DARK_RATIO) {
    return {
      passed: false,
      reason: 'poor_image_quality',
      message: L('Image is too dark. Use better lighting.', 'छवि बहुत अंधेरी है। बेहतर रोशनी का उपयोग करें।'),
      details: { ...details, usable: false, code: 'too_dark' },
    };
  }

  // Too bright
  if (metrics.meanBrightness > MAX_BRIGHTNESS || metrics.brightRatio > MAX_BRIGHT_RATIO) {
    return {
      passed: false,
      reason: 'poor_image_quality',
      message: L('Image is overexposed. Reduce brightness or avoid direct sunlight.', 'छवि अति-उजागर है। चमक कम करें या सीधी धूप से बचें।'),
      details: { ...details, usable: false, code: 'too_bright' },
    };
  }

  // Uniform / blank surface
  if (metrics.brightnessVariance < MIN_VARIANCE || metrics.uniformRatio > MAX_UNIFORM_RATIO) {
    return {
      passed: false,
      reason: 'non_leaf_or_invalid_image',
      message: L('Image appears to be a blank or uniform surface. Take a photo of a leaf.', 'छवि एक खाली या समान सतह प्रतीत होती है। पत्ती की फ़ोटो लें।'),
      details: { ...details, usable: false, code: 'uniform' },
    };
  }

  return { passed: true, details };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a visionSchema-compatible ABSTAIN result.
 * The rejected model label is NEVER shown as diagnosis.
 */
function buildAbstainResult({
  reason,
  reasons,
  message,
  confidence = null,
  topPredictions = [],
  imageQuality = null,
  supportedCrop = true,
  lang = 'en',
  engine = 'cropguard-onnx',
  onDevice = true,
}) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const guardrailReasons = reasons || (reason ? [reason] : []);
  const primaryReason = guardrailReasons[0] || reason;

  const title = primaryReason === 'unsupported_crop'
    ? L('Crop Not Supported', 'फसल समर्थित नहीं')
    : L('Unable to Identify Reliably', 'विश्वसनीय रूप से पहचान नहीं हो सकी');

  const flat = {
    disease: title,
    confidence: confidence,
    severity: 'Low',
    description: message,
    treatment_steps: [
      primaryReason === 'unsupported_crop'
        ? L('Use cloud AI (Gemini) for diagnosis of this crop.', 'इस फसल के निदान के लिए क्लाउड AI (Gemini) का उपयोग करें।')
        : L('Retake a clear, well-lit close-up of a single leaf.', 'एक पत्ती की स्पष्ट, अच्छी रोशनी वाली नज़दीकी तस्वीर दोबारा लें।'),
      L('If online, cloud AI can provide a more detailed analysis.', 'यदि ऑनलाइन हैं, तो क्लाउड AI अधिक विस्तृत विश्लेषण दे सकता है।'),
    ],
    nutrientDeficiency: {
      status: L('Not Assessed', 'आकलन नहीं हुआ'),
      confidence: null,
      symptoms: L('Diagnosis was not completed.', 'निदान पूरा नहीं हुआ।'),
      recommendation: L('Retake photo or use cloud diagnosis.', 'दोबारा फ़ोटो लें या क्लाउड निदान उपयोग करें।'),
    },
    pestPressure: {
      status: L('Not Assessed', 'आकलन नहीं हुआ'),
      severity: 'Low',
      action: L('Retake photo or use cloud diagnosis.', 'दोबारा फ़ोटो लें या क्लाउड निदान उपयोग करें।'),
    },
    advisory: {
      sprayStatus: L('Spray Status: Re-scan Required', 'स्प्रे स्थिति: दोबारा स्कैन आवश्यक'),
      fertilizerAction: L('Fertilizer: Re-scan Required', 'उर्वरक: दोबारा स्कैन आवश्यक'),
      nextInspection: L('Next Inspection: Re-scan Now', 'अगला निरीक्षण: अभी दोबारा स्कैन करें'),
    },
    onDevice,
    engine,
    guardrailStatus: 'abstained',
    guardrailReasons,
    supportedCrop,
    modelVersion: engine === 'cropguard-onnx' ? 'cropguard-v1' : 'gemini-cloud',
    topPredictions,
    demoNotice: engine === 'cropguard-onnx'
      ? L(
          '🧬 CropGuard AI could not reliably identify this image. Try cloud AI or retake.',
          '🧬 CropGuard AI इस छवि की विश्वसनीय पहचान नहीं कर सका। क्लाउड AI आज़माएं या दोबारा लें।'
        )
      : L(
          '🌐 Cloud AI diagnosis could not be reliably verified. Try again or use CropGuard.',
          '🌐 क्लाउड AI निदान को विश्वसनीय रूप से सत्यापित नहीं किया जा सका। पुन: प्रयास करें या CropGuard का उपयोग करें।'
        ),
  };

  const findings = [
    makeFinding({
      id: `${engine}-${reason || 'abstained'}`,
      category: CATEGORY.UNKNOWN,
      title,
      severity: 'Info',
      confidence,
      confidenceBasis: CONFIDENCE_BASIS.MODEL_ESTIMATE,
      description: message,
      recommendations: flat.treatment_steps,
    }),
  ];

  return assembleResult({
    flat,
    findings,
    imageQuality: imageQuality || {
      code: reason === 'unsupported_crop' ? 'not_assessed' : 'rejected',
      usable: reason === 'unsupported_crop',
      note: message,
    },
    engine,
    onDevice,
    lang,
  });
}

/**
 * Build a visionSchema-compatible ACCEPTED result.
 * All guardrails have passed — the prediction is shown to the user.
 */
function buildAcceptedResult({
  top1Class,
  confidence,
  topPredictions,
  imageQuality,
  cropName: _cropName,
  lang = 'en',
}) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const category = top1Class.category === 'healthy' ? CATEGORY.HEALTHY : CATEGORY.DISEASE;
  const label = top1Class.label[lang === 'hi' ? 'hi' : 'en'] || top1Class.label.en;
  const desc = top1Class.description[lang === 'hi' ? 'hi' : 'en'] || top1Class.description.en;

  // Severity is NOT predicted by the model — it is derived from confidence
  // as a rough proxy. The model was not trained on severity levels.
  let severity;
  if (category === CATEGORY.HEALTHY) {
    severity = 'Low';
  } else if (confidence >= 85) {
    severity = 'High';
  } else if (confidence >= 65) {
    severity = 'Moderate';
  } else {
    severity = 'Low';
  }

  const recommendations = category === CATEGORY.HEALTHY
    ? [
        L('Continue routine field scouting every 3–5 days.', 'हर 3–5 दिन में नियमित खेत निरीक्षण जारी रखें।'),
        L('Maintain balanced nutrition and irrigation.', 'संतुलित पोषण और सिंचाई बनाए रखें।'),
      ]
    : [
        L('Verify diagnosis by inspecting the affected area closely.', 'प्रभावित क्षेत्र की बारीकी से जाँच करके निदान सत्यापित करें।'),
        L('Remove and destroy severely affected leaf tissue where appropriate.', 'जहाँ उचित हो, गंभीर रूप से प्रभावित पत्ती ऊतक हटाकर नष्ट करें।'),
        L('Follow crop-specific and locally approved treatment guidance.', 'फसल-विशिष्ट और स्थानीय रूप से अनुमोदित उपचार मार्गदर्शन का पालन करें।'),
      ];

  const flat = {
    disease: label,
    confidence,
    severity,
    description: desc,
    treatment_steps: recommendations,
    nutrientDeficiency: {
      status: L('Nutrient Levels: Not Assessed by CropGuard', 'पोषक तत्व स्तर: CropGuard द्वारा आकलन नहीं'),
      confidence: null,
      symptoms: L('CropGuard classifies disease/healthy only.', 'CropGuard केवल रोग/स्वस्थ वर्गीकरण करता है।'),
      recommendation: L('Use a soil test for nutrient assessment.', 'पोषक तत्व आकलन के लिए मृदा परीक्षण करें।'),
    },
    pestPressure: {
      status: L('Pest Pressure: Not Assessed by CropGuard', 'कीट दबाव: CropGuard द्वारा आकलन नहीं'),
      severity: 'Low',
      action: L('Maintain routine field inspection for pests.', 'कीटों के लिए नियमित खेत निरीक्षण जारी रखें।'),
    },
    advisory: {
      sprayStatus: category === CATEGORY.DISEASE
        ? L('Spray Status: Verify Diagnosis First', 'स्प्रे स्थिति: पहले निदान सत्यापित करें')
        : L('Spray Status: Preventive Only', 'स्प्रे स्थिति: केवल निवारक'),
      fertilizerAction: L('Fertilizer: Confirm with Soil Test', 'उर्वरक: मृदा परीक्षण से पुष्टि करें'),
      nextInspection: severity === 'High'
        ? L('Next Inspection: 24 Hours', 'अगला निरीक्षण: 24 घंटे')
        : severity === 'Moderate'
          ? L('Next Inspection: 48 Hours', 'अगला निरीक्षण: 48 घंटे')
          : L('Next Inspection: 5 Days', 'अगला निरीक्षण: 5 दिन'),
    },
    onDevice: true,
    engine: 'cropguard-onnx',
    guardrailStatus: 'passed',
    guardrailReasons: [],
    supportedCrop: true,
    modelVersion: 'cropguard-v1',
    topPredictions,
    demoNotice: L(
      '🧬 Analyzed by CropGuard AI (on-device, PlantVillage trained). Real-world field performance may differ.',
      '🧬 CropGuard AI द्वारा विश्लेषण (डिवाइस पर, PlantVillage प्रशिक्षित)। वास्तविक खेत प्रदर्शन भिन्न हो सकता है।'
    ),
  };

  const findings = [
    makeFinding({
      id: `cropguard-${top1Class.id}`,
      category,
      title: label,
      severity,
      confidence,
      confidenceBasis: CONFIDENCE_BASIS.MODEL_ESTIMATE,
      description: desc,
      recommendations,
      evidence: {
        modelProbability: topPredictions[0]?.probability,
        predictedClass: top1Class.id,
        crop: top1Class.crop,
        engine: 'cropguard-onnx',
      },
    }),
  ];

  return assembleResult({
    flat,
    findings,
    imageQuality: {
      code: imageQuality?.code || 'ok',
      usable: true,
      ...imageQuality,
      note: L('Image processed by CropGuard AI.', 'छवि CropGuard AI द्वारा संसाधित।'),
    },
    engine: 'cropguard-onnx',
    onDevice: true,
    lang,
  });
}

/**
 * Validate a structured Gemini cloud diagnosis before presentation.
 * Enforces AGRIO's single consistent safety policy on online Gemini results:
 *  - Supported crop verification (whitelist of 14 crops)
 *  - Crop compatibility / cross-crop mismatch rejection
 *  - Confidence validity check
 *  - Malformed or empty output rejection
 *  - Rejection of uncertain / unknown findings
 *  - Image quality check (where image data is available)
 *
 * An unsafe or invalid Gemini diagnosis is safely converted to an
 * UNKNOWN / ABSTAINED result with zero chemical/treatment recommendations.
 *
 * @param {Object} rawResult   The structured or flat result from Gemini
 * @param {Object} [options]
 * @param {string} [options.cropName]   Selected crop name (e.g. 'Tomato 🍅')
 * @param {string} [options.lang]       'en' | 'hi'
 * @param {string} [options.base64Data] Optional base64 image for quality verification
 * @param {Function} [options.extractMetrics]
 * @returns {Promise<Object>} Safe, validated visionSchema result
 */
export async function validateGeminiDiagnosis(rawResult, {
  cropName = null,
  lang = 'en',
  base64Data = null,
  extractMetrics = extractImageMetrics,
} = {}) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);

  // ── Guard 1: Malformed or missing result ──────────────────────────────────
  if (!rawResult || typeof rawResult !== 'object') {
    return buildAbstainResult({
      reason: 'malformed_output',
      message: L(
        'Cloud AI returned an invalid or empty response. Please retry.',
        'क्लाउड AI ने अमान्य या खाली प्रतिक्रिया दी। कृपया पुन: प्रयास करें।'
      ),
      supportedCrop: true,
      lang,
      engine: 'gemini-cloud',
      onDevice: false,
    });
  }

  // Pass through if already cleanly abstained (e.g. cloud unavailable)
  if (rawResult.guardrailStatus === 'abstained' || rawResult.code === 'CLOUD_AI_UNAVAILABLE') {
    return rawResult;
  }

  const flat = rawResult.flat || rawResult;
  const diseaseText = (flat.disease || '').trim();

  if (!diseaseText) {
    return buildAbstainResult({
      reason: 'malformed_output',
      message: L(
        'Cloud AI response did not specify a diagnosis. Please retry.',
        'क्लाउड AI प्रतिक्रिया में निदान निर्दिष्ट नहीं था। कृपया पुन: प्रयास करें।'
      ),
      supportedCrop: true,
      lang,
      engine: 'gemini-cloud',
      onDevice: false,
    });
  }

  // ── Guard 2: Supported crop whitelist ───────────────────────────────────
  // Gemini must never produce a confirmed diagnosis for an unsupported crop.
  const cropKey = normalizeToCropGuardKey(cropName);
  if (!cropKey) {
    return buildAbstainResult({
      reason: 'unsupported_crop',
      message: L(
        `The selected crop (${cropName || 'Unknown'}) is not supported by AGRIO diagnosis.`,
        `चयनित फसल (${cropName || 'अज्ञात'}) AGRIO निदान द्वारा समर्थित नहीं है।`
      ),
      supportedCrop: false,
      lang,
      engine: 'gemini-cloud',
      onDevice: false,
    });
  }

  // ── Guard 3: Image quality gate (where practical) ───────────────────────
  if (base64Data) {
    try {
      const metrics = await extractMetrics(base64Data);
      const qualityCheck = checkImageQuality(metrics, lang);
      if (!qualityCheck.passed) {
        return buildAbstainResult({
          reason: qualityCheck.reason,
          message: qualityCheck.message,
          imageQuality: qualityCheck.details,
          supportedCrop: true,
          lang,
          engine: 'gemini-cloud',
          onDevice: false,
        });
      }
    } catch {
      // In test environments or non-canvas contexts, metrics may reject gracefully
    }
  }

  // ── Guard 4: Crop compatibility & cross-crop mismatch rejection ─────────
  // Gemini must not return a disease for another crop (e.g. Apple Scab on Tomato).
  const lowerDisease = diseaseText.toLowerCase();
  for (const otherCrop of SUPPORTED_CROPS) {
    if (otherCrop !== cropKey) {
      const regex = new RegExp(`\\b${otherCrop}\\b`, 'i');
      if (regex.test(lowerDisease) && !lowerDisease.includes(cropKey)) {
        return buildAbstainResult({
          reason: 'crop_prediction_mismatch',
          message: L(
            `Diagnosis (${diseaseText}) does not match the selected crop (${cropName}).`,
            `निदान (${diseaseText}) चयनित फसल (${cropName}) से मेल नहीं खाता।`
          ),
          supportedCrop: true,
          lang,
          engine: 'gemini-cloud',
          onDevice: false,
        });
      }
    }
  }

  // ── Guard 5: Unknown / Inconclusive diagnosis detection ─────────────────
  const inconclusiveWords = ['unknown', 'inconclusive', 'undetected', 'unable to', 'अज्ञात', 'अनिर्णायक', 'पहचान नहीं'];
  if (inconclusiveWords.some((w) => lowerDisease.includes(w))) {
    return buildAbstainResult({
      reason: 'low_model_confidence',
      message: L(
        'Cloud AI was unable to identify a specific condition reliably.',
        'क्लाउड AI किसी विशिष्ट स्थिति की विश्वसनीय पहचान करने में असमर्थ रहा।'
      ),
      supportedCrop: true,
      lang,
      engine: 'gemini-cloud',
      onDevice: false,
    });
  }

  // ── Guard 6: Confidence validity ────────────────────────────────────────
  const rawConfidence = flat.confidence;
  let numericConfidence = null;
  if (typeof rawConfidence === 'number' && !isNaN(rawConfidence)) {
    numericConfidence = rawConfidence <= 1.0 ? Math.round(rawConfidence * 100) : Math.round(rawConfidence);
  }

  // Missing or negative or out-of-bounds confidence
  if (numericConfidence === null || numericConfidence <= 0 || numericConfidence > 100) {
    return buildAbstainResult({
      reason: 'low_model_confidence',
      message: L(
        'Cloud AI provided an invalid or missing confidence estimate.',
        'क्लाउड AI ने अमान्य या लापता विश्वास अनुमान प्रदान किया।'
      ),
      supportedCrop: true,
      lang,
      engine: 'gemini-cloud',
      onDevice: false,
    });
  }

  // Confidence floor for Gemini acceptance (50%)
  if (numericConfidence < 50) {
    return buildAbstainResult({
      reason: 'low_model_confidence',
      message: L(
        'Cloud AI confidence is too low to confirm diagnosis. Retake a clear photo.',
        'क्लाउड AI का विश्वास निदान की पुष्टि के लिए बहुत कम है। स्पष्ट तस्वीर लें।'
      ),
      confidence: numericConfidence,
      supportedCrop: true,
      lang,
      engine: 'gemini-cloud',
      onDevice: false,
    });
  }

  // ── Guard 7: Check Category ─────────────────────────────────────────────
  const findingCat = rawResult.findings?.[0]?.category;
  if (findingCat === CATEGORY.UNKNOWN) {
    return buildAbstainResult({
      reason: 'low_model_confidence',
      message: L(
        'Cloud AI diagnosis category is unknown or unverified.',
        'क्लाउड AI निदान श्रेणी अज्ञात या असत्यापित है।'
      ),
      supportedCrop: true,
      lang,
      engine: 'gemini-cloud',
      onDevice: false,
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ALL GUARDS PASSED — return structured, validated Gemini result
  // ═════════════════════════════════════════════════════════════════════════
  const isHealthy = lowerDisease.includes('healthy') || lowerDisease.includes('स्वस्थ') || lowerDisease.includes('optimal');
  const finalCategory = isHealthy ? CATEGORY.HEALTHY : CATEGORY.DISEASE;

  const findings = [
    makeFinding({
      id: 'gemini-validated-finding',
      category: finalCategory,
      title: diseaseText,
      severity: flat.severity || 'Low',
      confidence: numericConfidence,
      confidenceBasis: CONFIDENCE_BASIS.MODEL_ESTIMATE,
      description: flat.description || '',
      recommendations: Array.isArray(flat.treatment_steps) ? flat.treatment_steps : [],
    }),
  ];

  const validatedFlat = {
    ...flat,
    confidence: numericConfidence,
    guardrailStatus: 'passed',
    guardrailReasons: [],
    supportedCrop: true,
    engine: 'gemini-cloud',
    onDevice: false,
  };

  return assembleResult({
    flat: validatedFlat,
    findings,
    imageQuality: rawResult.imageQuality || {
      code: 'not_assessed',
      usable: true,
      note: L('Image quality assessed by cloud model.', 'क्लाउड मॉडल द्वारा छवि गुणवत्ता का आकलन।'),
    },
    engine: 'gemini-cloud',
    onDevice: false,
    lang,
  });
}

