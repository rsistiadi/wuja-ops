// Sorts "Bus 1", "Bus 1 YW", "Bus 2", "Bus 10" etc. in the order a person
// would expect (numeric run comparison), instead of plain string order
// (which would put "Bus 10" before "Bus 2").
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function naturalSortBy(list, key = (x) => x) {
  return (list || []).slice().sort((a, b) => collator.compare(key(a), key(b)));
}
