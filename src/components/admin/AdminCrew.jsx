import React, { useState, useEffect } from "react";
import { AlertTriangle, UserCircle2, RefreshCw } from "lucide-react";
import { C } from "../../lib/tokens";
import { Dropdown } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { getCrewPhotoUrl } from "../../lib/photoStorage";
import { ROLE_META } from "../../lib/roleMeta";

const ROLE_OPTIONS = Object.entries(ROLE_META).map(([value, v]) => ({ value, label: v.label }));

export default function AdminCrew({ callCrewAdmin }) {
  const [crew, setCrew] = useState([]);
  const [photoUrls, setPhotoUrls] = useState({});
  const [roleDraft, setRoleDraft] = useState({});
  const [resetNotice, setResetNotice] = useState({});
  const [confirmAction, setConfirmAction] = useState(null); // { type, member }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refetch = async () => {
    const { data } = await supabase.from("crew").select("*").order("created_at");
    setCrew(data || []);
    const withPhotos = (data || []).filter((c) => c.photo_url && !photoUrls[c.id]);
    for (const c of withPhotos) {
      const url = await getCrewPhotoUrl(c.photo_url);
      if (url) setPhotoUrls((prev) => ({ ...prev, [c.id]: url }));
    }
  };
  useEffect(() => {
    refetch();
    // The pending-count badge in AdminMode already polls every 15s —
    // this list needs to stay in sync with that, or an Admin can see
    // "1 pending" in the tab badge while the list underneath is stale
    // (exactly the bug that prompted this fix). Same interval, same
    // source of truth.
    const interval = setInterval(refetch, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = crew.filter((c) => c.status === "pending");
  const active = crew.filter((c) => c.status === "active");
  const deactivated = crew.filter((c) => c.status === "deactivated");

  const approve = async (c) => {
    setBusy(true); setError("");
    try { await callCrewAdmin("approve", { crew_id: c.id, approved_role: roleDraft[c.id] || c.requested_role }); refetch(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const reject = async (c) => {
    setBusy(true); setError("");
    try { await callCrewAdmin("reject", { crew_id: c.id }); refetch(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const confirmDeactivate = async () => {
    setBusy(true); setError("");
    try { await callCrewAdmin("deactivate", { crew_id: confirmAction.member.id }); refetch(); }
    catch (e) { setError(e.message); } finally { setBusy(false); setConfirmAction(null); }
  };
  const reactivate = async (c) => {
    setBusy(true); setError("");
    try { await callCrewAdmin("reactivate", { crew_id: c.id }); refetch(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const confirmResetPin = async () => {
    setBusy(true); setError("");
    try {
      const res = await callCrewAdmin("reset_pin", { crew_id: confirmAction.member.id });
      setResetNotice((prev) => ({ ...prev, [confirmAction.member.id]: res.new_pin }));
      refetch();
    } catch (e) { setError(e.message); } finally { setBusy(false); setConfirmAction(null); }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6 flex flex-col gap-6" style={{ background: C.inkSoft, position: "relative" }}>
      {error && <div style={{ color: C.alert, fontSize: 12.5 }}>{error}</div>}

      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span style={{ color: C.ink60, fontSize: 11, fontWeight: 700 }}>PENDING APPROVAL · {pending.length}</span>
          <button onClick={refetch} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: C.gold, fontSize: 10.5, fontWeight: 700 }}><RefreshCw size={11} /> Refresh</button>
        </div>
        {pending.length === 0 && <div style={{ color: C.ink40, fontSize: 12 }}>None.</div>}
        {pending.map((c) => (
          <div key={c.id} className="rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.gold}66` }}>
            <div className="flex items-center gap-3">
              {photoUrls[c.id] ? (
                <img src={photoUrls[c.id]} alt={c.full_name} style={{ width: 44, height: 44, borderRadius: 999, objectFit: "cover", border: `2px solid ${C.gold}` }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 999, background: `${C.gold}22`, border: `2px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><UserCircle2 size={24} color={C.gold} /></div>
              )}
              <div><div style={{ color: C.parchment, fontSize: 13.5, fontWeight: 700 }}>{c.full_name}</div><div style={{ color: C.ink60, fontSize: 11.5, marginTop: 2 }}>Requested: {ROLE_META[c.requested_role]?.label}</div></div>
            </div>
            <div style={{ marginTop: 10 }} />
            <Dropdown value={roleDraft[c.id] || c.requested_role} onChange={(v) => setRoleDraft((prev) => ({ ...prev, [c.id]: v }))} options={ROLE_OPTIONS} />
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => approve(c)} disabled={busy} className="flex-1 rounded-lg" style={{ background: C.ok, color: C.ink, fontSize: 12, fontWeight: 700, padding: "8px 0", border: "none", cursor: "pointer" }}>Approve</button>
              <button onClick={() => reject(c)} disabled={busy} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.alert, fontSize: 12, fontWeight: 600, padding: "8px 0", cursor: "pointer" }}>Reject</button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>ACTIVE CREW · {active.length}</div>
        {active.map((c) => (
          <div key={c.id} className="rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div className="flex items-center justify-between">
              <div><div style={{ color: C.parchment, fontSize: 13.5, fontWeight: 700 }}>{c.full_name}</div><div style={{ color: C.ok, fontSize: 11, marginTop: 2 }}>{ROLE_META[c.approved_role]?.label}</div></div>
              <span className="rounded-full" style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", background: `${C.ok}22`, color: C.ok }}>ACTIVE</span>
            </div>
            {resetNotice[c.id] && <div style={{ color: C.gold, fontSize: 11.5, marginTop: 8 }}>New PIN: <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>{resetNotice[c.id]}</span> — share with them.</div>}
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => setConfirmAction({ type: "reset", member: c })} disabled={busy} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 11.5, fontWeight: 600, padding: "7px 0", cursor: "pointer" }}>Reset PIN</button>
              <button onClick={() => setConfirmAction({ type: "deactivate", member: c })} disabled={busy} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.alert}66`, color: C.alert, fontSize: 11.5, fontWeight: 600, padding: "7px 0", cursor: "pointer" }}>Deactivate</button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>DEACTIVATED · {deactivated.length}</div>
        {deactivated.length === 0 && <div style={{ color: C.ink40, fontSize: 12 }}>None.</div>}
        {deactivated.map((c) => (
          <div key={c.id} className="rounded-xl p-3.5 mb-2 flex items-center justify-between" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div style={{ color: C.ink60, fontSize: 13, fontWeight: 600 }}>{c.full_name}</div>
            <button onClick={() => reactivate(c)} disabled={busy} style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.gold, fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>Reactivate</button>
          </div>
        ))}
      </div>

      {confirmAction && (
        <div className="absolute inset-0 flex items-end" style={{ background: "rgba(10,15,26,0.82)" }}>
          <div className="w-full rounded-t-2xl p-5" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} color={confirmAction.type === "deactivate" ? C.alert : C.gold} /><span style={{ color: C.parchment, fontSize: 13.5, fontWeight: 700 }}>{confirmAction.type === "deactivate" ? "Deactivate crew member?" : "Reset PIN?"}</span></div>
            <div style={{ color: C.ink60, fontSize: 12.5, marginBottom: 16 }}>
              {confirmAction.type === "deactivate"
                ? `${confirmAction.member.full_name} will immediately lose login access.`
                : `${confirmAction.member.full_name}'s current PIN stops working immediately. A new PIN is generated — you'll need to share it with them yourself.`}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmAction.type === "deactivate" ? confirmDeactivate : confirmResetPin} disabled={busy} className="flex-1 rounded-lg" style={{ background: confirmAction.type === "deactivate" ? C.alert : C.gold, color: confirmAction.type === "deactivate" ? C.parchment : C.ink, fontSize: 13, fontWeight: 700, padding: "10px 0", border: "none", cursor: "pointer" }}>Confirm</button>
              <button onClick={() => setConfirmAction(null)} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.ink60, fontSize: 13, fontWeight: 600, padding: "10px 0", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
