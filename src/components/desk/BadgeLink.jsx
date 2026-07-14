import React, { useState } from "react";
import { ScanLine, Check, ArrowRight } from "lucide-react";
import { C, CATEGORY_META } from "../../lib/tokens";
import { TopBar, PrimaryButton, PersonTag, StepDots } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";

export default function BadgeLink({ reg, onBack, onNext }) {
  const [badge, setBadge] = useState("");
  const [scanned, setScanned] = useState(false);
  const [contactShareable, setContactShareable] = useState(!!reg.contact_shareable);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const meta = CATEGORY_META[reg.category];

  // Placeholder for real QR hardware/camera scanning — wires up the same
  // way as photo capture (getUserMedia + a barcode-detection library like
  // the browser's native BarcodeDetector API where available). Manual
  // entry below is the reliable fallback either way.
  const simulateScan = () => { setBadge(`B-${reg.id.slice(-4)}`); setScanned(true); };

  const submit = async () => {
    if (!badge.trim()) return;
    setSaving(true); setError("");
    const { error } = await supabase
      .from("registrations")
      .update({ badge_number: badge.trim(), badge_status: "received", contact_shareable: contactShareable })
      .eq("id", reg.id);
    setSaving(false);
    if (error) { setError(error.code === "23505" ? "That badge number is already assigned to someone else." : error.message); return; }
    onNext(badge.trim());
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Link Badge" subtitle={reg.full_name} onBack={onBack} accent={meta.color} />
      <StepDots step={0} total={3} />
      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5" style={{ background: C.inkSoft }}>
        <div className="rounded-2xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <PersonTag reg={reg} />
          <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18, fontWeight: 600, marginTop: 8 }}>{reg.full_name}</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink40, fontSize: 11, marginTop: 2 }}>{reg.reg_code}</div>
        </div>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Scan the pre-printed badge QR</div>
          <button onClick={simulateScan} className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl"
            style={{ background: C.ink, border: `1.5px dashed ${scanned ? C.ok : C.gold}`, padding: "30px 16px", cursor: "pointer" }}>
            <ScanLine size={34} color={scanned ? C.ok : C.gold} />
            <div style={{ color: scanned ? C.ok : C.parchment, fontSize: 13, fontWeight: 600 }}>{scanned ? "Badge scanned" : "Tap to scan badge QR"}</div>
          </button>
        </div>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Or enter badge number manually</div>
          <input value={badge} onChange={(e) => { setBadge(e.target.value); setScanned(false); }} placeholder="e.g. B-0423"
            style={{ fontFamily: "JetBrains Mono, monospace", width: "100%", background: C.ink, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 14, padding: "12px 14px", outline: "none" }} />
        </div>

        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: `${C.ok}14`, border: `1px solid ${C.ok}44` }}>
          <Check size={15} color={C.ok} /><span style={{ color: C.ok, fontSize: 12, fontWeight: 600 }}>Goodie bag is pre-packed with this badge — no separate scan needed.</span>
        </div>

        <div className="rounded-xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <div className="flex items-center justify-between">
            <div className="pr-3">
              <div style={{ color: C.parchment, fontSize: 13, fontWeight: 600 }}>Share contact on public badge profile?</div>
              <div style={{ color: C.ink60, fontSize: 11, marginTop: 2 }}>Only controls whether phone/email are visible when someone scans their badge.</div>
            </div>
            <input type="checkbox" checked={contactShareable} onChange={(e) => setContactShareable(e.target.checked)} style={{ width: 20, height: 20 }} />
          </div>
        </div>

        {error && <div style={{ color: C.alert, fontSize: 12.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={ArrowRight} disabled={!badge.trim() || saving} onClick={submit}>{saving ? "Saving…" : "Continue to photo"}</PrimaryButton>
      </div>
    </div>
  );
}
