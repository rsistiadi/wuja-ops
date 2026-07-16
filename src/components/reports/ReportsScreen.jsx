import React, { useState, useEffect } from "react";
import { C } from "../../lib/tokens";
import { TopBar } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";

export default function ReportsScreen() {
  const [statusCounts, setStatusCounts] = useState({ pending: 0, badge_pending: 0, checked_in: 0 });
  const [busReport, setBusReport] = useState([]); // [{ bus, roster, legs: [{leg, boarded, notRiding, elsewhere, unaccounted}] }]
  const [eventReport, setEventReport] = useState([]); // [{ checkpoint, scanned, allowed, denied }]
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      const [pendingRes, badgePendingRes, checkedInRes] = await Promise.all([
        supabase.from("registrations").select("id", { count: "exact", head: true }).eq("registered", false),
        supabase.from("registrations").select("id", { count: "exact", head: true }).eq("registered", true).eq("badge_status", "not_received"),
        supabase.from("registrations").select("id", { count: "exact", head: true }).eq("registered", true).eq("badge_status", "received"),
      ]);
      if (!cancelled) setStatusCounts({ pending: pendingRes.count || 0, badge_pending: badgePendingRes.count || 0, checked_in: checkedInRes.count || 0 });

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
    <div className="flex-1 flex flex-col">
      <TopBar title="Reports" subtitle="Live status across the congress" accent={C.gold} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6" style={{ background: C.inkSoft }}>
        {loading && <div style={{ color: C.ink40, fontSize: 13.5 }}>Loading…</div>}

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>REGISTRATION STATUS</div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Pending" value={statusCounts.pending} color={C.ink40} />
            <Stat label="Badge Pending" value={statusCounts.badge_pending} color={C.gold} />
            <Stat label="Checked In" value={statusCounts.checked_in} color={C.ok} />
          </div>
        </div>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>BUS TRIPS</div>
          {busReport.length === 0 && !loading && <div style={{ color: C.ink40, fontSize: 13.5 }}>No buses configured.</div>}
          {busReport.map(({ bus, rosterCount, legStats }) => (
            <div key={bus.id} className="rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
              <div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 700, marginBottom: 8 }}>{bus.name} <span style={{ color: C.ink40, fontWeight: 500 }}>· roster {rosterCount}</span></div>
              {legStats.map(({ leg, boarded, notRiding, elsewhere, unaccounted }) => (
                <div key={leg.id} className="flex items-center justify-between py-1.5" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
                  <span style={{ color: C.ink60, fontSize: 12.5 }}>{leg.label}</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink40, fontSize: 12.5 }}>
                    <span style={{ color: C.ok }}>{boarded}</span> boarded · <span style={{ color: C.ink60 }}>{notRiding}</span> not riding · <span style={{ color: C.guest }}>{elsewhere}</span> elsewhere · <span style={{ color: unaccounted ? C.alert : C.ok }}>{unaccounted}</span> unacc.
                  </span>
                </div>
              ))}
            </div>
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
