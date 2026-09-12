/**
 * VisionGuard Service — Deterministic Unit Tests
 *
 * Tests the guardrail logic using mocked ONNX session outputs.
 * These do NOT run the real CropGuard model — they test the acceptance
 * policy, crop filtering, image quality checks, and abstention logic
 * with synthetic probability distributions.
 *
 * The real model is tested separately via model-test/test_inference.py.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock modules before importing the service under test ──────────────────────

// Mock onnxVisionService to avoid actual ONNX model loading
vi.mock('../onnxVisionService', () => ({
  getOnnxModelReadiness: vi.fn(() => 'ready'),
  getOnnxLoadError: vi.fn(() => null),
  preprocessImage: vi.fn(async () => new Float32Array(1 * 3 * 224 * 224)),
  runOnnxInference: vi.fn(async () => new Float32Array(38)),
  extractImageMetrics: vi.fn(async () => ({
    width: 640,
    height: 480,
    meanBrightness: 128,
    brightnessVariance: 2000,
    greenRatio: 0.35,
    darkRatio: 0.05,
    brightRatio: 0.05,
    uniformRatio: 0.1,
  })),
}));

import {
  analyzeWithCropGuard,
  isCropSupported,
  normalizeToCropGuardKey,
} from '../visionGuardService';
import {
  getOnnxModelReadiness,
  runOnnxInference,
  extractImageMetrics,
} from '../onnxVisionService';

// Helper: create logits where class `idx` has a dominant value
function makeLogits(dominantIdx, dominantValue = 8.0, baseValue = -2.0) {
  const logits = new Float32Array(38).fill(baseValue);
  logits[dominantIdx] = dominantValue;
  return logits;
}

// Helper: create logits where two classes have similar values (ambiguous)
function makeAmbiguousLogits(idx1, idx2, value1 = 5.0, value2 = 4.8) {
  const logits = new Float32Array(38).fill(-2.0);
  logits[idx1] = value1;
  logits[idx2] = value2;
  return logits;
}

// Helper: create uniformly distributed logits (max entropy)
function _makeUniformLogits() {
  return new Float32Array(38).fill(0.0);
}

const FAKE_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

describe('normalizeToCropGuardKey', () => {
  test('resolves supported crop names', () => {
    expect(normalizeToCropGuardKey('Tomato')).toBe('tomato');
    expect(normalizeToCropGuardKey('Tomato 🍅')).toBe('tomato');
    expect(normalizeToCropGuardKey('Apple')).toBe('apple');
    expect(normalizeToCropGuardKey('Grape')).toBe('grape');
    expect(normalizeToCropGuardKey('Corn (Maize)')).toBe('corn');
    expect(normalizeToCropGuardKey('Bell Pepper')).toBe('pepper');
    expect(normalizeToCropGuardKey('Pepper')).toBe('pepper');
    expect(normalizeToCropGuardKey('Orange')).toBe('orange');
    expect(normalizeToCropGuardKey('Potato')).toBe('potato');
  });

  test('returns null for unsupported crops', () => {
    expect(normalizeToCropGuardKey('Wheat')).toBeNull();
    expect(normalizeToCropGuardKey('Rice')).toBeNull();
    expect(normalizeToCropGuardKey('Mustard')).toBeNull();
    expect(normalizeToCropGuardKey('Cotton')).toBeNull();
    expect(normalizeToCropGuardKey('')).toBeNull();
    expect(normalizeToCropGuardKey(null)).toBeNull();
  });
});

describe('isCropSupported', () => {
  test('returns true for supported crops', () => {
    expect(isCropSupported('Tomato')).toBe(true);
    expect(isCropSupported('Apple')).toBe(true);
    expect(isCropSupported('Grape')).toBe(true);
  });

  test('returns false for unsupported crops', () => {
    expect(isCropSupported('Wheat')).toBe(false);
    expect(isCropSupported('Rice')).toBe(false);
  });
});

describe('analyzeWithCropGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOnnxModelReadiness.mockReturnValue('ready');
    extractImageMetrics.mockResolvedValue({
      width: 640, height: 480,
      meanBrightness: 128, brightnessVariance: 2000,
      greenRatio: 0.35, darkRatio: 0.05, brightRatio: 0.05, uniformRatio: 0.1,
    });
  });

  // ── Test 1: Supported healthy crop → accepted ────────────────────────────
  test('1. supported healthy crop → accepted', async () => {
    // Index 37 = Tomato healthy
    runOnnxInference.mockResolvedValue(makeLogits(37, 10.0));

    const result = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en');

    expect(result.engine).toBe('cropguard-onnx');
    expect(result.guardrailStatus).toBe('passed');
    expect(result.guardrailReasons).toEqual([]);
    expect(result.findings).toBeDefined();
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].category).toBe('healthy');
  });

  // ── Test 2: Supported disease crop → accepted ────────────────────────────
  test('2. supported disease crop → accepted', async () => {
    // Index 29 = Tomato Early Blight
    runOnnxInference.mockResolvedValue(makeLogits(29, 10.0));

    const result = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en');

    expect(result.engine).toBe('cropguard-onnx');
    expect(result.guardrailStatus).toBe('passed');
    expect(result.findings[0].category).toBe('disease');
    expect(result.findings[0].title).toContain('Early Blight');
  });

  // ── Test 3: Low confidence → unknown ──────────────────────────────────────
  test('3. low confidence → unknown (low_model_confidence)', async () => {
    // All logits near zero → no clear winner after softmax
    runOnnxInference.mockResolvedValue(makeLogits(29, 1.0, 0.5));

    const result = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en');

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('low_model_confidence');
    // Must NOT show a disease label
    expect(result.findings[0].category).toBe('unknown');
  });

  // ── Test 4: Crop mismatch → unknown ───────────────────────────────────────
  test('4. crop mismatch → unknown (crop_prediction_mismatch)', async () => {
    // Predict Apple Scab (index 0) but user selected Tomato
    runOnnxInference.mockResolvedValue(makeLogits(0, 10.0));

    const result = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en');

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('crop_prediction_mismatch');
    expect(result.findings[0].category).toBe('unknown');
  });

  // ── Test 5: Non-leaf/car-like input → unknown ─────────────────────────────
  test('5. non-leaf image (uniform surface) → unknown', async () => {
    // Simulate a uniform surface (like a car hood or wall)
    extractImageMetrics.mockResolvedValue({
      width: 640, height: 480,
      meanBrightness: 180, brightnessVariance: 50,  // very low variance
      greenRatio: 0.01, darkRatio: 0.02, brightRatio: 0.1, uniformRatio: 0.85,
    });

    const result = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en');

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('non_leaf_or_invalid_image');
    expect(result.findings[0].category).toBe('unknown');
  });

  // ── Test 6: Unsupported crop → unknown ────────────────────────────────────
  test('6. unsupported crop → unknown (unsupported_crop)', async () => {
    const result = await analyzeWithCropGuard(FAKE_BASE64, 'Wheat 🌾', 'en');

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('unsupported_crop');
    expect(result.findings[0].category).toBe('unknown');
    expect(result.supportedCrop).toBe(false);
    // ONNX inference should NOT have been called
    expect(runOnnxInference).not.toHaveBeenCalled();
  });

  // ── Test 7: Ambiguous top1/top2 → unknown ─────────────────────────────────
  test('7. ambiguous prediction (small margin) → unknown', async () => {
    // Two tomato diseases with nearly equal logits
    runOnnxInference.mockResolvedValue(makeAmbiguousLogits(29, 30, 5.0, 4.95));

    const result = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en');

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('ambiguous_prediction');
    expect(result.findings[0].category).toBe('unknown');
  });

  // ── Test 8: Invalid logits / model error → unknown ────────────────────────
  test('8. invalid logits (NaN) → unknown (model_error)', async () => {
    const nanLogits = new Float32Array(38).fill(NaN);
    runOnnxInference.mockResolvedValue(nanLogits);

    const result = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en');

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('model_error');
  });

  // ── Test 9: Model unavailable → throws (so diagnosisService falls back) ──
  test('9. model unavailable → throws error for fallback', async () => {
    getOnnxModelReadiness.mockReturnValue('unavailable');

    await expect(
      analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en')
    ).rejects.toThrow('CropGuard model unavailable');
  });

  // ── Test 10: Too-dark image → poor_image_quality ──────────────────────────
  test('10. too dark image → poor_image_quality', async () => {
    extractImageMetrics.mockResolvedValue({
      width: 640, height: 480,
      meanBrightness: 15, brightnessVariance: 200,
      greenRatio: 0.01, darkRatio: 0.85, brightRatio: 0.0, uniformRatio: 0.1,
    });

    const result = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en');

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('poor_image_quality');
  });

  // ── Test 11: Hindi language produces Hindi labels ─────────────────────────
  test('11. Hindi language produces Hindi text', async () => {
    runOnnxInference.mockResolvedValue(makeLogits(37, 10.0));

    const result = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'hi');

    expect(result.engine).toBe('cropguard-onnx');
    expect(result.guardrailStatus).toBe('passed');
    // Should contain Hindi text
    expect(result.findings[0].title).toContain('टमाटर');
  });
});
