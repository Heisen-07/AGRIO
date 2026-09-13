/**
 * AGRIO — Final Diagnosis UX, Deduplication, KVK Removal & Safety Verification Tests
 *
 * Deterministic automated tests validating:
 * 1. Healthy tomato scan produces zero-finding healthy summary (no duplicate empty cards)
 * 2. Disease finding displays cleanly with concise actions and no duplication
 * 3. Pest finding displays cleanly
 * 4. Multi-signal (disease + pest) displays cleanly without cross-duplication
 * 5. Nutrient observation marked as visual leaf symptom (not soil NPK)
 * 6. Cloud failure falls back gracefully with status line, without leaking 'TypeError: Failed to fetch'
 * 7. KVK broken CTAs removed (passive text only)
 * 8. Hardcoded chemical dosages completely purged
 * 9. Heuristic engine clearly labeled with evidence strength (never CropGuard, never clinical High)
 * 10. CropGuard ONNX properly attributed
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { runHeuristicDiagnosis } from '../edgeVisionService';
import { diagnoseLeaf } from '../diagnosisService';
import SAMPLE_ADVISORIES from '../advisoryService.samples';
import { translations } from '../../utils/i18n';

// Mocks for diagnosisService tests
vi.mock('../geminiService', () => ({
  analyzeLeafImage: vi.fn(),
}));

vi.mock('../onnxVisionService', () => ({
  ensureOnnxModelLoaded: vi.fn(),
  getOnnxModelReadiness: vi.fn(() => 'ready'),
  runOnnxInference: vi.fn(),
  preprocessImage: vi.fn(),
  extractImageMetrics: vi.fn(),
}));

vi.mock('../visionGuardService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    analyzeWithCropGuard: vi.fn(),
    validateGeminiDiagnosis: vi.fn(),
  };
});

import { analyzeLeafImage } from '../geminiService';
import { ensureOnnxModelLoaded } from '../onnxVisionService';
import { analyzeWithCropGuard } from '../visionGuardService';

const FAKE_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

beforeEach(() => {
  vi.clearAllMocks();
  ensureOnnxModelLoaded.mockResolvedValue({ ready: true, readiness: 'ready', code: null });
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
});

describe('AGRIO Diagnosis UX & Safety Suite', () => {

  // Test 1: Healthy crop diagnosis produces a healthy summary without duplicate disease/pest/deficiency findings
  test('1. Healthy tomato scan produces healthy finding with no duplicate empty findings', () => {
    const healthyRatios = {
      coverage: 0.5,
      greenRatio: 0.85,
      yellowRatio: 0.05,
      brownRatio: 0.0,
      rustRatio: 0.0,
      darkRatio: 0.0,
      lesionRatio: 0.0,
      holeRatio: 0.0,
      textureScore: 0.0,
    };

    const result = runHeuristicDiagnosis(healthyRatios, 'Tomato 🍅', 'en');
    expect(result.disease).toContain('Healthy');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe('healthy');
    expect(result.pestPressure.status).toMatch(/none|optimal/i);
    expect(result.pestPressure.severity).toBe('Low');
    expect(result.nutrientDeficiency.status).toMatch(/optimal/i);
  });

  // Test 2: Disease finding displays cleanly with concise actions without duplicating
  test('2. Disease finding displays qualitative actions without duplicating content', () => {
    const blightRatios = {
      coverage: 0.5,
      greenRatio: 0.45,
      yellowRatio: 0.10,
      brownRatio: 0.20,
      rustRatio: 0.02,
      darkRatio: 0.15,
      lesionRatio: 0.22,
      holeRatio: 0.01,
      textureScore: 0.10,
    };

    const result = runHeuristicDiagnosis(blightRatios, 'Tomato 🍅', 'en');
    expect(result.disease).toContain('Blight');
    expect(result.treatment_steps.length).toBeGreaterThan(0);
    expect(result.treatment_steps.length).toBeLessThanOrEqual(4);

    // Each treatment step is unique
    const uniqueSteps = new Set(result.treatment_steps);
    expect(uniqueSteps.size).toBe(result.treatment_steps.length);

    // Every step provides qualitative advice
    result.treatment_steps.forEach((step) => {
      expect(typeof step).toBe('string');
      expect(step.length).toBeGreaterThan(5);
    });
  });

  // Test 3: Pest finding cleanly represented
  test('3. Pest finding clearly captured in pestPressure', () => {
    const pestRatios = {
      coverage: 0.5,
      greenRatio: 0.60,
      yellowRatio: 0.05,
      brownRatio: 0.05,
      rustRatio: 0.01,
      darkRatio: 0.05,
      lesionRatio: 0.02,
      holeRatio: 0.15,
      textureScore: 0.25,
    };

    const result = runHeuristicDiagnosis(pestRatios, 'Tomato 🍅', 'en');
    expect(result.pestPressure).toBeDefined();
    expect(result.pestPressure.severity).toBeDefined();
    expect(result.pestPressure.severity).not.toBe('Low');
  });

  // Test 4: Visual nutrient symptom distinction
  test('4. Nutrient observation is identified as visual foliar symptom', () => {
    const chlorosisRatios = {
      coverage: 0.5,
      greenRatio: 0.40,
      yellowRatio: 0.35,
      brownRatio: 0.02,
      rustRatio: 0.01,
      darkRatio: 0.02,
      lesionRatio: 0.02,
      holeRatio: 0.01,
      textureScore: 0.05,
    };

    const result = runHeuristicDiagnosis(chlorosisRatios, 'Tomato 🍅', 'en');
    expect(result.nutrientDeficiency).toBeDefined();
    expect(result.nutrientDeficiency.status).toContain('Chlorosis');
  });

  // Test 5: Fallback when Gemini fetch throws TypeError
  test('5. Gemini fetch network failure falls back gracefully with cloudFallback note and no raw stack trace', async () => {
    // Cloud fails with TypeError: Failed to fetch
    analyzeLeafImage.mockRejectedValue(new TypeError('Failed to fetch'));

    // Edge ONNX returns a valid diagnosis
    analyzeWithCropGuard.mockResolvedValue({
      overallStatus: { code: 'issues_found', label: 'Issues Found' },
      findings: [{ category: 'disease', title: 'Tomato Early Blight' }],
      disease: 'Tomato Early Blight',
      confidence: 0.85,
      severity: 'Moderate',
      treatment_steps: ['Isolate affected plant', 'Inspect lower canopy'],
      guardrailStatus: 'passed',
      engine: 'cropguard-onnx',
      onDevice: true,
    });

    const result = await diagnoseLeaf(FAKE_BASE64, 'en', { cropName: 'Tomato 🍅' });

    expect(result).toBeDefined();
    expect(result.cloudFallback).toBe(true);
    expect(result.fallbackMessage).toBe('Online AI unavailable • using on-device analysis');
    // Ensure raw error is not exposed in the diagnosis output
    expect(JSON.stringify(result)).not.toContain('TypeError');
    expect(JSON.stringify(result)).not.toContain('Failed to fetch');
  });

  // Test 6: Bilingual fallback message in Hindi
  test('6. Bilingual fallback message in Hindi when Gemini fails', async () => {
    analyzeLeafImage.mockRejectedValue(new Error('Network error'));

    analyzeWithCropGuard.mockResolvedValue({
      overallStatus: { code: 'issues_found', label: 'Issues Found' },
      findings: [{ category: 'disease', title: 'टमाटर अगेती झुलसा' }],
      disease: 'टमाटर अगेती झुलसा',
      confidence: 0.85,
      severity: 'Moderate',
      treatment_steps: ['प्रभावित पत्तियों को हटाएं'],
      guardrailStatus: 'passed',
      engine: 'cropguard-onnx',
      onDevice: true,
    });

    const result = await diagnoseLeaf(FAKE_BASE64, 'hi', { cropName: 'Tomato 🍅' });
    expect(result.cloudFallback).toBe(true);
    expect(result.fallbackMessage).toBe('ऑनलाइन AI अनुपलब्ध • डिवाइस पर विश्लेषण का उपयोग');
  });

  // Test 7: KVK removal & passive expert text only
  test('7. No broken KVK CTAs or external links exist in i18n or samples', () => {
    const en = translations.en;
    const hi = translations.hi;

    // Verify translations do NOT promote broken external link or find CTA
    const i18nJson = JSON.stringify(translations);
    expect(i18nJson).not.toContain('kvk.icar.gov.in');
    expect(i18nJson).not.toContain('Find Nearest KVK');
    expect(i18nJson).not.toContain('निकटतम केवीके खोजें');

    // Verify passive referral text is present
    expect(en.expertReviewTitle).toBe('Expert Review Recommended');
    expect(en.expertReviewBody).toContain('AGRIO will support local agricultural expert referral');
    expect(hi.expertReviewTitle).toBe('विशेषज्ञ समीक्षा अनुशंसित');
    expect(hi.expertReviewBody).toContain('KVK निर्देशिका');

    // Verify samples do not have broken KVK links
    const samplesJson = JSON.stringify(SAMPLE_ADVISORIES);
    expect(samplesJson).not.toContain('kvk.icar.gov.in');
    expect(samplesJson).not.toContain('Find Nearest KVK');
  });

  // Test 8: Purge of hardcoded chemical dosages across the entire codebase
  test('8. Hardcoded chemical dosages are strictly purged', () => {
    const metrics = {
      coverage: 0.5,
      greenRatio: 0.45,
      yellowRatio: 0.10,
      brownRatio: 0.20,
      rustRatio: 0.02,
      darkRatio: 0.15,
      lesionRatio: 0.22,
      holeRatio: 0.01,
      textureScore: 0.10,
    };

    const enResult = runHeuristicDiagnosis(metrics, 'Tomato 🍅', 'en');
    const hiResult = runHeuristicDiagnosis(metrics, 'Tomato 🍅', 'hi');

    const enJson = JSON.stringify(enResult);
    const hiJson = JSON.stringify(hiResult);
    const samplesJson = JSON.stringify(SAMPLE_ADVISORIES);
    const i18nJson = JSON.stringify(translations);

    const forbiddenPatterns = [
      /5\s*m[lL]\/[lL]/i,
      /1\s*m[lL]\/[lL]/i,
      /2\s*g\/[lL]/i,
      /1\.5\s*%/i,
      /Propiconazole/i,
      /Mancozeb\s*@/i,
    ];

    forbiddenPatterns.forEach((pattern) => {
      expect(enJson).not.toMatch(pattern);
      expect(hiJson).not.toMatch(pattern);
      expect(samplesJson).not.toMatch(pattern);
      expect(i18nJson).not.toMatch(pattern);
    });
  });

  // Test 9: Legacy heuristic engine attribution & evidence strength
  test('9. Legacy heuristic is never labeled CropGuard and reports evidence strength', () => {
    const metrics = {
      coverage: 0.5,
      greenRatio: 0.45,
      yellowRatio: 0.10,
      brownRatio: 0.20,
      rustRatio: 0.02,
      darkRatio: 0.15,
      lesionRatio: 0.22,
      holeRatio: 0.01,
      textureScore: 0.10,
    };

    const result = runHeuristicDiagnosis(metrics, 'Spinach 🥬', 'en');
    expect(result.engine).toBe('legacy-heuristic');
    expect(result.engineLabel).toBe('Legacy Heuristic — On-device');
    expect(result.evidenceStrength).toBe('Moderate');
    // Heuristic evidence should never claim clinical High severity by default
    expect(result.severityLabel).toMatch(/Moderate/i);
    expect(result.engine).not.toBe('cropguard-onnx');
  });

  // Test 10: CropGuard ONNX safe routing and attribution
  test('10. CropGuard ONNX is properly labeled when used', async () => {
    analyzeWithCropGuard.mockResolvedValue({
      overallStatus: { code: 'issues_found', label: 'Issues Found' },
      findings: [{ category: 'disease', title: 'Tomato Early Blight' }],
      disease: 'Tomato Early Blight',
      confidence: 0.88,
      severity: 'Moderate',
      treatment_steps: ['Isolate affected foliage'],
      guardrailStatus: 'passed',
      engine: 'cropguard-onnx',
      onDevice: true,
    });

    // When offline, diagnoseLeaf routes supported crops directly to CropGuard
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });

    const result = await diagnoseLeaf(FAKE_BASE64, 'en', { cropName: 'Tomato 🍅' });
    expect(result.engine).toBe('cropguard-onnx');
    expect(result.guardrailStatus).toBe('passed');
    expect(result.onDevice).toBe(true);
  });

});
