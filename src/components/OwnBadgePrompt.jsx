import React, { useState, useEffect } from "react";
import { ScanLine, Check, AlertTriangle, X } from "lucide-react";
import { C } from "../lib/tokens";
import { supabase } from "../lib/supabaseClient";
import { extractBadgeNumber } from "../lib/qrScan";
import QrScannerView from "./shared/QrScannerView";

// Shown to a logged-in crew member whose own linked badge hasn't been
// confirmed received yet — lets them scan their own physical badge
// (once handed to them) to self-confirm, using the same scanner every
// other part of the app already uses. Renders nothing once confirmed,
// or if this account has no linked badge at all (pre-unified-system
// accounts).
export default function OwnBadgePrompt({ registrationId, onConfirmed }) {
  const [reg, setReg] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // { ok, message } | null
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!registrationId) return;
    supabase.from("registrations").select("id, full_name, badge_number, badge_status").eq("id", registrationId).maybeSingle()
      .then(({ data }) => setReg(data));
  }, [registrationId]);

  const onQrResult = async (decodedText) => {
    setScanning(false);
    const scannedNumber = extractBadgeNumber(decodedText);
    if (!reg.badge_number || scannedNumber !== reg.badge_number) {
      setResult({ ok: false, message: "That badge doesn't match your own record — make sure you're scanning your own badge." });
      return;
    }
    const { error } = await supabase.from("registrations").update({ badge_status: "received" }).eq("id", registrationId);
    if (error) { setResult({ ok: false, message: error.message }); return; }
    setResult({ ok: true, message: "Badge confirmed — you're all set." });
    setReg((r) => ({ ...r, badge_status: "received" }));
    onConfirmed?.();
  };

  if (!registrationId || !reg || reg.badge_status === "received" || dismissed) return null;

  return (
    <>
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: `${C.gold}14`, borderBottom: `1px solid ${C.gold}44` }}>
        <ScanLine size={18} color={C.gold} style={{ flexShrink: 0 }} />
        <div className="flex-1">
          <div style={{ color: C.gold, fontSize: 13.5, fontWeight: 700 }}>Received your badge?</div>
          <div style={{ color: C.ink60, fontSize: 12.5 }}>Scan it to confirm — takes a second.</div>
        </div>
        <button onClick={() => setScanning(true)} style={{ background: C.gold, color: C.ink, fontWeight: 700, fontSize: 12.5, padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer" }}>Scan</button>
        <button onClick={() => setDismissed(true)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={16} color={C.ink40} /></button>
      </div>

      {scanning && <QrScannerView title="Scan your badge" onResult={onQrResult} onCancel={() => setScanning(false)} />}

      {result && (
        <div className="flex items-center" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(10,15,26,0.82)", justifyContent: "center", alignItems: "center" }}>
          <div className="rounded-2xl p-5 mx-6" style={{ background: C.ink, border: `1px solid ${result.ok ? C.ok : C.alert}` }}>
            <div className="flex items-center gap-2 mb-2">
              {result.ok ? <Check size={18} color={C.ok} /> : <AlertTriangle size={18} color={C.alert} />}
              <span style={{ color: result.ok ? C.ok : C.alert, fontSize: 14.5, fontWeight: 700 }}>{result.ok ? "Confirmed" : "Not matched"}</span>
            </div>
            <div style={{ color: C.ink60, fontSize: 13.5 }}>{result.message}</div>
            <button onClick={() => setResult(null)} className="w-full mt-4 rounded-lg" style={{ background: C.gold, color: C.ink, fontWeight: 700, fontSize: 13.5, padding: "10px 0", border: "none", cursor: "pointer" }}>OK</button>
          </div>
        </div>
      )}
    </>
  );
}
