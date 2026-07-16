import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, Search } from "lucide-react";
import { C, CATEGORY_META } from "../../lib/tokens";
import { TopBar, PrimaryButton, Dropdown, PersonTag } from "../shared/UI";
import { CHECKPOINT_TYPE_OPTIONS, ACCESS_RULE_OPTIONS, CATEGORY_OPTIONS } from "../../lib/checkpointAccess";
import { supabase } from "../../lib/supabaseClient";

export default function AdminCheckpoints() {
  const [checkpoints, setCheckpoints] = useState([]);
  const [buses, setBuses] = useState([]);
  const [screen, setScreen] = useState("list"); // list | form | roster
  const [editing, setEditing] = useState(null);

  const refetch = () => supabase.from("checkpoints").select("*").order("created_at").then(({ data }) => setCheckpoints(data || []));
  useEffect(() => { refetch(); supabase.from("buses").select("id, name").order("name").then(({ data }) => setBuses(data || [])); }, []);

  if (screen === "form") {
    return <CheckpointForm initial={editing} buses={buses} onBack={() => { setScreen("list"); setEditing(null); }} onSaved={() => { refetch(); setScreen("list"); setEditing(null); }} />;
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5" style={{ background: C.inkSoft }}>
        {checkpoints.map((cp) => (
          <button key={cp.id} onClick={() => { setEditing(cp); setScreen("form"); }} className="flex items-center gap-3 rounded-xl px-4 py-3.5" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, textAlign: "left", cursor: "pointer" }}>
            <div className="flex-1">
              <div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>{cp.name}</div>
              <div className="flex items-center gap-2 mt-1"><span style={{ color: C.ink40, fontSize: 12.5 }}>{CHECKPOINT_TYPE_OPTIONS.find((t) => t.value === cp.type)?.label}</span><span style={{ color: C.ink40, fontSize: 12.5 }}>·</span><span style={{ color: C.ink40, fontSize: 12.5 }}>{cp.date_label}</span></div>
              <span className="inline-block mt-1.5 rounded-full" style={{ fontSize: 11, fontWeight: 700, padding: "2.5px 8px", background: `${C.guest}22`, color: C.guest }}>{ACCESS_RULE_OPTIONS.find((r) => r.value === cp.access_rule)?.label}</span>
            </div>
            <Pencil size={14} color={C.ink40} />
          </button>
        ))}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}><PrimaryButton icon={Plus} onClick={() => { setEditing(null); setScreen("form"); }}>New checkpoint</PrimaryButton></div>
    </div>
  );
}

function CheckpointForm({ initial, buses, onBack, onSaved }) {
  const [name, setName] = useState(initial?.name || "");
  const [dateLabel, setDateLabel] = useState(initial?.date_label || "");
  const [type, setType] = useState(initial?.type || "entry");
  const [accessRule, setAccessRule] = useState(initial?.access_rule || "all");
  const [categories, setCategories] = useState(initial?.categories || []);
  const [linkedBusId, setLinkedBusId] = useState(initial?.linked_bus_id || "");
  const [showPicker, setShowPicker] = useState(false);
  const [namedCount, setNamedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) supabase.from("checkpoint_named_list").select("registration_id", { count: "exact", head: true }).eq("checkpoint_id", initial.id).then(({ count }) => setNamedCount(count || 0));
  }, [initial]);

  const toggleCategory = (key) => setCategories((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));

  const save = async () => {
    setSaving(true); setError("");
    const payload = { name: name.trim(), date_label: dateLabel.trim() || null, type, access_rule: accessRule, categories, linked_bus_id: type === "bus" ? linkedBusId || null : null };
    const { error } = initial
      ? await supabase.from("checkpoints").update(payload).eq("id", initial.id)
      : await supabase.from("checkpoints").insert(payload);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  };

  const remove = async () => {
    setSaving(true);
    const { error } = await supabase.from("checkpoints").delete().eq("id", initial.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  };

  if (showPicker) return <GuestListPicker checkpointId={initial?.id} onBack={() => setShowPicker(false)} onDone={(count) => { setNamedCount(count); setShowPicker(false); }} />;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={initial ? "Edit Checkpoint" : "New Checkpoint"} subtitle="Admin only" onBack={onBack} accent={C.gold} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5" style={{ background: C.inkSoft }}>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gala Dinner" style={inputStyle} /></Field>
        <Field label="When"><input value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} placeholder="e.g. Jul 31, 19:00" style={inputStyle} /></Field>

        <div>
          <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Checkpoint type</div>
          <div className="flex gap-2">
            {CHECKPOINT_TYPE_OPTIONS.map((t) => { const active = type === t.value; return (
              <button key={t.value} onClick={() => setType(t.value)} className="flex-1 rounded-xl py-3" style={{ background: active ? `${C.gold}1f` : C.ink, border: `1px solid ${active ? C.gold : C.inkLine}`, color: active ? C.gold : C.ink60, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{t.label}</button>
            ); })}
          </div>
        </div>

        {type === "bus" && buses.length > 0 && (
          <Field label="Linked bus"><Dropdown value={linkedBusId} onChange={setLinkedBusId} options={[{ value: "", label: "— none —" }, ...buses.map((b) => ({ value: b.id, label: b.name }))]} /></Field>
        )}

        <div>
          <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Who's allowed in</div>
          <div className="flex flex-col gap-2">
            {ACCESS_RULE_OPTIONS.map((r) => { const active = accessRule === r.value; return (
              <button key={r.value} onClick={() => setAccessRule(r.value)} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: active ? `${C.gold}1f` : C.ink, border: `1px solid ${active ? C.gold : C.inkLine}`, cursor: "pointer" }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: active ? C.gold : C.parchment }}>{r.label}</span>{active && <Check size={15} color={C.gold} />}
              </button>
            ); })}
          </div>
        </div>

        {(accessRule === "category" || accessRule === "both") && (
          <div>
            <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Allowed categories</div>
            <div className="flex flex-col gap-2">
              {CATEGORY_OPTIONS.map((c) => { const active = categories.includes(c.value); const color = CATEGORY_META[c.value].color; return (
                <button key={c.value} onClick={() => toggleCategory(c.value)} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: C.ink, border: `1px solid ${active ? color : C.inkLine}`, cursor: "pointer" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color }}>{c.label}</span>
                  <div className="flex items-center justify-center rounded" style={{ width: 18, height: 18, background: active ? color : "transparent", border: `1.5px solid ${active ? color : C.inkLine}` }}>{active && <Check size={12} color={C.ink} />}</div>
                </button>
              ); })}
            </div>
          </div>
        )}

        {(accessRule === "named" || accessRule === "both") && (
          <div>
            <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Named guest list</div>
            {initial ? (
              <button onClick={() => setShowPicker(true)} className="w-full flex items-center justify-between rounded-xl px-4 py-3.5" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>
                <span style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>Manage guest list</span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.gold, fontSize: 14.5, fontWeight: 700 }}>{namedCount} added</span>
              </button>
            ) : (
              <div style={{ color: C.ink40, fontSize: 12.5 }}>Save the checkpoint first, then come back to add named guests.</div>
            )}
          </div>
        )}

        {error && <div style={{ color: C.alert, fontSize: 13.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3 flex flex-col gap-2.5" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={Check} disabled={!name.trim() || saving} onClick={save}>{initial ? "Save changes" : "Create checkpoint"}</PrimaryButton>
        {initial && <button onClick={remove} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-xl" style={{ background: "transparent", color: C.alert, fontWeight: 600, fontSize: 14.5, padding: "10px 16px", border: "none", cursor: "pointer" }}><Trash2 size={14} /> Delete checkpoint</button>}
      </div>
    </div>
  );
}

function GuestListPicker({ checkpointId, onBack, onDone }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [pickedIds, setPickedIds] = useState(new Set());

  useEffect(() => {
    supabase.from("checkpoint_named_list").select("registration_id").eq("checkpoint_id", checkpointId).then(({ data }) => setPickedIds(new Set((data || []).map((r) => r.registration_id))));
  }, [checkpointId]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    supabase.from("registrations").select("id, full_name, category").ilike("full_name", `%${q.trim()}%`).limit(30).then(({ data }) => setResults(data || []));
  }, [q]);

  const toggle = async (regId) => {
    if (pickedIds.has(regId)) {
      await supabase.from("checkpoint_named_list").delete().eq("checkpoint_id", checkpointId).eq("registration_id", regId);
      setPickedIds((prev) => { const next = new Set(prev); next.delete(regId); return next; });
    } else {
      await supabase.from("checkpoint_named_list").insert({ checkpoint_id: checkpointId, registration_id: regId });
      setPickedIds((prev) => new Set(prev).add(regId));
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Guest List" subtitle={`${pickedIds.size} selected`} onBack={() => onBack()} accent={C.gold} />
      <div className="px-5 pb-4" style={{ background: C.ink }}>
        <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
          <Search size={16} color={C.ink60} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 15.5, padding: "11px 4px", border: "none" }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2" style={{ background: C.inkSoft }}>
        {results.map((p) => { const active = pickedIds.has(p.id); return (
          <button key={p.id} onClick={() => toggle(p.id)} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: C.ink, border: `1px solid ${active ? C.gold : C.inkLine}`, cursor: "pointer" }}>
            <div className="text-left"><div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>{p.full_name}</div><div className="flex items-center gap-2 mt-1"><PersonTag reg={p} /></div></div>
            <div className="flex items-center justify-center rounded" style={{ width: 20, height: 20, background: active ? C.gold : "transparent", border: `1.5px solid ${active ? C.gold : C.inkLine}` }}>{active && <Check size={13} color={C.ink} />}</div>
          </button>
        ); })}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}><PrimaryButton icon={Check} onClick={() => onDone(pickedIds.size)}>Done — {pickedIds.size} selected</PrimaryButton></div>
    </div>
  );
}

const inputStyle = { width: "100%", background: C.ink, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 15.5, padding: "12px 14px", outline: "none" };
function Field({ label, children }) { return <div><div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{label}</div>{children}</div>; }
