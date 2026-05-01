# SignSync AI — Real-time ASL Recognition

SignSync AI is a high-performance American Sign Language (ASL) recognition system that converts hand gestures into text in real-time. It leverages Google's MediaPipe for robust hand landmark extraction and a trained Random Forest classifier to achieve high precision and low latency.

![App Screenshot](https://raw.githubusercontent.com/Pratapydv16/signsync/main/static/img/screenshot.png) *(Note: Add your actual screenshot path here or I can help you generate one)*

## 🚀 Key Features

- **High Precision Feature Extraction**: Uses a 94-feature geometric vector including 3D coordinates, finger angles, and tip-to-joint distances.
- **Stable Predictions**: Implements a rolling-mode prediction smoother to eliminate jitter and flickering.
- **Web-Based Interface**: Clean, modern UI built with CSS Glassmorphism and real-time canvas rendering.
- **Dynamic Suggestions**: Integrated dictionary-based word suggestions as you sign.
- **Auto-Speech**: Integrated Speech Synthesis (TTS) to "speak" the translated text.
- **Lazy Loading**: Server automatically detects model updates without needing a restart.

## 🛠️ Technology Stack

- **Backend**: Python (Flask)
- **Machine Learning**: Scikit-Learn (Random Forest), MediaPipe
- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Optimization**: NumPy for fast vector math

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Pratapydv16/signsync.git
   cd signsync
   ```

2. **Create a virtual environment (optional but recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## 📖 Usage

### 1. Data Collection & Preprocessing
Organize your images in the `data/` directory (each class in its own folder).
```bash
python create_dataset.py
```
This will generate `data.pickle`.

### 2. Training the Model
Train the Random Forest classifier:
```bash
python train_classifier.py
```
This will output `model.p` and `model_meta.json`.

### 3. Run the Web Application
Start the Flask server:
```bash
python app.py
```
Open your browser and navigate to `http://localhost:5000`.

## 🧠 Model Details

The current model is trained on **28 classes** (A-Z, SPACE, BACKSPACE).
- **Features**: 94 (63 spatial + 10 angles + 21 distances)
- **Classifier**: Random Forest (300 estimators)
- **Accuracy**: ~100% (on validation set)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
