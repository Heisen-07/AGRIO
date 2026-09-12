# AGRIO ONNX Models Directory

This directory holds trained ONNX model files for on-device inference.

## Current Status

**No trained agricultural model is currently present.**

The ONNX integration infrastructure is implemented and waiting for a real
trained model file. See `src/services/onnxModelMeta.js` for the expected
model contract.

## How to Add a Model

1. Train or obtain a plant-disease classification model (e.g., MobileNetV2
   fine-tuned on PlantVillage).
2. Export to ONNX format.
3. Place the `.onnx` file here as `plant_disease.onnx` (or update the
   `modelPath` in `onnxModelMeta.js`).
4. Update `onnxModelMeta.js` with the actual input/output specification.
5. Populate `onnxLabels.js` with the real class mapping.
6. Set `modelAvailable: true` in `onnxModelMeta.js`.

## Required Model Information

Before integrating a model, document:

- Model architecture (e.g., MobileNetV2)
- Training dataset and class list
- Input tensor: name, shape (e.g., [1, 3, 224, 224]), normalization
- Output tensor: name, shape (e.g., [1, 38]), activation type
- Validation metrics (from real evaluation, never fabricated)
