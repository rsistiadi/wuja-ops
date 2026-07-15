import React, { useRef, useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { C } from "../../lib/tokens";
import { startCamera, stopCamera } from "../../lib/photo";
import { startQrScanLoop } from "../../lib/qrScan";

// Full-screen-within-sheet QR scanner. Rear camera always (scanning a
// badge someone else is holding up, never a selfie scenario). Calls
// onResult(decodedText) the moment a QR is found, or onCancel() if the
// user backs out / camera access fails.
export default function QrScannerView({ onResult, onCancel, title = "Scan badge QR" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stopLoopRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    startCamera(videoRef.current, "environment")
      .then((stream) => {
        if (cancelled) { stopCamera(stream); return; }
        streamRef.current = stream;
        stopLoopRef.current = startQrScanLoop(videoRef.current, (decoded) => {
          if (!cancelled) onResult(decoded);
        });
      })
      .catch((e) => setError(e.message || "Camera unavailable — use manual entry instead."));

    return () => {
      cancelled = true;
      stopLoopRef.current?.();
      stopCamera(streamRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "#000", zIndex: 10 }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ background: "rgba(10,15,26,0.85)" }}>
        <span style={{ color: C.parchment, fontSize: 14, fontWeight: 700 }}>{title}</span>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.parchment} /></button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6">
            <AlertTriangle size={28} color={C.gold} />
            <div style={{ color: C.parchment, fontSize: 13, textAlign: "center" }}>{error}</div>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <svg width="100%" height="100%" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <defs>
                <mask id="qr-cutout">
                  <rect x="0" y="0" width="300" height="300" fill="white" />
                  <rect x="60" y="60" width="180" height="180" rx="16" fill="black" />
                </mask>
              </defs>
              <rect x="0" y="0" width="300" height="300" fill="rgba(0,0,0,0.55)" mask="url(#qr-cutout)" />
              <rect x="60" y="60" width="180" height="180" rx="16" fill="none" stroke="#FFD24C" strokeWidth="3" />
            </svg>
            <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: C.parchment, fontSize: 12 }}>Hold the badge QR inside the frame</div>
          </>
        )}
      </div>
    </div>
  );
}
