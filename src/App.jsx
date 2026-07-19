import React, { useState, useEffect } from "react";
import { useAuth } from "./lib/useAuth";
import { C } from "./lib/tokens";
import { ROLE_META } from "./lib/roleMeta";
import LoginFlow from "./components/LoginFlow";
import DeskApp from "./components/desk/DeskApp";
import BusOpsMode from "./components/bus/BusOpsMode";
import EventScanMode from "./components/scan/EventScanMode";
import VerifyMode from "./components/verify/VerifyMode";
import ReportsScreen from "./components/reports/ReportsScreen";
import AdminMode from "./components/admin/AdminMode";
import BottomTabBar from "./components/shared/BottomTabBar";
import OwnBadgePrompt from "./components/OwnBadgePrompt";

export default function App() {
  const auth = useAuth();
  const [mode, setMode] = useState("desk");

  const role = auth.crew?.approved_role;
  const visibleTabs = role ? ROLE_META[role]?.tabs || [] : [];

  useEffect(() => {
    if (role && !visibleTabs.includes(mode)) setMode(visibleTabs[0] || "desk");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (auth.loading) {
    return <div style={{ minHeight: "100vh", background: "#0A0F1A", display: "flex", alignItems: "center", justifyContent: "center", color: C.ink60, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: C.ink }}>
      {auth.session && auth.crew ? (
        <>
          <div className="flex items-center justify-between px-5 py-2 flex-shrink-0" style={{ background: C.inkSoft, borderBottom: `1px solid ${C.inkLine}` }}>
            <span style={{ color: C.ink40, fontSize: 12.5 }}>
              <span style={{ color: C.parchment, fontWeight: 700 }}>{auth.crew.full_name}</span> · <span style={{ color: C.gold, fontWeight: 700 }}>{ROLE_META[auth.crew.approved_role]?.label || auth.crew.approved_role}</span>
            </span>
            <button onClick={auth.signOut} style={{ color: C.alert, fontSize: 12.5, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Log out</button>
          </div>

          <OwnBadgePrompt registrationId={auth.crew.registration_id} />

          <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingBottom: visibleTabs.length > 1 ? "calc(60px + env(safe-area-inset-bottom))" : 0 }}>
            {mode === "desk" && <DeskApp allowSkipPhoto={true} />}
            {mode === "bus" && <BusOpsMode />}
            {mode === "scan" && <EventScanMode />}
            {mode === "verify" && <VerifyMode canEdit={auth.crew.approved_role === "admin" || auth.crew.approved_role === "superadmin"} />}
            {mode === "reports" && <ReportsScreen />}
            {mode === "admin" && <AdminMode callCrewAdmin={auth.callCrewAdmin} isSuperAdmin={auth.crew.approved_role === "superadmin"} />}
          </div>

          <BottomTabBar mode={mode} setMode={setMode} visibleTabs={visibleTabs} />
        </>
      ) : (
        <LoginFlow auth={auth} />
      )}
    </div>
  );
}
