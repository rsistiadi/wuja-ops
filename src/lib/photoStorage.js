import { supabase } from "./supabaseClient";

// The bucket is private (not public) — RLS on storage.objects requires
// an active crew session to read or write. We store just the object
// PATH in registrations.photo_url, not a full URL, because a public
// URL wouldn't work against a private bucket and a signed URL would
// expire. Signed URLs are generated on demand at display time instead.

export async function uploadBadgePhoto(registrationId, blob) {
  const path = `${registrationId}.jpg`;
  const { error } = await supabase.storage
    .from("badge-photos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return path;
}

export async function getBadgePhotoUrl(path, expiresInSeconds = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("badge-photos")
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("Failed to sign photo URL:", error.message);
    return null;
  }
  return data.signedUrl;
}

export async function getCrewPhotoUrl(path, expiresInSeconds = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("crew-photos")
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("Failed to sign crew photo URL:", error.message);
    return null;
  }
  return data.signedUrl;
}
