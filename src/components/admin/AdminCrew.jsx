import React, { useState, useEffect } from "react";
import { AlertTriangle, UserCircle2, RefreshCw, X, Check } from "lucide-react";
import { C, CATEGORY_META, categoryLabel } from "../../lib/tokens";
import { Dropdown, PersonAvatar, PersonTag, StatusPill } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { getBadgePhotoUrl } from "../../lib/photoStorage";
import { ROLE_META } from "../../lib/roleMeta";

const ROLE_OPTIONS = Object.entries(ROLE_META).map(([value, v]) => ({ value, label: v.label }));

export default function AdminCrew({ callCrewAdmin, isSuperAdmin }) {
  const [crew, setCrew] = useState([]);
  const [regById, setRegById] = useState({}); // registration_id -> registration row
  const [photoUrls, setPhotoUrls] = useState({}); // registration_id -> signed photo url
  const [roleDraft, setRoleDraft] = useState({});
  const [resetNotice, setResetNotice] = useState({});
  const [confirmAction, setConfirmAction] = useState(null); // { type, member }
  const [selected, setSelected] = useState(null); // crew member being viewed in detail
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  const refetch = async () => {
    const { data, error } = await supabase
      .from("crew")
      .select("id, full_name, auth_user_id, requested_role, approved_role, status, created_at, registration_id, is_new_registration, merch_access")
      .order("created_at");
    if (error) { setError(`Couldn't load crew list: ${error.message}`); return; }
    setError("");
    setCrew(data || []);

    // Crew photo/category now lives on their linked registrations row —
    // fetch those in one batch rather than one request per person.
    const regIds = (data || []).map((c) => c.registration_id).filter(Boolean);
    if (regIds.length) {
      const { data: regs } = await supabase.from("registrations").select("id, full_name, category, photo_status, photo_url, badge_status, badge_number").in("id", regIds);
      const map = {};
      for (const r of regs || []) map[r.id] = r;
      setRegById(map);
      for (const r of regs || []) {
        if (r.photo_status === "captured" && r.photo_url && !photoUrls[r.id]) {
          const url = await getBadgePhotoUrl(r.photo_url);
          if (url) setPhotoUrls((prev) => ({ ...prev, [r.id]: url }));
        }
      }
    }
  };
  useEffect(() => {
    refetch();
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
  const changeRole = async (c, newRole) => {
    setRoleDraft((prev) => ({ ...prev, [c.id]: newRole })); // optimistic
    setBusy(true); setError("");
    try { await callCrewAdmin("change_role", { crew_id: c.id, approved_role: newRole }); refetch(); }
    catch (e) { setError(e.message); setRoleDraft((prev) => ({ ...prev, [c.id]: c.approved_role })); }
    finally { setBusy(false); }
  };
  const toggleMerchAccess = async (c) => {
    setBusy(true); setError("");
    try { await callCrewAdmin("toggle_merch_access", { crew_id: c.id, merch_access: !c.merch_access }); refetch(); }
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

  const requestRetake = async (c) => {
    if (!c.registration_id) return;
    setBusy(true); setError("");
    const { error } = await supabase.from("registrations").update({ photo_status: "retake_requested" }).eq("id", c.registration_id);
    if (error) setError(error.message);
    await refetch();
    setBusy(false);
  };

  const CrewAvatar = ({ c, size = 44 }) => {
    const reg = regById[c.registration_id];
    if (!reg) return <div style={{ width: size, height: size, borderRadius: 999, background: `${C.gold}22`, border: `2px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><UserCircle2 size={size * 0.55} color={C.gold} /></div>;
    return <PersonAvatar reg={reg} photoUrl={photoUrls[reg.id]} size={size} />;
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6 flex flex-col gap-6" style={{ background: C.inkSoft, position: "relative" }}>
      {error && <div style={{ color: C.alert, fontSize: 13.5 }}>{error}</div>}

      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700 }}>PENDING APPROVAL · {pending.length}</span>
          <button onClick={async () => { setRefreshing(true); await refetch(); setRefreshing(false); setTimeout(() => setJustRefreshed(false), 1500); setJustRefreshed(true); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: justRefreshed ? C.ok : C.gold, fontSize: 12.5, fontWeight: 700 }}>
            <RefreshCw size={11} style={{ animation: refreshing ? "spin 0.6s linear infinite" : "none" }} /> {justRefreshed ? "Refreshed ✓" : "Refresh"}
          </button>
        </div>
        {pending.length === 0 && <div style={{ color: C.ink40, fontSize: 13.5 }}>None.</div>}
        {pending.map((c) => (
          <div key={c.id} className="rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.gold}66` }}>
            <button onClick={() => setSelected(c)} className="flex items-center gap-3 w-full text-left" style={{ background: "none", border: "none", cursor: "pointer" }}>
              <CrewAvatar c={c} />
              <div>
                <div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 700 }}>{c.full_name}</div>
                {c.is_new_registration ? (
                  <div className="inline-flex items-center gap-1 rounded-full mt-1" style={{ background: `${C.alert}22`, color: C.alert, fontSize: 11, fontWeight: 700, padding: "2.5px 8px" }}><AlertTriangle size={10} /> NOT ON ROSTER — review carefully</div>
                ) : (
                  <div className="inline-flex items-center gap-1 rounded-full mt-1" style={{ background: `${C.ok}22`, color: C.ok, fontSize: 11, fontWeight: 700, padding: "2.5px 8px" }}><Check size={10} /> Matched to roster</div>
                )}
              </div>
            </button>
            <div style={{ marginTop: 10 }} />
            <Dropdown value={roleDraft[c.id] || c.requested_role} onChange={(v) => setRoleDraft((prev) => ({ ...prev, [c.id]: v }))} options={ROLE_OPTIONS} />
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => approve(c)} disabled={busy} className="flex-1 rounded-lg" style={{ background: C.ok, color: C.ink, fontSize: 13.5, fontWeight: 700, padding: "8px 0", border: "none", cursor: "pointer" }}>Approve</button>
              <button onClick={() => reject(c)} disabled={busy} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.alert, fontSize: 13.5, fontWeight: 600, padding: "8px 0", cursor: "pointer" }}>Reject</button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>ACTIVE CREW · {active.length}</div>
        {active.map((c) => (
          <div key={c.id} className="rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div className="flex items-center justify-between">
              <button onClick={() => setSelected(c)} className="flex items-center gap-3 flex-1 text-left" style={{ background: "none", border: "none", cursor: "pointer" }}>
                <CrewAvatar c={c} size={38} />
                <div><div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 700 }}>{c.full_name}</div><div style={{ color: C.ok, fontSize: 12.5, marginTop: 2 }}>{ROLE_META[c.approved_role]?.label}</div></div>
              </button>
              <div className="flex flex-col items-end gap-1.5" style={{ flexShrink: 0 }}>
                <span className="rounded-full" style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", background: `${C.ok}22`, color: C.ok }}>ACTIVE</span>
                {regById[c.registration_id]?.photo_status === "retake_requested" && (
                  <span className="rounded-full" style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", background: `${C.alert}22`, color: C.alert }}>RETAKE REQUESTED</span>
                )}
              </div>
            </div>
            {resetNotice[c.id] && <div style={{ color: C.gold, fontSize: 12.5, marginTop: 8 }}>New PIN: <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>{resetNotice[c.id]}</span> — share with them.</div>}
            <div className="mt-2.5"><Dropdown value={roleDraft[c.id] ?? c.approved_role} onChange={(v) => changeRole(c, v)} options={ROLE_OPTIONS} /></div>
            <button onClick={() => toggleMerchAccess(c)} disabled={busy} className="flex items-center justify-between w-full rounded-lg mt-2" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, padding: "8px 12px", cursor: "pointer" }}>
              <span style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600 }}>Merch operator access</span>
              <span className="rounded-full" style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", background: c.merch_access ? `${C.gold}22` : `${C.ink40}22`, color: c.merch_access ? C.gold : C.ink40 }}>{c.merch_access ? "GRANTED" : "OFF"}</span>
            </button>
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => setConfirmAction({ type: "reset", member: c })} disabled={busy} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 12.5, fontWeight: 600, padding: "7px 0", cursor: "pointer" }}>Reset PIN</button>
              <button onClick={() => setConfirmAction({ type: "deactivate", member: c })} disabled={busy} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.alert}66`, color: C.alert, fontSize: 12.5, fontWeight: 600, padding: "7px 0", cursor: "pointer" }}>Deactivate</button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>DEACTIVATED · {deactivated.length}</div>
        {deactivated.length === 0 && <div style={{ color: C.ink40, fontSize: 13.5 }}>None.</div>}
        {deactivated.map((c) => (
          <div key={c.id} className="rounded-xl p-3.5 mb-2 flex items-center justify-between" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <button onClick={() => setSelected(c)} className="flex items-center gap-3 flex-1 text-left" style={{ background: "none", border: "none", cursor: "pointer" }}>
              <CrewAvatar c={c} size={34} />
              <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600 }}>{c.full_name}</div>
            </button>
            <button onClick={() => reactivate(c)} disabled={busy} style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.gold, fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>Reactivate</button>
          </div>
        ))}
      </div>

      {confirmAction && (
        <div className="flex items-end" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(10,15,26,0.82)" }}>
          <div className="w-full rounded-t-2xl p-5" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} color={confirmAction.type === "deactivate" ? C.alert : C.gold} /><span style={{ color: C.parchment, fontSize: 14.5, fontWeight: 700 }}>{confirmAction.type === "deactivate" ? "Deactivate crew member?" : "Reset PIN?"}</span></div>
            <div style={{ color: C.ink60, fontSize: 13.5, marginBottom: 16 }}>
              {confirmAction.type === "deactivate"
                ? `${confirmAction.member.full_name} will immediately lose login access.`
                : `${confirmAction.member.full_name}'s current PIN stops working immediately. A new PIN is generated — you'll need to share it with them yourself.`}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmAction.type === "deactivate" ? confirmDeactivate : confirmResetPin} disabled={busy} className="flex-1 rounded-lg" style={{ background: confirmAction.type === "deactivate" ? C.alert : C.gold, color: confirmAction.type === "deactivate" ? C.parchment : C.ink, fontSize: 14.5, fontWeight: 700, padding: "10px 0", border: "none", cursor: "pointer" }}>Confirm</button>
              <button onClick={() => setConfirmAction(null)} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.ink60, fontSize: 14.5, fontWeight: 600, padding: "10px 0", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="flex items-end" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(10,15,26,0.82)" }}>
          <div className="w-full rounded-t-2xl p-5" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div className="flex items-center justify-between mb-4">
              <span style={{ color: C.parchment, fontSize: 15.5, fontWeight: 700 }}>Crew Profile</span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={C.ink40} /></button>
            </div>
            <div className="flex flex-col items-center">
              <CrewAvatar c={selected} size={84} />
              <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 20, fontWeight: 600, marginTop: 10 }}>{selected.full_name}</div>
              <span className="rounded-full mt-2" style={{ fontSize: 12.5, fontWeight: 700, padding: "3px 10px", background: `${C.gold}22`, color: C.gold }}>{ROLE_META[selected.approved_role || selected.requested_role]?.label}</span>
              {regById[selected.registration_id] && (
                <div className="w-full mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
                  <div className="flex justify-between"><span style={{ color: C.ink40, fontSize: 12.5 }}>Badge category</span><PersonTag reg={regById[selected.registration_id]} /></div>
                  <div className="flex justify-between"><span style={{ color: C.ink40, fontSize: 12.5 }}>Badge status</span><StatusPill reg={regById[selected.registration_id]} /></div>
                  <div className="flex justify-between"><span style={{ color: C.ink40, fontSize: 12.5 }}>Badge no.</span><span style={{ fontFamily: "JetBrains Mono, monospace", color: C.parchment, fontSize: 12.5 }}>{regById[selected.registration_id].badge_number || "— not issued —"}</span></div>
                </div>
              )}
              {!regById[selected.registration_id] && <div style={{ color: C.ink40, fontSize: 12.5, marginTop: 12, textAlign: "center" }}>No linked badge record — this account predates the unified badge system.</div>}
              {isSuperAdmin && regById[selected.registration_id] && (
                regById[selected.registration_id].photo_status === "retake_requested" ? (
                  <div className="w-full mt-4 rounded-lg text-center" style={{ background: `${C.alert}18`, border: `1px solid ${C.alert}66`, color: C.alert, fontSize: 12.5, fontWeight: 700, padding: "8px 0" }}>Retake already requested — waiting on them</div>
                ) : (
                  <button onClick={() => requestRetake(selected)} disabled={busy} className="w-full mt-4 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.alert}66`, color: C.alert, fontSize: 13.5, fontWeight: 600, padding: "9px 0", cursor: "pointer" }}>Request photo retake</button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
