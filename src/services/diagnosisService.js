/**
 * AGRIO Diagnosis Service — hybrid cloud + edge routing.
 *
 * Decides where a leaf image gets analysed:
 *
 *   ONLINE:
 *     Gemini cloud model (highest accuracy, multi-crop)
 *       ↓ failure / unavailable
 *     Edge chain (below)
 *
 *   OFFLINE / EDGE CHAIN:
 *     • SUPPORTED crop (one of CropGuard's 14):
 *         CropGuard ONNX → prediction OR safe abstention.
 *         If the model cannot load/init → explicit `cropguard_unavailable`
 *         abstention. We NEVER silently substitute the legacy heuristic for a
 *         supported crop — that would let a classical-CV guess masquerade as
 *         the trained model.
 *     • UNSUPPORTED crop:
 *         CropGuard returns an `unsupported_crop` abstention WITHOUT loading or
 *         running the model (steer the user to cloud AI).
 *
 * The legacy classical-CV heuristic (edgeVisionService) is intentionally NOT in
 * this routing. It remains in the codebase only as a clearly-separate legacy
 * module and is never presented as equivalent to CropGuard.
 *
 * The UI only ever calls diagnoseLeaf(); every path returns the same result
 * shape (visionSchema contract).
 *
 * Engine identification is HONEST:
 *   • engine = 'gemini-...'      → cloud model actually ran
 *   • engine = 'cropguard-onnx'  → CropGuard ONNX ran (or abstained on its behalf)
 * The engine value is NEVER misattributed.
 */
import { analyzeLeafImage } from './geminiService';
import {
  analyzeWithCropGuard,
  validateGeminiDiagnosis,
  isCropSupported,
  buildCropguardUnavailableResult,
} from './visionGuardService';
import { ensureOnnxModelLoaded } from './onnxVisionService';

/**
 * Edge (on-device) diagnosis chain.
 *
 * Supported crops require the CropGuard ONNX model: we trigger the load, then
 * run guarded inference. On any load/init failure we abstain explicitly
 * (`cropguard_unavailable`) rather than fall back to the heuristic.
 *
 * @param {string} base64Data  Base64 image
 * @param {string} cropName    User's selected crop (e.g. 'Tomato 🍅')
 * @param {string} lang        'en' | 'hi'
 */
async function edgeFallbackChain(base64Data, cropName, lang) {
  // ── Unsupported crop → CropGuard abstains without touching the model ─────
  if (!isCropSupported(cropName)) {
    return analyzeWithCropGuard(base64Data, cropName, lang);
  }

  // ── Supported crop → CropGuard ONNX is REQUIRED ──────────────────────────
  // Trigger the (lazy, singleton) load FIRST — this is the step that was
  // missing before, which left readiness permanently 'unavailable' and forced
  // the heuristic fallback for every supported crop.
  const load = await ensureOnnxModelLoaded();
  if (!load.ready) {
    console.warn(
      `[Diagnosis] CropGuard ONNX unavailable (${load.code}) — returning cropguard_unavailable. ` +
      'No heuristic substitution for a supported crop.'
    );
    return buildCropguardUnavailableResult({ cropName, lang, code: load.code });
  }

  try {
    // Model is ready → run the full guarded pipeline (predicts OR abstains).
    return await analyzeWithCropGuard(base64Data, cropName, lang);
  } catch (onnxErr) {
    // analyzeWithCropGuard normally abstains internally; a throw here means the
    // session died after load. Still no heuristic — abstain explicitly.
    console.warn('[Diagnosis] CropGuard ONNX errored after load — returning cropguard_unavailable:', onnxErr);
    return buildCropguardUnavailableResult({
      cropName,
      lang,
      code: onnxErr?.code || 'INFERENCE_FAILED',
    });
  }
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
      const edgeResult = await edgeFallbackChain(base64Data, cropName, lang);
      return {
        ...edgeResult,
        cloudFallback: true,
        fallbackMessage: lang === 'hi'
          ? 'ऑनलाइन AI अनुपलब्ध • डिवाइस पर विश्लेषण का उपयोग'
          : 'Online AI unavailable • using on-device analysis',
      };
    }
    return await validateGeminiDiagnosis(rawCloudResult, { cropName, lang, base64Data });
  } catch (cloudErr) {
    console.warn('[Diagnosis] Cloud diagnosis unavailable — falling back to edge chain:', cloudErr);
    const edgeResult = await edgeFallbackChain(base64Data, cropName, lang);
    return {
      ...edgeResult,
      cloudFallback: true,
      fallbackMessage: lang === 'hi'
        ? 'ऑनलाइन AI अनुपलब्ध • डिवाइस पर विश्लेषण का उपयोग'
        : 'Online AI unavailable • using on-device analysis',
    };
  }
}
