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

export const hubCapacityMt = (hub: Hub) => num(hub.capacity?.total_capacity_mt);

export const hubWarehouses = (hub: Hub, warehouses: Warehouse[]) =>
  warehouses.filter((w) => w.hub_id === hub.id);
