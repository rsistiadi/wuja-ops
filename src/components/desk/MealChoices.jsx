import React, { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { C } from "../../lib/tokens";
import { TopBar, PrimaryButton } from "../shared/UI";
import { BOROBUDUR_MEAL_OPTIONS, PRAMBANAN_MEAL_OPTIONS } from "../../lib/mealChoices";
import { supabase } from "../../lib/supabaseClient";

// Only asks about a venue if this person's category actually has
// access to it — access varies per venue (e.g. plain "delegate" isn't
// on Borobudur's list but is on Prambanan's), so the two are checked
// independently rather than assuming everyone (or every non-performer)
// gets both questions. A venue they're not eligible for is recorded
// as "na" automatically rather than left blank, so Reports can tell
// "correctly not applicable" apart from "genuinely not asked yet" —
// and if their access changes later, that value can simply be
// corrected like any other field.
export default function MealChoices({ reg, onBack, onNext }) {
  const [loading, setLoading] = useState(true);
  const [hasBorobudur, setHasBorobudur] = useState(false);
  const [hasPrambanan, setHasPrambanan] = useState(false);
  const [borobudur, setBorobudur] = useState(reg.meal_choice_borobudur || null);
  const [prambanan, setPrambanan] = useState(reg.meal_choice_prambanan || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    supabase.from("checkpoints").select("name, categories").in("name", ["Borobudur", "Prambanan"]).then(({ data }) => {
      if (cancelled) return;
      const borobudurCp = (data || []).find((c) => c.name === "Borobudur");
      const prambananCp = (data || []).find((c) => c.name === "Prambanan");
      const eligibleBorobudur = !!borobudurCp?.categories?.includes(reg.category);
      const eligiblePrambanan = !!prambananCp?.categories?.includes(reg.category);
      setHasBorobudur(eligibleBorobudur);
      setHasPrambanan(eligiblePrambanan);
      setLoading(false);
      if (!eligibleBorobudur && !eligiblePrambanan) submit(false, false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = (!hasBorobudur || !!borobudur) && (!hasPrambanan || !!prambanan);

  const submit = async (eligibleBorobudur = hasBorobudur, eligiblePrambanan = hasPrambanan) => {
    setSaving(true); setError("");
    const { error } = await supabase
      .from("registrations")
      .update({
        meal_choice_borobudur: eligibleBorobudur ? borobudur : "na",
        meal_choice_prambanan: eligiblePrambanan ? prambanan : "na",
      })
      .eq("id", reg.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onNext();
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title="Meal Choices" subtitle="Checking venue access…" onBack={onBack} accent={C.gold} />
        <div className="flex-1 flex items-center justify-center" style={{ background: C.inkSoft }}>
          <div style={{ color: C.ink40, fontSize: 13.5 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!hasBorobudur && !hasPrambanan) return null; // already auto-submitted above, this screen just isn't shown

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Meal Choices" subtitle="Ask their preference for each event" onBack={onBack} accent={C.gold} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6" style={{ background: C.inkSoft }}>
        {hasBorobudur && <MealPicker label="31 July — Lunch Trip to Borobudur" options={BOROBUDUR_MEAL_OPTIONS} value={borobudur} onChange={setBorobudur} />}
        {hasPrambanan && <MealPicker label="1 August — Main Course Dinner at Prambanan" options={PRAMBANAN_MEAL_OPTIONS} value={prambanan} onChange={setPrambanan} />}
        {error && <div style={{ color: C.alert, fontSize: 13.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={ArrowRight} disabled={!canContinue || saving} onClick={() => submit()}>{saving ? "Saving…" : "Continue"}</PrimaryButton>
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
