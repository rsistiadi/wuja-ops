import React, { useState, useEffect, useMemo } from "react";
import { ShoppingBag, Minus, Plus, Check, AlertTriangle, X, Trash2 } from "lucide-react";
import { C } from "../../lib/tokens";
import { PrimaryButton, Dropdown } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { formatIDR, PAYMENT_METHOD_OPTIONS } from "../../lib/merch";

export default function SellScreen({ crew, session }) {
  const [items, setItems] = useState(null);
  const [picking, setPicking] = useState(null); // item being picked (variant + qty chooser)
  const [cart, setCart] = useState([]); // [{ key, item, variant, quantity }]
  const [showCart, setShowCart] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetchItems = () => {
    supabase.from("merch_items").select("id, name, merch_item_variants(id, variant_label, price, stock_available)").order("name")
      .then(({ data }) => setItems(data || []));
  };
  useEffect(() => { refetchItems(); }, [refreshKey]);

  const addToCart = (item, variant, quantity) => {
    setCart((prev) => {
      const key = variant.id;
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l));
      return [...prev, { key, item, variant, quantity }];
    });
    setPicking(null);
  };

  const cartTotal = useMemo(() => cart.reduce((s, l) => s + l.variant.price * l.quantity, 0), [cart]);
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  if (session === undefined) return <div className="flex-1 flex items-center justify-center" style={{ background: C.inkSoft, color: C.ink40, fontSize: 14.5 }}>Loading…</div>;
  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8" style={{ background: C.inkSoft }}>
        <AlertTriangle size={26} color={C.gold} />
        <div style={{ color: C.parchment, fontSize: 16.5, fontWeight: 600, textAlign: "center" }}>No session open</div>
        <div style={{ color: C.ink40, fontSize: 14.5, textAlign: "center" }}>Ask an Admin to open the day from the Session tab before making sales.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ position: "relative", minHeight: 0 }}>
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5" style={{ background: C.inkSoft, paddingBottom: cartCount > 0 ? 90 : 16 }}>
        {items === null && <div style={{ color: C.ink40, fontSize: 14.5 }}>Loading…</div>}
        {items?.length === 0 && <div style={{ color: C.ink40, fontSize: 14.5 }}>No items in the catalog yet — ask an Admin to add some.</div>}
        {items?.map((item) => {
          const variants = item.merch_item_variants || [];
          const totalStock = variants.reduce((s, v) => s + v.stock_available, 0);
          const inCartQty = cart.filter((l) => l.item.id === item.id).reduce((s, l) => s + l.quantity, 0);
          return (
            <button key={item.id} onClick={() => setPicking(item)} disabled={totalStock === 0} className="w-full flex items-center justify-between rounded-xl px-4 py-3.5 text-left"
              style={{ background: C.ink, border: `1px solid ${C.inkLine}`, opacity: totalStock === 0 ? 0.5 : 1, cursor: totalStock === 0 ? "default" : "pointer" }}>
              <div>
                <div style={{ color: C.parchment, fontSize: 16.5, fontWeight: 600 }}>{item.name}{inCartQty > 0 && <span style={{ color: C.gold, fontWeight: 700 }}> · {inCartQty} in cart</span>}</div>
                <div style={{ color: C.ink40, fontSize: 13.5, marginTop: 3 }}>
                  {variants.length > 1 ? `${variants.length} variants` : formatIDR(variants[0]?.price)} · {totalStock === 0 ? "OUT OF STOCK" : `${totalStock} in stock`}
                </div>
              </div>
              <ShoppingBag size={18} color={totalStock === 0 ? C.ink40 : C.gold} />
            </button>
          );
        })}
      </div>

      {cartCount > 0 && !picking && !showCart && (
        <button onClick={() => setShowCart(true)} className="flex items-center justify-between" style={{ position: "absolute", left: 20, right: 20, bottom: 20, background: C.gold, borderRadius: 14, padding: "14px 18px", border: "none", cursor: "pointer" }}>
          <span style={{ color: C.ink, fontSize: 15.5, fontWeight: 700 }}>{cartCount} item{cartCount > 1 ? "s" : ""} in cart</span>
          <span style={{ color: C.ink, fontSize: 16.5, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{formatIDR(cartTotal)} →</span>
        </button>
      )}

      {picking && (
        <PickVariantSheet item={picking} onClose={() => setPicking(null)} onAdd={(variant, qty) => addToCart(picking, variant, qty)} />
      )}
      {showCart && (
        <CartCheckoutSheet
          crew={crew} session={session} cart={cart}
          onUpdateQuantity={(key, qty) => setCart((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l))))}
          onRemove={(key) => setCart((prev) => prev.filter((l) => l.key !== key))}
          onClose={() => setShowCart(false)}
          onComplete={(remainingCart) => { setCart(remainingCart); setShowCart(remainingCart.length > 0); setRefreshKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

function PickVariantSheet({ item, onClose, onAdd }) {
  const variants = item.merch_item_variants || [];
  const [variant, setVariant] = useState(variants.length === 1 ? variants[0] : null);
  const [quantity, setQuantity] = useState(1);

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
          <div>
            <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 8 }}>Quantity <span style={{ color: C.ink40, fontWeight: 500 }}>({variant.stock_available} available)</span></div>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: C.ink, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}><Minus size={16} color={C.parchment} /></button>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.parchment, fontSize: 23, fontWeight: 700, minWidth: 40, textAlign: "center" }}>{quantity}</span>
              <button onClick={() => setQuantity((q) => Math.min(variant.stock_available, q + 1))} className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: C.ink, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}><Plus size={16} color={C.parchment} /></button>
            </div>
          </div>
        )}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={Plus} disabled={!variant} onClick={() => onAdd(variant, quantity)}>Add to Cart</PrimaryButton>
      </div>
    </div>
  );
}

function CartCheckoutSheet({ crew, session, cart, onUpdateQuantity, onRemove, onClose, onComplete }) {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lineErrors, setLineErrors] = useState({});

  const total = cart.reduce((s, l) => s + l.variant.price * l.quantity, 0);

  const checkout = async () => {
    if (cart.length === 0) return;
    setSaving(true); setError(""); setLineErrors({});
    const checkoutId = crypto.randomUUID();
    const failures = {};
    const succeededKeys = [];

    // Each line gets its own independent atomic check — if one item
    // sold out between adding to cart and checkout, only that line
    // fails; everything else in the cart still goes through.
    for (const line of cart) {
      const { data, error } = await supabase.rpc("sell_merch_item", {
        p_variant_id: line.variant.id, p_quantity: line.quantity, p_session_id: session.id, p_payment_method: paymentMethod, p_checkout_id: checkoutId,
      });
      const result = data?.[0];
      if (error || !result?.success) {
        failures[line.key] = result?.message || error?.message || "Failed";
      } else {
        succeededKeys.push(line.key);
      }
    }

    setSaving(false);
    if (Object.keys(failures).length > 0) {
      setLineErrors(failures);
      setError(`${succeededKeys.length} of ${cart.length} item(s) went through — the rest need attention below.`);
      onComplete(cart.filter((l) => failures[l.key])); // keep only the failed lines in the cart for retry/removal
      return;
    }
    onComplete([]); // everything succeeded, cart is now empty
  };

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18.5, fontWeight: 600 }}>Checkout</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3" style={{ background: C.inkSoft }}>
        {cart.map((line) => (
          <div key={line.key} className="rounded-xl p-3.5" style={{ background: C.ink, border: `1px solid ${lineErrors[line.key] ? C.alert : C.inkLine}` }}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ color: C.parchment, fontSize: 15.5, fontWeight: 600 }}>{line.item.name}{line.variant.variant_label ? ` — ${line.variant.variant_label}` : ""}</div>
                <div style={{ color: C.ink40, fontSize: 13.5, marginTop: 2 }}>{formatIDR(line.variant.price)} each</div>
              </div>
              <button onClick={() => onRemove(line.key)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={15} color={C.ink40} /></button>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-2.5">
                <button onClick={() => onUpdateQuantity(line.key, line.quantity - 1)} className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: C.inkSoft, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}><Minus size={13} color={C.parchment} /></button>
                <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.parchment, fontSize: 16.5, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{line.quantity}</span>
                <button onClick={() => onUpdateQuantity(line.key, Math.min(line.variant.stock_available, line.quantity + 1))} className="flex items-center justify-center rounded-full" style={{ width: 30, height: 30, background: C.inkSoft, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}><Plus size={13} color={C.parchment} /></button>
              </div>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.gold, fontSize: 16.5, fontWeight: 700 }}>{formatIDR(line.variant.price * line.quantity)}</span>
            </div>
            {lineErrors[line.key] && <div style={{ color: C.alert, fontSize: 13.5, marginTop: 8 }}>{lineErrors[line.key]}</div>}
          </div>
        ))}
        {cart.length === 0 && <div style={{ color: C.ok, fontSize: 15.5, textAlign: "center", marginTop: 20 }}>✓ All items went through.</div>}

        {cart.length > 0 && (
          <>
            <div>
              <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, marginBottom: 8 }}>Payment method <span style={{ color: C.ink40, fontWeight: 500 }}>(one method for the whole cart)</span></div>
              <Dropdown value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHOD_OPTIONS} />
            </div>
            <div className="rounded-xl px-4 py-3.5 flex items-center justify-between" style={{ background: C.ink, border: `1px solid ${C.gold}66` }}>
              <span style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600 }}>Total</span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.gold, fontSize: 21, fontWeight: 700 }}>{formatIDR(total)}</span>
            </div>
          </>
        )}
        {error && <div className="flex items-center gap-2" style={{ color: C.alert, fontSize: 14.5 }}><AlertTriangle size={15} />{error}</div>}
      </div>
      {cart.length > 0 && (
        <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
          <PrimaryButton icon={Check} disabled={saving} onClick={checkout}>{saving ? "Processing…" : `Complete Sale — ${formatIDR(total)}`}</PrimaryButton>
        </div>
      )}
    </div>
  );
}
