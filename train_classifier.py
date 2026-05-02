import pickle
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import LabelEncoder

# ─── Load Dataset ───────────────────────────────────────────────────────────
print("=" * 60)
print("  SignSync AI — Model Training Pipeline")
print("=" * 60)

data_dict = pickle.load(open('./data.pickle', 'rb'))
data      = np.asarray(data_dict['data'])
labels    = np.asarray(data_dict['labels'])

# ─── Class Filter: keep only A-Z, SPACE, BACKSPACE ───────────────────────────
KEEP_CLASSES = set(list('ABCDEFGHIJKLMNOPQRSTUVWXYZ') + ['SPACE', 'BACKSPACE'])
mask   = np.array([lbl in KEEP_CLASSES for lbl in labels])
data   = data[mask]
labels = labels[mask]
print(f"\n[FILTER] Keeping only: {sorted(KEEP_CLASSES)}")
print(f"[FILTER] Removed {np.sum(~mask)} digit samples. {len(data)} samples remain.")

print(f"\n[INFO] Dataset loaded  : {len(data)} samples, {data.shape[1]} features")
print(f"[INFO] Classes found   : {sorted(set(labels))}")
print(f"[INFO] Samples per class:")
for cls in sorted(set(labels)):
    count = np.sum(labels == cls)
    print(f"         '{cls}': {count}")

# ─── Encode Labels ───────────────────────────────────────────────────────────
le             = LabelEncoder()
labels_encoded = le.fit_transform(labels)
class_names    = le.classes_

# ─── Train / Test Split ──────────────────────────────────────────────────────
x_train, x_test, y_train, y_test = train_test_split(
    data, labels_encoded,
    test_size=0.2, shuffle=True, stratify=labels_encoded, random_state=42
)
print(f"\n[INFO] Train: {len(x_train)} | Test: {len(x_test)}")

# ─── Train RandomForestClassifier ──────────────────────────────────────────────
print("\n[TRAINING] RandomForestClassifier ...")

model = RandomForestClassifier(
    n_estimators=80,
    max_depth=15,
    min_samples_split=2,
    min_samples_leaf=1,
    max_features='sqrt',
    class_weight='balanced',
    random_state=42,
    n_jobs=-1
)

model.fit(x_train, y_train)

# ─── Evaluate ────────────────────────────────────────────────────────────────
y_pred       = model.predict(x_test)
test_acc     = accuracy_score(y_test, y_pred)
y_pred_lbl   = le.inverse_transform(y_pred)
y_test_lbl   = le.inverse_transform(y_test)

print(f"\n[RESULT] Test Accuracy : {test_acc * 100:.2f}%")

print("\n[REPORT] Per-class Classification Report:")
print(classification_report(y_test_lbl, y_pred_lbl))

# ─── Quick 3-Fold CV ─────────────────────────────────────────────────────────
print("[CV] Running 3-fold cross-validation ...")
cv_scores = cross_val_score(model, data, labels_encoded, cv=3, scoring='accuracy', n_jobs=-1)
print(f"     CV Accuracy: {cv_scores.mean()*100:.2f}% ± {cv_scores.std()*100:.2f}%")

# ─── Confusion Matrix PNG ─────────────────────────────────────────────────────
print("\n[INFO] Saving confusion_matrix.png ...")
cm   = confusion_matrix(y_test_lbl, y_pred_lbl, labels=class_names)
size = max(8, len(class_names))
fig, ax = plt.subplots(figsize=(size, size - 2))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=class_names, yticklabels=class_names, ax=ax)
ax.set_title(f"SignSync Confusion Matrix — RandomForest ({test_acc*100:.1f}%)", fontsize=13)
ax.set_xlabel("Predicted Label")
ax.set_ylabel("True Label")
plt.tight_layout()
plt.savefig('confusion_matrix.png', dpi=150)
plt.close()
print("   Saved: confusion_matrix.png")

# ─── Feature Importance Plot ─────────────────────────────────────────────────
print("[INFO] Saving feature_importance.png ...")
try:
    importances = model.feature_importances_
    n_show = min(20, len(importances))
    indices = np.argsort(importances)[::-1][:n_show]
    fig2, ax2 = plt.subplots(figsize=(10, 5))
    ax2.bar(range(n_show), importances[indices], color='#00ffcc', alpha=0.85)
    ax2.set_title("Top Feature Importances (RandomForest)", fontsize=13)
    ax2.set_xlabel("Feature Index")
    ax2.set_ylabel("Importance")
    ax2.set_xticks(range(n_show))
    ax2.set_xticklabels(indices, rotation=45)
    plt.tight_layout()
    plt.savefig('feature_importance.png', dpi=150)
    plt.close()
    print("   Saved: feature_importance.png")
except Exception as e:
    print(f"   [SKIP] Feature importance plot skipped: {e}")

# ─── Save Model ──────────────────────────────────────────────────────────────
with open('model.p', 'wb') as f:
    pickle.dump({'model': model, 'label_encoder': le}, f)
print("\n[SAVED] model.p")

# ─── Save Metadata ───────────────────────────────────────────────────────────
meta = {
    "model_type":       "RandomForest",
    "test_accuracy":    round(test_acc * 100, 2),
    "cv_accuracy_mean": round(cv_scores.mean() * 100, 2),
    "cv_accuracy_std":  round(cv_scores.std()  * 100, 2),
    "classes":          list(class_names),
    "num_classes":      len(class_names),
    "num_features":     int(data.shape[1]),
    "num_samples":      len(data),
    "trained_at":       datetime.now().isoformat(),
    "hyperparameters": {
        "base": "RandomForestClassifier",
        "n_estimators": 80,
        "max_depth": 15,
        "max_features": "sqrt",
        "class_weight": "balanced"
    }
}
with open('model_meta.json', 'w') as f:
    json.dump(meta, f, indent=2)
print("[SAVED] model_meta.json")

print("\n" + "=" * 60)
print(f"  Done! Accuracy: {test_acc*100:.2f}%  |  CV: {cv_scores.mean()*100:.2f}%")
print("=" * 60)
