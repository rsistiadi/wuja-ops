import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { C } from "../../lib/tokens";
import { supabase } from "../../lib/supabaseClient";
import { formatIDR } from "../../lib/merch";

export default function MerchReports() {
  const [itemBreakdown, setItemBreakdown] = useState(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [dailyRevenue, setDailyRevenue] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [discrepancyDays, setDiscrepancyDays] = useState(null);
  const [voidStats, setVoidStats] = useState(null);

  useEffect(() => {
    supabase.from("merch_sales").select("quantity, total_price, payment_method, sold_at, merch_item_variants(variant_label, merch_items(name))").eq("status", "completed")
      .then(({ data }) => {
        const rows = data || [];
        const byItem = {};
        const byPayment = { cash: 0, qris: 0, card: 0 };
        const byDay = {};
        for (const r of rows) {
          const label = r.merch_item_variants ? `${r.merch_item_variants.merch_items?.name}${r.merch_item_variants.variant_label ? " — " + r.merch_item_variants.variant_label : ""}` : "Item";
          byItem[label] = byItem[label] || { qty: 0, total: 0 };
          byItem[label].qty += r.quantity;
          byItem[label].total += Number(r.total_price);
          byPayment[r.payment_method] += Number(r.total_price);
          const day = new Date(r.sold_at).toLocaleDateString("en-CA"); // YYYY-MM-DD, stable sort key
          byDay[day] = (byDay[day] || 0) + Number(r.total_price);
        }
        setItemBreakdown(Object.entries(byItem).sort((a, b) => b[1].total - a[1].total));
        setPaymentBreakdown(byPayment);
        setDailyRevenue(Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])));
      });

    supabase.from("merch_sessions").select("*").order("opened_at", { ascending: false }).limit(30)
      .then(({ data }) => {
        setSessions(data || []);
        const flagged = (data || []).filter((s) => s.cash_variance && Number(s.cash_variance) !== 0);
        setDiscrepancyDays((prev) => ({ ...prev, cashDays: flagged }));
      });

    supabase.from("merch_stock_reconciliation").select("*, merch_item_variants(variant_label, merch_items(name)), merch_sessions(opened_at)")
      .neq("variance", 0).order("created_at", { ascending: false })
      .then(({ data }) => setDiscrepancyDays((prev) => ({ ...prev, stockRows: data || [] })));

    Promise.all([
      supabase.from("merch_voids").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("merch_voids").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("merch_voids").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    ]).then(([{ count: pending }, { count: approved }, { count: rejected }]) => {
      setVoidStats({ pending: pending || 0, approved: approved || 0, rejected: rejected || 0 });
    });
  }, []);

  const grandTotal = paymentBreakdown ? paymentBreakdown.cash + paymentBreakdown.qris + paymentBreakdown.card : 0;
  const todayKey = new Date().toLocaleDateString("en-CA");
  const todayRevenue = dailyRevenue?.find(([day]) => day === todayKey)?.[1] || 0;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6" style={{ background: C.inkSoft }}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: C.ink, border: `1px solid ${C.gold}66` }}>
          <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>TODAY</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", color: C.gold, fontSize: 21, fontWeight: 700 }}>{formatIDR(todayRevenue)}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>ALL-TIME TOTAL</div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", color: C.parchment, fontSize: 21, fontWeight: 700 }}>{formatIDR(grandTotal)}</div>
        </div>
      </div>
      {paymentBreakdown && (
        <div className="flex gap-4">
          <span style={{ color: C.ink60, fontSize: 14.5 }}>Cash: {formatIDR(paymentBreakdown.cash)}</span>
          <span style={{ color: C.ink60, fontSize: 14.5 }}>QRIS: {formatIDR(paymentBreakdown.qris)}</span>
          <span style={{ color: C.ink60, fontSize: 14.5 }}>Card: {formatIDR(paymentBreakdown.card)}</span>
        </div>
      )}

      <div>
        <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 700, marginBottom: 8 }}>REVENUE BY DAY</div>
        {dailyRevenue === null && <div style={{ color: C.ink40, fontSize: 15.5 }}>Loading…</div>}
        {dailyRevenue?.length === 0 && <div style={{ color: C.ink40, fontSize: 15.5 }}>No sales yet.</div>}
        {dailyRevenue?.map(([day, total]) => (
          <div key={day} className="flex items-center justify-between py-2" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
            <span style={{ color: C.parchment, fontSize: 15.5 }}>{new Date(day + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.gold, fontSize: 15.5, fontWeight: 700 }}>{formatIDR(total)}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 700, marginBottom: 8 }}>BY ITEM</div>
        {itemBreakdown === null && <div style={{ color: C.ink40, fontSize: 15.5 }}>Loading…</div>}
        {itemBreakdown?.length === 0 && <div style={{ color: C.ink40, fontSize: 15.5 }}>No sales yet.</div>}
        {itemBreakdown?.map(([label, stats]) => (
          <div key={label} className="flex items-center justify-between py-2" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
            <span style={{ color: C.parchment, fontSize: 15.5 }}>{label}</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.ink60, fontSize: 14.5 }}>{stats.qty} sold · {formatIDR(stats.total)}</span>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={15} color={C.alert} />
          <span style={{ color: C.ink60, fontSize: 14.5, fontWeight: 700 }}>DISCREPANCY DAYS</span>
        </div>
        {(!discrepancyDays || (discrepancyDays.cashDays === undefined && discrepancyDays.stockRows === undefined)) && <div style={{ color: C.ink40, fontSize: 15.5 }}>Loading…</div>}
        {discrepancyDays && (discrepancyDays.cashDays?.length || 0) === 0 && (discrepancyDays.stockRows?.length || 0) === 0 && (
          <div style={{ color: C.ok, fontSize: 15.5 }}>✓ No discrepancies recorded.</div>
        )}
        {discrepancyDays?.cashDays?.map((s) => (
          <div key={s.id} className="rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.alert}66` }}>
            <div className="flex items-center justify-between">
              <span style={{ color: C.parchment, fontSize: 15.5, fontWeight: 600 }}>{new Date(s.opened_at).toLocaleDateString([], { dateStyle: "medium" })} — Cash</span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.alert, fontSize: 15.5, fontWeight: 700 }}>{s.cash_variance > 0 ? "+" : ""}{formatIDR(s.cash_variance)}</span>
            </div>
            {s.cash_variance_reason && <div style={{ color: C.ink60, fontSize: 14.5, marginTop: 4, fontStyle: "italic" }}>"{s.cash_variance_reason}"</div>}
            <div style={{ color: s.cash_variance_approved_at ? C.ok : C.gold, fontSize: 13.5, fontWeight: 700, marginTop: 4 }}>{s.cash_variance_approved_at ? "✓ Approved" : "Pending approval"}</div>
          </div>
        ))}
        {discrepancyDays?.stockRows?.map((r) => {
          const label = r.merch_item_variants ? `${r.merch_item_variants.merch_items?.name}${r.merch_item_variants.variant_label ? " — " + r.merch_item_variants.variant_label : ""}` : "Item";
          return (
            <div key={r.id} className="rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.alert}66` }}>
              <div className="flex items-center justify-between">
                <span style={{ color: C.parchment, fontSize: 15.5, fontWeight: 600 }}>{new Date(r.merch_sessions?.opened_at).toLocaleDateString([], { dateStyle: "medium" })} — {label}</span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.alert, fontSize: 15.5, fontWeight: 700 }}>{r.variance > 0 ? "+" : ""}{r.variance}</span>
              </div>
              {r.reason && <div style={{ color: C.ink60, fontSize: 14.5, marginTop: 4, fontStyle: "italic" }}>"{r.reason}"</div>}
              <div style={{ color: r.approved_at ? C.ok : C.gold, fontSize: 13.5, fontWeight: 700, marginTop: 4 }}>{r.approved_at ? "✓ Approved — stock corrected" : "Pending approval"}</div>
            </div>
          );
        })}
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 700, marginBottom: 8 }}>VOIDS</div>
        {voidStats && (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Pending" value={voidStats.pending} color={C.gold} />
            <Stat label="Approved" value={voidStats.approved} color={C.ok} />
            <Stat label="Rejected" value={voidStats.rejected} color={C.ink60} />
          </div>
        )}
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 700, marginBottom: 8 }}>SESSION HISTORY</div>
        {sessions === null && <div style={{ color: C.ink40, fontSize: 15.5 }}>Loading…</div>}
        {sessions?.map((s) => (
          <div key={s.id} className="rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <div className="flex items-center justify-between">
              <span style={{ color: C.parchment, fontSize: 15.5, fontWeight: 600 }}>{new Date(s.opened_at).toLocaleDateString([], { dateStyle: "medium" })}</span>
              <span className="rounded-full" style={{ fontSize: 12.5, fontWeight: 700, padding: "3px 9px", background: s.closed_at ? `${C.ok}22` : `${C.gold}22`, color: s.closed_at ? C.ok : C.gold }}>{s.closed_at ? "CLOSED" : "OPEN"}</span>
            </div>
            {s.closed_at && (
              <div style={{ color: C.ink40, fontSize: 13.5, marginTop: 4 }}>
                Cash variance: <span style={{ color: Number(s.cash_variance) === 0 ? C.ok : C.alert, fontWeight: 700 }}>{s.cash_variance > 0 ? "+" : ""}{formatIDR(s.cash_variance)}</span>
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
      <div style={{ fontFamily: "JetBrains Mono, monospace", color, fontSize: 21, fontWeight: 700 }}>{value}</div>
      <div style={{ color: C.ink40, fontSize: 12.5, fontWeight: 600 }}>{label.toUpperCase()}</div>
    </div>
  );
}
