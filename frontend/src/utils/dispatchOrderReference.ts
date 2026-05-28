/** Canonical dispatch order reference — always the system-assigned DO-{id}. */
export function getDispatchOrderReference(order: {
  id?: number;
  reference_no?: string | null;
  dispatch_reference?: string | null;
  plan_reference?: string | null;
}): string {
  if (order.reference_no?.trim()) return order.reference_no.trim();
  if (order.id) return `DO-${order.id}`;
  return '—';
}

export function isAllocationDispatchOrder(order: {
  dispatch_reference?: string | null;
  plan_reference?: string | null;
  dispatch_order_lines?: { source_allocations?: unknown[] }[];
}): boolean {
  const lines = order.dispatch_order_lines ?? [];
  return lines.some((l) => (l.source_allocations?.length ?? 0) > 0);
}
