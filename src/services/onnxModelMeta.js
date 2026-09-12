/**
 * ONNX Model Metadata — CropGuard ResNet50 (PlantVillage 38-class)
 *
 * This file documents the exact contract for the CropGuard ONNX model.
 * All values come from verified model inspection (model-test/inspect_model.py)
 * and the validated Python inference test (model-test/test_inference.py).
 *
 * ARCHITECTURE: ResNet50 fine-tuned on PlantVillage
 * NOT MobileNetV2 — the model is ~90 MB (ResNet50 scale).
 *
 * IMPORTANT: Do NOT modify tensor names, preprocessing, or class count
 * without re-verifying against the actual ONNX model file.
 */

export const MODEL_META = {
  // ── Model file ──────────────────────────────────────────────────────────────
  /** Path to the .onnx model file, relative to the public/ root. */
  modelPath: '/models/cropguard.onnx',

  /**
   * Whether a real trained model file currently exists at modelPath.
   * Set to true — the CropGuard model has been independently tested and verified.
   */
  modelAvailable: true,

  // ── Architecture & provenance ───────────────────────────────────────────────
  /** ResNet50 fine-tuned on PlantVillage 38-class dataset. */
  architecture: 'ResNet50',

  /** PlantVillage 38-class crop disease/healthy classification dataset. */
  trainingDataset: 'PlantVillage',

  /** Single-label multi-class classification (38 classes, 14 crops). */
  task: 'classification',

  /** Approximate file size in bytes (~90 MB). */
  modelSizeBytes: 94_240_000,

  // ── Input specification (verified from model inspection) ────────────────────
  input: {
    /** ONNX input tensor name — verified via onnxruntime InferenceSession. */
    name: 'input',

    /** Spatial dimensions the model was trained on. */
    width: 224,
    height: 224,

    /** Number of colour channels (RGB). */
    channels: 3,

    /** Tensor layout: NCHW (PyTorch convention). */
    layout: 'NCHW',

    /** Element data type. */
    dtype: 'float32',

    /**
     * Per-channel normalisation applied AFTER scaling pixels to [0, 1].
     * Standard ImageNet values — used during CropGuard training.
     */
    normalize: {
      mean: [0.485, 0.456, 0.406],
      std: [0.229, 0.224, 0.225],
    },

    /**
     * CropGuard preprocessing pipeline:
     *   1. Resize so the shorter side = 256, preserving aspect ratio
     *   2. Center-crop to 224×224
     *
     * This is NOT simple distortion resize to 224×224.
     * Using simple resize will produce incorrect predictions.
     */
    resizeBehavior: 'short-side-256-center-crop-224',
  },

  // ── Output specification ────────────────────────────────────────────────────
  output: {
    /** ONNX output tensor name — verified via onnxruntime InferenceSession. */
    name: 'logits',

    /** Number of classes the classification head produces. */
    numClasses: 38,

    /**
     * The model outputs RAW LOGITS — not softmax probabilities.
     * Temperature scaling (T=0.591) must be applied before softmax
     * to produce calibrated probabilities.
     */
    activation: 'raw-logits',
  },

  // ── Temperature scaling ─────────────────────────────────────────────────────
  /**
   * Post-hoc calibration temperature. Applied as: softmax(logits / T).
   * Determined from CropGuard's calibration process.
   * This sharpens the probability distribution for better-calibrated outputs.
   */
  temperature: 0.591,

  // ── Validation evidence ─────────────────────────────────────────────────────
  validation: {
    /**
     * Model was trained and evaluated on PlantVillage.
     * This does NOT constitute field validation.
     */
    validated: false,

    /** Evaluation was on the PlantVillage dataset domain only. */
    dataset: 'PlantVillage (dataset-domain evaluation only)',

    /**
     * Accuracy on the PlantVillage held-out test set.
     * NOT populated here — we do not fabricate metrics.
     * The model has been functionally verified to produce correct predictions
     * on test images (see model-test/).
     */
    accuracy: null,

    /** Free-text notes on validation. */
    notes:
      'CropGuard is a closed-set classifier trained on PlantVillage. ' +
      'It will produce predictions for ANY image — including non-leaf images — ' +
      'because it has no native out-of-distribution detection. ' +
      'AGRIO uses guardrails (visionGuardService) to reject uncertain results. ' +
      'Real-world field performance may differ significantly from PlantVillage evaluation.',
  },
};
