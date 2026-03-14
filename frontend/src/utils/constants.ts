export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/cats_warehouse/v1';

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
