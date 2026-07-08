import type { OfficerAssignment } from '../store/authStore';
import { normalizeRoleSlug, type RoleSlug } from '../contracts/warehouse';

/** Only users with multiple facility assignments use the role picker. */
export function needsWorkspaceSelection(
  assignments: OfficerAssignment[],
  activeAssignment: OfficerAssignment | null
): boolean {
  if (assignments.length <= 1) return false;
  if (!activeAssignment) return true;
  return !assignments.some((a) => a.id === activeAssignment.id);
}

/** Workspace used for facility checks (auto-select when there is only one assignment). */
export function effectiveActiveAssignment(
  assignments: OfficerAssignment[],
  activeAssignment: OfficerAssignment | null
): OfficerAssignment | null {
  if (assignments.length === 1) return assignments[0];
  return activeAssignment;
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
      // Storekeepers may be assigned at warehouse level (all stores) or a single store.
      return !!(assignment.store?.id || assignment.warehouse?.id);
    default:
      return true;
  }
}
