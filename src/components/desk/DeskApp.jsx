import React, { useState, useCallback } from "react";
import { getBadgePhotoUrl } from "../../lib/photoStorage";
import { supabase } from "../../lib/supabaseClient";
import SearchScreen from "./SearchScreen";
import WalkInForm from "./WalkInForm";
import BadgeLink from "./BadgeLink";
import PhotoCapture from "./PhotoCapture";
import MealChoices from "./MealChoices";
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

  // registered:true is the real "fully checked in" signal, so it's
  // written here — at the actual last step of Full Check-in — rather
  // than at the badge scan. Meals is normally that last step;
  // performers skip meals entirely, so photo becomes their last step.
  const completeFullCheckIn = async () => {
    await supabase.from("registrations").update({ registered: true }).eq("id", reg.id);
    setScreen("done");
  };

  const afterPhotoFull = () => {
    if (reg.category === "performer") completeFullCheckIn();
    else setScreen("meals");
  };
  const afterPhotoRegisterOnly = () => setScreen(reg.category === "performer" ? "register_done" : "register_meals");

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
      afterPhotoFull();
    } else {
      setScreen("photo");
    }
  };

  const onPhotoConfirmed = (status, url) => { setPhotoStatus(status); setPhotoUrl(url); afterPhotoFull(); };
  const finishRegisterOnlyPhoto = () => afterPhotoRegisterOnly();

  if (screen === "search") return <SearchScreen deskMode={deskMode} setDeskMode={setDeskMode} onSelect={selectReg} onWalkIn={() => setScreen("walkin")} />;
  if (screen === "walkin") return <WalkInForm onCancel={() => setScreen("search")} onCreate={createWalkIn} />;
  if (screen === "badge") return <BadgeLink reg={reg} onBack={() => setScreen("search")} onNext={handleBadgeNext} />;
  if (screen === "photo") return <PhotoCapture reg={reg} allowSkip={allowSkipPhoto} onBack={() => setScreen("badge")} onNext={onPhotoConfirmed} />;
  if (screen === "meals") return <MealChoices reg={reg} onBack={() => setScreen("badge")} onNext={completeFullCheckIn} />;
  if (screen === "done") return <Complete reg={reg} badge={badge} photoStatus={photoStatus} photoUrl={photoUrl} onNextGuest={resetToSearch} />;
  if (screen === "register_confirm") return <RegisterOnlyConfirm reg={reg} onBack={() => setScreen("search")} onDone={() => setScreen("register_photo")} />;
  if (screen === "register_photo") return <PhotoCapture reg={reg} allowSkip={allowSkipPhoto} onBack={() => setScreen("register_confirm")} onNext={finishRegisterOnlyPhoto} />;
  if (screen === "register_meals") return <MealChoices reg={reg} onBack={() => setScreen("register_confirm")} onNext={() => setScreen("register_done")} />;
  if (screen === "register_done") return <RegisterOnlyDone onNextGuest={resetToSearch} />;

  return null;
}
