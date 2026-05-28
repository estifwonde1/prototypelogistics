import type { DispatchOrderAuthorization, DispatchOrderV2 } from '../types/dispatchV2';

export function orderHasSourceAtWarehouse(order: DispatchOrderV2, whId: number): boolean {
  return (order.dispatch_order_lines ?? []).some((line) =>
    (line.source_allocations || []).some((s) => Number(s.warehouse_id) === Number(whId))
  );
}

export function sourceQtyAtWarehouse(order: DispatchOrderV2, whId: number): number {
  return (order.dispatch_order_lines ?? []).reduce((sum, line) => {
    const lineSum = (line.source_allocations ?? [])
      .filter((s) => Number(s.warehouse_id) === Number(whId))
      .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
    return sum + lineSum;
  }, 0);
}

export function warehouseLabelFromOrder(order: DispatchOrderV2, whId: number): string {
  for (const line of order.dispatch_order_lines ?? []) {
    const src = (line.source_allocations ?? []).find(
      (s) => Number(s.warehouse_id) === Number(whId)
    );
    if (src?.warehouse?.label) return src.warehouse.label;
    if (src?.warehouse?.name) return src.warehouse.name;
  }
  return `WH-${whId}`;
}

export type PendingAuthorizationRow = {
  order: DispatchOrderV2;
  warehouseId: number;
  warehouseLabel: string;
};

export function buildPendingRows(
  orders: DispatchOrderV2[],
  authorizations: DispatchOrderAuthorization[],
  warehouseFilter?: number
): PendingAuthorizationRow[] {
  const existingAuthKeys = new Set(
    authorizations.map((a) => `${a.dispatch_order_id}-${a.warehouse_id}`)
  );

  const rows: PendingAuthorizationRow[] = [];

  for (const order of orders) {
    const status = String(order.status ?? '').toLowerCase();
    if (status !== 'confirmed' && status !== 'partially_authorized') continue;

    const warehouseIds = new Set<number>();
    for (const line of order.dispatch_order_lines ?? []) {
      for (const s of line.source_allocations ?? []) {
        if (s.warehouse_id) warehouseIds.add(Number(s.warehouse_id));
      }
    }

    for (const whId of warehouseIds) {
      if (warehouseFilter != null && whId !== warehouseFilter) continue;
      if (!orderHasSourceAtWarehouse(order, whId)) continue;
      if (existingAuthKeys.has(`${order.id}-${whId}`)) continue;
      rows.push({
        order,
        warehouseId: whId,
        warehouseLabel: warehouseLabelFromOrder(order, whId),
      });
    }
  }

  return rows;
}

export function remainingQtyAtWarehouse(
  order: DispatchOrderV2,
  warehouseId: number,
  existingAuths: DispatchOrderAuthorization[]
): number {
  const allocated = sourceQtyAtWarehouse(order, warehouseId);
  const used = existingAuths
    .filter(
      (a) =>
        Number(a.dispatch_order_id) === Number(order.id) &&
        Number(a.warehouse_id) === Number(warehouseId) &&
        String(a.status).toLowerCase() !== 'cancelled'
    )
    .reduce((sum, a) => sum + Number(a.authorized_quantity ?? 0), 0);
  return Math.max(0, allocated - used);
}
