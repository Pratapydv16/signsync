from model_utils import load_model, load_model_metadata
import os

print(f"Checking files...")
print(f"model.p exists: {os.path.exists('model.p')}")
print(f"model_meta.json exists: {os.path.exists('model_meta.json')}")

m, l = load_model('model.p')
mt = load_model_metadata('model_meta.json')

if m:
    print("SUCCESS: Model loaded.")
    print(f"Metadata: {mt}")
else:
    print("FAILURE: Model failed to load.")
