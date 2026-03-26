import {
  DocumentStatus,
  PackagingCondition,
  PATH_SEGMENT_TO_RESOURCE,
  QualityStatus,
  ROLE_LABELS,
  ROLES,
  getDefaultRouteForRole,
  getRoleLabel,
  normalizeRoleSlug,
  type RoleSlug,
} from '../contracts/warehouse';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

function resolveApiBaseUrl() {
  if (configuredApiBaseUrl) return configuredApiBaseUrl;
  if (import.meta.env.DEV) return '/cats_warehouse/v1';

  throw new Error('VITE_API_BASE_URL must be configured for non-development environments.');
}

export const API_BASE_URL = resolveApiBaseUrl();

export {
  DocumentStatus,
  PackagingCondition,
  PATH_SEGMENT_TO_RESOURCE,
  QualityStatus,
  ROLE_LABELS,
  ROLES,
  getDefaultRouteForRole,
  getRoleLabel,
  normalizeRoleSlug,
  type RoleSlug,
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

