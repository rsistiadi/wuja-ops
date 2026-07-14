export const C = {
  ink: "#16233A",
  inkSoft: "#24354F",
  inkLine: "#33465F",
  parchment: "#F4F0E6",
  gold: "#C89A3C",
  goldDeep: "#9C7522",
  organizer: "#3E8C79",
  guest: "#4C6FA0",
  speaker: "#8B4C6C",
  alert: "#B0473E",
  ok: "#3E8C63",
  ink60: "rgba(244,240,230,0.6)",
  ink40: "rgba(244,240,230,0.4)",
};

// category = DB tier ('organizer' | 'guest' | 'speaker')
// person_role = only meaningful when category === 'guest' ('participant' | 'spouse')
export const CATEGORY_META = {
  organizer: { label: "Organizer", color: C.organizer },
  guest: { label: "Participant / Spouse", color: C.guest },
  speaker: { label: "Speaker / Performer", color: C.speaker },
};

export function categoryLabel(reg) {
  if (reg.category === "guest") return reg.person_role === "spouse" ? "Spouse" : "Participant";
  return CATEGORY_META[reg.category]?.label || reg.category;
}

// Mirrors the mockup's personStatus() but reads real snake_case DB columns.
export function registrationStatus(reg) {
  if (reg.registered && reg.badge_status === "received") return { key: "checked_in", label: "CHECKED IN", color: C.ok };
  if (reg.registered && reg.badge_status === "not_received") return { key: "badge_pending", label: "BADGE PENDING", color: C.gold };
  return { key: "pending", label: "PENDING", color: C.ink40 };
}

export function genRegCode() {
  // Human-readable lookup code — NOT the primary key (that's the DB's
  // own uuid). Collision risk here is a UX nuisance at worst (insert
  // fails on the unique constraint and the form can retry), not a
  // data-integrity risk, since nothing else references this value
  // as a foreign key.
  const n = Math.floor(10000 + Math.random() * 90000);
  return `WUJA2026-W${n}`;
}
