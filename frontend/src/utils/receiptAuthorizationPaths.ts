import type { RoleSlug } from '../contracts/warehouse';
import type { OfficerAssignment } from '../store/authStore';

export function receiptAuthorizationBasePath(roleSlug: RoleSlug | null): string {
  if (roleSlug === 'warehouse_manager') return '/warehouse/receipt-authorizations';
  return '/hub/receipt-authorizations';
}

/**
 * Independent warehouse = hub_id is explicitly null (not missing/undefined).
 * Prefer useWarehouseManagerRaAccess() which falls back to the warehouse API.
 */
export function isStandaloneWarehouseAssignment(
  assignment: OfficerAssignment | null | undefined,
  resolvedHubId?: number | null
): boolean {
  const wh = assignment?.warehouse;
  if (!wh?.id) return false;

  const hubId = resolvedHubId !== undefined ? resolvedHubId : wh.hub_id;
  if (hubId === undefined) return false;
  return hubId == null;
}
