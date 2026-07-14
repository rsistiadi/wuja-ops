import React from "react";
import { Check, AlertTriangle, Users } from "lucide-react";
import { C, CATEGORY_META } from "../../lib/tokens";
import { PrimaryButton, PersonTag, PersonAvatar } from "../shared/UI";

export function Complete({ reg, badge, photoStatus, photoUrl, onNextGuest }) {
  const meta = CATEGORY_META[reg.category];
  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 pt-8 pb-5 flex flex-col items-center" style={{ background: C.ink }}>
        <div className="flex items-center justify-center rounded-full mb-3" style={{ width: 56, height: 56, background: `${C.ok}22`, border: `1.5px solid ${C.ok}` }}><Check size={26} color={C.ok} /></div>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 19, fontWeight: 600 }}>Checked in</div>
        <div style={{ color: C.ink60, fontSize: 12.5, marginTop: 4 }}>Badge is now active for entry, buses, and sessions.</div>
      </div>
      <div className="flex-1 px-5 py-6" style={{ background: C.inkSoft }}>
        <div className="rounded-2xl p-5" style={{ background: C.parchment }}>
          <div className="flex items-start justify-between">
            <div>
              <PersonTag reg={reg} />
              <div style={{ fontFamily: "Fraunces, serif", color: C.ink, fontSize: 19, fontWeight: 700, marginTop: 8 }}>{reg.full_name}</div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", color: `${C.ink}99`, fontSize: 11, marginTop: 2 }}>{reg.reg_code}</div>
            </div>
            <PersonAvatar reg={{ ...reg, photo_status: photoStatus }} photoUrl={photoUrl} size={52} />
          </div>
          <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: `1px dashed ${C.inkLine}66` }}>
            <div>
              <div style={{ color: `${C.ink}88`, fontSize: 10.5, fontWeight: 600 }}>BADGE NO.</div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink, fontSize: 14, fontWeight: 600 }}>{badge}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full" style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 9px", background: `${C.ok}1f`, color: C.ok }}><Check size={11} /> Goodie bag included</span>
            {photoStatus === "captured" ? (
              <span className="inline-flex items-center gap-1 rounded-full" style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 9px", background: `${C.ok}1f`, color: C.ok }}><Check size={11} /> Photo on file</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full" style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 9px", background: `${C.gold}1f`, color: C.gold }}><AlertTriangle size={11} /> Photo skipped — add later</span>
            )}
          </div>
        </div>
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}><PrimaryButton icon={Users} onClick={onNextGuest}>Next guest</PrimaryButton></div>
    </div>
  );
}

export function RegisterOnlyDone({ onNextGuest }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5" style={{ background: C.inkSoft }}>
      <div className="flex items-center justify-center rounded-full mb-4" style={{ width: 64, height: 64, background: `${C.gold}22`, border: `1.5px solid ${C.gold}` }}><Check size={28} color={C.gold} /></div>
      <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 19, fontWeight: 600 }}>Registered</div>
      <div style={{ color: C.ink60, fontSize: 13, maxWidth: 260, textAlign: "center", marginTop: 8 }}>Badge pending pickup at the Main Venue registration desk.</div>
      <div className="w-full mt-8"><PrimaryButton icon={Users} onClick={onNextGuest}>Next guest</PrimaryButton></div>
    </div>
  );
}
