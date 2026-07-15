import jsQR from "jsqr";

// Extracts the badge number from the QR's decoded content. Badges are
// printed as https://<badge-site>/profile/{badge_number} — the badge
// number is just the last URL path segment. Falls back to treating the
// raw decoded text as the badge number directly, in case a badge was
// ever printed with a bare code instead of a full URL.
export function extractBadgeNumber(decodedText) {
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
