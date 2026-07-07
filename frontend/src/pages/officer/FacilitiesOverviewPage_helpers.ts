import type { Hub } from '../../types/hub';
import type { Warehouse } from '../../types/warehouse';
import type { Store } from '../../types/store';

const num = (v: number | string | undefined | null) => Number(v) || 0;

export const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export const pct = (used: number, total: number) =>
  total > 0 ? (used / total) * 100 : 0;

export const pctColor = (p: number) =>
  p > 90 ? 'red' : p > 70 ? 'orange' : p > 40 ? 'yellow' : 'green';

export const whCapacityMt = (w: Warehouse) =>
  num(w.capacity?.usable_storage_capacity_mt);

export const whUsedMt = (w: Warehouse) => num(w.capacity?.used_capacity_mt);

export const whFreeMt = (w: Warehouse) =>
  num(w.capacity?.remaining_capacity_mt);

export const whUtilPct = (w: Warehouse) =>
  w.capacity?.utilization_pct ?? pct(whUsedMt(w), whCapacityMt(w));

export const storeCapacityMt = (s: Store) => num(s.allocated_capacity_mt);

export const storeUsedMt = (s: Store) => num(s.used_capacity_mt);

export const storeFreeMt = (s: Store) => num(s.remaining_capacity_mt);

export const storeUtilPct = (s: Store) =>
  s.utilization_pct ?? pct(storeUsedMt(s), storeCapacityMt(s));

export const sumWhCapacity = (warehouses: Warehouse[]) =>
  warehouses.reduce((a, w) => a + whCapacityMt(w), 0);

export const sumWhUsed = (warehouses: Warehouse[]) =>
  warehouses.reduce((a, w) => a + whUsedMt(w), 0);

export const sumWhFree = (warehouses: Warehouse[]) =>
  warehouses.reduce((a, w) => a + whFreeMt(w), 0);

/** @deprecated Prefer hubCapacityFromWarehouses — hub DB rollup can be stale */
export const hubCapacityMt = (hub: Hub) => num(hub.capacity?.total_capacity_mt);

export const hubWarehouses = (hub: Hub, warehouses: Warehouse[]) =>
  warehouses.filter((w) => w.hub_id === hub.id);

export const hubCapacityFromWarehouses = (hub: Hub, warehouses: Warehouse[]) =>
  sumWhCapacity(hubWarehouses(hub, warehouses));

export const hubUsedFromWarehouses = (hub: Hub, warehouses: Warehouse[]) =>
  sumWhUsed(hubWarehouses(hub, warehouses));

export const hubFreeFromWarehouses = (hub: Hub, warehouses: Warehouse[]) =>
  sumWhFree(hubWarehouses(hub, warehouses));

export const hubUtilPctFromWarehouses = (hub: Hub, warehouses: Warehouse[]) =>
  pct(hubUsedFromWarehouses(hub, warehouses), hubCapacityFromWarehouses(hub, warehouses));

export type CapacityStatus = 'none' | 'available' | 'almost_full' | 'full';

export const warehouseCapacityStatus = (w: Warehouse): CapacityStatus => {
  if (w.capacity?.capacity_established !== true) return 'none';
  const remaining = whFreeMt(w);
  const util = whUtilPct(w);
  if (remaining <= 0) return 'full';
  if (util >= 90) return 'almost_full';
  return 'available';
};

export function formatWarehouseCapacityLabel(w: Warehouse): {
  label: string;
  disabled: boolean;
  status: CapacityStatus;
} {
  const status = warehouseCapacityStatus(w);

  if (status === 'none') {
    return { label: w.name, disabled: true, status };
  }
  if (status === 'full') {
    return { label: w.name, disabled: true, status };
  }
  return { label: w.name, disabled: false, status };
}

/** Progress bar value capped at 100; label shows actual utilization (may exceed 100%). */
export const progressBarValue = (utilPct: number) => Math.min(utilPct, 100);
