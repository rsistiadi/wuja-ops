import React, { useState } from "react";
import { X, Search, ShieldAlert, ScanLine } from "lucide-react";
import { C } from "../../lib/tokens";
import { PersonTag } from "./UI";
import { supabase } from "../../lib/supabaseClient";
import { extractBadgeNumber } from "../../lib/qrScan";
import { lookupByBadgeNumber } from "../../lib/badgeLookup";
import { getBadgePhotoUrl } from "../../lib/photoStorage";
import { personSearchOr } from "../../lib/personSearch";
import QrScannerView from "./QrScannerView";

// onPreview(person) -> { allowed, color, headline, detail } — pure,
// synchronous, no side effects. Only used on the no-badge path, so
// crew see the person's photo and real allow/deny status *before*
// anything is logged — a wrong search match can be caught and backed
// out of before it's ever recorded.
// onResolve(person, reason|null) -> Promise<{ color, headline, detail }>
// — does the actual logging. Called with reason=null immediately for
// a denial (blocking someone needs no explanation), or with a typed
// reason once confirmed for an allowed-but-no-badge case.
// useCamera=true opens a real QR scanner first (used for "Scan badge")
// and resolves the instant a badge is found — a physical badge scan
// is already strong identity proof, so no separate preview step.
// useCamera=false goes straight to search (used for "Find Person",
// where there's deliberately no badge to scan).
export default function ScanSheet({ title, onClose, onPreview, onResolve, useCamera }) {
  const [step, setStep] = useState(useCamera ? "scanning" : "search"); // scanning | search | preview | result
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [person, setPerson] = useState(null);
  const [preview, setPreview] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [reason, setReason] = useState("");
  const [resultView, setResultView] = useState(null);
  const [saving, setSaving] = useState(false);

  const runSearch = async (q) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); setSearchError(""); return; }
    const { data, error } = await supabase.from("registrations")
      .select("id, full_name, category, medical_note, phone, email, badge_number, photo_status, photo_url")
      .or(personSearchOr(q)).limit(20);
    if (error) { setSearchError(error.message); return; }
    setSearchError("");
    setResults(data || []);
  };

  const reset = () => { setStep(useCamera ? "scanning" : "search"); setQuery(""); setResults([]); setPerson(null); setPreview(null); setPhotoUrl(null); setReason(""); setResultView(null); };

  const selectPerson = async (p) => {
    setPerson(p);
    if (useCamera) {
      // Badge scan already proves identity — resolve straight away, no preview needed.
      const res = await onResolve(p, null);
      setResultView(res); setStep("result");
      return;
    }
    setPreview(onPreview(p));
    setPhotoUrl(p.photo_status === "captured" && p.photo_url ? await getBadgePhotoUrl(p.photo_url) : null);
    setStep("preview");
  };

  const confirmDeny = async () => {
    setSaving(true);
    const res = await onResolve(person, null);
    setSaving(false);
    setResultView(res); setStep("result");
  };

  const confirmReason = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    const res = await onResolve(person, reason.trim());
    setSaving(false);
    setResultView(res); setStep("result");
  };

  const onQrDetected = async (decodedText) => {
    const badgeNumber = extractBadgeNumber(decodedText);
    try {
      const found = await lookupByBadgeNumber(badgeNumber);
      if (!found) {
        setResultView({ color: C.alert, headline: "Badge not recognized", detail: `No registration matches badge "${badgeNumber}". Do not admit — verify identity manually or contact registration.` });
        setStep("result");
        return;
      }
      await selectPerson(found);
    } catch (e) {
      setResultView({ color: C.alert, headline: "Lookup failed", detail: e.message });
      setStep("result");
    }
  };

  if (step === "scanning") {
    return <QrScannerView title={title} onResult={onQrDetected} onCancel={() => setStep("search")} />;
  }

  return (
    <div className="flex items-end" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(10,15,26,0.82)" }}>
      <div className="w-full rounded-t-2xl p-5" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, maxHeight: "88%", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ color: C.parchment, fontSize: 15.5, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={C.ink40} /></button>
        </div>

        {step === "search" && (
          <>
            {useCamera && (
              <button onClick={() => setStep("scanning")} className="flex items-center justify-center gap-1.5 mb-3 rounded-lg" style={{ color: C.gold, fontSize: 13.5, fontWeight: 700, padding: "9px 0", border: `1px dashed ${C.gold}66`, background: "none", cursor: "pointer" }}>
                <ScanLine size={13} /> Try scanning again
              </button>
            )}
            <div className="flex items-center gap-2 rounded-xl px-3 mb-3" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
              <Search size={14} color={C.ink40} />
              <input autoFocus value={query} onChange={(e) => runSearch(e.target.value)} placeholder="Search name, phone, email, or badge no…"
                className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 14.5, padding: "9px 4px", border: "none" }} />
            </div>
            {searchError && <div style={{ color: C.alert, fontSize: 12.5, marginBottom: 8 }}>{searchError}</div>}
            <div className="overflow-y-auto flex flex-col gap-1.5">
              {results.map((p) => (
                <button key={p.id} onClick={() => selectPerson(p)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: C.inkSoft, border: "none", cursor: "pointer" }}>
                  <div className="text-left">
                    <div style={{ color: C.parchment, fontSize: 13.5 }}>{p.full_name}</div>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink40, fontSize: 11, marginTop: 2 }}>{p.badge_number || "no badge"} · {p.phone || "—"}</div>
                  </div>
                  <PersonTag reg={p} />
                </button>
              ))}
            </div>
          </>
        )}

        {step === "preview" && preview && (
          <div className="flex flex-col gap-3 overflow-y-auto">
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ width: 88, height: 88, background: C.inkSoft, border: `2px solid ${preview.color}` }}>
                {photoUrl ? <img src={photoUrl} alt={person.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ShieldAlert size={30} color={C.ink40} />}
              </div>
              <div style={{ color: C.parchment, fontSize: 16, fontWeight: 700, textAlign: "center" }}>{person.full_name}</div>
              <PersonTag reg={person} />
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: `${preview.color}1f`, border: `1px solid ${preview.color}` }}>
              <div style={{ color: preview.color, fontSize: 14.5, fontWeight: 700 }}>{preview.headline}</div>
              <div style={{ color: C.ink60, fontSize: 13, marginTop: 4 }}>{preview.detail}</div>
            </div>

            {!preview.allowed ? (
              <button onClick={confirmDeny} disabled={saving} className="rounded-lg" style={{ background: C.alert, color: "#fff", fontSize: 14.5, fontWeight: 700, padding: "11px 0", border: "none", cursor: "pointer" }}>
                {saving ? "Logging…" : "Confirm Deny"}
              </button>
            ) : (
              <>
                <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason no badge was scanned (required)"
                  className="w-full rounded-lg outline-none" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 13.5, padding: "9px 11px" }} />
                <button onClick={confirmReason} disabled={!reason.trim() || saving} className="rounded-lg"
                  style={{ background: reason.trim() ? C.gold : C.inkLine, color: C.ink, fontSize: 14.5, fontWeight: 700, padding: "10px 0", opacity: reason.trim() ? 1 : 0.6, border: "none", cursor: reason.trim() ? "pointer" : "default" }}>
                  {saving ? "Confirming…" : "Confirm & Admit"}
                </button>
              </>
            )}
            <button onClick={() => setStep("search")} className="rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.ink60, fontSize: 13, fontWeight: 600, padding: "8px 0", cursor: "pointer" }}>
              ← Not this person, search again
            </button>
          </div>
        )}

        {step === "result" && resultView && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl px-4 py-3" style={{ background: `${resultView.color}1f`, border: `1px solid ${resultView.color}` }}>
              <div style={{ color: resultView.color, fontSize: 15.5, fontWeight: 700 }}>{resultView.headline}</div>
              <div style={{ color: C.ink60, fontSize: 13.5, marginTop: 4 }}>{resultView.detail}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 rounded-lg" style={{ background: C.gold, color: C.ink, fontSize: 14.5, fontWeight: 700, padding: "10px 0", border: "none", cursor: "pointer" }}>Scan next</button>
              <button onClick={onClose} className="flex-1 rounded-lg" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.ink60, fontSize: 14.5, fontWeight: 600, padding: "10px 0", cursor: "pointer" }}>Exit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
