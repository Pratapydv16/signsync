"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface SignCanvasProps {
  onPrediction: (prediction: string, confidence: number) => void;
  onHandLost: () => void;
}

export default function SignCanvas({ onPrediction, onHandLost }: SignCanvasProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(0);

  const totalScripts = 3;

  const handleScriptLoad = () => {
    setScriptsLoaded((prev) => prev + 1);
  };

  useEffect(() => {
    if (scriptsLoaded < totalScripts) return;
    if (!videoRef.current || !canvasRef.current) return;

    const win = window as any;
    if (!win.Hands || !win.Camera || !win.drawConnectors) return;

    const hands = new win.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });

    const canvasCtx = canvasRef.current.getContext("2d");

    hands.onResults((results: any) => {
      if (!canvasCtx || !canvasRef.current) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        win.drawConnectors(canvasCtx, landmarks, win.HAND_CONNECTIONS, {
          color: "#10b981",
          lineWidth: 4,
        });
        win.drawLandmarks(canvasCtx, landmarks, {
          color: "#f9fafb",
          lineWidth: 2,
          radius: 4,
        });

        // Send to backend
        sendToBackend(landmarks);
      } else {
        onHandLost();
      }
      canvasCtx.restore();
    });

    const camera = new win.Camera(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current! });
      },
      width: 640,
      height: 480,
    });

    camera.start();
    setIsLoaded(true);

    return () => {
      camera.stop();
    };
  }, [scriptsLoaded, onHandLost]);

  const sendToBackend = async (landmarks: any) => {
    try {
      const payload = landmarks.map((lm: any) => ({ x: lm.x, y: lm.y, z: lm.z }));
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landmarks: payload }),
      });
      if (res.ok) {
        const data = await res.json();
        onPrediction(data.prediction, data.confidence);
      }
    } catch (err) {
      console.error("Backend error:", err);
    }
  };

  return (
    <div className="canvas-wrapper glass">
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"
        onLoad={handleScriptLoad}
      />

      <video ref={videoRef} className="canvas-video-hidden" playsInline muted />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="canvas-output"
      />
      
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', zIndex: 10 }}>
          <div className="flex flex-col items-center gap-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" style={{ width: '3rem', height: '3rem', border: '4px solid #10b981', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
            <p style={{ color: '#10b981', fontWeight: 500 }}>Initializing Vision Engine...</p>
          </div>
        </div>
      )}
    </div>
  );
}
