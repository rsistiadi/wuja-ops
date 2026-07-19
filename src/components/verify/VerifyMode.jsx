import React, { useState, useEffect } from "react";
import { Search, Contact, Heart, ScanLine, Pencil, X, Check } from "lucide-react";
import { C, CATEGORY_META, categoryLabel, registrationStatus } from "../../lib/tokens";
import { TopBar, PrimaryButton, PersonTag, StatusPill, PersonAvatar, useDebouncedValue } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { getBadgePhotoUrl } from "../../lib/photoStorage";
import { extractBadgeNumber } from "../../lib/qrScan";
import { lookupByBadgeNumber } from "../../lib/badgeLookup";
import QrScannerView from "../shared/QrScannerView";

export default function VerifyMode({ canEdit }) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 280);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [notFound, setNotFound] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const trimmed = debounced.trim();
    if (trimmed.length < 2) { setResults([]); return; }
    let cancelled = false;
    supabase.from("registrations").select("*").or(`full_name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,badge_number.ilike.%${trimmed}%`).limit(20)
      .then(({ data }) => { if (!cancelled) setResults(data || []); });
    return () => { cancelled = true; };
  }, [debounced]);

  const select = async (reg) => {
    setSelected(reg);
    setPhotoUrl(null);
    if (reg.photo_status === "captured" && reg.photo_url) {
      const url = await getBadgePhotoUrl(reg.photo_url);
      setPhotoUrl(url);
    }
  };

  const onQrDetected = async (decodedText) => {
    setScanning(false);
    const badgeNumber = extractBadgeNumber(decodedText);
    const found = await lookupByBadgeNumber(badgeNumber);
    if (!found) { setNotFound(`No registration matches badge "${badgeNumber}".`); return; }
    setNotFound("");
    select(found);
  };

  return (
    <div className="flex-1 flex flex-col" style={{ position: "relative" }}>
      <TopBar title="Scan & Verify" subtitle="Read-only identity check" accent={C.gold} />

      {!selected ? (
        <>
          <div className="px-5 pb-3" style={{ background: C.ink }}>
            <button onClick={() => { setScanning(true); setNotFound(""); }} className="w-full flex items-center justify-center gap-2.5 rounded-xl mb-3" style={{ background: C.gold, color: C.ink, fontWeight: 700, fontSize: 16.5, padding: "13px 0", border: "none", cursor: "pointer" }}>
              <ScanLine size={18} /> SCAN BADGE
            </button>
            {notFound && <div style={{ color: C.alert, fontSize: 13.5, marginBottom: 8 }}>{notFound}</div>}
            <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
              <Search size={16} color={C.ink60} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Or search name, phone, or badge no."
                className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 15.5, padding: "11px 4px", border: "none" }} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5" style={{ background: C.inkSoft }}>
            {debounced.trim().length < 2 && (
              <div className="flex flex-col items-center mt-16 gap-2">
                <Contact size={28} color={C.ink40} />
                <div style={{ color: C.ink40, fontSize: 13.5, maxWidth: 240, textAlign: "center" }}>General-purpose lookup — no checkpoint, no action, just confirms who someone is.</div>
              </div>
            )}
            {debounced.trim().length >= 2 && results.length === 0 && <div style={{ color: C.ink40, fontSize: 14.5, textAlign: "center", marginTop: 40 }}>No matches.</div>}
            {results.map((r) => (
              <button key={r.id} onClick={() => select(r)} className="flex items-center justify-between rounded-xl px-4 py-3.5" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>
                <div className="text-left">
                  <div style={{ color: C.parchment, fontSize: 15.5, fontWeight: 600 }}>{r.full_name}</div>
                  <div className="flex items-center gap-2 mt-1.5"><PersonTag reg={r} /></div>
                </div>
                <StatusPill reg={r} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col px-5 py-6" style={{ background: C.inkSoft }}>
          <div className="rounded-2xl p-5 flex flex-col items-center" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, position: "relative" }}>
            {canEdit && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5" style={{ position: "absolute", top: 14, right: 14, background: C.inkSoft, border: `1px solid ${C.inkLine}`, color: C.gold, fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>
                <Pencil size={12} /> Edit
              </button>
            )}
            <PersonAvatar reg={selected} photoUrl={photoUrl} size={84} />
            <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 20, fontWeight: 600, marginTop: 12, textAlign: "center" }}>{selected.full_name}</div>
            {selected.title_or_note && <div style={{ color: C.ink60, fontSize: 13, textAlign: "center", marginTop: 4, fontStyle: "italic" }}>{selected.title_or_note}</div>}
            <div className="flex items-center gap-2 mt-2">
              <PersonTag reg={selected} />
              {selected.medical_note && <span className="inline-flex items-center gap-1" style={{ color: C.speaker, fontSize: 12.5, fontWeight: 700 }}><Heart size={11} /> MEDICAL</span>}
            </div>
            <div className="mt-3"><StatusPill reg={selected} /></div>
            <div className="w-full mt-4 pt-4 flex flex-col gap-1.5" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
              <Row label="Badge no." value={selected.badge_number || "— not issued —"} />
              <Row label="Photo on file" value={selected.photo_status === "captured" ? "Yes" : selected.photo_status === "skipped" ? "Skipped" : "No"} color={selected.photo_status === "captured" ? C.ok : C.gold} />
              <Row label="Phone" value={selected.phone || "—"} />
              <Row label="Email" value={selected.email || "—"} />
              {selected.institution && <Row label="Institution" value={selected.institution} />}
            </div>
          </div>
          <div className="mt-5"><PrimaryButton icon={Search} onClick={() => { setSelected(null); setQuery(""); }}>Look up another</PrimaryButton></div>
        </div>
      )}

      {scanning && <QrScannerView title="Scan badge" onResult={onQrDetected} onCancel={() => setScanning(false)} />}
      {editing && <EditRegistrationSheet reg={selected} onClose={() => setEditing(false)} onSaved={(updated) => { setSelected(updated); setEditing(false); }} />}
    </div>
  );
}

// Admin/Superadmin only (gated by canEdit in the parent). Deliberately
// does NOT include category — that was locked down as fixed-forever
// early in this build, editable here would undermine that decision.
function EditRegistrationSheet({ reg, onClose, onSaved }) {
  const [fullName, setFullName] = useState(reg.full_name || "");
  const [phone, setPhone] = useState(reg.phone || "");
  const [email, setEmail] = useState(reg.email || "");
  const [institution, setInstitution] = useState(reg.institution || "");
  const [titleOrNote, setTitleOrNote] = useState(reg.title_or_note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!fullName.trim()) { setError("Name can't be empty."); return; }
    setSaving(true); setError("");
    const payload = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      institution: institution.trim() || null,
      title_or_note: titleOrNote.trim() || null,
    };
    const { data, error } = await supabase.from("registrations").update(payload).eq("id", reg.id).select().single();
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved(data);
  };

  return (
    <div className="flex flex-col" style={{ position: "fixed", inset: 0, zIndex: 30, background: C.ink }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.inkLine}` }}>
        <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600 }}>Edit Details</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.ink40} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4" style={{ background: C.inkSoft }}>
        <div className="rounded-lg px-3 py-2.5" style={{ background: `${C.gold}14`, border: `1px solid ${C.gold}44` }}>
          <span style={{ color: C.gold, fontSize: 12, fontWeight: 600 }}>Badge category ({categoryLabel(reg)}) can't be changed here — that's locked by design.</span>
        </div>
        <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} /></Field>
        <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} /></Field>
        <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></Field>
        <Field label="Institution"><input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="School / organization" style={inputStyle} /></Field>
        <Field label="Title / Note"><input value={titleOrNote} onChange={(e) => setTitleOrNote(e.target.value)} placeholder="e.g. professional title, for Speakers" style={inputStyle} /></Field>
        {error && <div style={{ color: C.alert, fontSize: 13.5 }}>{error}</div>}
      </div>
      <div className="px-5 pb-7 pt-3" style={{ background: C.inkSoft }}>
        <PrimaryButton icon={Check} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</PrimaryButton>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ color: C.ink60, fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", background: C.ink, border: `1px solid ${C.inkLine}`, borderRadius: 12, color: C.parchment, fontSize: 15.5, padding: "12px 14px", outline: "none" };

function Row({ label, value, color }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: C.ink40, fontSize: 12.5 }}>{label}</span>
      <span style={{ fontFamily: "JetBrains Mono, monospace", color: color || C.parchment, fontSize: 12.5, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}
