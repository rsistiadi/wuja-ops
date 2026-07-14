import React, { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { C, CATEGORY_META, genRegCode } from "../../lib/tokens";
import { TopBar, PrimaryButton, Dropdown } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";

export default function WalkInForm({ buses, onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("guest");
  const [role, setRole] = useState("participant");
  const [assignedBusId, setAssignedBusId] = useState("");
  const [contactShareable, setContactShareable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (buses.length && !assignedBusId) setAssignedBusId(buses[0].id); }, [buses, assignedBusId]);

  const canSubmit = name.trim().length > 1 && phone.trim().length > 3;

  const submit = async () => {
    setSaving(true); setError("");
    // Unique-constraint collision on reg_code is possible but rare (see
    // genRegCode's comment) — retry once with a fresh code if it happens,
    // rather than failing the whole walk-in on a one-in-thousands fluke.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase
        .from("registrations")
        .insert({
          reg_code: genRegCode(),
          full_name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          category,
          person_role: category === "guest" ? role : null,
          assigned_bus_id: assignedBusId || null,
          contact_shareable: contactShareable,
        })
        .select()
        .single();

      if (!error) { setSaving(false); onCreate(data); return; }
      if (error.code !== "23505" || attempt === 1) { setSaving(false); setError(error.message); return; }
      // 23505 = unique_violation on reg_code — loop retries with a new code
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Walk-in Registration" subtitle="New attendee not in the database" onBack={onCancel} accent={C.gold} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4" style={{ background: C.inkSoft }}>
        <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inputStyle} /></Field>
        <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xx-xxxx-xxxx" style={inputStyle} /></Field>
        <Field label="Email (optional)"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" style={inputStyle} /></Field>

        <div>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Category</div>
          <div className="flex gap-2">
            {Object.entries(CATEGORY_META).map(([key, meta]) => {
              const active = category === key;
              return (
                <button key={key} onClick={() => setCategory(key)} className="flex-1 rounded-lg"
                  style={{ padding: "9px 4px", fontSize: 10.5, fontWeight: 700, background: active ? `${meta.color}22` : C.ink, border: `1px solid ${active ? meta.color : C.inkLine}`, color: active ? meta.color : C.ink60, cursor: "pointer" }}>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {category === "guest" && (
          <div>
            <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Participant or spouse?</div>
            <div className="flex gap-2">
              {[{ k: "participant", l: "Participant" }, { k: "spouse", l: "Spouse" }].map((t) => {
                const active = role === t.k;
                return (
                  <button key={t.k} onClick={() => setRole(t.k)} className="flex-1 rounded-lg"
                    style={{ padding: "9px 0", fontSize: 12, fontWeight: 700, background: active ? C.gold : C.ink, border: `1px solid ${active ? C.gold : C.inkLine}`, color: active ? C.ink : C.ink60, cursor: "pointer" }}>{t.l}</button>
                );
              })}
            </div>
            <div style={{ color: C.ink40, fontSize: 10.5, marginTop: 6 }}>
              Linking a spouse to an existing participant record is an Admin action (done from the Buses/roster or a future "link" tool) — not part of this walk-in form.
            </div>
          </div>
        )}

        {buses.length > 0 && (
          <Field label="Assign to bus"><Dropdown value={assignedBusId} onChange={setAssignedBusId} options={buses.map((b) => ({ value: b.id, label: b.name }))} /></Field>
        )}

        <div className="rounded-xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <div className="flex items-center justify-between">
            <div className="pr-3">
              <div style={{ color: C.parchment, fontSize: 13, fontWeight: 600 }}>Share contact on public badge profile?</div>
              <div style={{ color: C.ink60, fontSize: 11, marginTop: 2 }}>Only controls whether phone/email are visible when someone scans their badge.</div>
            </div>
            <input type="checkbox" checked={contactShareable} onChange={(e) => setContactShareable(e.target.checked)} style={{ width: 20, height: 20 }} />
          </div>
        </div>

        {error && <div style={{ color: C.alert, fontSize: 12.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={ArrowRight} disabled={!canSubmit || saving} onClick={submit}>{saving ? "Creating…" : "Create & continue"}</PrimaryButton>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", background: C.ink, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 14, padding: "12px 14px", outline: "none" };

function Field({ label, children }) {
  return (
    <div>
      <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
