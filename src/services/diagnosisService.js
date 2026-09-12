/**
 * AGRIO Diagnosis Service — hybrid cloud + edge routing.
 *
 * Decides where a leaf image gets analysed using a three-tier fallback chain:
 *
 *   ONLINE:
 *     Gemini cloud model (highest accuracy, multi-crop)
 *       ↓ failure
 *     CropGuard ONNX (on-device, 14 supported crops, strict guardrails)
 *       ↓ failure / unsupported crop / model unavailable
 *     Legacy heuristic (classical-CV, always works)
 *
 *   OFFLINE:
 *     CropGuard ONNX (on-device, 14 supported crops, strict guardrails)
 *       ↓ failure / unsupported crop / model unavailable
 *     Legacy heuristic (classical-CV, always works)
 *
 * The UI only ever calls diagnoseLeaf(); it never needs to know which engine
 * ran — all three return the same result shape (visionSchema contract).
 *
 * Engine identification is HONEST:
 *   • engine = 'gemini-...'      → cloud model actually ran
 *   • engine = 'cropguard-onnx'  → CropGuard ONNX model actually ran
 *   • engine = 'on-device'       → legacy heuristic actually ran
 * The engine value is NEVER misattributed.
 */
import { analyzeLeafImage } from './geminiService';
import { analyzeLeafImageOnDevice } from './edgeVisionService';
import { analyzeWithCropGuard, validateGeminiDiagnosis } from './visionGuardService';
import { getOnnxModelReadiness } from './onnxVisionService';

/**
 * Try the CropGuard ONNX model, falling back to the legacy heuristic if ONNX is
 * unavailable, the crop is unsupported, or inference fails.
 *
 * @param {string} base64Data  Base64 image
 * @param {string} cropName    User's selected crop (e.g. 'Tomato 🍅')
 * @param {string} lang        'en' | 'hi'
 */
async function edgeFallbackChain(base64Data, cropName, lang) {
  // ── Tier 2: CropGuard ONNX (if model is available and crop is supported) ──
  const readiness = getOnnxModelReadiness();
  if (readiness !== 'unavailable' && readiness !== 'error') {
    try {
      const result = await analyzeWithCropGuard(base64Data, cropName, lang);
      // If CropGuard returned a result (even abstained), use it — the
      // abstention result is a valid structured visionSchema output with
      // clear user messaging. Only fall through on thrown errors.
      return result;
    } catch (onnxErr) {
      console.warn('[Diagnosis] CropGuard ONNX failed — falling back to legacy heuristic:', onnxErr);
    }
  }

  // ── Tier 3: Legacy heuristic (always works, no dependencies) ────────────
  return analyzeLeafImageOnDevice(base64Data, lang);
}

/**
 * Main entry point for leaf diagnosis.
 *
 * @param {string} base64Data  Base64 image (with or without data URI prefix)
 * @param {string} lang        'en' | 'hi'
 * @param {Object} [options]   Optional parameters
 * @param {string} [options.cropName]  User's selected crop for CropGuard filtering
 * @returns {Promise<Object>}  visionSchema-compatible result
 */
export async function diagnoseLeaf(base64Data, lang = 'en', { cropName } = {}) {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  // ── Offline → skip cloud, go straight to the edge chain ─────────────────
  if (!online) {
    return edgeFallbackChain(base64Data, cropName, lang);
  }

  // ── Online → Tier 1: cloud (validated via safety policy), edge fallback on failure ──
  try {
    const rawCloudResult = await analyzeLeafImage(base64Data, lang, { cropName });
    if (rawCloudResult?.code === 'CLOUD_AI_UNAVAILABLE') {
      console.warn('[Diagnosis] Cloud AI unavailable — attempting edge fallback chain');
      return edgeFallbackChain(base64Data, cropName, lang);
    }
    return await validateGeminiDiagnosis(rawCloudResult, { cropName, lang, base64Data });
  } catch (cloudErr) {
    console.warn('[Diagnosis] Cloud diagnosis unavailable — falling back to edge chain:', cloudErr);
    return edgeFallbackChain(base64Data, cropName, lang);
  }
}
