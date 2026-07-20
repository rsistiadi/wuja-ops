import React from "react";
import { ClipboardList, Bus, ScanLine, Contact, BarChart3, Settings2, Store } from "lucide-react";
import { C } from "../../lib/tokens";

const ALL_TABS = [
  { key: "desk", label: "Desk", icon: ClipboardList },
  { key: "bus", label: "Bus", icon: Bus },
  { key: "scan", label: "Event", icon: ScanLine },
  { key: "verify", label: "Verify", icon: Contact },
  { key: "merch", label: "Merch", icon: Store },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "admin", label: "Admin", icon: Settings2 },
];

export default function BottomTabBar({ mode, setMode, visibleTabs }) {
  const tabs = ALL_TABS.filter((t) => visibleTabs.includes(t.key));
  if (tabs.length <= 1) return null; // no point showing a nav bar with one destination
  return (
    <div className="flex items-stretch" style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 20,
      borderTop: `1px solid ${C.inkLine}`, background: C.ink,
    }}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = mode === t.key;
        return (
          <button key={t.key} onClick={() => setMode(t.key)} className="flex-1 flex flex-col items-center justify-center gap-1"
            style={{ padding: "9px 0 11px", background: "none", border: "none", cursor: "pointer" }}>
            <Icon size={19} color={active ? C.gold : C.ink40} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: active ? C.gold : C.ink40 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
