// ─── DOM Elements ──────────────────────────────────────────────────────────
// Change this to your Render backend URL once deployed.
// For local development, it falls back to the current host.
// Use relative URLs by default. This works for both local development and Render
// as long as the frontend is served by the Flask app.
const BACKEND_URL = '';

const videoEl        = document.querySelector('.input_video');
const canvasEl       = document.querySelector('.output_canvas');
const ctx            = canvasEl.getContext('2d');

const currentSignEl  = document.getElementById('current-sign');
const transcriptEl   = document.getElementById('transcript-text');
const progressBarEl  = document.getElementById('progress-bar');
const overlayEl      = document.getElementById('status-overlay');
const containerEl    = document.getElementById('video-container');
const confCircleEl   = document.getElementById('conf-circle');
const confPctEl      = document.getElementById('conf-pct');
const historyEl      = document.getElementById('gesture-history');
const suggestionsEl  = document.getElementById('suggestions-row');
const badgeLabelEl   = document.getElementById('badge-label');
const lockonSlider   = document.getElementById('lockon-slider');
const lockonValEl    = document.getElementById('lockon-val');
const confSlider     = document.getElementById('conf-slider');
const confValEl      = document.getElementById('conf-val');
const autoSpaceToggle   = document.getElementById('auto-space-toggle');
const autoSpeakToggle   = document.getElementById('auto-speak-toggle');
const clearBtn       = document.getElementById('clear-btn');
const backspaceBtn   = document.getElementById('backspace-btn');
const speakBtn       = document.getElementById('speak-btn');
const copyBtn        = document.getElementById('copy-btn');

// ─── State ─────────────────────────────────────────────────────────────────
let transcript       = '';
let currentPrediction = null;
let lockOnStartTime  = null;
let lastTriggerTime  = null;
let isFetching       = false;
let lastHandPresent  = false;
let gestureHistory   = [];
let confidenceThreshold = 0.55;
let lastFetchTime    = 0;
const FETCH_THROTTLE_MS = 100; // 10Hz maximum request rate

const LOCK_ON_MS     = () => parseInt(lockonSlider.value);
const COOLDOWN_MS    = 1800;
const HISTORY_MAX    = 8;
const RING_CIRCUMFERENCE = 213.6; // 2 * π * 34

// ─── Common Word List for Suggestions ──────────────────────────────────────
const WORD_LIST = [
    'HELLO','HI','YES','NO','PLEASE','THANK','SORRY','HELP','WATER',
    'FOOD','HOME','LOVE','GOOD','BAD','STOP','GO','COME','SEE','YOU',
    'ME','WE','HE','SHE','IT','THE','AND','BUT','FOR','WITH','FROM',
    'ARE','CAN','WILL','WANT','NEED','HAVE','MAKE','TIME','WHAT',
    'WHERE','WHEN','HOW','WHO','WHY','OKAY','DONE','NICE','WAIT'
];

// ─── Confidence Ring ───────────────────────────────────────────────────────
function setConfidenceRing(confidence) {
    const pct  = Math.max(0, Math.min(1, confidence));
    const offset = RING_CIRCUMFERENCE * (1 - pct);
    confCircleEl.style.strokeDashoffset = offset;
    confPctEl.textContent = Math.round(pct * 100) + '%';

    // Color shift: low=orange, high=neon
    if (pct < 0.4)       confCircleEl.style.stroke = '#ffa502';
    else if (pct < 0.65) confCircleEl.style.stroke = '#00d4a8';
    else                 confCircleEl.style.stroke = '#00ffcc';
}

// ─── Suggestions ──────────────────────────────────────────────────────────
function updateSuggestions() {
    // Get last partial word (after last space)
    const words    = transcript.split(' ');
    const partial  = words[words.length - 1].toUpperCase();

    if (partial.length < 1) {
        suggestionsEl.innerHTML = '<span class="suggestion-placeholder">Start signing to see suggestions...</span>';
        return;
    }

    const matches = WORD_LIST.filter(w => w.startsWith(partial) && w !== partial).slice(0, 5);

    if (matches.length === 0) {
        suggestionsEl.innerHTML = '<span class="suggestion-placeholder">No suggestions</span>';
        return;
    }

    suggestionsEl.innerHTML = matches.map(w =>
        `<button class="suggestion-chip">${w.toLowerCase()}</button>`
    ).join('');

    suggestionsEl.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const words2 = transcript.split(' ');
            words2[words2.length - 1] = chip.textContent.toUpperCase();
            transcript = words2.join(' ') + ' ';
            updateTranscript();
        });
    });
}

// ─── Gesture History ──────────────────────────────────────────────────────
function addToHistory(letter) {
    if (letter === 'SPACE' || letter === 'BACKSPACE') return;
    gestureHistory.push(letter);
    if (gestureHistory.length > HISTORY_MAX) gestureHistory.shift();
    renderHistory();
}
function renderHistory() {
    historyEl.innerHTML = gestureHistory.map(l =>
        `<div class="hist-chip">${l}</div>`
    ).join('');
}

// ─── Transcript ───────────────────────────────────────────────────────────
function updateTranscript() {
    transcriptEl.textContent = transcript;
    updateSuggestions();
}

// ─── MediaPipe Hands ─────────────────────────────────────────────────────
const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.55
});
hands.onResults(onResults);

const camera = new Camera(videoEl, {
    onFrame: async () => { await hands.send({ image: videoEl }); },
    width: 640, height: 480
});
camera.start();

function onResults(results) {
    ctx.save();
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00ffcc', lineWidth: 3 });
        drawLandmarks(ctx, landmarks, { color: '#eef2ff', lineWidth: 1, radius: 4 });

        lastHandPresent = true;
        
        // Throttle backend requests to FETCH_THROTTLE_MS
        const now = Date.now();
        if (!isFetching && (now - lastFetchTime) > FETCH_THROTTLE_MS) {
            lastFetchTime = now;
            sendToBackend(landmarks);
        }
    } else {
        if (lastHandPresent) {
            // Hand just left — reset smoother on server
            fetch(`${BACKEND_URL}/reset-smoother`, { method: 'POST' }).catch(() => {});
            lastHandPresent = false;
        }
        currentSignEl.textContent = '—';
        progressBarEl.style.width = '0%';
        setConfidenceRing(0);
        currentPrediction = null;
    }
    ctx.restore();
}

// ─── Backend Communication ────────────────────────────────────────────────
async function sendToBackend(landmarks) {
    isFetching = true;
    try {
        const payload = landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z }));
        const res = await fetch(`${BACKEND_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ landmarks: payload })
        });
        if (res.ok) {
            const data = await res.json();
            handlePrediction(data.prediction, data.confidence || 0);
        }
    } catch (err) {
        console.error('[SignSync] Prediction error:', err);
    }
    isFetching = false;
}

// ─── Prediction Logic ─────────────────────────────────────────────────────
function handlePrediction(letter, confidence) {
    setConfidenceRing(confidence);

    const now = Date.now();

    // Cooldown check
    if (lastTriggerTime && (now - lastTriggerTime) < COOLDOWN_MS) {
        currentSignEl.textContent = '…';
        progressBarEl.style.width = '0%';
        return;
    }

    // Reject uncertain predictions
    if (letter === 'uncertain' || confidence < confidenceThreshold) {
        currentSignEl.textContent = '?';
        progressBarEl.style.width = '0%';
        currentPrediction = null;
        return;
    }

    // New letter detected
    if (letter !== currentPrediction) {
        currentPrediction  = letter;
        lockOnStartTime    = now;
        currentSignEl.textContent = letter;
    }

    // Lock-on progress
    const elapsed  = now - lockOnStartTime;
    const progress = Math.min((elapsed / LOCK_ON_MS()) * 100, 100);
    progressBarEl.style.width = `${progress}%`;

    if (elapsed >= LOCK_ON_MS()) {
        triggerAction(letter);
        lastTriggerTime   = now;
        lockOnStartTime   = null;
        currentPrediction = null;
    }
}

// ─── Trigger Confirmed Letter ─────────────────────────────────────────────
function triggerAction(letter) {
    // Visual flash
    overlayEl.classList.add('flash');
    containerEl.classList.add('locked-on');
    setTimeout(() => {
        overlayEl.classList.remove('flash');
        containerEl.classList.remove('locked-on');
    }, 500);

    // Update transcript
    if (letter === 'SPACE') {
        if (autoSpaceToggle.checked) transcript += ' ';
    } else if (letter === 'BACKSPACE') {
        transcript = transcript.slice(0, -1);
    } else {
        transcript += letter;
        addToHistory(letter);

        // Auto-speak on word end (word completed by SPACE or dot)
        if (autoSpeakToggle.checked && transcript.endsWith(' ')) {
            speakText(transcript.trim().split(' ').slice(-1)[0]);
        }
    }

    updateTranscript();
}

// ─── Speech Synthesis ─────────────────────────────────────────────────────
function speakText(text) {
    if (!text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices    = speechSynthesis.getVoices();
    const good      = voices.find(v => v.lang.includes('en') && v.name.includes('Google'));
    if (good) utterance.voice = good;
    utterance.pitch = 0.95;
    utterance.rate  = 1;

    // Animate transcript board
    const board = document.querySelector('.transcript-board');
    board.classList.add('speaking');
    utterance.onend = () => board.classList.remove('speaking');

    speechSynthesis.speak(utterance);
}
speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();

// ─── Button Handlers ──────────────────────────────────────────────────────
speakBtn.addEventListener('click', () => speakText(transcript));

clearBtn.addEventListener('click', () => {
    transcript = '';
    gestureHistory = [];
    renderHistory();
    updateTranscript();
});

backspaceBtn.addEventListener('click', () => {
    transcript = transcript.slice(0, -1);
    updateTranscript();
});

copyBtn.addEventListener('click', () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript).then(() => {
        copyBtn.style.color = 'var(--success)';
        setTimeout(() => { copyBtn.style.color = ''; }, 1500);
    });
});

// ─── Settings Sliders ─────────────────────────────────────────────────────
lockonSlider.addEventListener('input', () => {
    lockonValEl.textContent = (lockonSlider.value / 1000).toFixed(1) + 's';
});
confSlider.addEventListener('input', () => {
    const pct = parseInt(confSlider.value);
    confValEl.textContent = pct + '%';
    confidenceThreshold = pct / 100;
});

// ─── Load Model Info ──────────────────────────────────────────────────────
async function loadModelInfo() {
    try {
        const res  = await fetch(`${BACKEND_URL}/model-info`);
        if (!res.ok) throw new Error('No metadata');
        const meta = await res.json();

        badgeLabelEl.textContent   = `${meta.model_type} · ${meta.test_accuracy}% acc`;
        document.getElementById('mi-type').textContent    = meta.model_type    || '—';
        document.getElementById('mi-acc').textContent     = meta.test_accuracy ? `${meta.test_accuracy}%` : '—';
        document.getElementById('mi-classes').textContent = meta.num_classes   || '—';
        document.getElementById('mi-feats').textContent   = meta.num_features  || '—';
    } catch (err) {
        console.error('[SignSync] Failed to load model info:', err);
        badgeLabelEl.textContent = 'Model not trained';
        document.getElementById('model-badge').style.background = 'rgba(255,71,87,0.12)';
        document.getElementById('model-badge').style.color      = 'var(--danger)';
        document.getElementById('model-badge').style.borderColor = 'rgba(255,71,87,0.3)';
        document.querySelector('.badge-dot').style.background   = 'var(--danger)';
    }
}

loadModelInfo();
