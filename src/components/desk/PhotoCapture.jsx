import React, { useRef, useState, useEffect } from "react";
import { Camera, RotateCcw, ArrowRight, SkipForward, AlertTriangle } from "lucide-react";
import { C, CATEGORY_META } from "../../lib/tokens";
import { TopBar, PrimaryButton, GhostButton, StepDots } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { startCamera, stopCamera, captureNormalizedPhoto, normalizeImageFile } from "../../lib/photo";
import { uploadBadgePhoto, getBadgePhotoUrl } from "../../lib/photoStorage";

export default function PhotoCapture({ reg, allowSkip, onBack, onNext }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const meta = CATEGORY_META[reg.category];

  useEffect(() => {
    let cancelled = false;
    if (videoRef.current) {
      startCamera(videoRef.current)
        .then((stream) => { if (!cancelled) streamRef.current = stream; else stopCamera(stream); })
        .catch((e) => setCameraError(e.message || "Camera unavailable — use 'Upload photo instead' below."));
    }
    return () => { cancelled = true; stopCamera(streamRef.current); };
  }, []);

  const capture = async () => {
    try {
      const blob = await captureNormalizedPhoto(videoRef.current);
      setCapturedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      stopCamera(streamRef.current);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const blob = await normalizeImageFile(file);
      setCapturedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      stopCamera(streamRef.current);
    } catch (err) {
      setError("Couldn't read that image — try a different file.");
    }
  };

  const retake = async () => {
    setCapturedBlob(null); setPreviewUrl(null); setError("");
    if (videoRef.current) {
      const stream = await startCamera(videoRef.current).catch((e) => { setCameraError(e.message); return null; });
      if (stream) streamRef.current = stream;
    }
  };

  const confirm = async () => {
    setSaving(true); setError("");
    try {
      const path = await uploadBadgePhoto(reg.id, capturedBlob);
      const { error } = await supabase.from("registrations").update({ photo_status: "captured", photo_url: path }).eq("id", reg.id);
      if (error) throw error;
      const signedUrl = await getBadgePhotoUrl(path);
      onNext("captured", signedUrl);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true); setError("");
    const { error } = await supabase.from("registrations").update({ photo_status: "skipped" }).eq("id", reg.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onNext("skipped", null);
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Capture Photo" subtitle={reg.full_name} onBack={onBack} accent={meta.color} />
      <StepDots step={1} total={3} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col" style={{ background: C.inkSoft }}>
        <div style={{ color: C.ink60, fontSize: 12, marginBottom: 12 }}>
          Align face and shoulders within the frame — same framing for everyone keeps badges consistent.
        </div>

        <div className="flex-1 rounded-2xl relative overflow-hidden" style={{ background: "#0B1524", border: `1px solid ${C.inkLine}`, minHeight: 300 }}>
          {!capturedBlob ? (
            cameraError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6">
                <AlertTriangle size={28} color={C.gold} />
                <div style={{ color: C.ink60, fontSize: 12.5, textAlign: "center" }}>{cameraError}</div>
              </div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                <svg width="150" height="200" viewBox="0 0 150 200" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
                  <ellipse cx="75" cy="70" rx="42" ry="52" fill="none" stroke={C.gold} strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
                  <path d="M 20 200 C 20 140 50 120 75 120 C 100 120 130 140 130 200" fill="none" stroke={C.gold} strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
                </svg>
              </>
            )
          ) : (
            <img src={previewUrl} alt="Captured preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>

        <div style={{ color: C.ink40, fontSize: 10.5, textAlign: "center", marginTop: 8 }}>Plain background · Even lighting · Shoulders level</div>

        {!capturedBlob ? (
          <div className="flex flex-col items-center gap-3 mt-4">
            <button onClick={capture} disabled={!!cameraError} className="flex items-center justify-center rounded-full"
              style={{ width: 68, height: 68, background: C.gold, border: `4px solid ${C.goldDeep}`, cursor: cameraError ? "default" : "pointer", opacity: cameraError ? 0.5 : 1 }}>
              <Camera size={26} color={C.ink} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ color: C.ink40, fontSize: 11.5, background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}>
              Upload photo instead
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
          </div>
        ) : (
          <div className="mt-4"><GhostButton icon={RotateCcw} onClick={retake}>Retake</GhostButton></div>
        )}

        {error && <div style={{ color: C.alert, fontSize: 12.5, marginTop: 10 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3 flex flex-col gap-2.5" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={ArrowRight} disabled={!capturedBlob || saving} onClick={confirm}>{saving ? "Uploading…" : "Confirm photo"}</PrimaryButton>
        {!capturedBlob && allowSkip && <GhostButton icon={SkipForward} onClick={skip}>Skip for now</GhostButton>}
      </div>
    </div>
  );
}
