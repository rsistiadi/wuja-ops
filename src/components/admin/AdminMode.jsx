import React, { useState, useEffect } from "react";
import { ListChecks, Bus, Users, Settings2 } from "lucide-react";
import { C } from "../../lib/tokens";
import { TopBar } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import AdminCheckpoints from "./AdminCheckpoints";
import AdminBuses from "./AdminBuses";
import AdminCrew from "./AdminCrew";
import AdminSettings from "./AdminSettings";

export default function AdminMode({ callCrewAdmin, isSuperAdmin }) {
  const [tab, setTab] = useState("checkpoints");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const refresh = () => supabase.from("crew").select("id", { count: "exact", head: true }).eq("status", "pending").then(({ count }) => setPendingCount(count || 0));
    refresh();
    const interval = setInterval(refresh, 15000); // light polling so the badge stays roughly current
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { k: "checkpoints", l: "Access", i: ListChecks },
    { k: "buses", l: "Buses", i: Bus },
    { k: "crew", l: "Crew", i: Users, badge: pendingCount },
    { k: "settings", l: "Settings", i: Settings2 },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Admin" subtitle="Checkpoints · Buses · Crew · Settings" accent={C.gold} />
      <div className="px-5 pb-3 grid grid-cols-4 gap-1.5" style={{ background: C.ink }}>
        {tabs.map((t) => { const Icon = t.i; const active = tab === t.k; return (
          <button key={t.k} onClick={() => setTab(t.k)} className="relative flex flex-col items-center justify-center gap-1 rounded-lg"
            style={{ padding: "8px 0", fontSize: 11, fontWeight: 700, background: active ? C.gold : C.inkSoft, color: active ? C.ink : C.ink60, border: `1px solid ${active ? C.gold : C.inkLine}`, cursor: "pointer" }}>
            <Icon size={14} />{t.l}
            {!!t.badge && <span style={{ position: "absolute", top: -5, right: -5, background: C.alert, color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "JetBrains Mono, monospace" }}>{t.badge}</span>}
          </button>
        ); })}
      </div>
      {tab === "checkpoints" && <AdminCheckpoints />}
      {tab === "buses" && <AdminBuses />}
      {tab === "crew" && <AdminCrew callCrewAdmin={callCrewAdmin} isSuperAdmin={isSuperAdmin} />}
      {tab === "settings" && <AdminSettings isSuperAdmin={isSuperAdmin} />}
    </div>
  );
}
