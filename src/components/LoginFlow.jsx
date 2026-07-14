import React, { useState } from "react";
import { Search, ArrowRight, Check, AlertTriangle, X, ShieldCheck } from "lucide-react";
import { C } from "../lib/tokens";
import { TopBar, PrimaryButton, Dropdown, useDebouncedValue } from "./shared/UI";

const ROLE_OPTIONS = [
  { value: "registration", label: "Registration Crew" },
  { value: "scanner", label: "Scan / Read-only" },
  { value: "liaison", label: "Liaison Officer" },
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Super Admin" },
];

export default function LoginFlow({ auth }) {
  const [stage, setStage] = useState("select"); // select | set-pin | request-role | enter-pin | pending | deactivated
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null); // {id, full_name, status} | null (brand new name)
  const [typedName, setTypedName] = useState("");
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [reqRole, setReqRole] = useState("registration");
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (debouncedQuery.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    auth.searchNames(debouncedQuery).then((r) => { if (!cancelled) { setResults(r); setSearching(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message); setSearching(false); } });
    return () => { cancelled = true; };
  }, [debouncedQuery, auth]);

  const pickExisting = (rec) => {
    setSelected(rec); setError("");
    if (rec.status === "pending") setStage("pending");
    else if (rec.status === "deactivated") setStage("deactivated");
    else setStage("enter-pin");
  };

  const pickNew = (name) => {
    setSelected(null); setTypedName(name); setError(""); setPin1(""); setPin2("");
    setStage("set-pin");
  };

  const submitPin = () => {
    if (pin1.length < 6) { setError("PIN must be at least 6 digits."); return; }
    if (pin1 !== pin2) { setError("PINs do not match."); return; }
    if (/^(\d)\1+$/.test(pin1) || "0123456789".includes(pin1) || "9876543210".includes(pin1)) {
      setError("That PIN is too predictable — avoid repeated or sequential digits."); return;
    }
    setError(""); setStage("request-role");
  };

  const submitRoleRequest = async () => {
    setBusy(true); setError("");
    try {
      await auth.requestSignup({ fullName: typedName, requestedRole: reqRole, pin: pin1 });
      setStage("pending");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = async () => {
    setBusy(true); setError("");
    try {
      await auth.signIn(selected.id, pinInput);
      // onAuthStateChange in useAuth picks up the new session automatically
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Wuja Ops" subtitle="Crew Login" accent={C.gold} />
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4" style={{ background: C.inkSoft }}>

        {stage === "select" && (
          <>
            <div style={{ color: C.ink60, fontSize: 12.5 }}>To log in, please search your name.</div>
            <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
              <Search size={16} color={C.ink60} />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your name…"
                className="flex-1 bg-transparent outline-none" style={{ color: C.parchment, fontSize: 14, padding: "11px 4px", border: "none" }} />
            </div>
            {debouncedQuery.trim().length < 2 && (
              <div className="flex flex-col items-center mt-10 gap-2">
                <Search size={26} color={C.ink40} />
                <div style={{ color: C.ink40, fontSize: 12, maxWidth: 220, textAlign: "center" }}>Start typing to find your name in the committee list.</div>
              </div>
            )}
            {debouncedQuery.trim().length >= 2 && !searching && (
              <div className="flex flex-col gap-2">
                {results.map((r) => (
                  <button key={r.id} onClick={() => pickExisting(r)} className="rounded-xl px-4 py-3 text-left" style={{ background: C.ink, border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 13.5, fontWeight: 600 }}>{r.full_name}</button>
                ))}
                {/* Offer self-registration for a name that's not yet a crew record */}
                <button onClick={() => pickNew(debouncedQuery.trim())} className="rounded-xl px-4 py-3 text-left" style={{ background: "transparent", border: `1px dashed ${C.gold}66`, color: C.gold, fontSize: 13, fontWeight: 700 }}>
                  + Register as "{debouncedQuery.trim()}"
                </button>
              </div>
            )}
          </>
        )}

        {stage === "set-pin" && (
          <>
            <button onClick={() => setStage("select")} style={{ color: C.ink40, fontSize: 11.5, alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer" }}>← Change name</button>
            <div className="rounded-xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
              <div style={{ color: C.ink60, fontSize: 11, fontWeight: 600 }}>FIRST TIME</div>
              <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600, marginTop: 4 }}>{typedName}</div>
            </div>
            <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600 }}>Choose a PIN (6–8 digits)</div>
            <input autoFocus type="tel" value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Enter PIN"
              className="w-full rounded-xl outline-none text-center" style={{ fontFamily: "JetBrains Mono, monospace", background: C.ink, border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 22, letterSpacing: 8, padding: 14 }} />
            <input type="tel" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Confirm PIN"
              className="w-full rounded-xl outline-none text-center" style={{ fontFamily: "JetBrains Mono, monospace", background: C.ink, border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 22, letterSpacing: 8, padding: 14 }} />
            {error && <div style={{ color: C.alert, fontSize: 12 }}>{error}</div>}
            <PrimaryButton icon={ArrowRight} disabled={pin1.length < 6} onClick={submitPin}>Continue</PrimaryButton>
          </>
        )}

        {stage === "request-role" && (
          <>
            <button onClick={() => setStage("set-pin")} style={{ color: C.ink40, fontSize: 11.5, alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer" }}>← Back</button>
            <div style={{ color: C.ink60, fontSize: 12.5, fontWeight: 600 }}>Which role are you requesting?</div>
            <Dropdown value={reqRole} onChange={setReqRole} options={ROLE_OPTIONS} />
            <div style={{ color: C.ink40, fontSize: 11.5 }}>An Admin will review this — they may approve you into a different role than requested.</div>
            {error && <div style={{ color: C.alert, fontSize: 12 }}>{error}</div>}
            <PrimaryButton icon={Check} disabled={busy} onClick={submitRoleRequest}>{busy ? "Submitting…" : "Submit request"}</PrimaryButton>
          </>
        )}

        {stage === "enter-pin" && (
          <>
            <button onClick={() => setStage("select")} style={{ color: C.ink40, fontSize: 11.5, alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer" }}>← Change name</button>
            <div className="rounded-xl p-4" style={{ background: C.ink, border: `1px solid ${C.inkLine}` }}>
              <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600 }}>{selected.full_name}</div>
            </div>
            <input autoFocus type="tel" value={pinInput} onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }} placeholder="Enter PIN"
              className="w-full rounded-xl outline-none text-center" style={{ fontFamily: "JetBrains Mono, monospace", background: C.ink, border: `1px solid ${C.inkLine}`, color: C.parchment, fontSize: 22, letterSpacing: 8, padding: 14 }} />
            {error && <div style={{ color: C.alert, fontSize: 12 }}>{error}</div>}
            <PrimaryButton icon={ShieldCheck} disabled={pinInput.length < 6 || busy} onClick={submitLogin}>{busy ? "Logging in…" : "Log in"}</PrimaryButton>
            <div style={{ color: C.ink40, fontSize: 11, textAlign: "center" }}>Forgot your PIN? Ask an Admin to reset it.</div>
          </>
        )}

        {stage === "pending" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 mt-10">
            <div className="flex items-center justify-center rounded-full" style={{ width: 64, height: 64, background: `${C.gold}22`, border: `1.5px solid ${C.gold}` }}><AlertTriangle size={28} color={C.gold} /></div>
            <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600 }}>Waiting for approval</div>
            <div style={{ color: C.ink60, fontSize: 12.5, maxWidth: 260, textAlign: "center" }}>Your request is pending review by an Admin. Check back once approved.</div>
            <button onClick={() => setStage("select")} style={{ color: C.gold, fontSize: 12, fontWeight: 700, background: "none", border: "none", cursor: "pointer", marginTop: 8 }}>← Back to name select</button>
          </div>
        )}

        {stage === "deactivated" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 mt-10">
            <div className="flex items-center justify-center rounded-full" style={{ width: 64, height: 64, background: `${C.alert}22`, border: `1.5px solid ${C.alert}` }}><X size={28} color={C.alert} /></div>
            <div style={{ fontFamily: "Fraunces, serif", color: C.parchment, fontSize: 17, fontWeight: 600 }}>Account deactivated</div>
            <div style={{ color: C.ink60, fontSize: 12.5, maxWidth: 260, textAlign: "center" }}>Contact an Admin if you believe this is a mistake.</div>
            <button onClick={() => setStage("select")} style={{ color: C.gold, fontSize: 12, fontWeight: 700, background: "none", border: "none", cursor: "pointer", marginTop: 8 }}>← Back to name select</button>
          </div>
        )}
      </div>
    </div>
  );
}
