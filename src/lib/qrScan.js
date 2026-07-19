import jsQR from "jsqr";

// Extracts the badge number from the QR's decoded content. Confirmed
// against real vendor-printed QR samples: badges are vCards with a
// dedicated UID field holding the badge code exactly (e.g. "UID:Y893"),
// so any phone's camera app can "add to contacts" while our own
// scanner reads the same code via this one specific field — the most
// reliable place for it to live, not buried in free text. Falls back
// to URL-style badges (in case that format is ever used instead), then
// to treating the raw text as the badge number directly as a last resort.
export function extractBadgeNumber(decodedText) {
  const uidMatch = decodedText.match(/^UID:(.+)$/m);
  if (uidMatch) return uidMatch[1].trim();

  try {
    const url = new URL(decodedText);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || decodedText;
  } catch {
    return decodedText.trim();
  }
}

// Runs a scan loop against a live <video> element using requestAnimationFrame,
// sampling frames onto an offscreen canvas and handing pixel data to jsQR.
// Calls onDetected(decodedText) once, then stops itself. Returns a stop()
// function the caller can invoke early (e.g. user cancels).
export function startQrScanLoop(videoEl, onDetected) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let raf = null;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && videoEl.videoWidth) {
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) {
        stopped = true;
        onDetected(code.data);
        return;
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => { stopped = true; if (raf) cancelAnimationFrame(raf); };
}
