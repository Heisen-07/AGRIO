/**
 * Diagnosis Service — routing tests.
 *
 * Verifies the hybrid cloud + edge routing policy, with special attention to
 * the CropGuard-loading fix:
 *   • Supported crop → CropGuard ONNX is loaded then run.
 *   • Supported crop + model cannot load/init → explicit `cropguard_unavailable`
 *     abstention. The legacy heuristic is NEVER substituted for a supported crop.
 *   • Unsupported crop → CropGuard abstains (`unsupported_crop`) WITHOUT loading.
 *   • Online → Gemini (validated); edge chain only on cloud failure.
 *
 * onnxVisionService and geminiService are mocked; visionGuardService keeps its
 * REAL isCropSupported + buildCropguardUnavailableResult so the abstention shape
 * is exercised for real, while analyzeWithCropGuard / validateGeminiDiagnosis are
 * stubbed (they need a browser canvas + the real 94 MB model otherwise).
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../geminiService', () => ({
  analyzeLeafImage: vi.fn(),
}));

// Provide every name visionGuardService imports from onnxVisionService, plus the
// new load trigger the routing depends on.
vi.mock('../onnxVisionService', () => ({
  ensureOnnxModelLoaded: vi.fn(),
  getOnnxModelReadiness: vi.fn(() => 'ready'),
  runOnnxInference: vi.fn(),
  preprocessImage: vi.fn(),
  extractImageMetrics: vi.fn(),
}));

// Keep the REAL isCropSupported + buildCropguardUnavailableResult; stub the two
// heavy pipeline entry points.
vi.mock('../visionGuardService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    analyzeWithCropGuard: vi.fn(),
    validateGeminiDiagnosis: vi.fn(),
  };
});

import { diagnoseLeaf } from '../diagnosisService';
import { analyzeLeafImage } from '../geminiService';
import { ensureOnnxModelLoaded } from '../onnxVisionService';
import { analyzeWithCropGuard, validateGeminiDiagnosis } from '../visionGuardService';

const FAKE_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

function setOnline(value) {
  Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  ensureOnnxModelLoaded.mockResolvedValue({ ready: true, readiness: 'ready', code: null });
  analyzeWithCropGuard.mockResolvedValue({
    engine: 'cropguard-onnx',
    guardrailStatus: 'passed',
    disease: 'Tomato Healthy',
    findings: [{ category: 'healthy' }],
  });
});

describe('diagnoseLeaf — offline edge routing', () => {
  test('supported crop → loads CropGuard then runs it', async () => {
    setOnline(false);

    const result = await diagnoseLeaf(FAKE_BASE64, 'en', { cropName: 'Tomato 🍅' });

    expect(ensureOnnxModelLoaded).toHaveBeenCalledTimes(1);
    expect(analyzeWithCropGuard).toHaveBeenCalledWith(FAKE_BASE64, 'Tomato 🍅', 'en');
    expect(result.engine).toBe('cropguard-onnx');
    expect(analyzeLeafImage).not.toHaveBeenCalled();
  });

  test('supported crop + model FETCH failure → cropguard_unavailable, NOT heuristic', async () => {
    setOnline(false);
    ensureOnnxModelLoaded.mockResolvedValue({ ready: false, readiness: 'error', code: 'MODEL_FETCH_FAILED' });

    const result = await diagnoseLeaf(FAKE_BASE64, 'en', { cropName: 'Tomato' });

    // Real buildCropguardUnavailableResult was used → honest on-device abstention.
    expect(result.engine).toBe('cropguard-onnx');
    expect(result.onDevice).toBe(true);
    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('cropguard_unavailable');
    expect(result.findings[0].category).toBe('unknown');
    // Crucially: inference was never attempted, and no heuristic substituted.
    expect(analyzeWithCropGuard).not.toHaveBeenCalled();
  });

  test('supported crop + WASM init failure → cropguard_unavailable', async () => {
    setOnline(false);
    ensureOnnxModelLoaded.mockResolvedValue({ ready: false, readiness: 'error', code: 'WASM_INIT_FAILED' });

    const result = await diagnoseLeaf(FAKE_BASE64, 'en', { cropName: 'Potato' });

    expect(result.guardrailReasons).toContain('cropguard_unavailable');
    expect(analyzeWithCropGuard).not.toHaveBeenCalled();
  });

  test('supported crop + session create failure → cropguard_unavailable', async () => {
    setOnline(false);
    ensureOnnxModelLoaded.mockResolvedValue({ ready: false, readiness: 'error', code: 'SESSION_CREATE_FAILED' });

    const result = await diagnoseLeaf(FAKE_BASE64, 'en', { cropName: 'Apple' });

    expect(result.guardrailReasons).toContain('cropguard_unavailable');
    expect(analyzeWithCropGuard).not.toHaveBeenCalled();
  });

  test('unsupported crop → CropGuard abstains WITHOUT loading the model', async () => {
    setOnline(false);
    analyzeWithCropGuard.mockResolvedValue({
      engine: 'cropguard-onnx',
      guardrailStatus: 'abstained',
      guardrailReasons: ['unsupported_crop'],
      supportedCrop: false,
      findings: [{ category: 'unknown' }],
    });

    const result = await diagnoseLeaf(FAKE_BASE64, 'en', { cropName: 'Wheat 🌾' });

    // Model load is NOT triggered for an unsupported crop.
    expect(ensureOnnxModelLoaded).not.toHaveBeenCalled();
    expect(analyzeWithCropGuard).toHaveBeenCalledWith(FAKE_BASE64, 'Wheat 🌾', 'en');
    expect(result.guardrailReasons).toContain('unsupported_crop');
  });
});

describe('diagnoseLeaf — online routing', () => {
  test('Gemini success → validated cloud result, edge chain not used', async () => {
    setOnline(true);
    analyzeLeafImage.mockResolvedValue({ flat: { disease: 'Tomato Early Blight', confidence: 0.9 } });
    validateGeminiDiagnosis.mockResolvedValue({ engine: 'gemini-cloud', guardrailStatus: 'passed' });

    const result = await diagnoseLeaf(FAKE_BASE64, 'en', { cropName: 'Tomato' });

    expect(result.engine).toBe('gemini-cloud');
    expect(validateGeminiDiagnosis).toHaveBeenCalled();
    expect(ensureOnnxModelLoaded).not.toHaveBeenCalled();
    expect(analyzeWithCropGuard).not.toHaveBeenCalled();
  });

  test('Gemini throws → edge chain runs CropGuard for supported crop', async () => {
    setOnline(true);
    analyzeLeafImage.mockRejectedValue(new Error('network down'));

    const result = await diagnoseLeaf(FAKE_BASE64, 'en', { cropName: 'Tomato' });

    expect(ensureOnnxModelLoaded).toHaveBeenCalledTimes(1);
    expect(analyzeWithCropGuard).toHaveBeenCalled();
    expect(result.engine).toBe('cropguard-onnx');
  });

  test('Gemini reports CLOUD_AI_UNAVAILABLE → edge chain runs CropGuard', async () => {
    setOnline(true);
    analyzeLeafImage.mockResolvedValue({ code: 'CLOUD_AI_UNAVAILABLE' });

    const result = await diagnoseLeaf(FAKE_BASE64, 'en', { cropName: 'Tomato' });

    expect(ensureOnnxModelLoaded).toHaveBeenCalledTimes(1);
    expect(analyzeWithCropGuard).toHaveBeenCalled();
    expect(result.engine).toBe('cropguard-onnx');
  });
});
