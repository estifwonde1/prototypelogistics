/** Roles exposed in Admin → Users and documented in the user manual. */
export const ALLOWED_ASSIGNABLE_ROLES = [
  'Admin',
  'Hub Manager',
  'Warehouse Manager',
  'Storekeeper',
  'Federal Officer',
  'Regional Officer',
  'Zonal Officer',
  'Woreda Officer',
  'Kebele Officer',
] as const;

export const ALLOWED_ASSIGNABLE_ROLE_SET = new Set<string>(ALLOWED_ASSIGNABLE_ROLES);

export function filterAllowedRoleNames(names: string[]): string[] {
  return names.filter((name) => ALLOWED_ASSIGNABLE_ROLE_SET.has(name));
}
