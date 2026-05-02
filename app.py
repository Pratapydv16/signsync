import logging
import os
import gc
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
model = None
le    = None
meta  = {}
smoother = PredictionSmoother(window=5)

def ensure_model_loaded():
    global model, le, meta
    if model is not None:
        return True
    
    log.info("Attempting to load model files...")
    
    # Check if files exist first
    if not os.path.exists('model.p'):
        log.error("CRITICAL: model.p not found!")
        return False
        
    m, l = load_model('model.p')
    mt   = load_model_metadata('model_meta.json')
    
    if m:
        model, le, meta = m, l, mt
        log.info(f"✅ Model loaded successfully — type: {meta.get('model_type','?')} "
                 f"accuracy: {meta.get('test_accuracy','?')}%")
        
        # Explicitly collect garbage after loading a large pickle to free memory spikes
        gc.collect()
        return True
    else:
        log.error("❌ Failed to load model from model.p (check pickle compatibility)")
        gc.collect()
        return False

# Initial attempt
ensure_model_loaded()


# ─── Routes ──────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/model-info')
def model_info():
    """Return model metadata for the UI."""
    ensure_model_loaded()
    if not meta:
        return jsonify({'error': 'Model metadata not found.'}), 404
    return jsonify(meta)


@app.route('/predict', methods=['POST'])
def predict():
    if not ensure_model_loaded():
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
    import os
    # Use PORT environment variable for Render compatibility
    port = int(os.environ.get('PORT', 5000))
    log.info(f"Starting dev server on port {port}...")
    app.run(debug=True, host='0.0.0.0', port=port)
