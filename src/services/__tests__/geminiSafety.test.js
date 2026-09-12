/**
 * Gemini Safety & Guardrail Enforcement — Deterministic Unit Tests
 *
 * Verifies that online Gemini results are subjected to the unified AGRIO
 * safety policy (crop whitelist, cross-crop compatibility, confidence floor,
 * unknown/abstain handling, malformed response rejection) and that no fake
 * demo diagnoses exist.
 */

import { describe, test, expect } from 'vitest';
import { validateGeminiDiagnosis } from '../visionGuardService';
import { buildCloudUnavailableResult } from '../geminiService';
import { CATEGORY } from '../visionSchema';

describe('Gemini Safety Policy & Guardrails', () => {
  // 1. Valid supported Gemini diagnosis → accepted
  test('1. Valid supported Gemini diagnosis → accepted', async () => {
    const rawResult = {
      flat: {
        disease: 'Tomato Early Blight',
        confidence: 88,
        severity: 'Moderate',
        description: 'Target-like concentric rings on lower leaves.',
        treatment_steps: ['Remove infected leaves', 'Apply copper fungicide'],
      },
      findings: [
        {
          category: CATEGORY.DISEASE,
          title: 'Tomato Early Blight',
        },
      ],
    };

    const result = await validateGeminiDiagnosis(rawResult, {
      cropName: 'Tomato 🍅',
      lang: 'en',
    });

    expect(result.guardrailStatus).toBe('passed');
    expect(result.findings[0].category).toBe(CATEGORY.DISEASE);
    expect(result.overallStatus.code).toBe('issues_found');
    expect(result.disease).toBe('Tomato Early Blight');
    expect(result.confidence).toBe(88);
    expect(result.engine).toBe('gemini-cloud');
    expect(result.onDevice).toBe(false);
  });

  // 2. Unsupported crop → UNKNOWN
  test('2. Unsupported crop → UNKNOWN (abstained)', async () => {
    const rawResult = {
      flat: {
        disease: 'Mango Anthracnose',
        confidence: 90,
      },
    };

    const result = await validateGeminiDiagnosis(rawResult, {
      cropName: 'Mango 🥭',
      lang: 'en',
    });

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('unsupported_crop');
    expect(result.findings[0].category).toBe(CATEGORY.UNKNOWN);
    expect(result.overallStatus.code).toBe('unknown');
  });

  // 3. Crop mismatch → UNKNOWN
  test('3. Crop mismatch (e.g. Apple scab returned for Tomato) → UNKNOWN', async () => {
    const rawResult = {
      flat: {
        disease: 'Apple Scab',
        confidence: 85,
        treatment_steps: ['Spray captan'],
      },
    };

    const result = await validateGeminiDiagnosis(rawResult, {
      cropName: 'Tomato 🍅',
      lang: 'en',
    });

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('crop_prediction_mismatch');
    expect(result.findings[0].category).toBe(CATEGORY.UNKNOWN);
    expect(result.overallStatus.code).toBe('unknown');
  });

  // 4. Missing confidence → UNKNOWN or safely handled
  test('4. Missing confidence → UNKNOWN / abstained', async () => {
    const rawResult = {
      flat: {
        disease: 'Tomato Late Blight',
        confidence: null,
      },
    };

    const result = await validateGeminiDiagnosis(rawResult, {
      cropName: 'Tomato 🍅',
      lang: 'en',
    });

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.guardrailReasons).toContain('low_model_confidence');
    expect(result.findings[0].category).toBe(CATEGORY.UNKNOWN);
    expect(result.overallStatus.code).toBe('unknown');
  });

  // 5. Malformed Gemini response → UNKNOWN
  test('5. Malformed Gemini response (null, empty, or missing disease) → UNKNOWN', async () => {
    const malformed1 = await validateGeminiDiagnosis(null, {
      cropName: 'Tomato 🍅',
      lang: 'en',
    });
    expect(malformed1.guardrailStatus).toBe('abstained');
    expect(malformed1.guardrailReasons).toContain('malformed_output');
    expect(malformed1.findings[0].category).toBe(CATEGORY.UNKNOWN);
    expect(malformed1.overallStatus.code).toBe('unknown');

    const malformed2 = await validateGeminiDiagnosis({ flat: { disease: '   ' } }, {
      cropName: 'Tomato 🍅',
      lang: 'en',
    });
    expect(malformed2.guardrailStatus).toBe('abstained');
    expect(malformed2.guardrailReasons).toContain('malformed_output');
    expect(malformed2.findings[0].category).toBe(CATEGORY.UNKNOWN);
    expect(malformed2.overallStatus.code).toBe('unknown');
  });

  // 6. Unknown Gemini category → UNKNOWN
  test('6. Unknown Gemini category → UNKNOWN', async () => {
    const rawResult = {
      flat: {
        disease: 'Unknown leaf symptom',
        confidence: 70,
      },
      findings: [
        {
          category: CATEGORY.UNKNOWN,
          title: 'Unknown leaf symptom',
        },
      ],
    };

    const result = await validateGeminiDiagnosis(rawResult, {
      cropName: 'Tomato 🍅',
      lang: 'en',
    });

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.findings[0].category).toBe(CATEGORY.UNKNOWN);
    expect(result.overallStatus.code).toBe('unknown');
  });

  // 7. Missing API key → CLOUD_UNAVAILABLE, NOT fake disease
  test('7. Missing API key returns CLOUD_AI_UNAVAILABLE and NOT fake Yellow Rust/Propiconazole', () => {
    const result = buildCloudUnavailableResult({ lang: 'en' });

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.code).toBe('CLOUD_AI_UNAVAILABLE');
    expect(result.findings[0].category).toBe(CATEGORY.UNKNOWN);
    expect(result.overallStatus.code).toBe('unknown');
    expect(result.confidence).toBeNull();
    expect(result.disease).not.toContain('Yellow Rust');
    expect(JSON.stringify(result)).not.toContain('Propiconazole');
    expect(result.description).toContain('Online AI is unavailable');
  });

  // 8. Gemini disease result cannot create treatment when result is UNKNOWN
  test('8. Gemini disease result cannot create treatment when result is UNKNOWN', async () => {
    const rawResult = {
      flat: {
        disease: 'Apple Scab', // mismatch on tomato
        confidence: 90,
        treatment_steps: ['Propiconazole 25% EC', 'Chemical Fungicide Spray'],
      },
    };

    const result = await validateGeminiDiagnosis(rawResult, {
      cropName: 'Tomato 🍅',
      lang: 'en',
    });

    expect(result.findings[0].category).toBe(CATEGORY.UNKNOWN);
    expect(result.treatment_steps).not.toContain('Propiconazole 25% EC');
    expect(result.advisory.sprayStatus).toContain('Re-scan Required');
    // Ensure recommendations are safe guidance (retake photo), not chemical treatments
    result.treatment_steps.forEach((step) => {
      expect(step.toLowerCase()).not.toContain('fungicide');
      expect(step.toLowerCase()).not.toContain('propiconazole');
    });
  });

  // 9. Gemini disease result cannot create confirmed disease risk when result is UNKNOWN
  test('9. Gemini disease result cannot create confirmed disease risk when result is UNKNOWN', async () => {
    const rawResult = {
      flat: {
        disease: 'Inconclusive fungal spot',
        confidence: 40, // below 50% floor
      },
    };

    const result = await validateGeminiDiagnosis(rawResult, {
      cropName: 'Tomato 🍅',
      lang: 'en',
    });

    expect(result.guardrailStatus).toBe('abstained');
    expect(result.overallStatus.code).toBe('unknown');
    expect(result.findings[0].category).toBe(CATEGORY.UNKNOWN);
  });
});
