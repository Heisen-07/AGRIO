import onnx
import onnxruntime as ort

MODEL = "public/models/cropguard.onnx"

print("Loading model...")

model = onnx.load(MODEL)
onnx.checker.check_model(model)

print("✅ ONNX model is valid")

session = ort.InferenceSession(
    MODEL,
    providers=["CPUExecutionProvider"]
)

print("\n=== INPUTS ===")
for x in session.get_inputs():
    print("Name :", x.name)
    print("Shape:", x.shape)
    print("Type :", x.type)

print("\n=== OUTPUTS ===")
for x in session.get_outputs():
    print("Name :", x.name)
    print("Shape:", x.shape)
    print("Type :", x.type)

print("\nProviders:")
print(session.get_providers())