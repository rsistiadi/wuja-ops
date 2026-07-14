import React, { useState } from "react";
import { X, Search, ShieldAlert } from "lucide-react";
import { C } from "../../lib/tokens";
import { PersonTag } from "./UI";
import { supabase } from "../../lib/supabaseClient";

// onResolve(person, reason|null) -> { needsReason?: true } | { color, headline, detail }
export default function ScanSheet({ title, onClose, onResolve, requireReasonAlways, simulateLabel }) {
  const [step, setStep] = useState("search"); // search | reason | result
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [person, setPerson] = useState(null);
  const [reason, setReason] = useState("");
  const [resultView, setResultView] = useState(null);

  const runSearch = async (q) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    const { data } = await supabase.from("registrations").select("id, full_name, category, person_role, medical_note").ilike("full_name", `%${q.trim()}%`).limit(20);
    setResults(data || []);
  };

  const reset = () => { setStep("search"); setQuery(""); setResults([]); setPerson(null); setReason(""); setResultView(null); };

  const selectPerson = async (p) => {
    setPerson(p);
    if (requireReasonAlways) { setStep("reason"); return; }
    const res = await onResolve(p, null);
    if (res.needsReason) setStep("reason");
    else { setResultView(res); setStep("result"); }
  };

  const confirmReason = async () => {
    if (!reason.trim()) return;
    const res = await onResolve(person, reason.trim());
    setResultView(res);
    setStep("result");
  };

  const simulateUnrecognized = () => {
    setResultView({ color: C.alert, headline: "Badge not recognized", detail: "No matching record for this QR — do not admit. Verify identity manually or contact registration." });
    setStep("result");
  };

  return (
    <div className="absolute inset-0 flex items-end" style={{ background: "rgba(10,15,26,0.82)" }}>
      <div className="w-full rounded-t-2xl p-5" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, maxHeight: "85%", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ color: C.parchment, fontSize: 14, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={C.ink40} /></button>
        </div>

        {step === "search" && (
          <>
            {simulateLabel && (
              <div className="rounded-lg px-3 py-2 mb-3 flex items-start gap-2" style={{ background: `${C.gold}14`, border: `1px solid ${C.gold}44` }}>
                <ShieldAlert size={13} color={C.gold} style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ color: C.gold, fontSize: 10.5, lineHeight: 1.3 }}>{simulateLabel}</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl px-3 mb-3" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
              <Search size={14} color={C.ink40} />
              <input autoFocus value={query} onChange={(e) => runSearch(e.target.value)} placeholder="Search entire database…"
                className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 13, padding: "9px 4px", border: "none" }} />
            </div>
            <div className="overflow-y-auto flex flex-col gap-1.5">
              {results.map((p) => (
                <button key={p.id} onClick={() => selectPerson(p)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: C.inkSoft, border: "none", cursor: "pointer" }}>
                  <span style={{ color: C.parchment, fontSize: 12.5 }}>{p.full_name}</span>
                  <PersonTag reg={p} />
                </button>
              ))}
            </div>
            <button onClick={simulateUnrecognized} className="flex items-center justify-center gap-1.5 mt-3" style={{ color: C.alert, fontSize: 11.5, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
              <ShieldAlert size={13} /> Simulate an unrecognized / fake badge
            </button>
          </>
        )}

        {step === "reason" && (
          <div className="flex flex-col gap-3">
            <div style={{ color: C.parchment, fontSize: 13, fontWeight: 600 }}>{person.full_name}</div>
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)"
              className="w-full rounded-lg outline-none" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 12.5, padding: "9px 11px" }} />
            <button onClick={confirmReason} disabled={!reason.trim()} className="rounded-lg"
              style={{ background: reason.trim() ? C.gold : C.inkLine, color: C.ink, fontSize: 13, fontWeight: 700, padding: "10px 0", opacity: reason.trim() ? 1 : 0.6, border: "none", cursor: reason.trim() ? "pointer" : "default" }}>Confirm</button>
          </div>
        )}

        {step === "result" && resultView && (
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
