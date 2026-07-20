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
  // Deliberately not anchored to line boundaries (^/$) — a scan logged
  // in production showed the decoded vCard text with no discernible
  // newlines between fields, which would make a line-anchored match
  // silently fail and fall through to using the entire raw blob as the
  // badge number. This version finds "UID:" anywhere and captures up
  // to the next newline, "END:VCARD", or end of string — correct
  // whether or not real line breaks are present in the decoded text.
  const uidMatch = decodedText.match(/UID:(.*?)(?:[\r\n]|END:VCARD|$)/);
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

  // jsQR is pure JavaScript (no hardware acceleration), and its cost
  // scales with pixel count — running it on a phone's full native
  // camera resolution (often 1920x1080+) on every single frame is
  // genuinely heavy sustained work. That's what was causing the
  // inconsistent detection: fine when the phone keeps up, degraded
  // the moment it can't. A QR code doesn't need anywhere near that
  // much resolution to read correctly, so every frame is downscaled
  // to a fixed working size first — dramatically cheaper per frame,
  // with no real loss of read reliability.
  const MAX_DIMENSION = 640;

  const tick = () => {
    if (stopped) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && videoEl.videoWidth) {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(videoEl.videoWidth, videoEl.videoHeight));
      canvas.width = Math.round(videoEl.videoWidth * scale);
      canvas.height = Math.round(videoEl.videoHeight * scale);
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
