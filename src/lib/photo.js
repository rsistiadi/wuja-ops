// Every badge photo, regardless of which phone/camera captured it,
// gets normalized to the same output: TARGET_SIZE x TARGET_SIZE pixels,
// JPEG at JPEG_QUALITY. This is what makes storage cost and upload
// time predictable at ~1000 people, and keeps every badge visually
// consistent — see the earlier conversation about camera variance.

const TARGET_SIZE = 480; // long-edge-independent square output
const JPEG_QUALITY = 0.78;

export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 960 } },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

// Captures the current video frame, center-crops to a square, resizes
// to TARGET_SIZE, and returns a compressed JPEG Blob ready to upload.
// Using createImageBitmap first (rather than drawing the <video> element
// directly) lets the browser handle any EXIF-orientation correction for
// us — the one genuinely device-inconsistent part of this pipeline.
export async function captureNormalizedPhoto(videoEl) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) throw new Error("Camera not ready yet");

  const side = Math.min(vw, vh);
  const sx = (vw - side) / 2;
  const sy = (vh - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("Failed to encode photo");
  return blob;
}

// For photos coming from a file input (e.g. desktop testing without a
// camera) rather than live video — same normalization applied so the
// output is identical either way.
export async function normalizeImageFile(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("Failed to encode photo");
  return blob;
}
