import React, { useState, useEffect } from "react";
import { Plus, X, Check, AlertTriangle, Trash2, Pencil } from "lucide-react";
import { C } from "../../lib/tokens";
import { PrimaryButton, GhostButton } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { formatIDR } from "../../lib/merch";

export default function AdminItems() {
  const [items, setItems] = useState(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [editVariant, setEditVariant] = useState(null); // { item, variant | null } — null variant = adding new
  const [damageFor, setDamageFor] = useState(null); // variant

  const refetch = () => {
    supabase.from("merch_items").select("id, name, merch_item_variants(id, variant_label, price, stock_available, stock_damaged)").order("name")
      .then(({ data }) => setItems(data || []));
  };
  useEffect(() => { refetch(); }, []);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3" style={{ background: C.inkSoft }}>
      <PrimaryButton icon={Plus} onClick={() => setShowNewItem(true)}>New Item</PrimaryButton>
      {items === null && <div style={{ color: C.ink40, fontSize: 14.5 }}>Loading…</div>}
      {items?.map((item) => (
        <div key={item.id} className="rounded-xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: C.parchment, fontSize: 16.5, fontWeight: 700 }}>{item.name}</span>
            <button onClick={() => setEditVariant({ item, variant: null })} className="flex items-center gap-1" style={{ background: "none", border: "none", color: C.gold, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}><Plus size={13} /> Variant</button>
          </div>
          {(item.merch_item_variants || []).length === 0 && <div style={{ color: C.ink40, fontSize: 13.5 }}>No variants yet — add one to set a price and stock.</div>}
          {(item.merch_item_variants || []).map((v) => (
            <div key={v.id} className="flex items-center justify-between py-2" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
              <div>
                <div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>{v.variant_label || "— no variant —"}</div>
                <div style={{ color: C.ink40, fontSize: 12.5, marginTop: 2 }}>{formatIDR(v.price)} · {v.stock_available} available{v.stock_damaged > 0 ? ` · ${v.stock_damaged} damaged` : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setDamageFor(v)} title="Flag damage" style={{ background: "none", border: `1px solid ${C.inkLine}`, borderRadius: 8, padding: 6, cursor: "pointer" }}><AlertTriangle size={13} color={C.gold} /></button>
                <button onClick={() => setEditVariant({ item, variant: v })} title="Edit" style={{ background: "none", border: `1px solid ${C.inkLine}`, borderRadius: 8, padding: 6, cursor: "pointer" }}><Pencil size={13} color={C.ink40} /></button>
              </div>
            </div>
          ))}
        </div>
      ))}
      {showNewItem && <NewItemSheet onClose={() => setShowNewItem(false)} onSaved={() => { setShowNewItem(false); refetch(); }} />}
      {editVariant && <EditVariantSheet item={editVariant.item} variant={editVariant.variant} onClose={() => setEditVariant(null)} onSaved={() => { setEditVariant(null); refetch(); }} />}
      {damageFor && <DamageSheet variant={damageFor} onClose={() => setDamageFor(null)} onSaved={() => { setDamageFor(null); refetch(); }} />}
    </div>
  );
}

function NewItemSheet({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    const { error } = await supabase.from("merch_items").insert({ name: name.trim() });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  };

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18.5, fontWeight: 600 }}>New Item</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      <div className="flex-1 px-5 py-5" style={{ background: C.inkSoft }}>
        <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Item name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tumbler" style={inputStyle} />
        <div style={{ color: C.ink40, fontSize: 13.5, marginTop: 8 }}>Add variants (sizes, colors) next — an item with no variants can't be sold yet.</div>
        {error && <div style={{ color: C.alert, fontSize: 14.5, marginTop: 10 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}><PrimaryButton icon={Check} disabled={saving} onClick={save}>{saving ? "Saving…" : "Create Item"}</PrimaryButton></div>
    </div>
  );
}

function EditVariantSheet({ item, variant, onClose, onSaved }) {
  const [label, setLabel] = useState(variant?.variant_label || "");
  const [price, setPrice] = useState(variant?.price?.toString() || "");
  const [stock, setStock] = useState(variant?.stock_available?.toString() || "0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) { setError("Enter a valid price."); return; }
    setSaving(true); setError("");
    let error;
    if (variant) {
      ({ error } = await supabase.from("merch_item_variants").update({ variant_label: label.trim() || null, price: priceNum }).eq("id", variant.id));
    } else {
      const stockNum = parseInt(stock, 10) || 0;
      ({ error } = await supabase.from("merch_item_variants").insert({ item_id: item.id, variant_label: label.trim() || null, price: priceNum, stock_available: stockNum }));
    }
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  };

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18.5, fontWeight: 600 }}>{variant ? "Edit" : "New"} Variant — {item.name}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      <div className="flex-1 px-5 py-5 flex flex-col gap-4" style={{ background: C.inkSoft }}>
        <div>
          <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Variant label <span style={{ color: C.ink40, fontWeight: 500 }}>(leave blank if none)</span></div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Red, Size M" style={inputStyle} />
        </div>
        <div>
          <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Price (IDR)</div>
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" style={inputStyle} />
        </div>
        {!variant && (
          <div>
            <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Starting stock</div>
            <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" style={inputStyle} />
          </div>
        )}
        {variant && <div style={{ color: C.ink40, fontSize: 13.5 }}>Stock is adjusted via sales, voids, or the damage-flag button — not edited here directly.</div>}
        {error && <div style={{ color: C.alert, fontSize: 14.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}><PrimaryButton icon={Check} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</PrimaryButton></div>
    </div>
  );
}

function DamageSheet({ variant, onClose, onSaved }) {
  const [direction, setDirection] = useState("to_damaged");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!note.trim()) { setError("A note is required — why is this being adjusted?"); return; }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) { setError("Enter a valid quantity."); return; }
    setSaving(true); setError("");
    const { data, error } = await supabase.rpc("adjust_merch_stock_condition", { p_variant_id: variant.id, p_quantity: qty, p_direction: direction, p_note: note.trim() });
    setSaving(false);
    const result = data?.[0];
    if (error || !result?.success) { setError(result?.message || error?.message || "Failed."); return; }
    onSaved();
  };

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18.5, fontWeight: 600 }}>Adjust Condition</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      <div className="flex-1 px-5 py-5 flex flex-col gap-4" style={{ background: C.inkSoft }}>
        <div style={{ color: C.ink60, fontSize: 13.5 }}>Available: {variant.stock_available} · Damaged: {variant.stock_damaged}</div>
        <div className="flex gap-2">
          <button onClick={() => setDirection("to_damaged")} className="flex-1 rounded-lg" style={{ padding: "10px 0", fontSize: 14.5, fontWeight: 700, background: direction === "to_damaged" ? C.gold : C.ink, color: direction === "to_damaged" ? C.ink : C.ink60, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>Mark as damaged</button>
          <button onClick={() => setDirection("to_available")} className="flex-1 rounded-lg" style={{ padding: "10px 0", fontSize: 14.5, fontWeight: 700, background: direction === "to_available" ? C.gold : C.ink, color: direction === "to_available" ? C.ink : C.ink60, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>Return to available</button>
        </div>
        <div>
          <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Quantity</div>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" style={inputStyle} />
        </div>
        <div>
          <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Note <span style={{ color: C.ink40, fontWeight: 500 }}>(required)</span></div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. found scratched during stock check" style={inputStyle} />
        </div>
        {error && <div style={{ color: C.alert, fontSize: 14.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}><PrimaryButton icon={Check} disabled={saving} onClick={submit}>{saving ? "Saving…" : "Confirm"}</PrimaryButton></div>
    </div>
  );
}

const inputStyle = { width: "100%", background: C.ink, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 16.5, padding: "12px 14px", outline: "none" };
