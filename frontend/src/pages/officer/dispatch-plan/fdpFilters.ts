import type { Fdp } from '../../../types/fdp';

export function fdpOptionLabel(fdp: Fdp): string {
  const location = fdp.location_name?.trim();
  const level = fdp.location_type?.trim();
  if (location && level) return `${fdp.name} — ${location} (${level})`;
  if (location) return `${fdp.name} — ${location}`;
  return fdp.name;
}
