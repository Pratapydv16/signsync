import pickle
import json
import os
import numpy as np
import math
from collections import Counter

# ─── Load Model ──────────────────────────────────────────────────────────────
def load_model(path='model.p'):
    """Load the trained model and optional LabelEncoder."""
    try:
        model_dict = pickle.load(open(path, 'rb'))
        model = model_dict.get('model')
        le    = model_dict.get('label_encoder', None)
        return model, le
    except Exception as e:
        print(f"Error loading model: {e}")
        return None, None


def load_model_metadata(path='model_meta.json'):
    """Load saved metadata (accuracy, classes, etc.)"""
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception:
        return {}


# ─── Feature Extraction ───────────────────────
def extract_features_from_landmarks(landmarks, num_features=42):
    """
    landmarks: list of 21 dicts with keys 'x', 'y', 'z'
    """
    xs = [lm['x'] for lm in landmarks]
    ys = [lm['y'] for lm in landmarks]

    xmin, ymin = min(xs), min(ys)

    data_aux = []

    if num_features in [73, 94]:
        xrange = max(xs) - xmin + 1e-6
        yrange = max(ys) - ymin + 1e-6

        for lm in landmarks:
            data_aux.append((lm['x'] - xmin) / xrange)
            data_aux.append((lm['y'] - ymin) / yrange)
            data_aux.append(lm['z'])

        # Angles
        tip_pairs = [
            (4, 2), (8, 6), (12, 10), (16, 14), (20, 18),
            (8, 5), (12, 9), (16, 13), (20, 17), (4, 0)
        ]
        # Angles
        for (a, b) in tip_pairs:
            vx = landmarks[a]['x'] - landmarks[b]['x']
            vy = landmarks[a]['y'] - landmarks[b]['y']
            angle = np.degrees(np.arctan2(vy, vx))
            data_aux.append(angle / 180.0)

        if num_features == 94:
            def get_dist(a, b):
                dx = (landmarks[a]['x'] - landmarks[b]['x']) / xrange
                dy = (landmarks[a]['y'] - landmarks[b]['y']) / yrange
                return math.hypot(dx, dy)

            dist_pairs = [
                # Tip-to-Tip (7)
                (4, 8), (4, 12), (4, 16), (4, 20),
                (8, 12), (12, 16), (16, 20),
                # Tip-to-Wrist (5)
                (4, 0), (8, 0), (12, 0), (16, 0), (20, 0),
                # Tip-to-Palm/MiddleMCP (5)
                (4, 9), (8, 9), (12, 9), (16, 9), (20, 9),
                # Thumb to PIPs (4)
                (4, 6), (4, 10), (4, 14), (4, 18)
            ]
            for (a, b) in dist_pairs:
                data_aux.append(get_dist(a, b))
    else:
        for lm in landmarks:
            data_aux.append(lm['x'] - xmin)
            data_aux.append(lm['y'] - ymin)

    return data_aux


# ─── Prediction Buffer ────────────────────────────────────────────────────────
class PredictionSmoother:
    """Rolling-mode buffer for stable, jitter-free label selection."""
    def __init__(self, window=3):
        self.window = window
        self.buffer = []

    def add(self, label):
        self.buffer.append(label)
        if len(self.buffer) > self.window:
            self.buffer.pop(0)

    def get_stable(self):
        if not self.buffer:
            return None, 0.0
        counts = Counter(self.buffer)
        most_common, votes = counts.most_common(1)[0]
        confidence = votes / len(self.buffer)
        return most_common, confidence

    def reset(self):
        self.buffer = []


# ─── Predict ──────────────────────────────────────────────────────────────────
MIN_CONFIDENCE = 0.55   # below this the prediction is treated as "uncertain"

def predict_landmarks(model, le, landmarks, smoother=None, threshold=MIN_CONFIDENCE, num_features=42):
    """
    Predict the signed letter from a list of 21 landmark dicts.

    Returns:
        prediction (str): predicted letter / 'uncertain'
        confidence (float): 0.0 – 1.0
    """
    features = extract_features_from_landmarks(landmarks, num_features=num_features)
    feat_arr = np.asarray(features).reshape(1, -1)

    # Raw model output
    if hasattr(model, 'predict_proba'):
        proba = model.predict_proba(feat_arr)[0]
        raw_conf  = float(np.max(proba))
        class_idx = int(np.argmax(proba))
        raw_label = le.inverse_transform([class_idx])[0] if le else str(class_idx)
    else:
        raw_label = str(model.predict(feat_arr)[0])
        raw_conf  = 1.0

    # Smooth via buffer — used only for label stability, NOT to deflate confidence
    if smoother is not None:
        smoother.add(raw_label)
        smoothed_label, _ = smoother.get_stable()
        final_label = smoothed_label if smoothed_label else raw_label
    else:
        final_label = raw_label

    # Always use raw model probability as confidence (0.0 – 1.0)
    final_conf = raw_conf

    if final_conf < threshold:
        return 'uncertain', round(final_conf, 3)

    return final_label, round(final_conf, 3)
