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
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 40, background: "#000" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ background: "rgba(10,15,26,0.85)" }}>
        <span style={{ color: C.parchment, fontSize: 15.5, fontWeight: 700 }}>{title}</span>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.parchment} /></button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6">
            <AlertTriangle size={28} color={C.gold} />
            <div style={{ color: C.parchment, fontSize: 14.5, textAlign: "center" }}>{error}</div>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {/* A CSS square (not an SVG viewBox stretched to fit a
                non-square container — that mismatch was the actual bug
                in the old version of this guide). box-shadow spread to
                9999px darkens everything outside the square, clipped by
                the parent's overflow:hidden — this technique is always
                a true square regardless of screen size or aspect ratio,
                so there's no coordinate math that can go wrong. */}
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: "min(70vw, 60vh, 280px)", aspectRatio: "1 / 1", borderRadius: 16,
              border: "3px solid #FFD24C", boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)", pointerEvents: "none",
            }} />
            <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: C.parchment, fontSize: 13.5 }}>Hold the badge QR inside the frame</div>
          </>
        )}
      </div>
    </div>
  );
}
