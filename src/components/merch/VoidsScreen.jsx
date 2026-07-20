import React, { useState, useEffect } from "react";
import { Plus, X, Check, XCircle } from "lucide-react";
import { C } from "../../lib/tokens";
import { PrimaryButton } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { formatIDR } from "../../lib/merch";

export default function VoidsScreen({ crew, isAdmin, merchAccess }) {
  const [voids, setVoids] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [approving, setApproving] = useState(null); // void row

  const refetch = () => {
    supabase.from("merch_voids")
      .select("*, merch_sales(quantity, total_price, sold_at, merch_item_variants(variant_label, merch_items(name)))")
      .order("requested_at", { ascending: false })
      .then(({ data }) => setVoids(data || []));
  };
  useEffect(() => { refetch(); }, []);

  const pending = (voids || []).filter((v) => v.status === "pending");
  const resolved = (voids || []).filter((v) => v.status !== "pending");

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4" style={{ background: C.inkSoft }}>
      {merchAccess && <PrimaryButton icon={Plus} onClick={() => setRequesting(true)}>Request a Void</PrimaryButton>}

      <div>
        <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>PENDING · {pending.length}</div>
        {pending.length === 0 && <div style={{ color: C.ink40, fontSize: 13 }}>None.</div>}
        {pending.map((v) => (
          <VoidCard key={v.id} v={v} onClick={isAdmin ? () => setApproving(v) : undefined} />
        ))}
      </div>

      <div>
        <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>RESOLVED</div>
        {resolved.map((v) => <VoidCard key={v.id} v={v} />)}
      </div>

      {requesting && <RequestVoidSheet crew={crew} onClose={() => setRequesting(false)} onRequested={() => { setRequesting(false); refetch(); }} />}
      {approving && <ApproveSheet voidRow={approving} onClose={() => setApproving(null)} onDone={() => { setApproving(null); refetch(); }} />}
    </div>
  );
}

function VoidCard({ v, onClick }) {
  const sale = v.merch_sales;
  const label = sale?.merch_item_variants ? `${sale.merch_item_variants.merch_items?.name}${sale.merch_item_variants.variant_label ? " — " + sale.merch_item_variants.variant_label : ""}` : "Item";
  const statusColor = v.status === "pending" ? C.gold : v.status === "approved" ? C.ok : C.alert;
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper onClick={onClick} className="w-full text-left rounded-xl p-3.5 mb-2" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, cursor: onClick ? "pointer" : "default" }}>
      <div className="flex items-center justify-between">
        <span style={{ color: C.parchment, fontSize: 13.5, fontWeight: 600 }}>{label} × {sale?.quantity}</span>
        <span className="rounded-full" style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", background: `${statusColor}22`, color: statusColor }}>{v.status.toUpperCase()}</span>
      </div>
      <div style={{ color: C.ink40, fontSize: 11.5, marginTop: 4 }}>{formatIDR(sale?.total_price)} · requested: "{v.requested_reason}"</div>
      {v.approved_reason && <div style={{ color: C.ink40, fontSize: 11.5, marginTop: 2 }}>{v.status}: "{v.approved_reason}"</div>}
    </Wrapper>
  );
}

function RequestVoidSheet({ crew, onClose, onRequested }) {
  const [sales, setSales] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("merch_sales").select("id, quantity, total_price, sold_at, merch_item_variants(variant_label, merch_items(name))")
      .eq("status", "completed").order("sold_at", { ascending: false }).limit(30)
      .then(({ data }) => setSales(data || []));
  }, []);

  const submit = async () => {
    if (!selected) { setError("Pick the sale to void."); return; }
    if (!reason.trim()) { setError("A reason is required."); return; }
    setSaving(true); setError("");
    const { error } = await supabase.from("merch_voids").insert({ sale_id: selected.id, requested_by_crew_id: crew.id, requested_reason: reason.trim() });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onRequested();
  };

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600 }}>Request a Void</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4" style={{ background: C.inkSoft }}>
        <div style={{ color: C.ink60, fontSize: 13, fontWeight: 600 }}>Which sale?</div>
        <div className="flex flex-col gap-1.5">
          {sales === null && <div style={{ color: C.ink40, fontSize: 13 }}>Loading…</div>}
          {sales?.map((s) => {
            const label = s.merch_item_variants ? `${s.merch_item_variants.merch_items?.name}${s.merch_item_variants.variant_label ? " — " + s.merch_item_variants.variant_label : ""}` : "Item";
            return (
              <button key={s.id} onClick={() => setSelected(s)} className="flex items-center justify-between rounded-lg px-3.5 py-2.5" style={{ background: selected?.id === s.id ? `${C.gold}22` : C.ink, border: `1px solid ${selected?.id === s.id ? C.gold : C.inkLine}`, cursor: "pointer" }}>
                <span style={{ color: C.parchment, fontSize: 13, fontWeight: 600 }}>{label} × {s.quantity}</span>
                <span style={{ color: C.ink40, fontSize: 11.5 }}>{formatIDR(s.total_price)} · {new Date(s.sold_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </button>
            );
          })}
        </div>
        <div>
          <div style={{ color: C.ink60, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Reason</div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What went wrong?" style={{ width: "100%", background: C.ink, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 15, padding: "12px 14px", outline: "none" }} />
        </div>
        {error && <div style={{ color: C.alert, fontSize: 13 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}><PrimaryButton icon={Check} disabled={saving} onClick={submit}>{saving ? "Submitting…" : "Submit Request"}</PrimaryButton></div>
    </div>
  );
}

function ApproveSheet({ voidRow, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState("available");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sale = voidRow.merch_sales;
  const label = sale?.merch_item_variants ? `${sale.merch_item_variants.merch_items?.name}${sale.merch_item_variants.variant_label ? " — " + sale.merch_item_variants.variant_label : ""}` : "Item";

  const action = async (approve) => {
    if (!reason.trim()) { setError("A reason is required either way."); return; }
    setSaving(true); setError("");
    const { data, error } = await supabase.rpc("approve_merch_void", {
      p_void_id: voidRow.id, p_approve: approve, p_approved_reason: reason.trim(), p_disposition: approve ? disposition : null,
    });
    setSaving(false);
    const result = data?.[0];
    if (error || !result?.success) { setError(result?.message || error?.message || "Failed."); return; }
    onDone();
  };

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600 }}>Review Void</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4" style={{ background: C.inkSoft }}>
        <div className="rounded-xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
          <div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>{label} × {sale?.quantity}</div>
          <div style={{ color: C.ink40, fontSize: 12.5, marginTop: 2 }}>{formatIDR(sale?.total_price)}</div>
          <div style={{ color: C.ink60, fontSize: 12.5, marginTop: 8, fontStyle: "italic" }}>Crew's reason: "{voidRow.requested_reason}"</div>
        </div>
        <div>
          <div style={{ color: C.ink60, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>If approving — where does the item go?</div>
          <div className="flex gap-2">
            <button onClick={() => setDisposition("available")} className="flex-1 rounded-lg" style={{ padding: "10px 0", fontSize: 13, fontWeight: 700, background: disposition === "available" ? C.gold : C.ink, color: disposition === "available" ? C.ink : C.ink60, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>Back to available</button>
            <button onClick={() => setDisposition("damaged")} className="flex-1 rounded-lg" style={{ padding: "10px 0", fontSize: 13, fontWeight: 700, background: disposition === "damaged" ? C.gold : C.ink, color: disposition === "damaged" ? C.ink : C.ink60, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>Mark as damaged</button>
          </div>
        </div>
        <div>
          <div style={{ color: C.ink60, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Your reason <span style={{ color: C.ink40, fontWeight: 500 }}>(required either way)</span></div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Confirmed with buyer, item unopened…" style={{ width: "100%", background: C.ink, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 15, padding: "12px 14px", outline: "none" }} />
        </div>
        {error && <div style={{ color: C.alert, fontSize: 13 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3 flex gap-2" style={{ background: C.inkSoft }}>
        <button onClick={() => action(false)} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl" style={{ background: "transparent", border: `1px solid ${C.alert}66`, color: C.alert, fontWeight: 700, fontSize: 14, padding: "12px 0", cursor: "pointer" }}><XCircle size={15} /> Reject</button>
        <button onClick={() => action(true)} disabled={saving} className="flex-[2] flex items-center justify-center gap-1.5 rounded-xl" style={{ background: C.gold, border: "none", color: C.ink, fontWeight: 700, fontSize: 14, padding: "12px 0", cursor: "pointer" }}><Check size={15} /> {saving ? "Saving…" : "Approve"}</button>
      </div>
    </div>
  );
}
