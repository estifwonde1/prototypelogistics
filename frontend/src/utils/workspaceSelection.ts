import type { OfficerAssignment } from '../store/authStore';
import { normalizeRoleSlug, type RoleSlug } from '../contracts/warehouse';

/** True when the user must pick (or re-pick) a workspace before using the app. */
export function needsWorkspaceSelection(
  assignments: OfficerAssignment[],
  activeAssignment: OfficerAssignment | null
): boolean {
  if (assignments.length === 0) return false;

  if (assignments.length > 1) {
    if (!activeAssignment) return true;
    return !assignments.some((a) => a.id === activeAssignment.id);
  }

  if (!activeAssignment) return true;
  return activeAssignment.id !== assignments[0].id;
}

export function assignmentHasRequiredFacility(
  assignment: OfficerAssignment | null,
  roleSlug: string | null
): boolean {
  if (!assignment) return false;

  const slug =
    (normalizeRoleSlug(assignment.role_name) as RoleSlug | null) ??
    (normalizeRoleSlug(roleSlug) as RoleSlug | null);

  if (!slug) return true;

  switch (slug) {
    case 'warehouse_manager':
    case 'quality_assurance':
      return !!assignment.warehouse?.id;
    case 'hub_manager':
      return !!assignment.hub?.id;
    case 'storekeeper':
      return !!assignment.store?.id;
    default:
      return true;
  }
}
