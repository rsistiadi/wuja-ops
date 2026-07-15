import React, { useState, useEffect } from "react";
import { Search, Contact, Heart, ScanLine } from "lucide-react";
import { C, CATEGORY_META, categoryLabel, registrationStatus } from "../../lib/tokens";
import { TopBar, PrimaryButton, PersonTag, StatusPill, PersonAvatar, useDebouncedValue } from "../shared/UI";
import { supabase } from "../../lib/supabaseClient";
import { getBadgePhotoUrl } from "../../lib/photoStorage";
import { extractBadgeNumber } from "../../lib/qrScan";
import { lookupByBadgeNumber } from "../../lib/badgeLookup";
import QrScannerView from "../shared/QrScannerView";

export default function VerifyMode() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 280);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [notFound, setNotFound] = useState("");

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
            <button onClick={() => { setScanning(true); setNotFound(""); }} className="w-full flex items-center justify-center gap-2.5 rounded-xl mb-3" style={{ background: C.gold, color: C.ink, fontWeight: 700, fontSize: 15, padding: "13px 0", border: "none", cursor: "pointer" }}>
              <ScanLine size={18} /> SCAN BADGE
            </button>
            {notFound && <div style={{ color: C.alert, fontSize: 12, marginBottom: 8 }}>{notFound}</div>}
            <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: C.inkSoft, border: `1px solid ${C.inkLine}` }}>
              <Search size={16} color={C.ink60} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Or search name, phone, or badge no."
                className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 14, padding: "11px 4px", border: "none" }} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5" style={{ background: C.inkSoft }}>
            {debounced.trim().length < 2 && (
              <div className="flex flex-col items-center mt-16 gap-2">
                <Contact size={28} color={C.ink40} />
                <div style={{ color: C.ink40, fontSize: 12.5, maxWidth: 240, textAlign: "center" }}>General-purpose lookup — no checkpoint, no action, just confirms who someone is.</div>
              </div>
            )}
            {debounced.trim().length >= 2 && results.length === 0 && <div style={{ color: C.ink40, fontSize: 13, textAlign: "center", marginTop: 40 }}>No matches.</div>}
            {results.map((r) => (
              <button key={r.id} onClick={() => select(r)} className="flex items-center justify-between rounded-xl px-4 py-3.5" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, cursor: "pointer" }}>
                <div className="text-left">
                  <div style={{ color: C.parchment, fontSize: 14.5, fontWeight: 600 }}>{r.full_name}</div>
                  <div className="flex items-center gap-2 mt-1.5"><PersonTag reg={r} /></div>
                </div>
                <StatusPill reg={r} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col px-5 py-6" style={{ background: C.inkSoft }}>
          <div className="rounded-2xl p-5 flex flex-col items-center" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
            <PersonAvatar reg={selected} photoUrl={photoUrl} size={84} />
            <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 18, fontWeight: 600, marginTop: 12 }}>{selected.full_name}</div>
            <div className="flex items-center gap-2 mt-2">
              <PersonTag reg={selected} />
              {selected.medical_note && <span className="inline-flex items-center gap-1" style={{ color: C.speaker, fontSize: 10.5, fontWeight: 700 }}><Heart size={11} /> MEDICAL</span>}
            </div>
            <div className="mt-3"><StatusPill reg={selected} /></div>
            <div className="w-full mt-4 pt-4 flex flex-col gap-1.5" style={{ borderTop: `1px dashed ${C.inkLine}` }}>
              <Row label="Badge no." value={selected.badge_number || "— not issued —"} />
              <Row label="Photo on file" value={selected.photo_status === "captured" ? "Yes" : selected.photo_status === "skipped" ? "Skipped" : "No"} color={selected.photo_status === "captured" ? C.ok : C.gold} />
            </div>
          </div>
          <div className="mt-5"><PrimaryButton icon={Search} onClick={() => { setSelected(null); setQuery(""); }}>Look up another</PrimaryButton></div>
        </div>
      )}

      {scanning && <QrScannerView title="Scan badge" onResult={onQrDetected} onCancel={() => setScanning(false)} />}
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: C.ink40, fontSize: 11 }}>{label}</span>
      <span style={{ fontFamily: "JetBrains Mono, monospace", color: color || C.parchment, fontSize: 11.5 }}>{value}</span>
    </div>
  );
}
