import React, { useState, useEffect } from "react";
import { useAuth } from "./lib/useAuth";
import { supabase } from "./lib/supabaseClient";
import { C } from "./lib/tokens";
import { ROLE_META } from "./lib/roleMeta";
import LoginFlow from "./components/LoginFlow";
import DeskApp from "./components/desk/DeskApp";
import BusOpsMode from "./components/bus/BusOpsMode";
import EventScanMode from "./components/scan/EventScanMode";
import VerifyMode from "./components/verify/VerifyMode";
import ReportsScreen from "./components/reports/ReportsScreen";
import AdminMode from "./components/admin/AdminMode";
import MerchMode from "./components/merch/MerchMode";
import BottomTabBar from "./components/shared/BottomTabBar";
import OwnBadgePrompt from "./components/OwnBadgePrompt";
import RetakePhotoPrompt from "./components/RetakePhotoPrompt";

export default function App() {
  const auth = useAuth();
  const [mode, setMode] = useState("desk");
  // Was previously hardcoded to `true` here regardless of what Admin
  // Settings actually had stored — meaning the toggle never did
  // anything, for any role, not just Superadmin. Now genuinely read
  // from app_settings once a session exists.
  const [allowSkipPhoto, setAllowSkipPhoto] = useState(true);

  useEffect(() => {
    if (!auth.session) return;
    supabase.from("app_settings").select("value").eq("key", "allow_skip_photo").single()
      .then(({ data }) => { if (data) setAllowSkipPhoto(data.value === true || data.value === "true"); });
  }, [auth.session]);

  const role = auth.crew?.approved_role;
  const isAdmin = role === "admin" || role === "superadmin";
  // Merch access is a standalone permission, independent of role tier —
  // any Crew/Admin/Superadmin can be individually designated an
  // operator. Admin/Superadmin can always see the tab regardless (to
  // manage the catalog and approve voids), even without merch_access
  // themselves.
  const canSeeMerch = !!auth.crew?.merch_access || isAdmin;
  const visibleTabs = [...(role ? ROLE_META[role]?.tabs || [] : []), ...(canSeeMerch ? ["merch"] : [])];

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
          <RetakePhotoPrompt registrationId={auth.crew.registration_id} />

          <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingBottom: visibleTabs.length > 1 ? "calc(60px + env(safe-area-inset-bottom))" : 0 }}>
            {mode === "desk" && <DeskApp allowSkipPhoto={allowSkipPhoto} />}
            {mode === "bus" && <BusOpsMode />}
            {mode === "scan" && <EventScanMode />}
            {mode === "verify" && <VerifyMode canEdit={isAdmin} />}
            {mode === "merch" && <MerchMode crew={auth.crew} isAdmin={isAdmin} />}
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
