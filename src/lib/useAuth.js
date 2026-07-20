import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export function useAuth() {
  const [session, setSession] = useState(null);
  const [crew, setCrew] = useState(null); // own crew row: {id, full_name, approved_role, status}
  const [loading, setLoading] = useState(true);

  const loadOwnCrewRow = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("crew")
      .select("id, full_name, approved_role, status, registration_id, merch_access")
      .eq("auth_user_id", userId)
      .single();
    if (error) {
      console.error("Failed to load crew profile:", error.message);
      setCrew(null);
      return;
    }
    setCrew(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadOwnCrewRow(session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) loadOwnCrewRow(session.user.id);
      else setCrew(null);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadOwnCrewRow]);

  // --- Public: search the pre-login name directory ---
  const searchNames = useCallback(async (query) => {
    if (query.trim().length < 2) return [];
    const { data, error } = await supabase
      .from("crew_login_directory")
      .select("id, full_name, status")
      .ilike("full_name", `%${query.trim()}%`)
      .limit(15);
    if (error) throw error;
    return data;
  }, []);

  // Sign-up search: only Committee/Volunteer badge holders (the
  // pre-uploaded roster) are searchable here — see
  // signup_eligible_directory. Deliberately separate from searchNames
  // (which finds existing crew LOGIN accounts) since these serve two
  // different steps: finding your badge to sign up vs. finding your
  // account to log in.
  const searchEligible = useCallback(async (query) => {
    if (query.trim().length < 2) return [];
    const { data, error } = await supabase
      .from("signup_eligible_directory")
      .select("id, full_name")
      .ilike("full_name", `%${query.trim()}%`)
      .limit(15);
    if (error) throw error;
    return data;
  }, []);

  // --- Log in an existing active crew member: PIN IS their Auth password ---
  const signIn = useCallback(async (crewId, pin) => {
    const email = `${crewId}@crew.wuja.internal`;
    const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Incorrect PIN — try again." : error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // --- First-time signup: goes through the public Edge Function, not
  // a direct table insert, so validation (weak-PIN check, duplicate
  // name check) happens server-side and can't be bypassed by a
  // tampered client. ---
  const requestSignup = useCallback(async ({ fullName, requestedRole, pin, registrationId, category, performerColor, photoBlob }) => {
    const photo_base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(photoBlob);
    });
    const res = await fetch(`${FUNCTIONS_URL}/crew-self-register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, requested_role: requestedRole, pin, registration_id: registrationId || null, category, performer_color: performerColor, photo_base64 }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Signup failed");
    return body;
  }, []);

  // --- Admin actions: approve/reject/reset_pin/deactivate/reactivate.
  // Requires the caller's own session token — crew-admin verifies on
  // the server that this token belongs to an active Admin/Super Admin,
  // never trusting anything the client claims about its own role. ---
  const callCrewAdmin = useCallback(async (action, payload) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) throw new Error("Not logged in");
    const res = await fetch(`${FUNCTIONS_URL}/crew-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSession.access_token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Action failed");
    return body;
  }, []);

  return { session, crew, loading, searchNames, searchEligible, signIn, signOut, requestSignup, callCrewAdmin };
}
