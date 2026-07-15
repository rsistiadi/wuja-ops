import { supabase } from "./supabaseClient";

export async function lookupByBadgeNumber(badgeNumber) {
  const { data, error } = await supabase.from("registrations").select("*").eq("badge_number", badgeNumber).maybeSingle();
  if (error) throw error;
  return data; // null if no registration has this badge number
}
