import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { C } from "../../lib/tokens";
import { TopBar, PrimaryButton } from "../shared/UI";
import { BOROBUDUR_MEAL_OPTIONS, PRAMBANAN_MEAL_OPTIONS } from "../../lib/mealChoices";
import { supabase } from "../../lib/supabaseClient";

export default function MealChoices({ reg, onBack, onNext }) {
  const [borobudur, setBorobudur] = useState(reg.meal_choice_borobudur || null);
  const [prambanan, setPrambanan] = useState(reg.meal_choice_prambanan || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canContinue = !!borobudur && !!prambanan;

  const submit = async () => {
    setSaving(true); setError("");
    const { error } = await supabase
      .from("registrations")
      .update({ meal_choice_borobudur: borobudur, meal_choice_prambanan: prambanan })
      .eq("id", reg.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Meal Choices" subtitle="Ask their preference for each event" onBack={onBack} accent={C.gold} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6" style={{ background: C.inkSoft }}>
        <MealPicker label="31 July — Lunch Trip to Borobudur" options={BOROBUDUR_MEAL_OPTIONS} value={borobudur} onChange={setBorobudur} />
        <MealPicker label="1 August — Main Course Dinner at Prambanan" options={PRAMBANAN_MEAL_OPTIONS} value={prambanan} onChange={setPrambanan} />
        {error && <div style={{ color: C.alert, fontSize: 13.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={ArrowRight} disabled={!canContinue || saving} onClick={submit}>{saving ? "Saving…" : "Continue"}</PrimaryButton>
      </div>
    </div>
  );
}

function MealPicker({ label, options, value, onChange }) {
  return (
    <div>
      <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button key={o.value} onClick={() => onChange(o.value)} className="rounded-xl py-3"
              style={{ background: active ? C.gold : C.ink, border: `1px solid ${active ? C.gold : C.inkLine}`, color: active ? C.ink : C.parchment, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
