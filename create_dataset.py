import os
import sys
import pickle
import random

# Workaround for mediapipe/tensorflow protobuf version conflict:
# Prevent mediapipe from optionally importing tensorflow docs, which breaks on protobuf>=4
sys.modules['tensorflow'] = None
import mediapipe as mp
import cv2
import numpy as np

mp_hands = mp.solutions.hands

# Use static_image_mode for dataset creation
hands_detector = mp_hands.Hands(static_image_mode=True, min_detection_confidence=0.3)

# Fallback paths to find dataset images
if os.path.exists('./kaggle_data/processed_combine_asl_dataset'):
    DATA_DIR = './kaggle_data/processed_combine_asl_dataset'
elif os.path.exists('./data'):
    DATA_DIR = './data'
else:
    print("[ERROR] Could not find dataset folder ('./kaggle_data/...' or './data').")
    sys.exit(1)

# ─── Feature Extraction ──────────────────────────────────────────────────────
def extract_features(hand_landmarks):
    """
    Extract a normalized feature vector from hand landmarks.
    
    Features:
      - 63 values: (x - xmin, y - ymin, z) per landmark  → raw spatial
      - 10 finger angle features                           → geometric
    Total: 73 features
    """
    lm = hand_landmarks.landmark
    xs = [p.x for p in lm]
    ys = [p.y for p in lm]
    
    xmin, ymin = min(xs), min(ys)
    
    # Bounding box size for scale normalisation
    xrange = max(xs) - xmin + 1e-6
    yrange = max(ys) - ymin + 1e-6

    data_aux = []

    # 63 normalised spatial features (x, y, z per landmark)
    for p in lm:
        data_aux.append((p.x - xmin) / xrange)
        data_aux.append((p.y - ymin) / yrange)
        data_aux.append(p.z)          # depth is already wrist-relative in MediaPipe

    # Finger angle features (tip → knuckle vectors)
    # Landmark indices: wrist=0, thumb=[1-4], index=[5-8], middle=[9-12], ring=[13-16], pinky=[17-20]
    tip_pairs = [
        (4, 2),   # thumb tip → thumb MCP
        (8, 6),   # index tip → index MCP
        (12, 10), # middle tip → middle MCP
        (16, 14), # ring tip → ring MCP
        (20, 18), # pinky tip → pinky MCP
        (8, 5),   # index tip → index base
        (12, 9),  # middle tip → middle base
        (16, 13), # ring tip → ring base
        (20, 17), # pinky tip → pinky base
        (4, 0),   # thumb tip → wrist
    ]
    for (a, b) in tip_pairs:
        vx = lm[a].x - lm[b].x
        vy = lm[a].y - lm[b].y
        angle = np.degrees(np.arctan2(vy, vx))
        data_aux.append(angle / 180.0)  # normalise to [-1, 1]

    return data_aux   # 73 features


def augment_image(img):
    """Return a list of augmented variants of the image. (Augmentation disabled for speed)"""
    variants = [img]
    return variants


# ─── Main Loop ───────────────────────────────────────────────────────────────
data   = []
labels = []

directories   = sorted([d for d in os.listdir(DATA_DIR) if os.path.isdir(os.path.join(DATA_DIR, d))])
total_classes = len(directories)

print("=" * 60)
print("  SignSync AI — Dataset Creation")
print("=" * 60)
print(f"\nFound {total_classes} classes: {directories}")

skip_count = 0

for i, dir_ in enumerate(directories):
    dir_path = os.path.join(DATA_DIR, dir_)
    files = [f for f in os.listdir(dir_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp'))]
    print(f"\n[{i+1}/{total_classes}] Class '{dir_}' — {len(files)} images")

    accepted = 0
    for j, file_img in enumerate(files):
        img_path = os.path.join(dir_path, file_img)

        # Safely load image
        try:
            img = cv2.imread(img_path)
            if img is None:
                skip_count += 1
                continue
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        except Exception:
            skip_count += 1
            continue

        # Augment
        variants = augment_image(img_rgb)

        for variant in variants:
            results = hands_detector.process(variant)
            if results.multi_hand_landmarks:
                features = extract_features(results.multi_hand_landmarks[0])
                data.append(features)
                labels.append(dir_)
                accepted += 1

        # Progress
        pct = (j + 1) / len(files) * 100
        print(f"  {j+1}/{len(files)} ({pct:.0f}%)  accepted: {accepted}", end='\r')

    print(f"  Done — {accepted} feature vectors (with augmentation)")

print(f"\n\n{'='*60}")
print(f"Total samples : {len(data)}")
print(f"Feature vector: {len(data[0]) if data else 0} features")
print(f"Skipped files : {skip_count}")
print(f"{'='*60}")

# Validate uniform length
lengths = set(len(d) for d in data)
if len(lengths) > 1:
    print(f"[WARNING] Inconsistent feature lengths: {lengths}. Fixing...")
    expected = max(lengths)
    data = [d for d in data if len(d) == expected]
    print(f"[INFO] Kept {len(data)} samples with {expected} features")

with open('data.pickle', 'wb') as f:
    pickle.dump({'data': data, 'labels': labels}, f)

print("\n[SAVED] data.pickle")
