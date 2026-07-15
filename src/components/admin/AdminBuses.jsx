import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, Search } from "lucide-react";
import { C } from "../../lib/tokens";
import { TopBar, PrimaryButton, PersonTag } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";

export default function AdminBuses() {
  const [buses, setBuses] = useState([]);
  const [legs, setLegs] = useState([]);
  const [rosterCounts, setRosterCounts] = useState({});
  const [screen, setScreen] = useState("list"); // list | busForm | legForm | roster
  const [editingBus, setEditingBus] = useState(null);
  const [editingLeg, setEditingLeg] = useState(null);
  const [rosterBus, setRosterBus] = useState(null);
  const [busName, setBusName] = useState("");
  const [legLabel, setLegLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const refetch = async () => {
    const [busesRes, legsRes] = await Promise.all([
      supabase.from("buses").select("id, name").order("name"),
      supabase.from("trip_legs").select("id, label").order("leg_date"),
    ]);
    setBuses(busesRes.data || []);
    setLegs(legsRes.data || []);
    const counts = {};
    for (const b of busesRes.data || []) {
      const { count } = await supabase.from("registrations").select("id", { count: "exact", head: true }).eq("assigned_bus_id", b.id);
      counts[b.id] = count || 0;
    }
    setRosterCounts(counts);
  };
  useEffect(() => { refetch(); }, []);

  const saveBus = async () => {
    if (!busName.trim()) return;
    setSaving(true);
    if (editingBus) await supabase.from("buses").update({ name: busName.trim() }).eq("id", editingBus.id);
    else await supabase.from("buses").insert({ name: busName.trim() });
    setSaving(false); setScreen("list"); setEditingBus(null); setBusName(""); refetch();
  };
  const deleteBus = async () => { setSaving(true); await supabase.from("buses").delete().eq("id", editingBus.id); setSaving(false); setScreen("list"); setEditingBus(null); refetch(); };

  const saveLeg = async () => {
    if (!legLabel.trim()) return;
    setSaving(true);
    if (editingLeg) await supabase.from("trip_legs").update({ label: legLabel.trim() }).eq("id", editingLeg.id);
    else await supabase.from("trip_legs").insert({ label: legLabel.trim() });
    setSaving(false); setScreen("list"); setEditingLeg(null); setLegLabel(""); refetch();
  };
  const deleteLeg = async () => { setSaving(true); await supabase.from("trip_legs").delete().eq("id", editingLeg.id); setSaving(false); setScreen("list"); setEditingLeg(null); refetch(); };

  if (screen === "roster" && rosterBus) return <BusRosterPicker bus={rosterBus} onBack={() => { setScreen("list"); setRosterBus(null); refetch(); }} />;

  if (screen === "busForm") {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title={editingBus ? "Edit Bus" : "New Bus"} onBack={() => { setScreen("list"); setEditingBus(null); }} accent={C.gold} />
        <div className="flex-1 px-5 py-5" style={{ background: C.inkSoft }}>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Bus / vehicle name</div>
          <input value={busName} onChange={(e) => setBusName(e.target.value)} placeholder="e.g. Bus C" style={inputStyle} />
        </div>
        <div className="px-5 pb-7 pt-3 flex flex-col gap-2.5" style={{ background: C.inkSoft }}>
          <PrimaryButton icon={Check} disabled={!busName.trim() || saving} onClick={saveBus}>{editingBus ? "Save changes" : "Create bus"}</PrimaryButton>
          {editingBus && <button onClick={deleteBus} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-xl" style={{ background: "transparent", color: C.alert, fontWeight: 600, fontSize: 13, padding: "10px 16px", border: "none", cursor: "pointer" }}><Trash2 size={14} /> Delete bus</button>}
        </div>
      </div>
    );
  }

  if (screen === "legForm") {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title={editingLeg ? "Edit Trip" : "New Trip"} onBack={() => { setScreen("list"); setEditingLeg(null); }} accent={C.gold} />
        <div className="flex-1 px-5 py-5" style={{ background: C.inkSoft }}>
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Trip / leg name</div>
          <input value={legLabel} onChange={(e) => setLegLabel(e.target.value)} placeholder="e.g. Jul 31 — Morning · To Venue" style={inputStyle} />
        </div>
        <div className="px-5 pb-7 pt-3 flex flex-col gap-2.5" style={{ background: C.inkSoft }}>
          <PrimaryButton icon={Check} disabled={!legLabel.trim() || saving} onClick={saveLeg}>{editingLeg ? "Save changes" : "Create trip"}</PrimaryButton>
          {editingLeg && <button onClick={deleteLeg} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-xl" style={{ background: "transparent", color: C.alert, fontWeight: 600, fontSize: 13, padding: "10px 16px", border: "none", cursor: "pointer" }}><Trash2 size={14} /> Delete trip</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col" style={{ background: C.inkSoft }}>
      <div className="px-5 pt-4 pb-2 flex flex-col gap-2">
        <div style={{ color: C.ink60, fontSize: 11, fontWeight: 700 }}>BUSES / VEHICLES</div>
        {buses.map((b) => (
          <div key={b.id} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div><div style={{ color: C.parchment, fontSize: 13.5, fontWeight: 600 }}>{b.name}</div><div style={{ color: C.ink40, fontSize: 11, marginTop: 4 }}>{rosterCounts[b.id] ?? 0} assigned</div></div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setRosterBus(b); setScreen("roster"); }} style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.gold, fontSize: 11, fontWeight: 700, padding: "7px 10px", borderRadius: 8, cursor: "pointer" }}>Roster</button>
              <button onClick={() => { setEditingBus(b); setBusName(b.name); setScreen("busForm"); }} style={{ background: "none", border: "none", cursor: "pointer" }}><Pencil size={15} color={C.ink40} /></button>
            </div>
          </div>
        ))}
        <button onClick={() => { setEditingBus(null); setBusName(""); setScreen("busForm"); }} className="flex items-center justify-center gap-2 rounded-xl" style={{ background: C.ink, border: `1px dashed ${C.gold}66`, color: C.gold, fontSize: 12.5, fontWeight: 700, padding: "10px 0", cursor: "pointer" }}><Plus size={14} /> New bus</button>
      </div>
      <div className="px-5 pt-5 pb-6 flex flex-col gap-2">
        <div style={{ color: C.ink60, fontSize: 11, fontWeight: 700 }}>TRIPS / LEGS</div>
        {legs.map((l) => (
          <div key={l.id} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div style={{ color: C.parchment, fontSize: 13, fontWeight: 600 }}>{l.label}</div>
            <button onClick={() => { setEditingLeg(l); setLegLabel(l.label); setScreen("legForm"); }} style={{ background: "none", border: "none", cursor: "pointer" }}><Pencil size={15} color={C.ink40} /></button>
          </div>
        ))}
        <button onClick={() => { setEditingLeg(null); setLegLabel(""); setScreen("legForm"); }} className="flex items-center justify-center gap-2 rounded-xl" style={{ background: C.ink, border: `1px dashed ${C.gold}66`, color: C.gold, fontSize: 12.5, fontWeight: 700, padding: "10px 0", cursor: "pointer" }}><Plus size={14} /> New trip</button>
      </div>
    </div>
  );
}

function BusRosterPicker({ bus, onBack }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    const query = supabase.from("registrations").select("id, full_name, category, assigned_bus_id");
    (q.trim().length >= 2 ? query.ilike("full_name", `%${q.trim()}%`) : query.eq("assigned_bus_id", bus.id)).limit(50).then(({ data }) => setResults(data || []));
  }, [q, bus.id]);

  const toggle = async (p) => {
    const newBusId = p.assigned_bus_id === bus.id ? null : bus.id;
    await supabase.from("registrations").update({ assigned_bus_id: newBusId }).eq("id", p.id);
    setResults((prev) => prev.map((x) => (x.id === p.id ? { ...x, assigned_bus_id: newBusId } : x)));
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={`${bus.name} Roster`} subtitle="Tap to assign / unassign" onBack={onBack} accent={C.gold} />
      <div className="px-5 pb-4" style={{ background: C.ink }}>
        <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
          <Search size={16} color={C.ink60} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name… (blank = current roster)" className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 14, padding: "11px 4px", border: "none" }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2" style={{ background: C.inkSoft }}>
        {results.map((p) => { const active = p.assigned_bus_id === bus.id; return (
          <button key={p.id} onClick={() => toggle(p)} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: C.ink, border: `1px solid ${active ? C.gold : C.inkLine}`, cursor: "pointer" }}>
            <div className="text-left"><div style={{ color: C.parchment, fontSize: 13.5, fontWeight: 600 }}>{p.full_name}</div><div className="flex items-center gap-2 mt-1"><PersonTag reg={p} /></div></div>
            <div className="flex items-center justify-center rounded" style={{ width: 20, height: 20, background: active ? C.gold : "transparent", border: `1.5px solid ${active ? C.gold : C.inkLine}` }}>{active && <Check size={13} color={C.ink} />}</div>
          </button>
        ); })}
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", background: C.ink, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 14, padding: "12px 14px", outline: "none" };
