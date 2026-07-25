// Every "search for a person" box in the app should match the same
// fields — name, phone, email, badge number — so crew get the same
// search behavior no matter which screen they're on. This has drifted
// out of sync more than once already (screens built at different
// times ended up searching different subsets of fields), so this is
// the one place that list lives now; every search box should import
// and use this rather than hand-rolling its own .ilike()/.or() clause.
export function personSearchOr(query) {
  const q = query.trim();
  return `full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,badge_number.ilike.%${q}%`;
}
