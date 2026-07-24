import React, { useState, useEffect } from "react";
import { Search, UserPlus } from "lucide-react";
import { C } from "../../lib/tokens";
import { TopBar, PersonTag, StatusPill, useDebouncedValue } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";

export default function SearchScreen({ deskMode, setDeskMode, onSelect, onWalkIn }) {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 280);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmed = debounced.trim();
    if (trimmed.length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true); setError("");

    // Server-side search — never fetch the whole table client-side.
    // Matches name, phone, email, or badge number (useful for finding
    // a placeholder record like "VIP Guest G622" by its badge alone).
    supabase
      .from("registrations")
      .select("id, reg_code, badge_number, full_name, phone, email, category, registered, badge_status, photo_status")
      .or(`full_name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,email.ilike.%${trimmed}%,badge_number.ilike.%${trimmed}%`)
      .limit(25)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setError(error.message); setResults([]); }
        else setResults(data);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debounced]);

  const trimmed = debounced.trim();

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Registration Desk" subtitle={deskMode === "full" ? "Full check-in" : "Register only — badge at main venue"} />
      <div className="px-5 pb-3" style={{ background: C.ink }}>
        <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
          {[{ k: "full", l: "Full Check-in" }, { k: "register_only", l: "Register Only" }].map((t) => (
            <button key={t.k} onClick={() => setDeskMode(t.k)} className="flex-1 rounded-md"
              style={{ padding: "7px 0", fontSize: 12.5, fontWeight: 700, background: deskMode === t.k ? C.gold : "transparent", color: deskMode === t.k ? C.ink : C.ink60, border: "none", cursor: "pointer" }}>{t.l}</button>
          ))}
        </div>
      </div>
      <div className="px-5 pb-4" style={{ background: C.ink }}>
        <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
          <Search size={16} color={C.ink60} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email, or badge no…"
            className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 15.5, padding: "11px 4px", border: "none" }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5" style={{ background: C.inkSoft }}>
        {trimmed.length < 2 && (
          <div className="flex flex-col items-center mt-16 gap-2">
            <Search size={28} color={C.ink40} />
            <div style={{ color: C.ink40, fontSize: 13.5, maxWidth: 220, textAlign: "center" }}>Type a name, phone, email, or badge number to search — nothing loads until you do.</div>
          </div>
        )}
        {error && <div style={{ color: C.alert, fontSize: 13.5 }}>{error}</div>}
        {trimmed.length >= 2 && !loading && results.length === 0 && !error && (
          <div style={{ color: C.ink40, fontSize: 14.5, textAlign: "center", marginTop: 40 }}>No matches — check spelling or register a walk-in below.</div>
        )}
        {results.map((r) => (
          <button key={r.id} onClick={() => onSelect(r)} className="flex items-center justify-between rounded-xl px-4 py-3.5" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div className="text-left">
              <div style={{ color: C.parchment, fontSize: 15.5, fontWeight: 600 }}>{r.full_name}</div>
              <div className="flex items-center gap-2 mt-1.5"><PersonTag reg={r} /></div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink40, fontSize: 11, marginTop: 3 }}>{r.badge_number || "no badge"} · {r.phone}</div>
            </div>
            <StatusPill reg={r} />
          </button>
        ))}
      </div>
      <div className="px-5 pb-6 pt-3" style={{ background: C.inkSoft }}>
        <button onClick={onWalkIn} className="w-full flex items-center justify-center gap-2 rounded-xl"
          style={{ background: C.ink, border: `1px dashed ${C.gold}66`, color: C.gold, fontWeight: 700, fontSize: 13.5, padding: "11px 0", cursor: "pointer" }}>
          <UserPlus size={15} /> Register a walk-in
        </button>
      </div>
    </div>
  );
}
