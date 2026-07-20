import React, { useState, useEffect, useMemo } from "react";
import { ShoppingBag, Minus, Plus, Check, AlertTriangle, X } from "lucide-react";
import { C } from "../../lib/tokens";
import { PrimaryButton, Dropdown } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { formatIDR, PAYMENT_METHOD_OPTIONS } from "../../lib/merch";

export default function SellScreen({ crew, session }) {
  const [items, setItems] = useState(null);
  const [checkout, setCheckout] = useState(null); // { item, variant }
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    supabase.from("merch_items").select("id, name, merch_item_variants(id, variant_label, price, stock_available)").order("name")
      .then(({ data }) => setItems(data || []));
  }, [refreshKey]);

  if (session === undefined) return <div className="flex-1 flex items-center justify-center" style={{ background: C.inkSoft, color: C.ink40, fontSize: 14.5 }}>Loading…</div>;
  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8" style={{ background: C.inkSoft }}>
        <AlertTriangle size={26} color={C.gold} />
        <div style={{ color: C.parchment, fontSize: 16.5, fontWeight: 600, textAlign: "center" }}>No session open</div>
        <div style={{ color: C.ink40, fontSize: 14.5, textAlign: "center" }}>Open the day from the Session tab before making sales.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5" style={{ background: C.inkSoft }}>
      {items === null && <div style={{ color: C.ink40, fontSize: 14.5 }}>Loading…</div>}
      {items?.length === 0 && <div style={{ color: C.ink40, fontSize: 14.5 }}>No items in the catalog yet — ask an Admin to add some.</div>}
      {items?.map((item) => {
        const variants = item.merch_item_variants || [];
        const totalStock = variants.reduce((s, v) => s + v.stock_available, 0);
        return (
          <button key={item.id} onClick={() => setCheckout({ item, variant: variants.length === 1 ? variants[0] : null })}
            disabled={totalStock === 0} className="w-full flex items-center justify-between rounded-xl px-4 py-3.5 text-left"
            style={{ background: C.ink, border: `1px solid ${C.inkLine}`, opacity: totalStock === 0 ? 0.5 : 1, cursor: totalStock === 0 ? "default" : "pointer" }}>
            <div>
              <div style={{ color: C.parchment, fontSize: 16.5, fontWeight: 600 }}>{item.name}</div>
              <div style={{ color: C.ink40, fontSize: 13.5, marginTop: 3 }}>
                {variants.length > 1 ? `${variants.length} variants` : formatIDR(variants[0]?.price)} · {totalStock === 0 ? "OUT OF STOCK" : `${totalStock} in stock`}
              </div>
            </div>
            <ShoppingBag size={18} color={totalStock === 0 ? C.ink40 : C.gold} />
          </button>
        );
      })}
      {checkout && <CheckoutSheet crew={crew} session={session} item={checkout.item} initialVariant={checkout.variant} onClose={() => setCheckout(null)} onSold={() => { setCheckout(null); setRefreshKey((k) => k + 1); }} />}
    </div>
  );
}

function CheckoutSheet({ crew, session, item, initialVariant, onClose, onSold }) {
  const variants = item.merch_item_variants || [];
  const [variant, setVariant] = useState(initialVariant);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(() => (variant ? variant.price * quantity : 0), [variant, quantity]);

  const complete = async () => {
    if (!variant) { setError("Pick a variant first."); return; }
    setSaving(true); setError("");
    const { data, error } = await supabase.rpc("sell_merch_item", {
      p_variant_id: variant.id, p_quantity: quantity, p_session_id: session.id, p_payment_method: paymentMethod,
    });
    setSaving(false);
    const result = data?.[0];
    if (error || !result?.success) { setError(result?.message || error?.message || "Sale failed."); return; }
    onSold();
  };

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18.5, fontWeight: 600 }}>{item.name}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5" style={{ background: C.inkSoft }}>
        {variants.length > 1 && (
          <div>
            <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 8 }}>Variant</div>
            <div className="flex flex-col gap-1.5">
              {variants.map((v) => (
                <button key={v.id} onClick={() => setVariant(v)} disabled={v.stock_available === 0}
                  className="flex items-center justify-between rounded-lg px-3.5 py-2.5" style={{ background: variant?.id === v.id ? `${C.gold}22` : C.ink, border: `1px solid ${variant?.id === v.id ? C.gold : C.inkLine}`, opacity: v.stock_available === 0 ? 0.4 : 1, cursor: v.stock_available === 0 ? "default" : "pointer" }}>
                  <span style={{ color: C.parchment, fontSize: 15.5, fontWeight: 600 }}>{v.variant_label}</span>
                  <span style={{ color: C.ink40, fontSize: 13.5 }}>{v.stock_available === 0 ? "OUT" : `${v.stock_available} left`} · {formatIDR(v.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {variant && (
          <>
            <div>
              <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 8 }}>Quantity <span style={{ color: C.ink40, fontWeight: 500 }}>({variant.stock_available} available)</span></div>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: C.ink, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}><Minus size={16} color={C.parchment} /></button>
                <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.parchment, fontSize: 23, fontWeight: 700, minWidth: 40, textAlign: "center" }}>{quantity}</span>
                <button onClick={() => setQuantity((q) => Math.min(variant.stock_available, q + 1))} className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: C.ink, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}><Plus size={16} color={C.parchment} /></button>
              </div>
            </div>
            <div>
              <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 8 }}>Payment method</div>
              <Dropdown value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHOD_OPTIONS} />
            </div>
            <div className="rounded-xl px-4 py-3.5 flex items-center justify-between" style={{ background: C.ink, border: `1px solid ${C.gold}66` }}>
              <span style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600 }}>Total</span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.gold, fontSize: 21, fontWeight: 700 }}>{formatIDR(total)}</span>
            </div>
          </>
        )}
        {error && <div style={{ color: C.alert, fontSize: 14.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={Check} disabled={!variant || saving} onClick={complete}>{saving ? "Processing…" : "Complete Sale"}</PrimaryButton>
      </div>
    </div>
  );
}
