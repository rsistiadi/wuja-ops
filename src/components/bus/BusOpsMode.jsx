import React, { useState, useEffect, useCallback } from "react";
import { ScanLine, ClipboardList, Check } from "lucide-react";
import { C } from "../../lib/tokens";
import { TopBar, PrimaryButton, Dropdown, PersonTag } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import BusScanSheet from "./BusScanSheet";
import { naturalSortBy } from "../../lib/naturalSort";

export default function BusOpsMode() {
  const [buses, setBuses] = useState([]);
  const [legs, setLegs] = useState([]);
  const [busId, setBusId] = useState("");
  const [legId, setLegId] = useState("");
  const [roster, setRoster] = useState([]);
  const [legStatuses, setLegStatuses] = useState([]); // all statuses for this leg, any bus
  const [addedRiders, setAddedRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null); // 'scan' | null
  const [showSummary, setShowSummary] = useState(false);
  const [reasonFor, setReasonFor] = useState(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [manualFor, setManualFor] = useState(null);
  const [manualReason, setManualReason] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("buses").select("id, name, assigned_lo_crew_id, crew:assigned_lo_crew_id(full_name)"),
      supabase.from("trip_legs").select("id, label").order("sort_order"),
    ]).then(([busesRes, legsRes]) => {
      const sortedBuses = naturalSortBy(busesRes.data, (b) => b.name);
      setBuses(sortedBuses);
      setLegs(legsRes.data || []);
      if (sortedBuses.length) setBusId(sortedBuses[0].id);
      if (legsRes.data?.length) setLegId(legsRes.data[0].id);
    });
  }, []);

  const bus = buses.find((b) => b.id === busId);
  const leg = legs.find((l) => l.id === legId);

  const refetch = useCallback(async () => {
    if (!busId || !legId) { setLoading(false); return; }
    setLoading(true);
    const [rosterRes, statusRes] = await Promise.all([
      supabase.from("registrations").select("id, full_name, category, assigned_bus_id, medical_note").eq("assigned_bus_id", busId),
      supabase.from("bus_trip_status").select("registration_id, bus_id, status, method, reason").eq("trip_leg_id", legId),
    ]);
    const rosterData = rosterRes.data || [];
    const statuses = statusRes.data || [];
    setRoster(rosterData);
    setLegStatuses(statuses);

    const rosterIds = new Set(rosterData.map((r) => r.id));
    const addedIds = statuses.filter((s) => s.bus_id === busId && s.status === "boarded" && !rosterIds.has(s.registration_id)).map((s) => s.registration_id);
    if (addedIds.length) {
      const { data: addedRegs } = await supabase.from("registrations").select("id, full_name, category, assigned_bus_id").in("id", addedIds);
      setAddedRiders(addedRegs || []);
    } else {
      setAddedRiders([]);
    }
    setLoading(false);
  }, [busId, legId]);

  useEffect(() => { refetch(); }, [refetch]);

  const statusFor = (registrationId) => legStatuses.find((s) => s.registration_id === registrationId);

  const boardedHere = roster.filter((p) => statusFor(p.id)?.status === "boarded" && statusFor(p.id)?.bus_id === busId).length;
  const notRiding = roster.filter((p) => statusFor(p.id)?.status === "not_riding").length;
  const elsewhere = roster.filter((p) => statusFor(p.id)?.status === "boarded" && statusFor(p.id)?.bus_id !== busId).length;
  const unaccounted = roster.length - boardedHere - notRiding - elsewhere;

  const upsertStatus = async (registrationId, status, reasonText = "", method = "manual") => {
    await supabase.from("bus_trip_status").upsert(
      { registration_id: registrationId, trip_leg_id: legId, bus_id: busId, status, method, reason: reasonText },
      { onConflict: "registration_id,trip_leg_id" }
    );
    refetch();
  };

  if (!bus || !leg) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: C.inkSoft, color: C.ink40, fontSize: 14.5 }}>
        {loading ? "Loading buses & trips…" : "No buses or trips configured yet — set these up in Admin first."}
      </div>
    );
  }

  if (showSummary) {
    const notRidingList = roster.filter((p) => statusFor(p.id)?.status === "not_riding");
    const unaccountedList = roster.filter((p) => !statusFor(p.id));
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title="Trip Summary" subtitle={`${bus.name} · ${leg.label}`} onBack={() => setShowSummary(false)} accent={C.gold} />
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5" style={{ background: C.inkSoft }}>
          <div className="grid grid-cols-3 gap-2">
            {[{ l: "Boarded", v: boardedHere + addedRiders.length, c: C.ok }, { l: "Not riding", v: notRiding, c: C.ink60 }, { l: "Unaccounted", v: unaccountedList.length, c: unaccountedList.length ? C.alert : C.ok }].map((s) => (
              <div key={s.l} className="rounded-lg text-center py-2.5" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}><div style={{ fontFamily: "JetBrains Mono, monospace", color: s.c, fontSize: 20, fontWeight: 700 }}>{s.v}</div><div style={{ color: C.ink40, fontSize: 11, fontWeight: 600 }}>{s.l.toUpperCase()}</div></div>
            ))}
          </div>
          <div>
            <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>NOT RIDING — WITH REASON</div>
            {notRidingList.length === 0 && <div style={{ color: C.ink40, fontSize: 13.5 }}>None.</div>}
            {notRidingList.map((p) => (<div key={p.id} className="rounded-xl px-4 py-3 mb-2" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}><div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>{p.full_name}</div><div style={{ color: C.ink40, fontSize: 12.5, fontStyle: "italic", marginTop: 2 }}>{statusFor(p.id)?.reason ? `"${statusFor(p.id).reason}"` : "No reason given"}</div></div>))}
          </div>
          <div>
            <div style={{ color: C.alert, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>UNACCOUNTED — NEEDS FOLLOW-UP</div>
            {unaccountedList.length === 0 && <div style={{ color: C.ok, fontSize: 13.5 }}>Everyone is accounted for.</div>}
            {unaccountedList.map((p) => (<div key={p.id} className="rounded-xl px-4 py-3 mb-2" style={{ background: C.ink, border: `1px solid ${C.alert}66` }}><div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>{p.full_name}</div><div style={{ color: C.alert, fontSize: 12.5, marginTop: 2 }}>No status recorded</div></div>))}
          </div>
        </div>
        <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}><PrimaryButton icon={Check} onClick={() => setShowSummary(false)}>Back to roster</PrimaryButton></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Bus Trip" subtitle={`${bus.name} · ${leg.label}${bus.crew?.full_name ? " · LO: " + bus.crew.full_name : ""}`} accent={C.gold} />
      <div className="px-5 pb-3 flex flex-col gap-2" style={{ background: C.ink }}>
        <div className="grid grid-cols-2 gap-2">
          <Dropdown value={busId} onChange={setBusId} options={buses.map((b) => ({ value: b.id, label: b.name }))} />
          <Dropdown value={legId} onChange={setLegId} options={legs.map((l) => ({ value: l.id, label: l.label }))} />
        </div>
      </div>

      <div className="px-5 pb-3" style={{ background: C.ink }}>
        <div className="grid grid-cols-4 gap-1.5">
          {[{ label: "Boarded", val: boardedHere, color: C.ok }, { label: "Not riding", val: notRiding, color: C.ink60 }, { label: "On another bus", val: elsewhere, color: C.guest }, { label: "Unaccounted", val: unaccounted, color: unaccounted > 0 ? C.alert : C.ok }].map((s) => (
            <div key={s.label} className="rounded-lg text-center py-2" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}><div style={{ fontFamily: "JetBrains Mono, monospace", color: s.color, fontSize: 16.5, fontWeight: 700 }}>{s.val}</div><div style={{ color: C.ink40, fontSize: 11, fontWeight: 600, marginTop: 1, lineHeight: 1.2 }}>{s.label.toUpperCase()}</div></div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-3 flex flex-col gap-2" style={{ background: C.ink }}>
        <button onClick={() => setSheet("scan")} className="w-full flex items-center justify-center gap-2.5 rounded-xl" style={{ background: C.gold, color: C.ink, fontWeight: 700, fontSize: 16.5, padding: "16px 0", border: "none", cursor: "pointer" }}><ScanLine size={20} /> SCAN BADGE</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-2" style={{ background: C.inkSoft }}>
        <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700 }}>{bus.name.toUpperCase()} ROSTER · {roster.length}</div>
        {roster.map((p) => {
          const rec = statusFor(p.id);
          let pill = { text: "UNACCOUNTED", color: C.alert };
          if (rec?.status === "not_riding") pill = { text: "NOT RIDING", color: C.ink60 };
          else if (rec?.status === "boarded" && rec.bus_id === busId) pill = { text: rec.method === "manual" ? "BOARDED (MANUAL)" : "BOARDED", color: C.ok };
          else if (rec?.status === "boarded" && rec.bus_id !== busId) pill = { text: `→ ${buses.find((b) => b.id === rec.bus_id)?.name || "?"}`, color: C.guest };

          return (
            <div key={p.id} className="rounded-xl px-4 py-3" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
              <div className="flex items-center justify-between">
                <div><div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>{p.full_name}</div><div className="flex items-center gap-2 mt-1"><PersonTag reg={p} /></div></div>
                <span className="rounded-full" style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", background: `${pill.color}22`, color: pill.color }}>{pill.text}</span>
              </div>
              {rec?.reason && <div style={{ color: C.ink40, fontSize: 12.5, fontStyle: "italic", marginTop: 6 }}>"{rec.reason}"</div>}

              {reasonFor === p.id ? (
                <div className="mt-2.5 flex flex-col gap-2">
                  <input value={reasonDraft} onChange={(e) => setReasonDraft(e.target.value)} placeholder="Reason (optional)" className="w-full rounded-lg outline-none" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 13.5, padding: "8px 10px" }} />
                  <div className="flex gap-2">
                    <button onClick={async () => { await upsertStatus(p.id, "not_riding", reasonDraft); setReasonFor(null); setReasonDraft(""); }} className="flex-1 rounded-lg" style={{ background: C.gold, color: C.ink, fontSize: 13.5, fontWeight: 700, padding: "7px 0", border: "none", cursor: "pointer" }}>Confirm</button>
                    <button onClick={() => setReasonFor(null)} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.ink60, fontSize: 13.5, fontWeight: 600, padding: "7px 0", cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : manualFor === p.id ? (
                <div className="mt-2.5 flex flex-col gap-2">
                  <input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="Reason (required — e.g. badge lost)" className="w-full rounded-lg outline-none" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 13.5, padding: "8px 10px" }} />
                  <div className="flex gap-2">
                    <button onClick={async () => { if (!manualReason.trim()) return; await upsertStatus(p.id, "boarded", manualReason.trim(), "manual"); setManualFor(null); setManualReason(""); }} disabled={!manualReason.trim()} className="flex-1 rounded-lg" style={{ background: manualReason.trim() ? C.gold : C.inkLine, color: C.ink, fontSize: 13.5, fontWeight: 700, padding: "7px 0", border: "none", cursor: "pointer" }}>Confirm boarded</button>
                    <button onClick={() => { setManualFor(null); setManualReason(""); }} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.ink60, fontSize: 13.5, fontWeight: 600, padding: "7px 0", cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                (!rec || rec.status === "not_riding") && (
                  <div className="mt-2.5 flex gap-2">
                    <button onClick={() => { setManualFor(p.id); setManualReason(""); }} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 12.5, fontWeight: 600, padding: "7px 0", cursor: "pointer" }}>Badge unavailable</button>
                    <button onClick={() => { setReasonFor(p.id); setReasonDraft(rec?.reason || ""); }} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.ink60, fontSize: 12.5, fontWeight: 600, padding: "7px 0", cursor: "pointer" }}>Not riding</button>
                  </div>
                )
              )}
            </div>
          );
        })}

        {addedRiders.length > 0 && (
          <>
            <div style={{ color: C.guest, fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>ON {bus.name.toUpperCase()}, NOT ON ROSTER</div>
            {addedRiders.map((p) => {
              const rec = statusFor(p.id);
              return (
                <div key={p.id} className="rounded-xl px-4 py-3" style={{ background: C.ink, border: `1px solid ${C.guest}55` }}>
                  <div className="flex items-center justify-between">
                    <div><div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>{p.full_name}</div><div style={{ color: C.ink40, fontSize: 12.5, marginTop: 4 }}>Home: {buses.find((b) => b.id === p.assigned_bus_id)?.name || "Unassigned"}</div></div>
                    <span className="rounded-full" style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", background: `${C.guest}22`, color: C.guest }}>ADDED</span>
                  </div>
                  {rec?.reason && <div style={{ color: C.ink40, fontSize: 12.5, fontStyle: "italic", marginTop: 6 }}>"{rec.reason}"</div>}
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={ClipboardList} onClick={() => setShowSummary(true)}>Complete trip</PrimaryButton>
      </div>

      {sheet === "scan" && <BusScanSheet bus={bus} buses={buses} roster={roster} legId={legId} onClose={() => setSheet(null)} onChanged={refetch} />}
    </div>
  );
}
