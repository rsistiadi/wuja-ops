import React, { useState, useCallback } from "react";
import { getBadgePhotoUrl } from "../../lib/photoStorage";
import SearchScreen from "./SearchScreen";
import WalkInForm from "./WalkInForm";
import BadgeLink from "./BadgeLink";
import PhotoCapture from "./PhotoCapture";
import RegisterOnlyConfirm from "./RegisterOnlyConfirm";
import { Complete, RegisterOnlyDone } from "./CompleteScreens";

export default function DeskApp({ allowSkipPhoto }) {
  const [deskMode, setDeskMode] = useState("full"); // full | register_only
  const [screen, setScreen] = useState("search");
  const [reg, setReg] = useState(null);
  const [badge, setBadge] = useState("");
  const [photoStatus, setPhotoStatus] = useState("none");
  const [photoUrl, setPhotoUrl] = useState(null);

  const resetToSearch = useCallback(() => {
    setScreen("search"); setReg(null); setBadge(""); setPhotoStatus("none"); setPhotoUrl(null);
  }, []);

  const selectReg = (r) => { setReg(r); setScreen(deskMode === "full" ? "badge" : "register_confirm"); };
  const createWalkIn = (newReg) => { setReg(newReg); setScreen(deskMode === "full" ? "badge" : "register_confirm"); };

  const handleBadgeNext = async (b) => {
    setBadge(b);
    // If they already have a photo on file (e.g. completing a deferred
    // badge pickup after an earlier Register Only), skip re-capturing.
    if (reg.photo_status === "captured" || reg.photo_status === "skipped") {
      setPhotoStatus(reg.photo_status);
      if (reg.photo_status === "captured" && reg.photo_url) {
        const url = await getBadgePhotoUrl(reg.photo_url);
        setPhotoUrl(url);
      }
      setScreen("done");
    } else {
      setScreen("photo");
    }
  };

  const finishFullCheckIn = (status, url) => { setPhotoStatus(status); setPhotoUrl(url); setScreen("done"); };
  const finishRegisterOnlyPhoto = () => setScreen("register_done");

  if (screen === "search") return <SearchScreen deskMode={deskMode} setDeskMode={setDeskMode} onSelect={selectReg} onWalkIn={() => setScreen("walkin")} />;
  if (screen === "walkin") return <WalkInForm onCancel={() => setScreen("search")} onCreate={createWalkIn} />;
  if (screen === "badge") return <BadgeLink reg={reg} onBack={() => setScreen("search")} onNext={handleBadgeNext} />;
  if (screen === "photo") return <PhotoCapture reg={reg} allowSkip={allowSkipPhoto} onBack={() => setScreen("badge")} onNext={finishFullCheckIn} />;
  if (screen === "done") return <Complete reg={reg} badge={badge} photoStatus={photoStatus} photoUrl={photoUrl} onNextGuest={resetToSearch} />;
  if (screen === "register_confirm") return <RegisterOnlyConfirm reg={reg} onBack={() => setScreen("search")} onDone={() => setScreen("register_photo")} />;
  if (screen === "register_photo") return <PhotoCapture reg={reg} allowSkip={allowSkipPhoto} onBack={() => setScreen("register_confirm")} onNext={finishRegisterOnlyPhoto} />;
  if (screen === "register_done") return <RegisterOnlyDone onNextGuest={resetToSearch} />;

  return null;
}
