import React, { useState, useEffect } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { C, genRegCode } from "../../lib/tokens";
import { TopBar, PrimaryButton, Dropdown } from "../shared/UI";
import { CATEGORY_OPTIONS, PERFORMER_COLOR_OPTIONS, PERFORMER_COLOR_VENUE } from "../../lib/checkpointAccess";
import { supabase } from "../../lib/supabaseClient";

export default function WalkInForm({ onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("committee");
  const [performerColor, setPerformerColor] = useState("yellow");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [linkedQuery, setLinkedQuery] = useState("");
  const [linkedResults, setLinkedResults] = useState([]);
  const [linkedPerson, setLinkedPerson] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (category !== "accompanying" || linkedQuery.trim().length < 2) { setLinkedResults([]); return; }
    supabase.from("registrations").select("id, full_name, category").ilike("full_name", `%${linkedQuery.trim()}%`).limit(15)
      .then(({ data }) => setLinkedResults(data || []));
  }, [category, linkedQuery]);

  const canSubmit = name.trim().length > 1 && phone.trim().length > 3 && (category !== "accompanying" || linkedPerson) && (paymentStatus !== "paid" || Number(paymentAmount) > 0);

  const submit = async () => {
    setSaving(true); setError("");
    let created = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase
        .from("registrations")
        .insert({
          reg_code: genRegCode(),
          full_name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          category,
          performer_color: category === "performer" ? performerColor : null,
          linked_registration_id: category === "accompanying" ? linkedPerson.id : null,
          payment_status: paymentStatus,
          payment_amount: paymentStatus === "paid" ? Number(paymentAmount) : null,
          // Bus assignment is deliberately not decided here — that's a
          // separate logistics decision made later via Admin → Buses →
          // Roster, not something registration should bundle in.
        })
        .select()
        .single();

      if (!error) { created = data; break; }
      if (error.code !== "23505" || attempt === 1) { setSaving(false); setError(error.message); return; }
      // 23505 = unique_violation on reg_code — loop retries with a new code
    }

    // Performer access is granted via the named guest list of the one
    // venue their color maps to, not the category rule everyone else uses.
    if (created && category === "performer") {
      const venueName = PERFORMER_COLOR_VENUE[performerColor];
      const { data: cp } = await supabase.from("checkpoints").select("id").eq("name", venueName).maybeSingle();
      if (cp) await supabase.from("checkpoint_named_list").upsert({ checkpoint_id: cp.id, registration_id: created.id });
    }

    setSaving(false);
    if (created) onCreate(created);
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Walk-in Registration" subtitle="New attendee not in the database" onBack={onCancel} accent={C.gold} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4" style={{ background: C.inkSoft }}>
        <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inputStyle} /></Field>
        <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xx-xxxx-xxxx" style={inputStyle} /></Field>
        <Field label="Email (optional)"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" style={inputStyle} /></Field>

        <Field label="Badge category"><Dropdown value={category} onChange={setCategory} options={CATEGORY_OPTIONS} /></Field>

        {category === "performer" && (
          <Field label="Performer color group"><Dropdown value={performerColor} onChange={setPerformerColor} options={PERFORMER_COLOR_OPTIONS} /></Field>
        )}

        <div>
          <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Payment</div>
          <div className="flex gap-2">
            {[
              { value: "free", label: "Free" },
              { value: "unpaid", label: "Not Paid" },
              { value: "paid", label: "Paid" },
            ].map((o) => {
              const active = paymentStatus === o.value;
              return (
                <button key={o.value} onClick={() => setPaymentStatus(o.value)} className="flex-1 rounded-xl py-2.5"
                  style={{ background: active ? C.gold : C.ink, border: `1px solid ${active ? C.gold : C.inkLine}`, color: active ? C.ink : C.parchment, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                  {o.label}
                </button>
              );
            })}
          </div>
          {paymentStatus === "paid" && (
            <div className="mt-3">
              <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Amount (IDR)</div>
              <input
                value={paymentAmount ? Number(paymentAmount).toLocaleString("id-ID") : ""}
                onChange={(e) => setPaymentAmount(e.target.value.replace(/\D/g, ""))}
                type="text"
                inputMode="numeric"
                placeholder="0"
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {category === "accompanying" && (
          <div>
            <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Accompanying whom?</div>
            {linkedPerson ? (
              <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: C.ink, border: `1px solid ${C.gold}` }}>
                <span style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>{linkedPerson.full_name}</span>
                <button onClick={() => setLinkedPerson(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={15} color={C.ink40} /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
                  <Search size={14} color={C.ink40} />
                  <input value={linkedQuery} onChange={(e) => setLinkedQuery(e.target.value)} placeholder="Search name…"
                    className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 14.5, padding: "10px 4px", border: "none" }} />
                </div>
                {linkedResults.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    {linkedResults.map((p) => (
                      <button key={p.id} onClick={() => { setLinkedPerson(p); setLinkedQuery(""); setLinkedResults([]); }} className="rounded-lg px-3 py-2 text-left" style={{ background: C.inkSoft, border: "none", color: C.parchment, fontSize: 13.5, cursor: "pointer" }}>{p.full_name}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && <div style={{ color: C.alert, fontSize: 13.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={ArrowRight} disabled={!canSubmit || saving} onClick={submit}>{saving ? "Creating…" : "Create & continue"}</PrimaryButton>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", background: C.ink, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 15.5, padding: "12px 14px", outline: "none" };

function Field({ label, children }) {
  return (
    <div>
      <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
