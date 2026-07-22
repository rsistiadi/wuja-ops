// Mirrors the checkpoint access_rule column exactly.
export function isAllowed(reg, checkpoint, namedListIds) {
  if (!checkpoint) return false;
  const { access_rule, categories } = checkpoint;
  if (access_rule === "all") return true;
  if (access_rule === "category") return (categories || []).includes(reg.category);
  if (access_rule === "named") return namedListIds.has(reg.id);
  if (access_rule === "both") return (categories || []).includes(reg.category) || namedListIds.has(reg.id);
  return false;
}

export const CATEGORY_OPTIONS = [
  { value: "vip_pass", label: "VIP (Pass)" },
  { value: "vip", label: "VIP" },
  { value: "speaker", label: "Speaker" },
  { value: "accompanying", label: "Accompanying" },
  { value: "board_member", label: "Board Member" },
  { value: "delegate_pass", label: "Delegate (Pass)" },
  { value: "delegate", label: "Delegate" },
  { value: "youth_wing", label: "Youth Wing" },
  { value: "exhibitor", label: "Exhibitor" },
  { value: "performer", label: "Performer" },
  { value: "volunteer", label: "Volunteer" },
  { value: "committee", label: "Committee" },
];

// Performer access doesn't follow the category rule like everyone else
// — it depends on which color group a specific individual belongs to.
// Rather than force that into the category-based rule, each performer
// gets added to the named guest list of exactly the one venue their
// color maps to.
export const PERFORMER_COLOR_OPTIONS = [
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
  { value: "blue", label: "Blue" },
];
export const PERFORMER_COLOR_VENUE = {
  yellow: "Ganjuran",
  red: "Prambanan",
  blue: "USD",
};

export const ACCESS_RULE_OPTIONS = [
  { value: "all", label: "Open to all" },
  { value: "category", label: "By category" },
  { value: "named", label: "Named guest list" },
  { value: "both", label: "Category + named list" },
];

export const CHECKPOINT_TYPE_OPTIONS = [
  { value: "event", label: "Exclusive Event" },
  { value: "entry", label: "General Entry" },
];
