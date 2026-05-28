export type DispatchAuthorizationBasePath = 'warehouse' | 'hub';

export function dispatchAuthorizationPrefix(basePath: DispatchAuthorizationBasePath): string {
  return basePath === 'hub' ? '/hub' : '/warehouse';
}

export function dispatchAuthorizationListPath(basePath: DispatchAuthorizationBasePath): string {
  return `${dispatchAuthorizationPrefix(basePath)}/dispatch-authorizations`;
}

export function dispatchAuthorizationNewPath(
  basePath: DispatchAuthorizationBasePath,
  params?: { dispatch_order_id?: number; warehouse_id?: number }
): string {
  const base = `${dispatchAuthorizationListPath(basePath)}/new`;
  if (!params?.dispatch_order_id) return base;
  const qs = new URLSearchParams();
  qs.set('dispatch_order_id', String(params.dispatch_order_id));
  if (params.warehouse_id) qs.set('warehouse_id', String(params.warehouse_id));
  return `${base}?${qs.toString()}`;
}

export function dispatchAuthorizationDetailPath(
  basePath: DispatchAuthorizationBasePath,
  id: number
): string {
  return `${dispatchAuthorizationListPath(basePath)}/${id}`;
}
