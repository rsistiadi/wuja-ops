import React, { useState } from "react";
import { ChevronLeft, ChevronDown, ShieldCheck, UserCircle2 } from "lucide-react";
import { C, CATEGORY_META, categoryLabel, registrationStatus } from "../../lib/tokens";

export function TopBar({ title, subtitle, onBack, accent }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-6 pb-4" style={{ background: C.ink }}>
      {onBack ? (
        <button onClick={onBack} className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
          <ChevronLeft size={18} color={C.ink60} />
        </button>
      ) : (
        <div style={{ width: 34, height: 34, borderRadius: 999, background: accent || C.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShieldCheck size={17} color={C.ink} />
        </div>
      )}
      <div>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18, fontWeight: 600, lineHeight: 1.1 }}>{title}</div>
        {subtitle && <div style={{ fontFamily: "Inter, sans-serif", color: C.ink60, fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

export function PrimaryButton({ children, onClick, icon: Icon, tone = "gold", disabled, type = "button" }) {
  const bg = tone === "gold" ? C.gold : tone === "ok" ? C.ok : C.alert;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="w-full flex items-center justify-center gap-2 rounded-xl"
      style={{ fontFamily: "Inter, sans-serif", background: disabled ? C.inkLine : bg, color: disabled ? C.ink60 : C.ink, fontWeight: 700, fontSize: 15, padding: "14px 16px", opacity: disabled ? 0.6 : 1, border: "none", cursor: disabled ? "default" : "pointer" }}>
      {Icon && <Icon size={17} />}{children}
    </button>
  );
}

export function GhostButton({ children, onClick, icon: Icon }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-center gap-2 rounded-xl"
      style={{ fontFamily: "Inter, sans-serif", background: "transparent", color: C.parchment, fontWeight: 600, fontSize: 14, padding: "12px 16px", border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>
      {Icon && <Icon size={16} />}{children}
    </button>
  );
}

export function Dropdown({ value, onChange, options, label }) {
  return (
    <div>
      {label && <div style={{ color: C.ink60, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{label}</div>}
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl outline-none"
          style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 13.5, fontWeight: 600, padding: "11px 34px 11px 14px", appearance: "none" }}>
          {options.map((o) => <option key={o.value} value={o.value} style={{ background: C.ink }}>{o.label}</option>)}
        </select>
        <ChevronDown size={16} color={C.gold} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

export function PersonTag({ reg, size = "sm" }) {
  const color = CATEGORY_META[reg.category]?.color || C.ink60;
  const label = categoryLabel(reg);
  return (
    <span className="inline-flex items-center gap-1 rounded-full" style={{ background: `${color}22`, color, border: `1px solid ${color}55`, fontSize: size === "sm" ? 11 : 12, fontWeight: 600, padding: size === "sm" ? "3px 9px" : "4px 11px" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color, display: "inline-block" }} />{label}
    </span>
  );
}

export function StatusPill({ reg }) {
  const s = registrationStatus(reg);
  return <span className="rounded-full" style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 9px", background: `${s.color}22`, color: s.color }}>{s.label}</span>;
}

export function PersonAvatar({ reg, photoUrl, size = 48 }) {
  const color = CATEGORY_META[reg.category]?.color || C.ink60;
  if (reg.photo_status === "captured" && photoUrl) {
    return <img src={photoUrl} alt={reg.full_name} style={{ width: size, height: size, borderRadius: 999, objectFit: "cover", border: `2px solid ${color}`, flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 999, background: `${color}33`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <UserCircle2 size={Math.round(size * 0.58)} color={color} />
    </div>
  );
}

export function StepDots({ step, total }) {
  return <div className="flex items-center gap-1.5 px-5 pb-3" style={{ background: C.ink }}>{Array.from({ length: total }).map((_, i) => <div key={i} style={{ height: 3, borderRadius: 999, flex: 1, background: i <= step ? C.gold : C.inkLine }} />)}</div>;
}

export function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
