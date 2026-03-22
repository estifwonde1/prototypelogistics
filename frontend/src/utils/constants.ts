const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const defaultApiBaseUrl =
  import.meta.env.DEV ? '/cats_warehouse/v1' : 'http://localhost:3000/cats_warehouse/v1';

export const API_BASE_URL = configuredApiBaseUrl || defaultApiBaseUrl;

/** Role slugs used by usePermission (must match backend role names normalized) */
export const ROLES = {
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
  HUB_MANAGER: 'hub_manager',
  WAREHOUSE_MANAGER: 'warehouse_manager',
  STOREKEEPER: 'storekeeper',
  INSPECTOR: 'inspector',
  DISPATCHER: 'dispatcher',
} as const;

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];

/** Human-readable labels for roles (for display in UI) */
export const ROLE_LABELS: Record<RoleSlug, string> = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SUPERADMIN]: 'Superadmin',
  [ROLES.HUB_MANAGER]: 'Hub Manager',
  [ROLES.WAREHOUSE_MANAGER]: 'Warehouse Manager',
  [ROLES.STOREKEEPER]: 'Storekeeper',
  [ROLES.INSPECTOR]: 'Inspector',
  [ROLES.DISPATCHER]: 'Dispatcher',
};

/** Normalize backend role name (e.g. "Warehouse Manager") to slug (e.g. "warehouse_manager") */
export function normalizeRoleSlug(roleName: string | null | undefined): RoleSlug | null {
  if (!roleName || typeof roleName !== 'string') return null;
  const slug = roleName.toLowerCase().trim().replace(/\s+/g, '_');
  const valid = Object.values(ROLES).includes(slug as RoleSlug);
  return valid ? (slug as RoleSlug) : null;
}

/** Get display label for a role slug (e.g. "warehouse_manager" -> "Warehouse Manager") */
export function getRoleLabel(roleSlug: string | null | undefined): string {
  if (!roleSlug) return 'User';
  return ROLE_LABELS[roleSlug as RoleSlug] ?? roleSlug;
}

/** Default route after login per role (first page they should see) */
export function getDefaultRouteForRole(role: RoleSlug | null): string {
  if (!role) return '/';
  switch (role) {
    case ROLES.ADMIN:
      return '/admin/users';
    case ROLES.SUPERADMIN:
      return '/admin/users';
    case ROLES.HUB_MANAGER:
      return '/hubs';
    case ROLES.WAREHOUSE_MANAGER:
      return '/warehouses';
    case ROLES.STOREKEEPER:
      return '/stock-balances';
    case ROLES.INSPECTOR:
      return '/inspections';
    case ROLES.DISPATCHER:
      return '/waybills';
    default:
      return '/';
  }
}

/** Map URL path segment (first segment) to permission resource for route guard */
export const PATH_SEGMENT_TO_RESOURCE: Record<
  string,
  | 'hubs'
  | 'warehouses'
  | 'stores'
  | 'stacks'
  | 'stock_balances'
  | 'grns'
  | 'gins'
  | 'inspections'
  | 'waybills'
  | 'receipts'
  | 'dispatches'
  | 'reports'
> = {
  hubs: 'hubs',
  warehouses: 'warehouses',
  stores: 'stores',
  stacks: 'stacks',
  'stock-balances': 'stock_balances',
  grns: 'grns',
  gins: 'gins',
  inspections: 'inspections',
  waybills: 'waybills',
  receipts: 'receipts',
  dispatches: 'dispatches',
  reports: 'reports',
};

export const HubType = {
  REGIONAL: 'regional',
  ZONAL: 'zonal',
  WOREDA: 'woreda'
} as const;

export const WarehouseType = {
  MAIN: 'main',
  SATELLITE: 'satellite',
  TEMPORARY: 'temporary'
} as const;

export const Status = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance'
} as const;

export const DocumentStatus = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled'
} as const;

export const CommodityStatus = {
  GOOD: 'good',
  DAMAGED: 'damaged',
  EXPIRED: 'expired'
} as const;

export const StackStatus = {
  AVAILABLE: 'available',
  FULL: 'full',
  RESERVED: 'reserved'
} as const;

export const QualityStatus = {
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  DAMAGED: 'damaged'
} as const;

export const PackagingCondition = {
  INTACT: 'intact',
  TORN: 'torn',
  DAMAGED: 'damaged',
  REPACKAGED: 'repackaged'
} as const;
