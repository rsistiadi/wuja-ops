import React, { useState, useEffect } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { C } from "../../lib/tokens";
import { supabase } from "../../lib/supabaseClient";

export default function AdminSettings({ isSuperAdmin }) {
  const [allowSkipPhoto, setAllowSkipPhoto] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "allow_skip_photo").single()
      .then(({ data }) => { if (data) setAllowSkipPhoto(data.value === true || data.value === "true"); });
  }, []);

  const toggle = async () => {
    const next = !allowSkipPhoto;
    setAllowSkipPhoto(next); // optimistic
    const { error } = await supabase.from("app_settings").update({ value: next }).eq("key", "allow_skip_photo");
    if (error) { setError(error.message); setAllowSkipPhoto(!next); }
  };

  return (
    <div className="flex-1 px-5 py-5" style={{ background: C.inkSoft }}>
      <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
        <div className="pr-3">
          <div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>Allow skipping photo capture</div>
          <div style={{ color: C.ink60, fontSize: 12.5, marginTop: 4 }}>Super Admin only. When off, "Skip for now" disappears desk-wide.</div>
          {!isSuperAdmin && <div style={{ color: C.gold, fontSize: 12.5, marginTop: 6 }}>You're an Admin, not a Super Admin — this toggle is read-only for you.</div>}
        </div>
        <button onClick={toggle} disabled={!isSuperAdmin} style={{ background: "none", border: "none", cursor: isSuperAdmin ? "pointer" : "default", opacity: isSuperAdmin ? 1 : 0.5 }}>
          {allowSkipPhoto ? <ToggleRight size={34} color={C.gold} /> : <ToggleLeft size={34} color={C.ink40} />}
        </button>
      </div>
      {error && <div style={{ color: C.alert, fontSize: 13.5, marginTop: 10 }}>{error}</div>}
    </div>
  );
}
