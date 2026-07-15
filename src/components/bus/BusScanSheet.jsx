import React, { useState } from "react";
import { X, Search, AlertTriangle, ScanLine } from "lucide-react";
import { C } from "../../lib/tokens";
import { PersonTag } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { extractBadgeNumber } from "../../lib/qrScan";
import { lookupByBadgeNumber } from "../../lib/badgeLookup";
import QrScannerView from "../shared/QrScannerView";

export default function BusScanSheet({ bus, buses, roster, legId, onClose, onChanged }) {
  const [stage, setStage] = useState("scanning"); // scanning | pick | searchAll | action | result
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [person, setPerson] = useState(null);
  const [reason, setReason] = useState("");
  const [resultView, setResultView] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setStage("scanning"); setQuery(""); setSearchResults([]); setPerson(null); setReason(""); setResultView(null); };

  const runSearch = async (q) => {
    setQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from("registrations").select("id, full_name, category, person_role, assigned_bus_id").ilike("full_name", `%${q.trim()}%`).limit(20);
    setSearchResults(data || []);
  };

  const writeStatus = async (registrationId, status, atBusId, method, reasonText = "") => {
    // recorded_by / recorded_at are force-set server-side by the
    // trg_bus_trip_status_actor trigger regardless of what's sent here.
    const { error } = await supabase.from("bus_trip_status").upsert(
      { registration_id: registrationId, trip_leg_id: legId, bus_id: atBusId, status, method, reason: reasonText },
      { onConflict: "registration_id,trip_leg_id" }
    );
    if (error) throw error;
  };

  const boardPerson = async (p, method) => {
    setBusy(true);
    try {
      await writeStatus(p.id, "boarded", bus.id, method);
      setPerson(p);
      setResultView({ color: C.ok, headline: "Boarded ✓", detail: `${p.full_name} — ${bus.name}` });
      setStage("result");
      onChanged();
    } catch (e) {
      setResultView({ color: C.alert, headline: "Failed to save", detail: e.message });
      setStage("result");
    } finally {
      setBusy(false);
    }
  };

  const routePerson = async (p, method) => {
    const exception = p.assigned_bus_id !== bus.id;
    if (!exception) { await boardPerson(p, method); return; }
    setPerson(p); setReason(""); setStage("action");
  };

  // --- Real QR scan result: look up the decoded badge number against
  // the live database, not a canned "simulate" button anymore. ---
  const onQrDetected = async (decodedText) => {
    const badgeNumber = extractBadgeNumber(decodedText);
    setBusy(true);
    try {
      const found = await lookupByBadgeNumber(badgeNumber);
      if (!found) {
        setResultView({ color: C.alert, headline: "Badge not recognized", detail: `No registration matches badge "${badgeNumber}". Do not admit — verify identity manually or contact registration.` });
        setStage("result");
        return;
      }
      await routePerson(found, "scan");
    } catch (e) {
      setResultView({ color: C.alert, headline: "Lookup failed", detail: e.message });
      setStage("result");
    } finally {
      setBusy(false);
    }
  };

  const pickFromManual = async (p) => { await routePerson(p, "manual"); };

  const confirmExceptionNotRiding = async () => {
    setBusy(true);
    try {
      await writeStatus(person.id, "not_riding", bus.id, "exception", "");
      setResultView({ color: C.ink60, headline: "Not added", detail: `${person.full_name} was not boarded on ${bus.name}.` });
      setStage("result");
      onChanged();
    } finally { setBusy(false); }
  };

  const confirmExceptionRide = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await writeStatus(person.id, "boarded", bus.id, "exception", reason.trim());
      const homeBus = buses.find((b) => b.id === person.assigned_bus_id);
      setResultView({ color: C.guest, headline: "Added as exception", detail: `${person.full_name} — reason logged, also flagged on ${homeBus?.name || "their home bus"}` });
      setStage("result");
      onChanged();
    } finally { setBusy(false); }
  };

  if (stage === "scanning") {
    return <QrScannerView title={`Scan badge — ${bus.name}`} onResult={onQrDetected} onCancel={() => setStage("pick")} />;
  }

  return (
    <div className="absolute inset-0 flex items-end" style={{ background: "rgba(10,15,26,0.82)" }}>
      <div className="w-full rounded-t-2xl p-5" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, maxHeight: "88%", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ color: C.parchment, fontSize: 14, fontWeight: 700 }}>Badge unavailable — {bus.name}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={C.ink40} /></button>
        </div>

        {(stage === "pick" || stage === "searchAll") && (
          <button onClick={() => setStage("scanning")} className="flex items-center justify-center gap-1.5 mb-3 rounded-lg" style={{ color: C.gold, fontSize: 12, fontWeight: 700, padding: "9px 0", border: `1px dashed ${C.gold}66`, background: "none", cursor: "pointer" }}>
            <ScanLine size={13} /> Try scanning again
          </button>
        )}

        {stage === "pick" && (
          <div className="overflow-y-auto flex flex-col gap-1.5">
            <div style={{ color: C.ink40, fontSize: 10.5, fontWeight: 700, marginBottom: 2 }}>{bus.name.toUpperCase()} ROSTER</div>
            {roster.map((p) => (
              <button key={p.id} onClick={() => pickFromManual(p)} disabled={busy} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: C.inkSoft, border: "none", cursor: "pointer" }}>
                <span style={{ color: C.parchment, fontSize: 12.5 }}>{p.full_name}</span>
                <PersonTag reg={p} />
              </button>
            ))}
            <button onClick={() => setStage("searchAll")} className="flex items-center justify-center gap-1.5 mt-2 rounded-lg" style={{ color: C.gold, fontSize: 12, fontWeight: 700, padding: "9px 0", border: `1px dashed ${C.gold}66`, background: "none", cursor: "pointer" }}>
              <Search size={13} /> Not here — search all registrants
            </button>
          </div>
        )}

        {stage === "searchAll" && (
          <>
            <div className="flex items-center gap-2 rounded-xl px-3 mb-3" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
              <Search size={14} color={C.ink40} />
              <input autoFocus value={query} onChange={(e) => runSearch(e.target.value)} placeholder="Search all registrants…"
                className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 13, padding: "9px 4px", border: "none" }} />
            </div>
            <div className="overflow-y-auto flex flex-col gap-1.5">
              {searchResults.map((p) => (
                <button key={p.id} onClick={() => pickFromManual(p)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: C.inkSoft, border: "none", cursor: "pointer" }}>
                  <span style={{ color: C.parchment, fontSize: 12.5 }}>{p.full_name}</span>
                  <span style={{ color: C.ink40, fontSize: 10.5 }}>{buses.find((b) => b.id === p.assigned_bus_id)?.name || "Unassigned"}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {stage === "action" && person && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: `${C.speaker}18`, border: `1px solid ${C.speaker}55` }}>
              <AlertTriangle size={18} color={C.speaker} style={{ flexShrink: 0 }} />
              <div style={{ color: C.parchment, fontSize: 12.5 }}>{person.full_name} is assigned to {buses.find((b) => b.id === person.assigned_bus_id)?.name || "another bus"}, not {bus.name}.</div>
            </div>
            <button onClick={confirmExceptionNotRiding} disabled={busy} className="rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 13, fontWeight: 600, padding: "11px 0", cursor: "pointer" }}>Not riding this bus</button>
            <div style={{ color: C.ink40, fontSize: 10.5 }}>— or, to ride anyway, give a reason (also flags their home bus):</div>
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required to ride)"
              className="w-full rounded-lg outline-none" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 12.5, padding: "9px 11px" }} />
            <button onClick={confirmExceptionRide} disabled={!reason.trim() || busy} className="rounded-lg"
              style={{ background: reason.trim() ? C.ok : C.inkLine, color: C.ink, fontSize: 13, fontWeight: 700, padding: "11px 0", opacity: reason.trim() ? 1 : 0.6, border: "none", cursor: reason.trim() ? "pointer" : "default" }}>Confirm ride</button>
          </div>
        )}

        {stage === "result" && resultView && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl px-4 py-3" style={{ background: `${resultView.color}1f`, border: `1px solid ${resultView.color}` }}>
              <div style={{ color: resultView.color, fontSize: 14, fontWeight: 700 }}>{resultView.headline}</div>
              <div style={{ color: C.ink60, fontSize: 12, marginTop: 4 }}>{resultView.detail}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 rounded-lg" style={{ background: C.gold, color: C.ink, fontSize: 13, fontWeight: 700, padding: "10px 0", border: "none", cursor: "pointer" }}>Scan next</button>
              <button onClick={onClose} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.ink60, fontSize: 13, fontWeight: 600, padding: "10px 0", cursor: "pointer" }}>Exit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
