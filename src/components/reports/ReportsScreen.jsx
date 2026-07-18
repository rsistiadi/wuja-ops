import React, { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { C } from "../../lib/tokens";
import { TopBar, PersonTag, Dropdown } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";

const CREW_CATEGORIES = ["committee", "volunteer"];

export default function ReportsScreen() {
  const [participantCounts, setParticipantCounts] = useState({ pending: 0, badge_pending: 0, checked_in: 0 });
  const [crewCounts, setCrewCounts] = useState({ pending: 0, badge_pending: 0, checked_in: 0 });
  const [busReport, setBusReport] = useState([]); // [{ bus, roster, legs: [{leg, boarded, notRiding, elsewhere, unaccounted}] }]
  const [eventReport, setEventReport] = useState([]); // [{ checkpoint, scanned, allowed, denied }]
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busDetail, setBusDetail] = useState(null); // { bus } while a detail sheet is open

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      const countFor = async (categoryFilter) => {
        const base = () => {
          let q = supabase.from("registrations").select("id", { count: "exact", head: true });
          return categoryFilter === "crew" ? q.in("category", CREW_CATEGORIES) : q.not("category", "in", `(${CREW_CATEGORIES.join(",")})`);
        };
        const [pendingRes, badgePendingRes, checkedInRes] = await Promise.all([
          base().eq("registered", false),
          base().eq("registered", true).eq("badge_status", "not_received"),
          base().eq("registered", true).eq("badge_status", "received"),
        ]);
        return { pending: pendingRes.count || 0, badge_pending: badgePendingRes.count || 0, checked_in: checkedInRes.count || 0 };
      };
      const [participantRes, crewRes] = await Promise.all([countFor("participant"), countFor("crew")]);
      if (!cancelled) { setParticipantCounts(participantRes); setCrewCounts(crewRes); }

      const [busesRes, legsRes] = await Promise.all([
        supabase.from("buses").select("id, name").order("name"),
        supabase.from("trip_legs").select("id, label").order("leg_date"),
      ]);
      const buses = busesRes.data || [];
      const legs = legsRes.data || [];

      const busRows = [];
      for (const bus of buses) {
        const { data: roster } = await supabase.from("registrations").select("id").eq("assigned_bus_id", bus.id);
        const rosterIds = (roster || []).map((r) => r.id);
        const legStats = [];
        for (const leg of legs) {
          const { data: statuses } = await supabase.from("bus_trip_status").select("registration_id, bus_id, status").eq("trip_leg_id", leg.id).in("registration_id", rosterIds.length ? rosterIds : ["00000000-0000-0000-0000-000000000000"]);
          const boarded = (statuses || []).filter((s) => s.status === "boarded" && s.bus_id === bus.id).length;
          const notRiding = (statuses || []).filter((s) => s.status === "not_riding").length;
          const elsewhere = (statuses || []).filter((s) => s.status === "boarded" && s.bus_id !== bus.id).length;
          legStats.push({ leg, boarded, notRiding, elsewhere, unaccounted: rosterIds.length - boarded - notRiding - elsewhere });
        }
        busRows.push({ bus, rosterCount: rosterIds.length, legStats });
      }
      if (!cancelled) setBusReport(busRows);

      const { data: checkpoints } = await supabase.from("checkpoints").select("id, name").in("type", ["event", "entry"]);
      const eventRows = [];
      for (const cp of checkpoints || []) {
        const [scannedRes, allowedRes] = await Promise.all([
          supabase.from("event_scan_log").select("id", { count: "exact", head: true }).eq("checkpoint_id", cp.id),
          supabase.from("event_scan_log").select("id", { count: "exact", head: true }).eq("checkpoint_id", cp.id).eq("allowed", true),
        ]);
        const scanned = scannedRes.count || 0;
        const allowed = allowedRes.count || 0;
        eventRows.push({ checkpoint: cp, scanned, allowed, denied: scanned - allowed });
      }
      if (!cancelled) setEventReport(eventRows);

      const { data: activityData } = await supabase.from("activity_log").select("action_text, created_at").order("created_at", { ascending: false }).limit(25);
      if (!cancelled) setActivity(activityData || []);

      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex-1 flex flex-col" style={{ position: "relative" }}>
      <TopBar title="Reports" subtitle="Live status across the congress" accent={C.gold} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6" style={{ background: C.inkSoft }}>
        {loading && <div style={{ color: C.ink40, fontSize: 13.5 }}>Loading…</div>}

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>PARTICIPANTS</div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Pending" value={participantCounts.pending} color={C.ink40} />
            <Stat label="Badge Pending" value={participantCounts.badge_pending} color={C.gold} />
            <Stat label="Checked In" value={participantCounts.checked_in} color={C.ok} />
          </div>
        </div>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>CREW / COMMITTEE</div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Pending" value={crewCounts.pending} color={C.ink40} />
            <Stat label="Badge Pending" value={crewCounts.badge_pending} color={C.gold} />
            <Stat label="Checked In" value={crewCounts.checked_in} color={C.ok} />
          </div>
        </div>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>BUS TRIPS <span style={{ fontWeight: 500, textTransform: "none" }}>— tap for detail</span></div>
          {busReport.length === 0 && !loading && <div style={{ color: C.ink40, fontSize: 13.5 }}>No buses configured.</div>}
          {busReport.map(({ bus, rosterCount, legStats }) => (
            <button key={bus.id} onClick={() => setBusDetail({ bus })} className="w-full text-left rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>
              <div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 700, marginBottom: 8 }}>{bus.name} <span style={{ color: C.ink40, fontWeight: 500 }}>· roster {rosterCount}</span></div>
              {legStats.map(({ leg, boarded, notRiding, elsewhere, unaccounted }) => (
                <div key={leg.id} className="flex items-center justify-between py-1.5" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
                  <span style={{ color: C.ink60, fontSize: 12.5 }}>{leg.label}</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink40, fontSize: 12.5 }}>
                    <span style={{ color: C.ok }}>{boarded}</span> boarded · <span style={{ color: C.ink60 }}>{notRiding}</span> not riding · <span style={{ color: C.guest }}>{elsewhere}</span> elsewhere · <span style={{ color: unaccounted ? C.alert : C.ok }}>{unaccounted}</span> unacc.
                  </span>
                </div>
              ))}
            </button>
          ))}
        </div>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>EVENT & ENTRY CHECKPOINTS</div>
          {eventReport.length === 0 && !loading && <div style={{ color: C.ink40, fontSize: 13.5 }}>No checkpoints configured.</div>}
          {eventReport.map(({ checkpoint, scanned, allowed, denied }) => (
            <div key={checkpoint.id} className="rounded-xl p-3.5 mb-2 flex items-center justify-between" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
              <span style={{ color: C.parchment, fontSize: 13.5, fontWeight: 600 }}>{checkpoint.name}</span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink40, fontSize: 12.5 }}>{scanned} scanned · <span style={{ color: C.ok }}>{allowed} allowed</span> · <span style={{ color: C.alert }}>{denied} denied</span></span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>RECENT ACTIVITY</div>
          {activity.length === 0 && !loading && <div style={{ color: C.ink40, fontSize: 13.5 }}>Nothing logged yet.</div>}
          {activity.map((a, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5" style={{ borderTop: i > 0 ? `1px dashed ${C.inkLine}` : "none" }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink40, fontSize: 11, marginTop: 1, flexShrink: 0 }}>{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span style={{ color: C.ink60, fontSize: 12.5 }}>{a.action_text}</span>
            </div>
          ))}
        </div>
      </div>

      {busDetail && <BusDetailSheet bus={busDetail.bus} onClose={() => setBusDetail(null)} />}
    </div>
  );
}

function BusDetailSheet({ bus, onClose }) {
  const [legs, setLegs] = useState([]);
  const [legId, setLegId] = useState("");
  const [roster, setRoster] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("trip_legs").select("id, label").order("leg_date").then(({ data }) => {
      setLegs(data || []);
      if (data?.length) setLegId(data[0].id);
    });
    supabase.from("registrations").select("id, full_name, category").eq("assigned_bus_id", bus.id).then(({ data }) => setRoster(data || []));
  }, [bus.id]);

  const refetch = useCallback(async () => {
    if (!legId) return;
    setLoading(true);
    const { data } = await supabase.from("bus_trip_status").select("registration_id, bus_id, status, reason").eq("trip_leg_id", legId);
    setStatuses(data || []);
    setLoading(false);
  }, [legId]);
  useEffect(() => { refetch(); }, [refetch]);

  const statusFor = (id) => statuses.find((s) => s.registration_id === id);

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div>
          <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600 }}>{bus.name} — Full Detail</div>
          <div style={{ color: C.ink40, fontSize: 12.5 }}>{roster.length} on roster</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      <div className="px-5 py-3" style={{ background: C.inkSoft }}>
        <Dropdown value={legId} onChange={setLegId} options={legs.map((l) => ({ value: l.id, label: l.label }))} />
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-2" style={{ background: C.inkSoft }}>
        {loading && <div style={{ color: C.ink40, fontSize: 13.5 }}>Loading…</div>}
        {!loading && roster.map((p) => {
          const rec = statusFor(p.id);
          let pill = { text: "UNACCOUNTED", color: C.alert };
          if (rec?.status === "not_riding") pill = { text: "NOT RIDING", color: C.ink60 };
          else if (rec?.status === "boarded" && rec.bus_id === bus.id) pill = { text: "BOARDED", color: C.ok };
          else if (rec?.status === "boarded" && rec.bus_id !== bus.id) pill = { text: "ON ANOTHER BUS", color: C.guest };
          return (
            <div key={p.id} className="rounded-xl px-4 py-3" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
              <div className="flex items-center justify-between">
                <div><div style={{ color: C.parchment, fontSize: 13.5, fontWeight: 600 }}>{p.full_name}</div><div className="mt-1"><PersonTag reg={p} /></div></div>
                <span className="rounded-full" style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", background: `${pill.color}22`, color: pill.color }}>{pill.text}</span>
              </div>
              {rec?.reason && <div style={{ color: C.ink40, fontSize: 12.5, fontStyle: "italic", marginTop: 6 }}>"{rec.reason}"</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-lg text-center py-3" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
      <div style={{ fontFamily: "JetBrains Mono, monospace", color, fontSize: 21, fontWeight: 700 }}>{value}</div>
      <div style={{ color: C.ink40, fontSize: 11, fontWeight: 600 }}>{label.toUpperCase()}</div>
    </div>
  );
}
