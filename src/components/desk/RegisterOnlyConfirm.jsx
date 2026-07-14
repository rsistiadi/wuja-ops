import React, { useState } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { C, CATEGORY_META } from "../../lib/tokens";
import { TopBar, PrimaryButton, PersonTag } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";

export default function RegisterOnlyConfirm({ reg, onBack, onDone }) {
  const [contactShareable, setContactShareable] = useState(!!reg.contact_shareable);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const meta = CATEGORY_META[reg.category];

  const submit = async () => {
    setSaving(true); setError("");
    const { error } = await supabase.from("registrations").update({ registered: true, contact_shareable: contactShareable }).eq("id", reg.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onDone(contactShareable);
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Register Only" subtitle={reg.full_name} onBack={onBack} accent={meta.color} />
      <div className="flex-1 px-5 py-6 flex flex-col gap-5" style={{ background: C.inkSoft }}>
        <div className="rounded-2xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <PersonTag reg={reg} />
          <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18, fontWeight: 600, marginTop: 8 }}>{reg.full_name}</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink40, fontSize: 11, marginTop: 2 }}>{reg.reg_code}</div>
        </div>
        <div className="rounded-xl px-4 py-3.5 flex items-start gap-2.5" style={{ background: `${C.gold}14`, border: `1px solid ${C.gold}44` }}>
          <AlertTriangle size={16} color={C.gold} style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ color: C.gold, fontSize: 12.5 }}>Badge and goodie bag are at the Main Venue — pick up there. Photo can be taken now so only the badge is left to collect.</span>
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
        <PrimaryButton icon={ArrowRight} disabled={saving} onClick={submit}>{saving ? "Saving…" : "Continue to photo"}</PrimaryButton>
      </div>
    </div>
  );
}
