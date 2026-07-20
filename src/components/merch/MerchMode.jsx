import React, { useState, useEffect } from "react";
import { Store, Clock, Package, AlertCircle, BarChart3 } from "lucide-react";
import { C } from "../../lib/tokens";
import { TopBar } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import SellScreen from "./SellScreen";
import SessionScreen from "./SessionScreen";
import AdminItems from "./AdminItems";
import VoidsScreen from "./VoidsScreen";
import MerchReports from "./MerchReports";

export default function MerchMode({ crew, isAdmin }) {
  const merchAccess = !!crew.merch_access;
  const availableTabs = [
    ...(merchAccess ? [{ k: "sell", l: "Sell", i: Store }] : []),
    ...(merchAccess || isAdmin ? [{ k: "session", l: "Session", i: Clock }] : []),
    ...(isAdmin ? [{ k: "items", l: "Items", i: Package }] : []),
    ...(merchAccess || isAdmin ? [{ k: "voids", l: "Voids", i: AlertCircle }] : []),
    ...(isAdmin ? [{ k: "reports", l: "Reports", i: BarChart3 }] : []),
  ];

  const [tab, setTab] = useState(availableTabs[0]?.k || "session");
  const [session, setSession] = useState(undefined); // undefined = loading, null = none open
  const [pendingVoidCount, setPendingVoidCount] = useState(0);

  const refetchSession = () => {
    supabase.from("merch_sessions").select("*").is("closed_at", null).maybeSingle()
      .then(({ data }) => setSession(data || null));
  };
  useEffect(() => { refetchSession(); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const refresh = () => supabase.from("merch_voids").select("id", { count: "exact", head: true }).eq("status", "pending").then(({ count }) => setPendingVoidCount(count || 0));
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const cols = availableTabs.length;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Merch" subtitle={session ? "Session open" : "No session open"} accent={C.gold} />
      <div className="px-5 pb-3 grid gap-1.5" style={{ background: C.ink, gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {availableTabs.map((t) => { const Icon = t.i; const active = tab === t.k; return (
          <button key={t.k} onClick={() => setTab(t.k)} className="relative flex flex-col items-center justify-center gap-1 rounded-lg"
            style={{ padding: "8px 0", fontSize: 11, fontWeight: 700, background: active ? C.gold : C.inkSoft, color: active ? C.ink : C.ink60, border: `1px solid ${active ? C.gold : C.inkLine}`, cursor: "pointer" }}>
            <Icon size={14} />{t.l}
            {t.k === "voids" && pendingVoidCount > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: C.alert, color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "JetBrains Mono, monospace" }}>{pendingVoidCount}</span>}
          </button>
        ); })}
      </div>
      {tab === "sell" && <SellScreen crew={crew} session={session} />}
      {tab === "session" && <SessionScreen crew={crew} isAdmin={isAdmin} session={session} onSessionChange={refetchSession} />}
      {tab === "items" && <AdminItems />}
      {tab === "voids" && <VoidsScreen crew={crew} isAdmin={isAdmin} merchAccess={merchAccess} />}
      {tab === "reports" && <MerchReports />}
    </div>
  );
}
