// Every badge photo, regardless of which phone/camera captured it,
// gets normalized to the same output: TARGET_SIZE x TARGET_SIZE pixels,
// JPEG at JPEG_QUALITY. This is what makes storage cost and upload
// time predictable at ~1000 people, and keeps every badge visually
// consistent — see the earlier conversation about camera variance.

const TARGET_SIZE = 480; // long-edge-independent square output
const JPEG_QUALITY = 0.78;

// Rear camera is the default: crew are photographing an attendee
// standing in front of them, not taking a selfie. Front camera is
// offered as a switchable option for edge cases (short-staffed desk,
// attendee self-serving).
export async function startCamera(videoEl, facingMode = "environment") {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facingMode }, width: { ideal: 960 }, height: { ideal: 960 } },
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
// When facingMode is "user" (front/selfie camera), the raw sensor feed
// is NOT mirrored, but we mirror the on-screen preview so it feels
// natural (like a mirror) — so the capture must apply the same mirror
// to match what the person actually saw, or the saved photo looks
// backwards compared to the preview. Rear camera never mirrors either
// preview or capture, since that's normal photography of someone else.
export async function captureNormalizedPhoto(videoEl, facingMode = "environment") {
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

  if (facingMode === "user") {
    ctx.translate(TARGET_SIZE, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(videoEl, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("Failed to encode photo");
  return blob;
}

// For photos coming from a file input (e.g. desktop testing without a
// camera) rather than live video — same normalization applied so the
// output is identical either way. Never mirrored, since a file upload
// has no "preview mirror" expectation attached to it.
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
