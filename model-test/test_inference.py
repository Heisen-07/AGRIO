import numpy as np
import onnxruntime as ort
from PIL import Image

MODEL = "public/models/cropguard.onnx"
IMAGE = "model-test/test_leaf.jpg"

# Exact class order from classes.json
CLASS_NAMES = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___healthy",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Raspberry___healthy",
    "Soybean___healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
]

# CropGuard preprocessing:
# resize short side -> 256
# center crop -> 224x224
# RGB
# [0,1]
# ImageNet normalization
def preprocess(image_path):
    image = Image.open(image_path).convert("RGB")

    # Resize while preserving aspect ratio.
    width, height = image.size
    scale = 256 / min(width, height)
    new_width = round(width * scale)
    new_height = round(height * scale)

    image = image.resize((new_width, new_height), Image.Resampling.BILINEAR)

    # Center crop 224x224
    left = (new_width - 224) // 2
    top = (new_height - 224) // 2
    image = image.crop((left, top, left + 224, top + 224))

    arr = np.asarray(image).astype(np.float32) / 255.0

    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    arr = (arr - mean) / std

    # HWC -> CHW -> NCHW
    arr = np.transpose(arr, (2, 0, 1))
    arr = np.expand_dims(arr, axis=0)

    return arr


def softmax(logits):
    logits = logits - np.max(logits)
    exp = np.exp(logits)
    return exp / np.sum(exp)


print("Loading model...")

session = ort.InferenceSession(
    MODEL,
    providers=["CPUExecutionProvider"]
)

input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name

print("Input :", input_name)
print("Output:", output_name)

image_tensor = preprocess(IMAGE)

print("Running inference...")

logits = session.run(
    [output_name],
    {input_name: image_tensor}
)[0][0]

# CropGuard documentation says calibration temperature = 0.591
TEMPERATURE = 0.591

calibrated_probs = softmax(logits / TEMPERATURE)

top_indices = np.argsort(calibrated_probs)[::-1][:5]

print("\n=== TOP 5 PREDICTIONS ===")

for rank, idx in enumerate(top_indices, start=1):
    print(
        f"{rank}. {CLASS_NAMES[idx]} "
        f"-> {calibrated_probs[idx] * 100:.2f}%"
    )

best_idx = top_indices[0]

print("\n=== BEST PREDICTION ===")
print("Class      :", CLASS_NAMES[best_idx])
print("Confidence :", f"{calibrated_probs[best_idx] * 100:.2f}%")
print("Class index:", best_idx)