import React, { useState, useEffect, useCallback } from "react";
import { ScanLine, UserPlus } from "lucide-react";
import { C, CATEGORY_META, categoryLabel } from "../../lib/tokens";
import { TopBar, Dropdown } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { isAllowed } from "../../lib/checkpointAccess";
import ScanSheet from "../shared/ScanSheet";

export default function EventScanMode() {
  const [checkpoints, setCheckpoints] = useState([]);
  const [cpId, setCpId] = useState("");
  const [namedIds, setNamedIds] = useState(new Set());
  const [stats, setStats] = useState({ scanned: 0, allowed: 0, denied: 0 });
  const [sheet, setSheet] = useState(null); // 'scan' | 'manual' | null
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    supabase.from("checkpoints").select("*").in("type", ["event", "entry"]).then(({ data }) => {
      setCheckpoints(data || []);
      if (data?.length) setCpId(data[0].id);
    });
  }, []);

  const cp = checkpoints.find((c) => c.id === cpId);

  const loadNamedList = useCallback(async () => {
    if (!cp) return;
    if (cp.access_rule !== "named" && cp.access_rule !== "both") { setNamedIds(new Set()); setLoadError(""); return; }
    const { data, error } = await supabase.from("checkpoint_named_list").select("registration_id").eq("checkpoint_id", cp.id);
    if (error) {
      // This list gates who's allowed in under this checkpoint's rule —
      // failing silently here would make the app wrongly deny every
      // named guest with no visible warning. Must be loud about it.
      setLoadError(`Couldn't load the named guest list — DO NOT rely on allow/deny results until this is fixed: ${error.message}`);
      return;
    }
    setLoadError("");
    setNamedIds(new Set((data || []).map((r) => r.registration_id)));
  }, [cp]);

  const loadStats = useCallback(async () => {
    if (!cp) return;
    const [scannedRes, allowedRes] = await Promise.all([
      supabase.from("event_scan_log").select("id", { count: "exact", head: true }).eq("checkpoint_id", cp.id),
      supabase.from("event_scan_log").select("id", { count: "exact", head: true }).eq("checkpoint_id", cp.id).eq("allowed", true),
    ]);
    const scanned = scannedRes.count || 0;
    const allowed = allowedRes.count || 0;
    setStats({ scanned, allowed, denied: scanned - allowed });
  }, [cp]);

  useEffect(() => { loadNamedList(); loadStats(); }, [loadNamedList, loadStats]);

  // Poll independently of local scans — otherwise this device's counter
  // only ever reflects its own activity, and looks wrong the moment a
  // second device scans the same checkpoint at the same time.
  useEffect(() => {
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [loadStats]);

  const record = async (person, allowed, method, reason = null) => {
    // scanned_by/scanned_at are force-set server-side by the trigger.
    await supabase.from("event_scan_log").insert({ checkpoint_id: cp.id, registration_id: person.id, allowed, method, reason });
    // Re-query the real count rather than incrementing local state —
    // a local-only increment would only ever reflect this one device's
    // scans, understating the true total the moment a second device
    // scans the same checkpoint at the same time.
    await loadStats();
  };

  const notAllowedDetail = (person) => {
    const required = (cp.categories || []).map((c) => CATEGORY_META[c]?.label || c);
    const requiredText = required.length ? `This checkpoint requires: ${required.join(", ")}` : "This checkpoint has no open category — named guest list only.";
    return `Category: ${categoryLabel(person)} · ${requiredText}`;
  };

  const resolveScan = async (person) => {
    const allowed = isAllowed(person, cp, namedIds);
    await record(person, allowed, "scan");
    return allowed
      ? { color: C.ok, headline: `ALLOWED — ${person.full_name}`, detail: categoryLabel(person) + (person.medical_note ? " · has a medical note" : "") }
      : { color: C.alert, headline: `NOT ALLOWED — ${person.full_name}`, detail: notAllowedDetail(person) };
  };

  const resolveManual = async (person, reason) => {
    if (reason === null) return { needsReason: true };
    const allowed = isAllowed(person, cp, namedIds);
    await record(person, allowed, "manual", reason);
    return allowed
      ? { color: C.ok, headline: `ALLOWED (manual) — ${person.full_name}`, detail: `Reason logged: "${reason}"` }
      : { color: C.alert, headline: `NOT ALLOWED — ${person.full_name}`, detail: `${notAllowedDetail(person)} · Manual entry, reason logged: "${reason}"` };
  };

  if (!cp) {
    return <div className="flex-1 flex items-center justify-center" style={{ background: C.inkSoft, color: C.ink40, fontSize: 14.5 }}>No checkpoints configured yet — set these up in Admin first.</div>;
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Event / Entry Scan" subtitle={cp.name} accent={C.gold} />
      <div className="px-5 pb-3" style={{ background: C.ink }}>
        <Dropdown value={cpId} onChange={setCpId} options={checkpoints.map((c) => ({ value: c.id, label: c.name }))} />
      </div>
      {loadError && (
        <div className="mx-5 mb-3 rounded-lg px-3 py-2.5" style={{ background: `${C.alert}1f`, border: `1px solid ${C.alert}` }}>
          <span style={{ color: C.alert, fontSize: 12.5, fontWeight: 600 }}>{loadError}</span>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ background: C.inkSoft }}>
        <div style={{ width: 96, height: 96, borderRadius: 999, border: `1.5px dashed ${C.inkLine}`, display: "flex", alignItems: "center", justifyContent: "center" }}><ScanLine size={40} color={C.ink40} /></div>
        <div style={{ color: C.ink40, fontSize: 13.5 }}>Ready to scan next badge</div>
      </div>
      <div className="px-5 pb-7 pt-3 flex flex-col gap-2" style={{ background: C.inkSoft, position: "relative" }}>
        <div style={{ color: C.ink40, fontSize: 12.5, textAlign: "center" }}>Scanned {stats.scanned} · Allowed {stats.allowed} · Denied {stats.denied}</div>
        <button onClick={() => setSheet("scan")} className="w-full flex items-center justify-center gap-2.5 rounded-xl" style={{ background: C.gold, color: C.ink, fontWeight: 700, fontSize: 16.5, padding: "16px 0", border: "none", cursor: "pointer" }}><ScanLine size={20} /> SCAN BADGE</button>
        <button onClick={() => setSheet("manual")} className="w-full flex items-center justify-center gap-2 rounded-xl" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, color: C.parchment, fontWeight: 700, fontSize: 13.5, padding: "10px 0", cursor: "pointer" }}><UserPlus size={14} /> Manual add (badge unavailable)</button>

        {sheet === "scan" && <ScanSheet title="Scan badge" onClose={() => setSheet(null)} onResolve={resolveScan} requireReasonAlways={false} useCamera={true} />}
        {sheet === "manual" && <ScanSheet title="Manual add" onClose={() => setSheet(null)} onResolve={resolveManual} requireReasonAlways={true} useCamera={false} />}
      </div>
    </div>
  );
}
