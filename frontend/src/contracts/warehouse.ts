export const ROLES = {
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
  OFFICER: 'officer',
  FEDERAL_OFFICER: 'federal_officer',
  REGIONAL_OFFICER: 'regional_officer',
  ZONAL_OFFICER: 'zonal_officer',
  WOREDA_OFFICER: 'woreda_officer',
  KEBELE_OFFICER: 'kebele_officer',
  HUB_MANAGER: 'hub_manager',
  WAREHOUSE_MANAGER: 'warehouse_manager',
  STOREKEEPER: 'storekeeper',
  INSPECTOR: 'inspector',
  DISPATCHER: 'dispatcher',
} as const;

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];

export const OFFICER_ROLE_SLUGS: RoleSlug[] = [
  ROLES.OFFICER,
  ROLES.FEDERAL_OFFICER,
  ROLES.REGIONAL_OFFICER,
  ROLES.ZONAL_OFFICER,
  ROLES.WOREDA_OFFICER,
  ROLES.KEBELE_OFFICER,
];

export const ROLE_LABELS: Record<RoleSlug, string> = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SUPERADMIN]: 'Superadmin',
  [ROLES.OFFICER]: 'Officer',
  [ROLES.FEDERAL_OFFICER]: 'Federal Officer',
  [ROLES.REGIONAL_OFFICER]: 'Regional Officer',
  [ROLES.ZONAL_OFFICER]: 'Zonal Officer',
  [ROLES.WOREDA_OFFICER]: 'Woreda Officer',
  [ROLES.KEBELE_OFFICER]: 'Kebele Officer',
  [ROLES.HUB_MANAGER]: 'Hub Manager',
  [ROLES.WAREHOUSE_MANAGER]: 'Warehouse Manager',
  [ROLES.STOREKEEPER]: 'Storekeeper',
  [ROLES.INSPECTOR]: 'Inspector',
  [ROLES.DISPATCHER]: 'Dispatcher',
};

export type Resource =
  | 'hubs'
  | 'warehouses'
  | 'stores'
  | 'stacks'
  | 'grns'
  | 'gins'
  | 'inspections'
  | 'waybills'
  | 'stock_balances'
  | 'receipts'
  | 'dispatches'
  | 'receipt_orders'
  | 'dispatch_orders'
  | 'reports';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'confirm';

export const DocumentStatus = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
} as const;

export const QualityStatus = {
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  DAMAGED: 'damaged',
} as const;

export const PackagingCondition = {
  INTACT: 'intact',
  TORN: 'torn',
  DAMAGED: 'damaged',
  REPACKAGED: 'repackaged',
} as const;

export const PATH_SEGMENT_TO_RESOURCE: Record<string, Resource> = {
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
  'receipt-orders': 'receipt_orders',
  'dispatch-orders': 'dispatch_orders',
  reports: 'reports',
};

type PermissionMatrix = Partial<Record<Resource, Action[]>>;

const FULL_ACCESS: PermissionMatrix = {
  hubs: ['read', 'create', 'update', 'delete', 'confirm'],
  warehouses: ['read', 'create', 'update', 'delete', 'confirm'],
  stores: ['read', 'create', 'update', 'delete', 'confirm'],
  stacks: ['read', 'create', 'update', 'delete', 'confirm'],
  grns: ['read', 'create', 'update', 'delete', 'confirm'],
  gins: ['read', 'create', 'update', 'delete', 'confirm'],
  inspections: ['read', 'create', 'update', 'delete', 'confirm'],
  waybills: ['read', 'create', 'update', 'delete', 'confirm'],
  stock_balances: ['read'],
  receipts: ['read'],
  dispatches: ['read'],
  reports: ['read'],
};

const OFFICER_ACCESS: PermissionMatrix = {
  receipt_orders: ['read', 'create', 'update', 'delete', 'confirm'],
  dispatch_orders: ['read', 'create', 'update', 'delete', 'confirm'],
  receipts: ['read'],
  dispatches: ['read'],
};

export const ROLE_CAPABILITIES: Record<RoleSlug, PermissionMatrix> = {
  [ROLES.ADMIN]: FULL_ACCESS,
  [ROLES.SUPERADMIN]: FULL_ACCESS,
  [ROLES.OFFICER]: OFFICER_ACCESS,
  [ROLES.FEDERAL_OFFICER]: OFFICER_ACCESS,
  [ROLES.REGIONAL_OFFICER]: OFFICER_ACCESS,
  [ROLES.ZONAL_OFFICER]: OFFICER_ACCESS,
  [ROLES.WOREDA_OFFICER]: OFFICER_ACCESS,
  [ROLES.KEBELE_OFFICER]: OFFICER_ACCESS,
  [ROLES.HUB_MANAGER]: {
    hubs: ['read'],
    warehouses: ['read', 'create', 'update'],
    stores: ['read'],
    stacks: ['read'],
    grns: ['read'],
    gins: ['read'],
    inspections: ['read'],
    // Matches WaybillPolicy: hub_manager can create/confirm waybills
    waybills: ['read', 'create', 'confirm'],
    stock_balances: ['read'],
    receipts: ['read'],
    dispatches: ['read'],
    receipt_orders: ['read'],
    dispatch_orders: ['read'],
    reports: ['read'],
  },
  [ROLES.WAREHOUSE_MANAGER]: {
    warehouses: ['read', 'update'],
    stores: ['read', 'create', 'update'],
    stacks: ['read', 'create', 'update'],
    grns: ['read', 'create', 'confirm'],
    gins: ['read', 'create', 'confirm'],
    inspections: ['read', 'create', 'confirm'],
    waybills: ['read', 'create', 'confirm'],
    stock_balances: ['read'],
    receipts: ['read'],
    dispatches: ['read'],
    receipt_orders: ['read'],
    dispatch_orders: ['read'],
    reports: ['read'],
  },
  [ROLES.STOREKEEPER]: {
    warehouses: ['read'],
    stores: ['read'],
    stacks: ['read', 'create', 'update'],
    grns: ['read', 'create'],
    gins: ['read', 'create'],
    inspections: ['read', 'create'],
    stock_balances: ['read'],
    receipts: ['read'],
    dispatches: ['read'],
    receipt_orders: ['read'],
    dispatch_orders: ['read'],
    reports: ['read'],
  },
  [ROLES.INSPECTOR]: {},
  [ROLES.DISPATCHER]: {},
};

const DEFAULT_ROUTE_BY_ROLE: Record<RoleSlug, string> = {
  [ROLES.ADMIN]: '/admin/users',
  [ROLES.SUPERADMIN]: '/admin/users',
  [ROLES.OFFICER]: '/officer/dashboard',
  [ROLES.FEDERAL_OFFICER]: '/officer/dashboard',
  [ROLES.REGIONAL_OFFICER]: '/officer/dashboard',
  [ROLES.ZONAL_OFFICER]: '/officer/dashboard',
  [ROLES.WOREDA_OFFICER]: '/officer/dashboard',
  [ROLES.KEBELE_OFFICER]: '/officer/dashboard',
  [ROLES.HUB_MANAGER]: '/hub/dashboard',
  [ROLES.WAREHOUSE_MANAGER]: '/warehouse/dashboard',
  [ROLES.STOREKEEPER]: '/storekeeper/dashboard',
  [ROLES.INSPECTOR]: '/',
  [ROLES.DISPATCHER]: '/dispatcher/dashboard',
};

export function normalizeRoleSlug(roleName: string | null | undefined): RoleSlug | null {
  if (!roleName || typeof roleName !== 'string') return null;
  const slug = roleName.toLowerCase().trim().replace(/\s+/g, '_');
  const valid = Object.values(ROLES).includes(slug as RoleSlug);
  return valid ? (slug as RoleSlug) : null;
}

export function getRoleLabel(roleSlug: string | null | undefined): string {
  if (!roleSlug) return 'User';
  return ROLE_LABELS[roleSlug as RoleSlug] ?? roleSlug;
}

export function getDefaultRouteForRole(role: RoleSlug | null): string {
  if (!role) return '/';
  return DEFAULT_ROUTE_BY_ROLE[role] ?? '/';
}

export function hasPermission(role: RoleSlug | null, resource: Resource, action: Action): boolean {
  if (!role) return false;
  const capabilities = ROLE_CAPABILITIES[role] ?? {};
  const actions = capabilities[resource] ?? [];
  return actions.includes(action);
}
