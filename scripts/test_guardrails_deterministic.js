/**
 * Standalone deterministic test runner for visionGuardService.
 * Runs in pure Node.js (ES module) with no external runner dependencies.
 */

import {
  isCropSupported,
  normalizeToCropGuardKey,
  analyzeWithCropGuard,
} from '../src/services/visionGuardService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// Helpers
function makeLogits(dominantIdx, dominantValue = 10.0, baseValue = -2.0) {
  const logits = new Float32Array(38).fill(baseValue);
  logits[dominantIdx] = dominantValue;
  return logits;
}

function makeAmbiguousLogits(idx1, idx2, value1 = 5.0, value2 = 4.95) {
  const logits = new Float32Array(38).fill(-2.0);
  logits[idx1] = value1;
  logits[idx2] = value2;
  return logits;
}

async function runTests() {
  console.log('--- Testing Crop Normalization & Support ---');
  assert(normalizeToCropGuardKey('Tomato') === 'tomato', 'normalize Tomato -> tomato');
  assert(normalizeToCropGuardKey('Tomato 🍅') === 'tomato', 'normalize Tomato 🍅 -> tomato');
  assert(normalizeToCropGuardKey('Bell Pepper') === 'pepper', 'normalize Bell Pepper -> pepper');
  assert(normalizeToCropGuardKey('Corn (Maize)') === 'corn', 'normalize Corn (Maize) -> corn');
  assert(normalizeToCropGuardKey('Wheat') === null, 'Wheat returns null');
  assert(isCropSupported('Tomato') === true, 'Tomato is supported');
  assert(isCropSupported('Wheat') === false, 'Wheat is unsupported');

  console.log('\n--- Testing Guardrail Scenarios ---');

  const defaultDeps = {
    getReadiness: () => 'ready',
    preprocess: async () => new Float32Array(1 * 3 * 224 * 224),
    extractMetrics: async () => ({
      width: 640, height: 480,
      meanBrightness: 128, brightnessVariance: 2000,
      greenRatio: 0.35, darkRatio: 0.05, brightRatio: 0.05, uniformRatio: 0.1,
    }),
    runInference: async () => new Float32Array(38),
  };

  const FAKE_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

  // Scenario 1: Supported healthy crop -> accepted
  {
    const deps = {
      ...defaultDeps,
      runInference: async () => makeLogits(37, 10.0), // Tomato healthy
    };
    const res = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en', deps);
    assert(res.engine === 'cropguard-onnx', 'Scenario 1: engine is cropguard-onnx');
    assert(res.guardrailStatus === 'passed', 'Scenario 1: guardrail passed');
    assert(res.findings[0].category === 'healthy', 'Scenario 1: finding category is healthy');
  }

  // Scenario 2: Supported disease crop -> accepted
  {
    const deps = {
      ...defaultDeps,
      runInference: async () => makeLogits(29, 10.0), // Tomato Early Blight
    };
    const res = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en', deps);
    assert(res.guardrailStatus === 'passed', 'Scenario 2: guardrail passed');
    assert(res.findings[0].category === 'disease', 'Scenario 2: finding category is disease');
    assert(res.findings[0].title.includes('Early Blight'), 'Scenario 2: title includes Early Blight');
  }

  // Scenario 3: Low confidence -> unknown (abstained)
  {
    const deps = {
      ...defaultDeps,
      runInference: async () => makeLogits(29, 0.5, 0.4),
    };
    const res = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en', deps);
    assert(res.guardrailStatus === 'abstained', 'Scenario 3: guardrail abstained');
    assert(res.guardrailReasons.includes('low_model_confidence'), 'Scenario 3: reason low_model_confidence');
    assert(res.findings[0].category === 'unknown', 'Scenario 3: finding is unknown');
  }

  // Scenario 4: Crop mismatch -> unknown
  {
    const deps = {
      ...defaultDeps,
      runInference: async () => makeLogits(0, 10.0), // Apple Scab
    };
    const res = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en', deps);
    assert(res.guardrailStatus === 'abstained', 'Scenario 4: guardrail abstained');
    assert(res.guardrailReasons.includes('crop_prediction_mismatch'), 'Scenario 4: reason crop_prediction_mismatch');
    assert(res.findings[0].category === 'unknown', 'Scenario 4: finding is unknown');
  }

  // Scenario 5: Non-leaf image (uniform surface) -> unknown
  {
    const deps = {
      ...defaultDeps,
      extractMetrics: async () => ({
        width: 640, height: 480,
        meanBrightness: 180, brightnessVariance: 50,
        greenRatio: 0.01, darkRatio: 0.02, brightRatio: 0.1, uniformRatio: 0.85,
      }),
    };
    const res = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en', deps);
    assert(res.guardrailStatus === 'abstained', 'Scenario 5: guardrail abstained');
    assert(res.guardrailReasons.includes('non_leaf_or_invalid_image'), 'Scenario 5: reason non_leaf_or_invalid_image');
    assert(res.findings[0].category === 'unknown', 'Scenario 5: finding is unknown');
  }

  // Scenario 6: Unsupported crop -> unknown without running inference
  {
    let inferenceCalled = false;
    const deps = {
      ...defaultDeps,
      runInference: async () => {
        inferenceCalled = true;
        return makeLogits(0, 10.0);
      },
    };
    const res = await analyzeWithCropGuard(FAKE_BASE64, 'Wheat', 'en', deps);
    assert(res.guardrailStatus === 'abstained', 'Scenario 6: guardrail abstained');
    assert(res.guardrailReasons.includes('unsupported_crop'), 'Scenario 6: reason unsupported_crop');
    assert(inferenceCalled === false, 'Scenario 6: inference was NOT called');
  }

  // Scenario 7: Ambiguous top 1 / top 2 -> unknown
  {
    const deps = {
      ...defaultDeps,
      runInference: async () => makeAmbiguousLogits(29, 30, 5.0, 4.95),
    };
    const res = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en', deps);
    assert(res.guardrailStatus === 'abstained', 'Scenario 7: guardrail abstained');
    assert(res.guardrailReasons.includes('ambiguous_prediction'), 'Scenario 7: reason ambiguous_prediction');
    assert(res.findings[0].category === 'unknown', 'Scenario 7: finding is unknown');
  }

  // Scenario 8: NaN logits -> model_error
  {
    const deps = {
      ...defaultDeps,
      runInference: async () => new Float32Array(38).fill(NaN),
    };
    const res = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en', deps);
    assert(res.guardrailStatus === 'abstained', 'Scenario 8: guardrail abstained');
    assert(res.guardrailReasons.includes('model_error'), 'Scenario 8: reason model_error');
  }

  // Scenario 9: Model unavailable -> throws so diagnosisService falls back
  {
    const deps = {
      ...defaultDeps,
      getReadiness: () => 'unavailable',
    };
    let threw = false;
    try {
      await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en', deps);
    } catch (e) {
      threw = true;
      assert(e.message.includes('CropGuard model unavailable'), 'Scenario 9: correct throw message');
    }
    assert(threw, 'Scenario 9: threw on model unavailable');
  }

  // Scenario 10: Too dark image -> poor_image_quality
  {
    const deps = {
      ...defaultDeps,
      extractMetrics: async () => ({
        width: 640, height: 480,
        meanBrightness: 15, brightnessVariance: 200,
        greenRatio: 0.01, darkRatio: 0.85, brightRatio: 0.0, uniformRatio: 0.1,
      }),
    };
    const res = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'en', deps);
    assert(res.guardrailStatus === 'abstained', 'Scenario 10: guardrail abstained');
    assert(res.guardrailReasons.includes('poor_image_quality'), 'Scenario 10: reason poor_image_quality');
  }

  // Scenario 11: Hindi localization
  {
    const deps = {
      ...defaultDeps,
      runInference: async () => makeLogits(37, 10.0),
    };
    const res = await analyzeWithCropGuard(FAKE_BASE64, 'Tomato', 'hi', deps);
    assert(res.findings[0].title.includes('टमाटर'), 'Scenario 11: title contains Hindi text');
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
