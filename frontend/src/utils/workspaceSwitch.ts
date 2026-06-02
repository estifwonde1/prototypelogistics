import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { postRoleSwitch } from '../api/me';
import {
  getOfficerDashboard,
  getWarehouseManagerDashboard,
  officerDashboardQueryKey,
  warehouseManagerDashboardQueryKey,
} from '../api/dashboard';
import {
  getDefaultRouteForRole,
  normalizeRoleSlug,
  type RoleSlug,
} from '../contracts/warehouse';
import { useAuthStore, type OfficerAssignment } from '../store/authStore';

const PRESERVED_QUERY_ROOTS = new Set([
  'me',
  'my-profile',
  'reference-data',
  'commodity-definitions',
  'unit-references',
  'dashboard',
]);

export function workspaceScopeKey(assignment: OfficerAssignment | null): number | null {
  return assignment?.id ?? null;
}

export function facilityLabelForAssignment(assignment: OfficerAssignment): string {
  return (
    assignment.hub?.name ??
    assignment.warehouse?.name ??
    assignment.store?.name ??
    assignment.location?.name ??
    'Federal'
  );
}

/** Evict operational/scoped caches while keeping reference data and identity queries. */
export function invalidateOperationalQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({
    predicate: (query) => {
      const root = query.queryKey[0];
      return typeof root === 'string' && !PRESERVED_QUERY_ROOTS.has(root);
    },
  });
}

const DASHBOARD_IMPORT_BY_ROLE: Partial<Record<RoleSlug, () => Promise<unknown>>> = {
  officer: () => import('../pages/officer/OfficerDashboardPage'),
  federal_officer: () => import('../pages/officer/OfficerDashboardPage'),
  regional_officer: () => import('../pages/officer/OfficerDashboardPage'),
  zonal_officer: () => import('../pages/officer/OfficerDashboardPage'),
  woreda_officer: () => import('../pages/officer/OfficerDashboardPage'),
  kebele_officer: () => import('../pages/officer/OfficerDashboardPage'),
  receipt_authorizer: () => import('../pages/officer/OfficerDashboardPage'),
  hub_manager: () => import('../pages/hubs/HubManagerDashboardPage'),
  warehouse_manager: () => import('../pages/warehouses/WarehouseManagerDashboardPage'),
  quality_assurance: () => import('../pages/warehouses/WarehouseManagerDashboardPage'),
  storekeeper: () => import('../pages/storekeeper/StorekeeperDashboardPage'),
  admin: () => import('../pages/admin/users/AdminUsersPage'),
  superadmin: () => import('../pages/admin/users/AdminUsersPage'),
  inspector: () => import('../pages/dashboard/DashboardPage'),
  dispatcher: () => import('../pages/dispatches/DispatchListPage'),
};

/** Warm the lazy-loaded dashboard chunk for the target role. */
export function prefetchDashboardForRole(roleSlug: RoleSlug | null): void {
  if (!roleSlug) return;
  const importer = DASHBOARD_IMPORT_BY_ROLE[roleSlug];
  if (importer) void importer();
}

export function prefetchDashboardForAssignment(assignment: OfficerAssignment): void {
  const roleSlug = normalizeRoleSlug(assignment.role_name) as RoleSlug | null;
  prefetchDashboardForRole(roleSlug);
}

export function prefetchDashboardData(
  queryClient: QueryClient,
  assignment: OfficerAssignment
): void {
  const roleSlug = normalizeRoleSlug(assignment.role_name) as RoleSlug | null;
  if (!roleSlug) return;

  const warehouseId = assignment.warehouse?.id;
  if (
    (roleSlug === 'warehouse_manager' || roleSlug === 'quality_assurance') &&
    warehouseId
  ) {
    void queryClient.prefetchQuery({
      queryKey: warehouseManagerDashboardQueryKey(warehouseId),
      queryFn: () => getWarehouseManagerDashboard(warehouseId),
    });
    return;
  }

  if (
    roleSlug === 'officer' ||
    roleSlug === 'federal_officer' ||
    roleSlug === 'regional_officer' ||
    roleSlug === 'zonal_officer' ||
    roleSlug === 'woreda_officer' ||
    roleSlug === 'kebele_officer' ||
    roleSlug === 'receipt_authorizer'
  ) {
    void queryClient.prefetchQuery({
      queryKey: officerDashboardQueryKey(assignment.id),
      queryFn: getOfficerDashboard,
    });
  }
}

export async function commitWorkspaceSwitch(opts: {
  assignment: OfficerAssignment;
  queryClient: QueryClient;
  navigate: NavigateFunction;
  fromRole: string | null;
  showNotification?: boolean;
}): Promise<void> {
  const { assignment, queryClient, navigate, fromRole, showNotification = true } = opts;
  const toRole = normalizeRoleSlug(assignment.role_name) as RoleSlug | null;
  if (!toRole) return;

  const facilityLabel = facilityLabelForAssignment(assignment);

  useAuthStore.getState().setActiveAssignment(assignment);
  invalidateOperationalQueries(queryClient);
  prefetchDashboardForRole(toRole);
  prefetchDashboardData(queryClient, assignment);
  navigate(getDefaultRouteForRole(toRole), { replace: true });

  postRoleSwitch({
    assignment_id: assignment.id,
    from_role: fromRole,
    to_role: assignment.role_name,
    facility_name: facilityLabel,
  }).catch(() => {
    // Audit failure is non-fatal — the switch already happened
  });

  if (showNotification) {
    notifications.show({
      title: 'Role switched',
      message: `Now operating as ${assignment.role_name} at ${facilityLabel}`,
      color: 'blue',
      autoClose: 3000,
    });
  }
}
