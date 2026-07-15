export const C = {
  ink: "#16233A",
  inkSoft: "#24354F",
  inkLine: "#33465F",
  parchment: "#F4F0E6",
  gold: "#C89A3C",
  goldDeep: "#9C7522",
  guest: "#4C6FA0", // kept as a generic "blue" token still used elsewhere (e.g. bus "elsewhere" pills)
  speaker: "#8B4C6C",
  alert: "#B0473E",
  ok: "#3E8C63",
  ink60: "rgba(244,240,230,0.6)",
  ink40: "rgba(244,240,230,0.4)",
};

// The 12-category badge scheme, replacing the old 3-tier
// organizer/guest/speaker model. Every attendee AND every crew/admin/
// superadmin login is a registrations row with one of these — see the
// venue access table this was built from.
export const CATEGORY_META = {
  vip_pass: { label: "VIP (Pass)", color: "#C89A3C" },
  vip: { label: "VIP", color: "#9C7522" },
  speaker: { label: "Speaker", color: "#8B4C6C" },
  accompanying: { label: "Accompanying", color: "#4C6FA0" },
  board_member: { label: "Board Member", color: "#3E8C79" },
  delegate_pass: { label: "Delegate (Pass)", color: "#6B5CA0" },
  delegate: { label: "Delegate", color: "#8B7BC0" },
  youth_wing: { label: "Youth Wing", color: "#4FA88F" },
  exhibitor: { label: "Exhibitor", color: "#B5763C" },
  performer: { label: "Performer", color: "#C15D80" },
  volunteer: { label: "Volunteer", color: "#5F9B5F" },
  committee: { label: "Committee", color: "#5C7FB5" },
};

export function categoryLabel(reg) {
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
