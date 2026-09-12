/**
 * AGRIO ONNX Vision Service — on-device neural-network crop leaf analysis.
 *
 * Runs the CropGuard ResNet50 ONNX model in the browser via ONNX Runtime Web
 * (WASM backend). This module handles the model lifecycle:
 *   1. Model loading (lazy, singleton, async — never blocks the UI)
 *   2. Image preprocessing (center-crop pipeline from onnxModelMeta.js)
 *   3. Inference (session.run)
 *   4. Raw output extraction
 *
 * Output DECODING, temperature scaling, guardrail checks, and result assembly
 * are handled by visionGuardService.js — this module only runs the ONNX session
 * and returns raw logits. This keeps the ONNX runner generic and testable.
 *
 * Engine values:
 *   engine = 'cropguard-onnx' — when CropGuard ONNX model actually ran inference
 *   engine = 'on-device'      — legacy heuristic (never set here)
 *   engine = 'gemini-...'     — cloud (never set here)
 */

import { MODEL_META } from './onnxModelMeta.js';

// ── Singleton state ───────────────────────────────────────────────────────────

/**
 * Model readiness:
 *   'unavailable' — no model file / modelAvailable is false
 *   'loading'     — model download + session creation in progress
 *   'ready'       — session cached and inference is possible
 *   'error'       — loading was attempted and failed
 */
let _readiness = 'unavailable';
let _session = null;
let _loadPromise = null;
let _loadError = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the current ONNX model readiness state.
 * @returns {'unavailable'|'loading'|'ready'|'error'}
 */
export function getOnnxModelReadiness() {
  // If meta says model is available but we haven't loaded yet, return 'unavailable'
  // (not 'error'). visionGuardService triggers loadModel when needed.
  if (!MODEL_META.modelAvailable) return 'unavailable';
  return _readiness;
}

/**
 * Returns the last model-loading error, if any.
 * @returns {Error|null}
 */
export function getOnnxLoadError() {
  return _loadError;
}

/**
 * Run CropGuard inference on a preprocessed Float32Array tensor.
 * Returns the RAW LOGITS array (float32, length = numClasses).
 *
 * The caller (visionGuardService) handles preprocessing, temperature scaling,
 * softmax, guardrails, and result assembly.
 *
 * @param {Float32Array} tensorData  Preprocessed NCHW tensor [1, 3, 224, 224]
 * @returns {Promise<Float32Array>}  Raw logits [38]
 */
export async function runOnnxInference(tensorData) {
  if (!MODEL_META.modelAvailable) {
    throw new Error('ONNX model not available — modelAvailable is false.');
  }

  const session = await ensureModelLoaded();
  const ort = await import('onnxruntime-web');

  const { width, height, channels, layout } = MODEL_META.input;
  const shape = layout === 'NCHW'
    ? [1, channels, height, width]
    : [1, height, width, channels];

  const inputTensor = new ort.Tensor('float32', tensorData, shape);
  const feeds = { [MODEL_META.input.name]: inputTensor };
  const results = await session.run(feeds);

  // Extract the output tensor by configured name, or fall back to the first output.
  const outputTensor = results[MODEL_META.output.name]
    || results[Object.keys(results)[0]];

  if (!outputTensor) {
    throw new Error('ONNX inference produced no output tensor.');
  }

  return outputTensor.data;
}

/**
 * Preprocess a base64 image for CropGuard inference.
 *
 * Pipeline (matches model-test/test_inference.py exactly):
 *   1. Decode image
 *   2. Resize so the shorter side = 256, preserving aspect ratio
 *   3. Center-crop to 224×224
 *   4. Scale to [0, 1]
 *   5. Subtract ImageNet mean, divide by ImageNet std
 *   6. Arrange as NCHW Float32Array
 *
 * @param {string} base64Data  Base64 image (with or without data URI prefix)
 * @returns {Promise<Float32Array>}  NCHW tensor [1×3×224×224]
 */
export function preprocessImage(base64Data) {
  const { width: targetW, height: targetH, channels, layout, normalize } = MODEL_META.input;

  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('ONNX preprocessing requires a browser environment.'));
      return;
    }

    const src = base64Data.startsWith('data:')
      ? base64Data
      : `data:image/jpeg;base64,${base64Data}`;

    const img = new Image();
    img.onload = () => {
      try {
        // ── Step 1–2: Resize so shorter side = 256 ────────────────────────
        const origW = img.naturalWidth;
        const origH = img.naturalHeight;
        const scale = 256 / Math.min(origW, origH);
        const resizedW = Math.round(origW * scale);
        const resizedH = Math.round(origH * scale);

        // Draw resized image onto a temporary canvas
        const resizeCanvas = document.createElement('canvas');
        resizeCanvas.width = resizedW;
        resizeCanvas.height = resizedH;
        const resizeCtx = resizeCanvas.getContext('2d', { willReadFrequently: true });
        resizeCtx.drawImage(img, 0, 0, resizedW, resizedH);

        // ── Step 3: Center-crop to 224×224 ────────────────────────────────
        const cropLeft = Math.floor((resizedW - targetW) / 2);
        const cropTop = Math.floor((resizedH - targetH) / 2);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = targetW;
        cropCanvas.height = targetH;
        const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
        cropCtx.drawImage(
          resizeCanvas,
          cropLeft, cropTop, targetW, targetH,  // source rect
          0, 0, targetW, targetH                // dest rect
        );

        const imageData = cropCtx.getImageData(0, 0, targetW, targetH);
        const pixels = imageData.data; // Uint8ClampedArray [R,G,B,A, R,G,B,A, ...]

        // ── Steps 4–6: Normalize and arrange as NCHW ──────────────────────
        const numPixels = targetW * targetH;
        const tensor = new Float32Array(channels * numPixels);

        const hasMean = normalize.mean && normalize.mean.length === channels;
        const hasStd = normalize.std && normalize.std.length === channels;

        for (let i = 0; i < numPixels; i++) {
          const px = i * 4; // RGBA stride
          for (let c = 0; c < channels; c++) {
            let val = pixels[px + c] / 255.0; // scale to [0, 1]

            if (hasMean) val -= normalize.mean[c];
            if (hasStd) val /= normalize.std[c];

            // Write into the tensor in NCHW layout.
            if (layout === 'NCHW') {
              tensor[c * numPixels + i] = val;
            } else {
              tensor[i * channels + c] = val;
            }
          }
        }

        resolve(tensor);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Could not load image for ONNX preprocessing.'));
    img.src = src;
  });
}

/**
 * Extract basic image metrics from a base64 image for quality checks.
 * Returns width, height, mean brightness, brightness variance, and
 * a simple green-pixel ratio (leaf plausibility proxy).
 *
 * @param {string} base64Data
 * @returns {Promise<Object>}
 */
export function extractImageMetrics(base64Data) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Image metrics require a browser environment.'));
      return;
    }

    const src = base64Data.startsWith('data:')
      ? base64Data
      : `data:image/jpeg;base64,${base64Data}`;

    const img = new Image();
    img.onload = () => {
      try {
        const origW = img.naturalWidth;
        const origH = img.naturalHeight;

        // Downsample to 128×128 for fast analysis
        const SIZE = 128;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

        const N = SIZE * SIZE;
        let sumBrightness = 0;
        let sumBrSq = 0;
        let greenPixels = 0;
        let darkPixels = 0;
        let brightPixels = 0;
        let uniformPixels = 0;

        for (let i = 0; i < N; i++) {
          const px = i * 4;
          const r = data[px], g = data[px + 1], b = data[px + 2];
          const brightness = (r + g + b) / 3.0;
          sumBrightness += brightness;
          sumBrSq += brightness * brightness;

          if (brightness < 20) darkPixels++;
          if (brightness > 235) brightPixels++;

          // Green-ish pixel: g > r and g > b with some margin
          if (g > r + 15 && g > b + 15 && g > 40) greenPixels++;

          // Near-uniform gray/white
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          if (maxDiff < 12 && brightness > 100) uniformPixels++;
        }

        const meanBrightness = sumBrightness / N;
        const variance = (sumBrSq / N) - (meanBrightness * meanBrightness);

        resolve({
          width: origW,
          height: origH,
          meanBrightness: Math.round(meanBrightness * 10) / 10,
          brightnessVariance: Math.round(variance * 10) / 10,
          greenRatio: Math.round((greenPixels / N) * 1000) / 1000,
          darkRatio: Math.round((darkPixels / N) * 1000) / 1000,
          brightRatio: Math.round((brightPixels / N) * 1000) / 1000,
          uniformRatio: Math.round((uniformPixels / N) * 1000) / 1000,
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Could not load image for quality analysis.'));
    img.src = src;
  });
}

// ── Model Loading ─────────────────────────────────────────────────────────────

/**
 * Ensure the ONNX session is loaded. Returns the cached session on subsequent
 * calls. Loading is deduplicated — concurrent callers share one promise.
 */
async function ensureModelLoaded() {
  if (_session) return _session;

  if (_readiness === 'error') {
    throw _loadError || new Error('ONNX model failed to load previously.');
  }

  if (_loadPromise) return _loadPromise;

  _loadPromise = loadModel();
  return _loadPromise;
}

async function loadModel() {
  _readiness = 'loading';
  _loadError = null;

  try {
    // Dynamic import so onnxruntime-web is only fetched when actually needed.
    const ort = await import('onnxruntime-web');

    // Configure WASM backend — single-threaded is safest for broad compatibility.
    ort.env.wasm.numThreads = 1;

    const session = await ort.InferenceSession.create(MODEL_META.modelPath, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    _session = session;
    _readiness = 'ready';
    _loadPromise = null;
    console.info('[ONNX] CropGuard model loaded successfully from', MODEL_META.modelPath);
    return session;
  } catch (err) {
    _readiness = 'error';
    _loadError = err;
    _loadPromise = null;
    console.error('[ONNX] CropGuard model load failed:', err);
    throw err;
  }
}
