import React, { useState } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { C, CATEGORY_META } from "../../lib/tokens";
import { TopBar, PrimaryButton, PersonTag } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";

export default function RegisterOnlyConfirm({ reg, onBack, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const meta = CATEGORY_META[reg.category];

  const submit = async () => {
    setSaving(true); setError("");
    const { error } = await supabase.from("registrations").update({ registered: true }).eq("id", reg.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onDone();
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Register Only" subtitle={reg.full_name} onBack={onBack} accent={meta.color} />
      <div className="flex-1 px-5 py-6 flex flex-col gap-5" style={{ background: C.inkSoft }}>
        <div className="rounded-2xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <PersonTag reg={reg} />
          <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 20, fontWeight: 600, marginTop: 8 }}>{reg.full_name}</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink40, fontSize: 12.5, marginTop: 2 }}>{reg.reg_code}</div>
        </div>
        <div className="rounded-xl px-4 py-3.5 flex items-start gap-2.5" style={{ background: `${C.gold}14`, border: `1px solid ${C.gold}44` }}>
          <AlertTriangle size={16} color={C.gold} style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ color: C.gold, fontSize: 13.5 }}>Badge and goodie bag are at the Main Venue — pick up there. Photo can be taken now so only the badge is left to collect.</span>
        </div>
        {error && <div style={{ color: C.alert, fontSize: 13.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={ArrowRight} disabled={saving} onClick={submit}>{saving ? "Saving…" : "Continue to photo"}</PrimaryButton>
      </div>
    </div>
  );
}
