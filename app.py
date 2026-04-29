import logging
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from model_utils import load_model, load_model_metadata, predict_landmarks, PredictionSmoother

# ─── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger(__name__)

# ─── Load Model ───────────────────────────────────────────────────────────────
model, le = load_model('model.p')
meta      = load_model_metadata('model_meta.json')
smoother  = PredictionSmoother(window=5)

if model:
    log.info(f"Model loaded — type: {meta.get('model_type','?')}  "
             f"accuracy: {meta.get('test_accuracy','?')}%  "
             f"classes: {meta.get('num_classes','?')}")
else:
    log.warning("Model NOT loaded. Train the model first (python train_classifier.py).")


# ─── Routes ──────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/model-info')
def model_info():
    """Return model metadata for the UI."""
    if not meta:
        return jsonify({'error': 'Model metadata not found.'}), 404
    return jsonify(meta)


@app.route('/predict', methods=['POST'])
def predict():
    if not model:
        return jsonify({'error': 'Model not loaded. Run train_classifier.py first.'}), 500

    data = request.get_json(silent=True)
    if not data or 'landmarks' not in data:
        return jsonify({'error': 'Invalid request — expected {"landmarks": [...]}'}), 400

    landmarks = data['landmarks']
    if len(landmarks) != 21:
        return jsonify({
            'error': f'Expected 21 landmarks, got {len(landmarks)}'
        }), 400

    num_feats = meta.get('num_features', 42) if meta else 42
    prediction, confidence = predict_landmarks(model, le, landmarks, smoother=smoother, num_features=num_feats)

    log.info(f"Prediction: {prediction!r:12s}  confidence: {confidence:.2%}")

    return jsonify({
        'prediction': prediction,
        'confidence': confidence,
        'percent':    round(confidence * 100, 1)
    })


@app.route('/reset-smoother', methods=['POST'])
def reset_smoother():
    """Reset the prediction buffer (call when hand leaves frame)."""
    smoother.reset()
    return jsonify({'status': 'ok'})


# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
