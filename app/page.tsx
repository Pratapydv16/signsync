"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Mic, Delete, Trash2, Copy, Settings, History } from "lucide-react";
import SignCanvas from "@/components/SignCanvas";

export default function Home() {
  const [transcript, setTranscript] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [currentPrediction, setCurrentPrediction] = useState("-");
  const [confidence, setConfidence] = useState(0);
  const [progress, setProgress] = useState(0);
  const [lastActionTime, setLastActionTime] = useState(0);
  
  // Settings
  const [holdDuration, setHoldDuration] = useState(1500);
  const [minConfidence, setMinConfidence] = useState(55);
  const [autoSpace, setAutoSpace] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(false);

  // ─── High-Frequency Tracking Refs ───────────────────────────────────────
  const lastLetterRef = React.useRef<string | null>(null);
  const lockStartTimeRef = React.useRef<number | null>(null);
  const lastActionTimeRef = React.useRef<number>(0);
  const consecutiveMatchRef = React.useRef<number>(0);

  const COOLDOWN_MS = 1800;

  const triggerAction = useCallback((letter: string) => {
    if (letter === "SPACE") {
      if (autoSpace) setTranscript((prev) => prev + " ");
    } else if (letter === "BACKSPACE") {
      setTranscript((prev) => prev.slice(0, -1));
    } else {
      setTranscript((prev) => prev + letter);
      setHistory((prev) => [letter, ...prev].slice(0, 8));
      
      if (autoSpeak && typeof window !== "undefined" && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(letter);
        window.speechSynthesis.speak(utterance);
      }
    }
    
    lastActionTimeRef.current = Date.now();
    lockStartTimeRef.current = null;
    lastLetterRef.current = null;
    setProgress(0);

    const box = document.getElementById("transcript-box");
    if (box) {
      box.classList.add("transcript-flash");
      setTimeout(() => box.classList.remove("transcript-flash"), 400);
    }
  }, [autoSpace, autoSpeak]);

  const handlePrediction = useCallback((letter: string, conf: number) => {
    const now = Date.now();
    setConfidence(conf);

    // 1. Cooldown check
    if (now - lastActionTimeRef.current < COOLDOWN_MS) {
      setCurrentPrediction("...");
      setProgress(0);
      return;
    }

    // 2. Reject uncertain
    if (letter === "uncertain" || conf < minConfidence / 100) {
      setCurrentPrediction("?");
      setProgress(0);
      lockStartTimeRef.current = null;
      lastLetterRef.current = null;
      consecutiveMatchRef.current = 0;
      return;
    }

    // 3. Jitter Smoothing: Must see the same letter twice to start/continue timer
    if (letter !== lastLetterRef.current) {
      consecutiveMatchRef.current++;
      if (consecutiveMatchRef.current >= 2) {
        lastLetterRef.current = letter;
        lockStartTimeRef.current = now;
        consecutiveMatchRef.current = 0;
        setProgress(0);
        setCurrentPrediction(letter);
      }
      return; 
    }

    setCurrentPrediction(letter);

    // 3. Logic using Refs for consistency
    if (letter !== lastLetterRef.current) {
      lastLetterRef.current = letter;
      lockStartTimeRef.current = now;
      setProgress(0);
    } else if (lockStartTimeRef.current) {
      const elapsed = now - lockStartTimeRef.current;
      const p = Math.min((elapsed / holdDuration) * 100, 100);
      setProgress(p);

      if (elapsed >= holdDuration) {
        triggerAction(letter);
      }
    }
  }, [holdDuration, minConfidence, triggerAction]);

  const handleHandLost = useCallback(() => {
    setCurrentPrediction("-");
    setConfidence(0);
    setProgress(0);
    lockStartTimeRef.current = null;
    lastLetterRef.current = null;
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript);
  };

  const clearAll = () => {
    setTranscript("");
    setHistory([]);
  };

  const speakTranscript = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(transcript);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <main className="container">
      {/* Header */}
      <header className="glass glass-header flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center" style={{ width: '3rem', height: '3rem', borderRadius: '1rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
            <Mic size={24} />
          </div>
          <div className="flex flex-col">
            <h1>SignSync <span className="accent-text">AI</span></h1>
            <p className="label-xs" style={{ marginTop: '0.25rem' }}>REAL-TIME ASL INTELLIGENCE</p>
          </div>
        </div>
        <div className="badge">
          <div className="badge-dot" />
          <span className="label-xs" style={{ color: '#10b981' }}>Model Online</span>
        </div>
      </header>

      <div className="grid grid-cols-2">
        {/* Left Column: Visuals */}
        <div className="flex flex-col gap-6">
          <SignCanvas onPrediction={handlePrediction} onHandLost={handleHandLost} />
          
          <div className="glass flex items-center gap-6" style={{ padding: '1.5rem' }}>
            <div className="flex flex-col items-center">
              <span className="label-xs">Detecting</span>
              <span className="accent-text" style={{ fontSize: '2rem', fontWeight: 700, minWidth: '1.5em', textAlign: 'center' }}>{currentPrediction}</span>
            </div>
            
            <div className="flex-1">
              <div className="flex justify-between" style={{ marginBottom: '0.5rem' }}>
                <span className="label-xs">Hold Progress</span>
                <span className="label-xs" style={{ color: '#10b981' }}>{Math.round(progress)}%</span>
              </div>
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-center" style={{ position: 'relative', width: '4rem', height: '4rem' }}>
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray={175.9} strokeDashoffset={175.9 * (1 - confidence)} style={{ transition: 'all 0.3s' }} />
              </svg>
              <span className="label-xs" style={{ color: '#10b981' }}>{Math.round(confidence * 100)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <span className="label-xs"><History size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Recent</span>
             <div className="flex gap-2">
                {history.map((l, i) => (
                  <div key={i} className="glass flex items-center justify-center" style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-2)' }}>
                    {l}
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="flex flex-col gap-6">
          <div id="transcript-box" className="glass flex flex-col" style={{ height: '320px', overflow: 'hidden' }}>
            <div className="flex items-center justify-between" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 className="label-xs">Transcript</h2>
              <button onClick={copyToClipboard} className="btn-glass" style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent' }}>
                <Copy size={16} />
              </button>
            </div>
            <div style={{ flex: 1, padding: '2rem', fontSize: '2.5rem', fontWeight: 300, overflowY: 'auto' }}>
              {transcript}<span style={{ display: 'inline-block', width: '4px', height: '2.5rem', background: '#10b981', marginLeft: '8px', verticalAlign: 'middle', animation: 'pulse 1s infinite' }} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={speakTranscript} className="btn btn-primary flex-1">
              <Mic size={20} /> Speak
            </button>
            <button onClick={() => setTranscript(t => t.slice(0, -1))} className="btn btn-glass" style={{ padding: '0 1.5rem' }}>
              <Delete size={20} />
            </button>
            <button onClick={clearAll} className="btn btn-glass btn-danger" style={{ padding: '0 1.5rem' }}>
              <Trash2 size={20} />
            </button>
          </div>

          <div className="glass" style={{ padding: '2rem' }}>
            <div className="label-xs" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={14} /> System Configuration
            </div>

            <div className="grid grid-cols-2">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>Hold Duration</label>
                  <span className="label-xs" style={{ color: '#10b981' }}>{(holdDuration / 1000).toFixed(1)}s</span>
                </div>
                <input 
                  type="range" min="500" max="3000" step="100" 
                  value={holdDuration} onChange={(e) => setHoldDuration(parseInt(e.target.value))}
                />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <label style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>Min Confidence</label>
                  <span className="label-xs" style={{ color: '#10b981' }}>{minConfidence}%</span>
                </div>
                <input 
                  type="range" min="30" max="95" step="5" 
                  value={minConfidence} onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="flex gap-8" style={{ marginTop: '2rem' }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={autoSpace} onChange={() => setAutoSpace(!autoSpace)} />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>Auto-Space</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={autoSpeak} onChange={() => setAutoSpeak(!autoSpeak)} />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>Auto-Speak</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
