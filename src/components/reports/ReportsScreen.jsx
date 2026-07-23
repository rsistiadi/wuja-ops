import React, { useState, useEffect, useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { C } from "../../lib/tokens";
import { TopBar, PersonTag, Dropdown } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { naturalSortBy } from "../../lib/naturalSort";
import { BOROBUDUR_MEAL_OPTIONS, PRAMBANAN_MEAL_OPTIONS } from "../../lib/mealChoices";
import VirtualList from "../shared/VirtualList";

const CREW_CATEGORIES = ["committee", "volunteer"];
const STATUS_LABELS = { pending: "Pending", badge_pending: "Badge Pending", checked_in: "Checked In" };

export default function ReportsScreen() {
  const [participantCounts, setParticipantCounts] = useState({ pending: 0, badge_pending: 0, checked_in: 0 });
  const [crewCounts, setCrewCounts] = useState({ pending: 0, badge_pending: 0, checked_in: 0 });
  const [walkInStats, setWalkInStats] = useState({ total: 0, free: 0, unpaid: 0, paid: 0, collected: 0 });
  const [mealStats, setMealStats] = useState({ borobudur: {}, prambanan: {} });
  const [busReport, setBusReport] = useState([]); // [{ bus, roster, legs: [{leg, boarded, notRiding, elsewhere, unaccounted}] }]
  const [eventReport, setEventReport] = useState([]); // [{ checkpoint, scanned, allowed, denied }]
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busDetail, setBusDetail] = useState(null); // { bus } while a detail sheet is open
  const [statusDetail, setStatusDetail] = useState(null); // { group: 'participant'|'crew', status: 'pending'|... }
  const [checkpointDetail, setCheckpointDetail] = useState(null); // { checkpoint }

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

      // Walk-ins get a distinct reg_code prefix (vs. the original bulk
      // import or crew self-signup), so no separate flag column is needed.
      const { data: walkIns } = await supabase.from("registrations").select("payment_status, payment_amount").like("reg_code", "WUJA2026-W%");
      if (!cancelled) {
        const rows = walkIns || [];
        setWalkInStats({
          total: rows.length,
          free: rows.filter((r) => r.payment_status === "free").length,
          unpaid: rows.filter((r) => r.payment_status === "unpaid").length,
          paid: rows.filter((r) => r.payment_status === "paid").length,
          collected: rows.reduce((sum, r) => sum + (r.payment_status === "paid" ? Number(r.payment_amount || 0) : 0), 0),
        });
      }

      // Excludes performers — they aren't asked, meal service doesn't apply to them.
      const { data: mealRows } = await supabase.from("registrations").select("meal_choice_borobudur, meal_choice_prambanan").neq("category", "performer");
      if (!cancelled) {
        const rows = mealRows || [];
        const countBy = (key, options) => {
          const counts = {};
          for (const o of options) counts[o.value] = rows.filter((r) => r[key] === o.value).length;
          counts.not_asked = rows.filter((r) => !r[key]).length;
          return counts;
        };
        setMealStats({
          borobudur: countBy("meal_choice_borobudur", BOROBUDUR_MEAL_OPTIONS),
          prambanan: countBy("meal_choice_prambanan", PRAMBANAN_MEAL_OPTIONS),
        });
      }

      const [busesRes, legsRes] = await Promise.all([
        supabase.from("buses").select("id, name"),
        supabase.from("trip_legs").select("id, label").order("sort_order"),
      ]);
      const buses = naturalSortBy(busesRes.data, (b) => b.name);
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
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>PARTICIPANTS <span style={{ fontWeight: 500, textTransform: "none" }}>— tap for detail</span></div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Pending" value={participantCounts.pending} color={C.ink40} onClick={() => setStatusDetail({ group: "participant", status: "pending" })} />
            <Stat label="Badge Pending" value={participantCounts.badge_pending} color={C.gold} onClick={() => setStatusDetail({ group: "participant", status: "badge_pending" })} />
            <Stat label="Checked In" value={participantCounts.checked_in} color={C.ok} onClick={() => setStatusDetail({ group: "participant", status: "checked_in" })} />
          </div>
        </div>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>CREW / COMMITTEE <span style={{ fontWeight: 500, textTransform: "none" }}>— tap for detail</span></div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Pending" value={crewCounts.pending} color={C.ink40} onClick={() => setStatusDetail({ group: "crew", status: "pending" })} />
            <Stat label="Badge Pending" value={crewCounts.badge_pending} color={C.gold} onClick={() => setStatusDetail({ group: "crew", status: "badge_pending" })} />
            <Stat label="Checked In" value={crewCounts.checked_in} color={C.ok} onClick={() => setStatusDetail({ group: "crew", status: "checked_in" })} />
          </div>
        </div>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>WALK-IN REGISTRATIONS</div>
          <div className="rounded-xl p-3.5" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ color: C.parchment, fontSize: 14.5, fontWeight: 700 }}>{walkInStats.total} total</span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.ok, fontSize: 13, fontWeight: 700 }}>Rp {walkInStats.collected.toLocaleString("id-ID")} collected</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Free" value={walkInStats.free} color={C.ink40} />
              <Stat label="Not Paid" value={walkInStats.unpaid} color={C.alert} />
              <Stat label="Paid" value={walkInStats.paid} color={C.ok} />
            </div>
          </div>
        </div>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>MEAL CHOICES <span style={{ fontWeight: 500, textTransform: "none" }}>— for catering counts, excludes performers</span></div>
          <div className="flex flex-col gap-2.5">
            <MealCard title="31 July — Lunch, Borobudur" options={BOROBUDUR_MEAL_OPTIONS} counts={mealStats.borobudur} />
            <MealCard title="1 August — Dinner, Prambanan" options={PRAMBANAN_MEAL_OPTIONS} counts={mealStats.prambanan} />
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
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>EVENT & ENTRY CHECKPOINTS <span style={{ fontWeight: 500, textTransform: "none" }}>— tap for detail</span></div>
          {eventReport.length === 0 && !loading && <div style={{ color: C.ink40, fontSize: 13.5 }}>No checkpoints configured.</div>}
          {eventReport.map(({ checkpoint, scanned, allowed, denied }) => (
            <button key={checkpoint.id} onClick={() => setCheckpointDetail({ checkpoint })} className="w-full text-left rounded-xl p-3.5 mb-2 flex items-center justify-between" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>
              <span style={{ color: C.parchment, fontSize: 13.5, fontWeight: 600 }}>{checkpoint.name}</span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink40, fontSize: 12.5 }}>{scanned} scanned · <span style={{ color: C.ok }}>{allowed} allowed</span> · <span style={{ color: C.alert }}>{denied} denied</span></span>
            </button>
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
      {statusDetail && <StatusDetailSheet group={statusDetail.group} status={statusDetail.status} onClose={() => setStatusDetail(null)} />}
      {checkpointDetail && <CheckpointDetailSheet checkpoint={checkpointDetail.checkpoint} onClose={() => setCheckpointDetail(null)} />}
    </div>
  );
}

function BusDetailSheet({ bus, onClose }) {
  const [legs, setLegs] = useState([]);
  const [legId, setLegId] = useState("");
  const [roster, setRoster] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("trip_legs").select("id, label").order("sort_order").then(({ data }) => {
      setLegs(data || []);
      if (data?.length) setLegId(data[0].id);
    });
    supabase.from("registrations").select("id, full_name, category, phone").eq("assigned_bus_id", bus.id).then(({ data }) => setRoster(data || []));
  }, [bus.id]);

  const refetch = useCallback(async () => {
    if (!legId) return;
    setLoading(true);
    const { data, error } = await supabase.from("bus_trip_status").select("registration_id, bus_id, status, reason, recorded_at").eq("trip_leg_id", legId);
    if (error) { setError(error.message); setLoading(false); return; }
    setError("");
    setStatuses(data || []);
    setLoading(false);
  }, [legId]);
  useEffect(() => { refetch(); }, [refetch]);

  const statusFor = (id) => statuses.find((s) => s.registration_id === id);

  const rosterWithStatus = useMemo(() => roster.map((p) => ({ ...p, _rec: statusFor(p.id) })), [roster, statuses]);

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
      {loading && <div style={{ color: C.ink40, fontSize: 13.5, padding: "0 20px" }}>Loading…</div>}
      {error && <div style={{ color: C.alert, fontSize: 13.5, padding: "0 20px" }}>Couldn't load trip status: {error}</div>}
      {!loading && (
        <VirtualList
          items={rosterWithStatus}
          rowHeight={78}
          searchKeys={["full_name", "phone"]}
          searchPlaceholder="Search roster…"
          emptyLabel="No matches."
          renderRow={(p) => {
            const rec = p._rec;
            let pill = { text: "UNACCOUNTED", color: C.alert };
            if (rec?.status === "not_riding") pill = { text: "NOT RIDING", color: C.ink60 };
            else if (rec?.status === "boarded" && rec.bus_id === bus.id) pill = { text: "BOARDED", color: C.ok };
            else if (rec?.status === "boarded" && rec.bus_id !== bus.id) pill = { text: "ON ANOTHER BUS", color: C.guest };
            return (
              <div className="rounded-xl px-4 py-3 h-full" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ color: C.parchment, fontSize: 13.5, fontWeight: 600 }}>{p.full_name}</div>
                    <div style={{ color: C.ink40, fontSize: 11.5, marginTop: 2 }}>{p.phone || "—"}{rec?.recorded_at ? ` · ${new Date(rec.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
                  </div>
                  <span className="rounded-full" style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", background: `${pill.color}22`, color: pill.color, flexShrink: 0 }}>{pill.text}</span>
                </div>
                {rec?.reason && <div style={{ color: C.ink40, fontSize: 12, fontStyle: "italic", marginTop: 4 }}>"{rec.reason}"</div>}
              </div>
            );
          }}
        />
      )}
    </div>
  );
}

// Backs all 6 Participant/Crew status cards — same shape of question
// each time ("who exactly is in this bucket"), just a different filter.
function StatusDetailSheet({ group, status, onClose }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let q = supabase.from("registrations").select("id, full_name, phone, category");
      q = group === "crew" ? q.in("category", CREW_CATEGORIES) : q.not("category", "in", `(${CREW_CATEGORIES.join(",")})`);
      if (status === "pending") q = q.eq("registered", false);
      else if (status === "badge_pending") q = q.eq("registered", true).eq("badge_status", "not_received");
      else q = q.eq("registered", true).eq("badge_status", "received");

      const { data, error } = await q.order("full_name");
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      setError("");
      setPeople(data || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [group, status]);

  const title = `${group === "crew" ? "Crew / Committee" : "Participants"} — ${STATUS_LABELS[status]}`;

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div>
          <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600 }}>{title}</div>
          <div style={{ color: C.ink40, fontSize: 12.5 }}>{people.length} {people.length === 1 ? "person" : "people"}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      {loading && <div style={{ color: C.ink40, fontSize: 13.5, padding: "16px 20px" }}>Loading…</div>}
      {error && <div style={{ color: C.alert, fontSize: 13.5, padding: "16px 20px" }}>Couldn't load: {error}</div>}
      {!loading && !error && (
        <VirtualList
          items={people}
          rowHeight={70}
          searchKeys={["full_name", "phone"]}
          searchPlaceholder="Search name or phone…"
          emptyLabel="Nobody in this bucket."
          renderRow={(p) => (
            <div className="rounded-xl px-4 py-3 h-full flex items-center justify-between" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
              <div>
                <div style={{ color: C.parchment, fontSize: 13.5, fontWeight: 600 }}>{p.full_name}</div>
                <div style={{ color: C.ink40, fontSize: 11.5, marginTop: 2 }}>{p.phone || "— no phone on file —"}</div>
              </div>
              <PersonTag reg={p} />
            </div>
          )}
        />
      )}
    </div>
  );
}

// Event Scan doesn't have a fixed roster like buses do — it's a log of
// scan events, and the same person can scan multiple times (re-entry).
// This shows one row per unique person with their MOST RECENT result,
// answering "who's currently allowed/denied here" rather than a full
// chronological log of every scan.
function CheckpointDetailSheet({ checkpoint, onClose }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: logs, error: logErr } = await supabase
        .from("event_scan_log")
        .select("registration_id, allowed, scanned_at")
        .eq("checkpoint_id", checkpoint.id)
        .order("scanned_at", { ascending: false });
      if (cancelled) return;
      if (logErr) { setError(logErr.message); setLoading(false); return; }

      // Latest scan per person — logs are already newest-first, so the
      // first time we see a registration_id is its latest result.
      const latestByPerson = new Map();
      for (const row of logs || []) {
        if (!latestByPerson.has(row.registration_id)) latestByPerson.set(row.registration_id, row);
      }
      const ids = [...latestByPerson.keys()];
      if (ids.length === 0) { setPeople([]); setLoading(false); return; }

      const { data: regs, error: regErr } = await supabase.from("registrations").select("id, full_name, phone, category").in("id", ids);
      if (cancelled) return;
      if (regErr) { setError(regErr.message); setLoading(false); return; }

      setError("");
      setPeople((regs || []).map((r) => ({ ...r, _latest: latestByPerson.get(r.id) })));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [checkpoint.id]);

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div>
          <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600 }}>{checkpoint.name} — Full Detail</div>
          <div style={{ color: C.ink40, fontSize: 12.5 }}>{people.length} unique {people.length === 1 ? "person" : "people"} scanned</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      {loading && <div style={{ color: C.ink40, fontSize: 13.5, padding: "16px 20px" }}>Loading…</div>}
      {error && <div style={{ color: C.alert, fontSize: 13.5, padding: "16px 20px" }}>Couldn't load: {error}</div>}
      {!loading && !error && (
        <VirtualList
          items={people}
          rowHeight={70}
          searchKeys={["full_name", "phone"]}
          searchPlaceholder="Search name or phone…"
          emptyLabel="No scans logged yet."
          renderRow={(p) => (
            <div className="rounded-xl px-4 py-3 h-full flex items-center justify-between" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
              <div>
                <div style={{ color: C.parchment, fontSize: 13.5, fontWeight: 600 }}>{p.full_name}</div>
                <div style={{ color: C.ink40, fontSize: 11.5, marginTop: 2 }}>{p.phone || "—"} · last scan {new Date(p._latest.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <span className="rounded-full" style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", background: p._latest.allowed ? `${C.ok}22` : `${C.alert}22`, color: p._latest.allowed ? C.ok : C.alert, flexShrink: 0 }}>{p._latest.allowed ? "ALLOWED" : "DENIED"}</span>
            </div>
          )}
        />
      )}
    </div>
  );
}

function MealCard({ title, options, counts }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
      <div style={{ color: C.parchment, fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => <Stat key={o.value} label={o.label} value={counts[o.value] || 0} color={o.value === "na" ? C.ink40 : C.gold} />)}
        <Stat label="Not Asked" value={counts.not_asked || 0} color={C.alert} />
      </div>
    </div>
  );
}

function Stat({ label, value, color, onClick }) {
  return (
    <button onClick={onClick} className="rounded-lg text-center py-3 w-full" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontFamily: "JetBrains Mono, monospace", color, fontSize: 21, fontWeight: 700 }}>{value}</div>
      <div style={{ color: C.ink40, fontSize: 11, fontWeight: 600 }}>{label.toUpperCase()}</div>
    </button>
  );
}
