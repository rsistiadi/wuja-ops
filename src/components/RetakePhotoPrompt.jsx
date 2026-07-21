import React, { useState, useEffect, useRef } from "react";
import { Camera, RotateCcw, Check, AlertTriangle, X, SwitchCamera } from "lucide-react";
import { C } from "../lib/tokens";
import { supabase } from "../lib/supabaseClient";
import { startCamera, stopCamera, captureNormalizedPhoto } from "../lib/photo";
import { uploadBadgePhoto } from "../lib/photoStorage";

// Shown to a logged-in crew member whose badge photo a superadmin has
// flagged for retake (registrations.photo_status === "retake_requested").
// Mirrors OwnBadgePrompt's banner pattern. Self-capture, front camera
// by default (this is a selfie, unlike the desk's rear-camera flow
// where crew photograph someone else). Renders nothing once resolved,
// dismissed, or if this account has no linked registration at all.
export default function RetakePhotoPrompt({ registrationId }) {
  const [reg, setReg] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!registrationId) return;
    supabase.from("registrations").select("id, full_name, photo_status").eq("id", registrationId).maybeSingle()
      .then(({ data }) => setReg(data));
  }, [registrationId]);

  const onSaved = () => {
    setCapturing(false);
    setReg((r) => ({ ...r, photo_status: "captured" }));
  };

  if (!registrationId || !reg || reg.photo_status !== "retake_requested" || dismissed) return null;

  return (
    <>
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: `${C.alert}14`, borderBottom: `1px solid ${C.alert}44` }}>
        <AlertTriangle size={18} color={C.alert} style={{ flexShrink: 0 }} />
        <div className="flex-1">
          <div style={{ color: C.alert, fontSize: 13.5, fontWeight: 700 }}>Photo retake needed</div>
          <div style={{ color: C.ink60, fontSize: 12.5 }}>An admin flagged your badge photo — please retake it.</div>
        </div>
        <button onClick={() => setCapturing(true)} style={{ background: C.alert, color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer" }}>Retake</button>
        <button onClick={() => setDismissed(true)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={16} color={C.ink40} /></button>
      </div>

      {capturing && <RetakeCapture registrationId={registrationId} onCancel={() => setCapturing(false)} onSaved={onSaved} />}
    </>
  );
}

function RetakeCapture({ registrationId, onCancel, onSaved }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState("user"); // selfie by default
  const [cameraError, setCameraError] = useState("");
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (capturedBlob) return;
    let cancelled = false;
    setCameraError("");
    if (videoRef.current) {
      startCamera(videoRef.current, facingMode)
        .then((stream) => { if (!cancelled) streamRef.current = stream; else stopCamera(stream); })
        .catch((e) => setCameraError(e.message || "Camera unavailable — try again or use a different device."));
    }
    return () => { cancelled = true; stopCamera(streamRef.current); streamRef.current = null; };
  }, [capturedBlob, facingMode]);

  const capture = async () => {
    try {
      const blob = await captureNormalizedPhoto(videoRef.current, facingMode);
      setCapturedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) { setError(e.message); }
  };
  const retake = () => { setCapturedBlob(null); setPreviewUrl(null); setError(""); };
  const switchCamera = () => setFacingMode((f) => (f === "environment" ? "user" : "environment"));

  const confirm = async () => {
    setSaving(true); setError("");
    try {
      const path = await uploadBadgePhoto(registrationId, capturedBlob);
      const { error } = await supabase.from("registrations").update({ photo_status: "captured", photo_url: path }).eq("id", registrationId);
      if (error) throw error;
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 40, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18.5, fontWeight: 600 }}>Retake Photo</div>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col" style={{ background: C.inkSoft }}>
        <div style={{ color: C.ink60, fontSize: 13.5, marginBottom: 12 }}>Plain background · Even lighting · Face and shoulders in frame</div>

        <div className="rounded-2xl relative overflow-hidden mx-auto" style={{ background: "#0B1524", border: `1px solid ${C.inkLine}`, width: "100%", maxWidth: 360, aspectRatio: "1 / 1" }}>
          {!capturedBlob ? (
            cameraError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6">
                <AlertTriangle size={28} color={C.gold} />
                <div style={{ color: C.ink60, fontSize: 13.5, textAlign: "center" }}>{cameraError}</div>
              </div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: facingMode === "user" ? "scaleX(-1)" : "none" }} />
                <button onClick={switchCamera} className="flex items-center justify-center rounded-full" style={{ position: "absolute", top: 12, right: 12, width: 40, height: 40, background: "rgba(10,15,26,0.65)", border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>
                  <SwitchCamera size={18} color={C.parchment} />
                </button>
              </>
            )
          ) : (
            <img src={previewUrl} alt="Captured preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>

        {!capturedBlob ? (
          <div className="flex flex-col items-center gap-3 mt-5">
            <button onClick={capture} disabled={!!cameraError} className="flex items-center justify-center rounded-full"
              style={{ width: 64, height: 64, background: C.gold, border: `4px solid ${C.goldDeep}`, cursor: cameraError ? "default" : "pointer", opacity: cameraError ? 0.5 : 1 }}>
              <Camera size={24} color={C.ink} />
            </button>
          </div>
        ) : (
          <div className="flex justify-center mt-5">
            <button onClick={retake} className="flex items-center gap-2 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 13.5, fontWeight: 600, padding: "9px 16px", cursor: "pointer" }}>
              <RotateCcw size={14} /> Retake
            </button>
          </div>
        )}
        {error && <div style={{ color: C.alert, fontSize: 13.5, marginTop: 10 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <button onClick={confirm} disabled={!capturedBlob || saving} className="w-full flex items-center justify-center gap-2 rounded-xl"
          style={{ background: C.gold, color: C.ink, fontWeight: 700, fontSize: 15.5, padding: "14px 0", border: "none", cursor: !capturedBlob || saving ? "default" : "pointer", opacity: !capturedBlob || saving ? 0.6 : 1 }}>
          <Check size={18} /> {saving ? "Uploading…" : "Confirm photo"}
        </button>
      </div>
    </div>
  );
}
