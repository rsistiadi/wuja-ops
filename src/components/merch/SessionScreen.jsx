import React, { useState, useEffect } from "react";
import { PlayCircle, StopCircle, AlertTriangle, Check } from "lucide-react";
import { C } from "../../lib/tokens";
import { PrimaryButton } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { formatIDR } from "../../lib/merch";

export default function SessionScreen({ crew, session, onSessionChange }) {
  if (session === undefined) return <div className="flex-1 flex items-center justify-center" style={{ background: C.inkSoft, color: C.ink40, fontSize: 14.5 }}>Loading…</div>;
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
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18.5, fontWeight: 600, marginBottom: 4 }}>Open the day</div>
        <div style={{ color: C.ink60, fontSize: 14.5, marginBottom: 16 }}>Count the cash physically in the drawer right now, before any sales.</div>
        <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Starting cash float (IDR)</div>
        <input value={float} onChange={(e) => setFloat(e.target.value)} type="number" placeholder="e.g. 500000"
          style={{ width: "100%", background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 18.5, padding: "12px 14px", outline: "none", fontFamily: "JetBrains Mono, monospace" }} />
        {error && <div style={{ color: C.alert, fontSize: 14.5, marginTop: 10 }}>{error}</div>}
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
        <div className="flex items-center gap-2 mb-3"><div style={{ width: 8, height: 8, borderRadius: 999, background: C.ok }} /><span style={{ color: C.ok, fontSize: 14.5, fontWeight: 700 }}>SESSION OPEN</span></div>
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
  const [reasons, setReasons] = useState({});
  const [expectedCash, setExpectedCash] = useState(null);
  const [countedCash, setCountedCash] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("merch_item_variants").select("id, variant_label, stock_available, merch_items(name)").then(({ data }) => setVariants(data || []));
    supabase.from("merch_sales").select("total_price").eq("session_id", session.id).eq("status", "completed").eq("payment_method", "cash")
      .then(({ data }) => setExpectedCash(session.opening_cash_float + (data || []).reduce((s, r) => s + Number(r.total_price), 0)));
  }, [session.id, session.opening_cash_float]);

  const cashVariance = expectedCash !== null && countedCash !== "" ? parseFloat(countedCash) - expectedCash : null;

  const submit = async () => {
    const counted = parseFloat(countedCash);
    if (isNaN(counted) || counted < 0) { setError("Enter the actual counted cash amount."); return; }
    if (variants.some((v) => counts[v.id] === undefined || counts[v.id] === "")) { setError("Enter a physical count for every item."); return; }
    if (cashVariance !== 0 && !cashReason.trim()) { setError("Cash doesn't match — a reason is required before closing."); return; }
    for (const v of variants) {
      const variance = parseInt(counts[v.id], 10) - v.stock_available;
      if (variance !== 0 && !(reasons[v.id] || "").trim()) { setError(`"${v.merch_items?.name}${v.variant_label ? " — " + v.variant_label : ""}" doesn't match — a reason is required.`); return; }
    }

    setSaving(true); setError("");
    const { data, error } = await supabase.rpc("close_merch_session", {
      p_session_id: session.id,
      p_counted_cash: counted,
      p_cash_variance_reason: cashReason.trim() || null,
      p_stock_counts: variants.map((v) => ({ variant_id: v.id, counted_available: parseInt(counts[v.id], 10), reason: reasons[v.id]?.trim() || null })),
    });
    setSaving(false);
    const result = data?.[0];
    if (error || !result?.success) { setError(result?.message || error?.message || "Failed to close."); return; }
    onClosed();
    onClose();
  };

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 20, fontWeight: 600 }}>Close the day</div>
        <div style={{ color: C.ink60, fontSize: 14.5 }}>Count everything physically — any mismatch needs a reason, and is applied + approved as you close.</div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4" style={{ background: C.inkSoft }}>
        <div className="rounded-xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <div style={{ color: C.gold, fontSize: 15.5, fontWeight: 700, marginBottom: 10 }}>CASH</div>
          <Row label="Expected in drawer" value={expectedCash !== null ? formatIDR(expectedCash) : "…"} />
          <div style={{ color: C.ink60, fontSize: 14.5, fontWeight: 600, margin: "10px 0 6px" }}>Physically counted (IDR)</div>
          <input value={countedCash} onChange={(e) => setCountedCash(e.target.value)} type="number" placeholder="0"
            style={{ width: "100%", background: C.inkSoft, border: `1px solid ${C.inkLine}`, borderRadius: 10, color: C.parchment, fontSize: 18.5, padding: "10px 12px", outline: "none", fontFamily: "JetBrains Mono, monospace" }} />
          {cashVariance !== null && (
            <div style={{ color: cashVariance === 0 ? C.ok : C.alert, fontSize: 15.5, fontWeight: 700, marginTop: 8 }}>
              {cashVariance === 0 ? "✓ Matches exactly" : `Variance: ${cashVariance > 0 ? "+" : ""}${formatIDR(cashVariance)}`}
            </div>
          )}
          {cashVariance !== null && cashVariance !== 0 && (
            <input value={cashReason} onChange={(e) => setCashReason(e.target.value)} placeholder="Reason for the cash discrepancy…"
              style={{ width: "100%", background: C.inkSoft, border: `1px solid ${C.alert}88`, borderRadius: 10, color: C.parchment, fontSize: 15.5, padding: "10px 12px", outline: "none", marginTop: 8 }} />
          )}
        </div>

        <div className="rounded-xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <div style={{ color: C.gold, fontSize: 15.5, fontWeight: 700, marginBottom: 10 }}>STOCK — count each item physically</div>
          {!variants && <div style={{ color: C.ink40, fontSize: 15.5 }}>Loading…</div>}
          {variants && variants.length === 0 && <div style={{ color: C.ink40, fontSize: 15.5 }}>No items in the catalog.</div>}
          {variants && variants.map((v) => {
            const label = v.variant_label ? `${v.merch_items?.name} — ${v.variant_label}` : v.merch_items?.name;
            const count = counts[v.id];
            const variance = count !== undefined && count !== "" ? parseInt(count, 10) - v.stock_available : null;
            return (
              <div key={v.id} className="py-2" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div style={{ color: C.parchment, fontSize: 15.5, fontWeight: 600 }}>{label}</div>
                    <div style={{ color: C.ink40, fontSize: 13.5 }}>Expected: {v.stock_available}</div>
                  </div>
                  <input value={count ?? ""} onChange={(e) => setCounts((prev) => ({ ...prev, [v.id]: e.target.value }))} type="number" placeholder="count"
                    style={{ width: 76, background: C.inkSoft, border: `1px solid ${variance !== null && variance !== 0 ? C.alert : C.inkLine}`, borderRadius: 8, color: C.parchment, fontSize: 16.5, padding: "8px 8px", outline: "none", textAlign: "center", fontFamily: "JetBrains Mono, monospace" }} />
                </div>
                {variance !== null && variance !== 0 && (
                  <input value={reasons[v.id] || ""} onChange={(e) => setReasons((prev) => ({ ...prev, [v.id]: e.target.value }))} placeholder={`Reason (off by ${variance > 0 ? "+" : ""}${variance})…`}
                    style={{ width: "100%", background: C.inkSoft, border: `1px solid ${C.alert}88`, borderRadius: 8, color: C.parchment, fontSize: 14.5, padding: "8px 10px", outline: "none", marginTop: 6 }} />
                )}
              </div>
            );
          })}
        </div>

        {error && <div className="flex items-center gap-2" style={{ color: C.alert, fontSize: 15.5 }}><AlertTriangle size={15} />{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3 flex gap-2" style={{ background: C.inkSoft }}>
        <button onClick={onClose} className="flex-1 rounded-xl" style={{ background: "transparent", border: `1px solid ${C.inkLine}`, color: C.ink60, fontWeight: 600, fontSize: 16.5, padding: "12px 0", cursor: "pointer" }}>Cancel</button>
        <div className="flex-[2]"><PrimaryButton icon={Check} disabled={saving} onClick={submit}>{saving ? "Closing…" : "Confirm Close"}</PrimaryButton></div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1">
      <span style={{ color: C.ink40, fontSize: 13.5 }}>{label}</span>
      <span style={{ fontFamily: "JetBrains Mono, monospace", color: C.parchment, fontSize: 13.5 }}>{value}</span>
    </div>
  );
}
