import React, { useRef, useState, useEffect } from "react";
import { Camera, RotateCcw, ArrowRight, SkipForward, AlertTriangle, SwitchCamera } from "lucide-react";
import { C, CATEGORY_META } from "../../lib/tokens";
import { TopBar, PrimaryButton, GhostButton, StepDots } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { startCamera, stopCamera, captureNormalizedPhoto, normalizeImageFile } from "../../lib/photo";
import { uploadBadgePhoto, getBadgePhotoUrl } from "../../lib/photoStorage";

export default function PhotoCapture({ reg, allowSkip, onBack, onNext }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [facingMode, setFacingMode] = useState("environment"); // rear camera by default — crew photographs the attendee, not themselves
  const [cameraError, setCameraError] = useState("");
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const meta = CATEGORY_META[reg.category];

  // Single effect owns the camera's whole lifecycle, keyed on whatever
  // should cause it to (re)start: no photo captured yet, or the camera
  // was switched. This fixes the old "camera not ready" bug on retake —
  // that bug was calling startCamera() synchronously right after
  // setCapturedBlob(null), before React had actually remounted the
  // <video> element, so the ref was stale. An effect only runs *after*
  // the DOM commit, so videoRef.current is guaranteed valid here.
  useEffect(() => {
    if (capturedBlob) return; // nothing to do while showing a preview
    let cancelled = false;
    setCameraError("");
    if (videoRef.current) {
      startCamera(videoRef.current, facingMode)
        .then((stream) => { if (!cancelled) streamRef.current = stream; else stopCamera(stream); })
        .catch((e) => setCameraError(e.message || "Camera unavailable — use 'Upload photo instead' below."));
    }
    return () => { cancelled = true; stopCamera(streamRef.current); streamRef.current = null; };
  }, [capturedBlob, facingMode]);

  const capture = async () => {
    try {
      const blob = await captureNormalizedPhoto(videoRef.current, facingMode);
      setCapturedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
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
    } catch (err) {
      setError("Couldn't read that image — try a different file.");
    }
  };

  const retake = () => { setCapturedBlob(null); setPreviewUrl(null); setError(""); };
  const switchCamera = () => setFacingMode((f) => (f === "environment" ? "user" : "environment"));

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

        <div className="flex-1 rounded-2xl relative overflow-hidden" style={{ background: "#0B1524", border: `1px solid ${C.inkLine}`, minHeight: 340 }}>
          {!capturedBlob ? (
            cameraError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6">
                <AlertTriangle size={28} color={C.gold} />
                <div style={{ color: C.ink60, fontSize: 12.5, textAlign: "center" }}>{cameraError}</div>
              </div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: facingMode === "user" ? "scaleX(-1)" : "none" }} />
                <FramingGuide />
                <button onClick={switchCamera} className="flex items-center justify-center rounded-full" style={{ position: "absolute", top: 12, right: 12, width: 40, height: 40, background: "rgba(10,15,26,0.65)", border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>
                  <SwitchCamera size={18} color={C.parchment} />
                </button>
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

// A large, high-contrast framing guide: everything outside the
// head-and-shoulders outline gets darkened (a "spotlight" effect),
// which makes the guide clearly visible regardless of what's behind it
// (unlike a thin dashed line, which disappeared against busy/light
// backgrounds). Bright yellow with a dark outline reads on any scene.
function FramingGuide() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <mask id="guide-cutout">
          <rect x="0" y="0" width="300" height="400" fill="white" />
          <ellipse cx="150" cy="150" rx="88" ry="108" fill="black" />
          <path d="M 40 400 C 40 300 90 255 150 255 C 210 255 260 300 260 400 Z" fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="300" height="400" fill="rgba(0,0,0,0.55)" mask="url(#guide-cutout)" />
      <ellipse cx="150" cy="150" rx="88" ry="108" fill="none" stroke="#0A0F1A" strokeWidth="5" opacity="0.6" />
      <path d="M 40 400 C 40 300 90 255 150 255 C 210 255 260 300 260 400" fill="none" stroke="#0A0F1A" strokeWidth="5" opacity="0.6" />
      <ellipse cx="150" cy="150" rx="88" ry="108" fill="none" stroke="#FFD24C" strokeWidth="2.5" strokeDasharray="8 6" />
      <path d="M 40 400 C 40 300 90 255 150 255 C 210 255 260 300 260 400" fill="none" stroke="#FFD24C" strokeWidth="2.5" strokeDasharray="8 6" />
    </svg>
  );
}
