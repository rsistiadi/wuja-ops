import React, { useState, useEffect } from "react";
import { C } from "../../lib/tokens";
import { supabase } from "../../lib/supabaseClient";
import { formatIDR } from "../../lib/merch";

export default function MerchReports() {
  const [itemBreakdown, setItemBreakdown] = useState(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [voidStats, setVoidStats] = useState(null);

  useEffect(() => {
    supabase.from("merch_sales").select("quantity, total_price, payment_method, merch_item_variants(variant_label, merch_items(name))").eq("status", "completed")
      .then(({ data }) => {
        const rows = data || [];
        const byItem = {};
        const byPayment = { cash: 0, qris: 0, card: 0 };
        for (const r of rows) {
          const label = r.merch_item_variants ? `${r.merch_item_variants.merch_items?.name}${r.merch_item_variants.variant_label ? " — " + r.merch_item_variants.variant_label : ""}` : "Item";
          byItem[label] = byItem[label] || { qty: 0, total: 0 };
          byItem[label].qty += r.quantity;
          byItem[label].total += Number(r.total_price);
          byPayment[r.payment_method] += Number(r.total_price);
        }
        setItemBreakdown(Object.entries(byItem).sort((a, b) => b[1].total - a[1].total));
        setPaymentBreakdown(byPayment);
      });

    supabase.from("merch_sessions").select("*").order("opened_at", { ascending: false }).limit(30)
      .then(({ data }) => setSessions(data || []));

    supabase.from("merch_voids").select("status", { count: "exact" }).then(async () => {
      const [{ count: pending }, { count: approved }, { count: rejected }] = await Promise.all([
        supabase.from("merch_voids").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("merch_voids").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("merch_voids").select("id", { count: "exact", head: true }).eq("status", "rejected"),
      ]);
      setVoidStats({ pending: pending || 0, approved: approved || 0, rejected: rejected || 0 });
    });
  }, []);

  const grandTotal = paymentBreakdown ? paymentBreakdown.cash + paymentBreakdown.qris + paymentBreakdown.card : 0;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6" style={{ background: C.inkSoft }}>
      <div>
        <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>TOTAL REVENUE</div>
        <div className="rounded-2xl p-5" style={{ background: C.ink, border: `1px solid ${C.gold}66` }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", color: C.gold, fontSize: 26, fontWeight: 700 }}>{formatIDR(grandTotal)}</div>
          {paymentBreakdown && (
            <div className="flex gap-4 mt-2">
              <span style={{ color: C.ink60, fontSize: 12 }}>Cash: {formatIDR(paymentBreakdown.cash)}</span>
              <span style={{ color: C.ink60, fontSize: 12 }}>QRIS: {formatIDR(paymentBreakdown.qris)}</span>
              <span style={{ color: C.ink60, fontSize: 12 }}>Card: {formatIDR(paymentBreakdown.card)}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>BY ITEM</div>
        {itemBreakdown === null && <div style={{ color: C.ink40, fontSize: 13 }}>Loading…</div>}
        {itemBreakdown?.length === 0 && <div style={{ color: C.ink40, fontSize: 13 }}>No sales yet.</div>}
        {itemBreakdown?.map(([label, stats]) => (
          <div key={label} className="flex items-center justify-between py-2" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
            <span style={{ color: C.parchment, fontSize: 13.5 }}>{label}</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink60, fontSize: 12.5 }}>{stats.qty} sold · {formatIDR(stats.total)}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>VOIDS</div>
        {voidStats && (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Pending" value={voidStats.pending} color={C.gold} />
            <Stat label="Approved" value={voidStats.approved} color={C.ok} />
            <Stat label="Rejected" value={voidStats.rejected} color={C.ink60} />
          </div>
        )}
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>SESSION HISTORY</div>
        {sessions === null && <div style={{ color: C.ink40, fontSize: 13 }}>Loading…</div>}
        {sessions?.map((s) => (
          <div key={s.id} className="rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div className="flex items-center justify-between">
              <span style={{ color: C.parchment, fontSize: 13, fontWeight: 600 }}>{new Date(s.opened_at).toLocaleDateString([], { dateStyle: "medium" })}</span>
              <span className="rounded-full" style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", background: s.closed_at ? `${C.ok}22` : `${C.gold}22`, color: s.closed_at ? C.ok : C.gold }}>{s.closed_at ? "CLOSED" : "OPEN"}</span>
            </div>
            {s.closed_at && (
              <div style={{ color: C.ink40, fontSize: 11.5, marginTop: 4 }}>
                Cash variance: <span style={{ color: s.cash_variance === 0 ? C.ok : C.alert, fontWeight: 700 }}>{s.cash_variance > 0 ? "+" : ""}{formatIDR(s.cash_variance)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-lg text-center py-3" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
      <div style={{ fontFamily: "JetBrains Mono, monospace", color, fontSize: 19, fontWeight: 700 }}>{value}</div>
      <div style={{ color: C.ink40, fontSize: 10.5, fontWeight: 600 }}>{label.toUpperCase()}</div>
    </div>
  );
}
