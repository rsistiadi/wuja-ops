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
  { value: "organizer", label: "Organizer" },
  { value: "guest", label: "Participant / Spouse" },
  { value: "speaker", label: "Speaker / Performer" },
];

export const ACCESS_RULE_OPTIONS = [
  { value: "all", label: "Open to all" },
  { value: "category", label: "By category" },
  { value: "named", label: "Named guest list" },
  { value: "both", label: "Category + named list" },
];

export const CHECKPOINT_TYPE_OPTIONS = [
  { value: "bus", label: "Bus" },
  { value: "event", label: "Exclusive Event" },
  { value: "entry", label: "General Entry" },
];
