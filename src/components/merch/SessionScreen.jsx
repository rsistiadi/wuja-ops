import React, { useState, useEffect } from "react";
import { PlayCircle, StopCircle, AlertTriangle, Check } from "lucide-react";
import { C } from "../../lib/tokens";
import { PrimaryButton } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { formatIDR } from "../../lib/merch";

export default function SessionScreen({ crew, session, onSessionChange }) {
  if (session === undefined) return <div className="flex-1 flex items-center justify-center" style={{ background: C.inkSoft, color: C.ink40, fontSize: 13.5 }}>Loading…</div>;
  return session ? <OpenSessionView crew={crew} session={session} onSessionChange={onSessionChange} /> : <OpenDayForm crew={crew} onSessionChange={onSessionChange} />;
}

function OpenDayForm({ crew, onSessionChange }) {
  const [float, setFloat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openDay = async () => {
    const amount = parseFloat(float);
    if (isNaN(amount) || amount < 0) { setError("Enter a valid starting cash amount."); return; }
    setSaving(true); setError("");
    const { error } = await supabase.from("merch_sessions").insert({ opened_by_crew_id: crew.id, opening_cash_float: amount });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSessionChange();
  };

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-4" style={{ background: C.inkSoft }}>
      <div className="rounded-2xl p-5" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Open the day</div>
        <div style={{ color: C.ink60, fontSize: 13, marginBottom: 16 }}>Count the cash physically in the drawer right now, before any sales.</div>
        <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Starting cash float (IDR)</div>
        <input value={float} onChange={(e) => setFloat(e.target.value)} type="number" placeholder="e.g. 500000"
          style={{ width: "100%", background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 17, padding: "12px 14px", outline: "none", fontFamily: "JetBrains Mono, monospace" }} />
        {error && <div style={{ color: C.alert, fontSize: 13, marginTop: 10 }}>{error}</div>}
      </div>
      <PrimaryButton icon={PlayCircle} disabled={saving} onClick={openDay}>{saving ? "Opening…" : "Open Day"}</PrimaryButton>
    </div>
  );
}

function OpenSessionView({ crew, session, onSessionChange }) {
  const [salesTotal, setSalesTotal] = useState(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    supabase.from("merch_sales").select("total_price, payment_method").eq("session_id", session.id).eq("status", "completed")
      .then(({ data }) => {
        const rows = data || [];
        const byMethod = { cash: 0, qris: 0, card: 0 };
        for (const r of rows) byMethod[r.payment_method] += Number(r.total_price);
        setSalesTotal({ ...byMethod, all: rows.reduce((s, r) => s + Number(r.total_price), 0), count: rows.length });
      });
  }, [session.id]);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-4" style={{ background: C.inkSoft }}>
      <div className="rounded-2xl p-5" style={{ background: C.ink, border: `1px solid ${C.ok}66` }}>
        <div className="flex items-center gap-2 mb-3"><div style={{ width: 8, height: 8, borderRadius: 999, background: C.ok }} /><span style={{ color: C.ok, fontSize: 13, fontWeight: 700 }}>SESSION OPEN</span></div>
        <Row label="Opened" value={new Date(session.opened_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} />
        <Row label="Opening float" value={formatIDR(session.opening_cash_float)} />
        {salesTotal && (
          <>
            <Row label="Sales so far" value={`${salesTotal.count} · ${formatIDR(salesTotal.all)}`} />
            <Row label="— Cash" value={formatIDR(salesTotal.cash)} />
            <Row label="— QRIS" value={formatIDR(salesTotal.qris)} />
            <Row label="— Card" value={formatIDR(salesTotal.card)} />
          </>
        )}
      </div>
      <PrimaryButton icon={StopCircle} onClick={() => setClosing(true)}>Close Day</PrimaryButton>
      {closing && <CloseDaySheet crew={crew} session={session} onClose={() => setClosing(false)} onClosed={onSessionChange} />}
    </div>
  );
}

function CloseDaySheet({ crew, session, onClose, onClosed }) {
  const [variants, setVariants] = useState(null);
  const [counts, setCounts] = useState({});
  const [expectedCash, setExpectedCash] = useState(null);
  const [countedCash, setCountedCash] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("merch_item_variants").select("id, variant_label, stock_available, merch_items(name)").then(({ data }) => setVariants(data || []));
    supabase.from("merch_sales").select("total_price").eq("session_id", session.id).eq("status", "completed").eq("payment_method", "cash")
      .then(({ data }) => setExpectedCash(session.opening_cash_float + (data || []).reduce((s, r) => s + Number(r.total_price), 0)));
  }, [session.id, session.opening_cash_float]);

  const submit = async () => {
    const counted = parseFloat(countedCash);
    if (isNaN(counted) || counted < 0) { setError("Enter the actual counted cash amount."); return; }
    if (variants.some((v) => counts[v.id] === undefined || counts[v.id] === "")) { setError("Enter a physical count for every item."); return; }

    setSaving(true); setError("");
    const variance = counted - expectedCash;

    const reconRows = variants.map((v) => ({
      session_id: session.id,
      variant_id: v.id,
      expected_available: v.stock_available,
      counted_available: parseInt(counts[v.id], 10),
      variance: parseInt(counts[v.id], 10) - v.stock_available,
    }));
    const { error: reconErr } = await supabase.from("merch_stock_reconciliation").insert(reconRows);
    if (reconErr) { setSaving(false); setError(reconErr.message); return; }

    const { error: closeErr } = await supabase.from("merch_sessions").update({
      closed_at: new Date().toISOString(), closed_by_crew_id: crew.id,
      closing_cash_counted: counted, closing_cash_expected: expectedCash, cash_variance: variance,
    }).eq("id", session.id).is("closed_at", null); // guard: someone else may have already closed it
    setSaving(false);
    if (closeErr) { setError(closeErr.message); return; }
    onClosed();
    onClose();
  };

  const cashVariance = expectedCash !== null && countedCash !== "" ? parseFloat(countedCash) - expectedCash : null;

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600 }}>Close the day</div>
        <div style={{ color: C.ink60, fontSize: 12.5 }}>Count everything physically — cash and stock — before confirming.</div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4" style={{ background: C.inkSoft }}>
        <div className="rounded-xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <div style={{ color: C.gold, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>CASH</div>
          <Row label="Expected in drawer" value={expectedCash !== null ? formatIDR(expectedCash) : "…"} />
          <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600, margin: "10px 0 6px" }}>Physically counted (IDR)</div>
          <input value={countedCash} onChange={(e) => setCountedCash(e.target.value)} type="number" placeholder="0"
            style={{ width: "100%", background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 10, color: C.parchment, fontSize: 15.5, padding: "10px 12px", outline: "none", fontFamily: "JetBrains Mono, monospace" }} />
          {cashVariance !== null && (
            <div style={{ color: cashVariance === 0 ? C.ok : C.alert, fontSize: 13, fontWeight: 700, marginTop: 8 }}>
              {cashVariance === 0 ? "✓ Matches exactly" : `Variance: ${cashVariance > 0 ? "+" : ""}${formatIDR(cashVariance)}`}
            </div>
          )}
        </div>

        <div className="rounded-xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <div style={{ color: C.gold, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>STOCK — count each item physically</div>
          {!variants && <div style={{ color: C.ink40, fontSize: 13 }}>Loading…</div>}
          {variants && variants.length === 0 && <div style={{ color: C.ink40, fontSize: 13 }}>No items in the catalog.</div>}
          {variants && variants.map((v) => {
            const label = v.variant_label ? `${v.merch_items?.name} — ${v.variant_label}` : v.merch_items?.name;
            const count = counts[v.id];
            const variance = count !== undefined && count !== "" ? parseInt(count, 10) - v.stock_available : null;
            return (
              <div key={v.id} className="flex items-center justify-between gap-2 py-2" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
                <div className="flex-1">
                  <div style={{ color: C.parchment, fontSize: 13, fontWeight: 600 }}>{label}</div>
                  <div style={{ color: C.ink40, fontSize: 11 }}>Expected: {v.stock_available}</div>
                </div>
                <input value={count ?? ""} onChange={(e) => setCounts((prev) => ({ ...prev, [v.id]: e.target.value }))} type="number" placeholder="count"
                  style={{ width: 72, background: C.inkSoft, border: `1px solid ${variance !== null && variance !== 0 ? C.alert : C.inkLine}`, borderRadius: 8, color: C.parchment, fontSize: 14, padding: "8px 8px", outline: "none", textAlign: "center", fontFamily: "JetBrains Mono, monospace" }} />
              </div>
            );
          })}
        </div>

        {error && <div className="flex items-center gap-2" style={{ color: C.alert, fontSize: 13 }}><AlertTriangle size={14} />{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3 flex gap-2" style={{ background: C.inkSoft }}>
        <button onClick={onClose} className="flex-1 rounded-xl" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.ink60, fontWeight: 600, fontSize: 14.5, padding: "12px 0", cursor: "pointer" }}>Cancel</button>
        <div className="flex-[2]"><PrimaryButton icon={Check} disabled={saving} onClick={submit}>{saving ? "Closing…" : "Confirm Close"}</PrimaryButton></div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1">
      <span style={{ color: C.ink40, fontSize: 12.5 }}>{label}</span>
      <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.parchment, fontSize: 12.5 }}>{value}</span>
    </div>
  );
}
