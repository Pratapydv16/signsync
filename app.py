import logging
import os
import gc
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from model_utils import load_model, load_model_metadata, predict_landmarks, PredictionSmoother

# ─── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)

@app.route('/')
def index():
    """Serve the main frontend."""
    return render_template('index.html')

# Configure CORS to allow requests from the Next.js dev server
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}})

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
    
    if not os.path.exists('model.p'):
        log.error("CRITICAL: model.p not found!")
        return False
        
    m, l = load_model('model.p')
    mt   = load_model_metadata('model_meta.json')
    
    if m:
        model, le, meta = m, l, mt
        log.info(f"✅ Model loaded — type: {meta.get('model_type','?')} accuracy: {meta.get('test_accuracy','?')}%")
        gc.collect()
        return True
    else:
        log.error("❌ Failed to load model.p")
        gc.collect()
        return False

# Initial attempt
ensure_model_loaded()


# ─── API Routes ───────────────────────────────────────────────────────────────

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
        return jsonify({'error': 'Model not loaded.'}), 500

    data = request.get_json(silent=True)
    if not data or 'landmarks' not in data:
        return jsonify({'error': 'Invalid request'}), 400

    landmarks = data['landmarks']
    num_feats = meta.get('num_features', 42) if meta else 42
    
    # Perform prediction
    prediction, confidence = predict_landmarks(model, le, landmarks, smoother=smoother, num_features=num_feats)

    return jsonify({
        'prediction': prediction,
        'confidence': confidence,
        'percent':    round(confidence * 100, 1)
    })


@app.route('/reset-smoother', methods=['POST'])
def reset_smoother():
    """Reset the prediction buffer."""
    smoother.reset()
    return jsonify({'status': 'ok'})


# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    log.info(f"SignSync Backend starting on port {port}...")
    app.run(debug=True, host='0.0.0.0', port=port)
