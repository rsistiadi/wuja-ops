// Collapsed from 5 roles to 3: real people rotate jobs day to day
// (registration desk one day, bus liaison the next), so splitting
// those into separate fixed roles just meant re-approving someone
// every time their job changed. "Crew" now covers every operational
// screen; Admin and Super Admin are unchanged.
export const ROLE_META = {
  crew: { label: "Crew", tabs: ["desk", "bus", "scan", "verify"] },
  admin: { label: "Admin", tabs: ["desk", "bus", "scan", "verify", "reports", "admin"] },
  superadmin: { label: "Super Admin", tabs: ["desk", "bus", "scan", "verify", "reports", "admin"] },
};
