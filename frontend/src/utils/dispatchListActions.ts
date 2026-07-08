import type { DispatchOrder } from '../api/dispatchOrders';
import type { DispatchOrderAuthorization } from '../api/dispatchOrderAuthorizations';

export interface ListRowAction {
  label: string;
  path: string;
  color?: string;
  variant?: 'filled' | 'light' | 'default' | 'subtle';
}

export interface ListRowActions {
  primary: ListRowAction;
  secondary?: ListRowAction;
}

function dispatchOrderCanAuthorizeMore(order: DispatchOrder): boolean {
  if (order.status === 'Draft') return false;
  if (order.status === 'Completed') return false;
  const remaining = order.remaining_quantity;
  if (remaining != null && Number.isFinite(Number(remaining))) {
    return Number(remaining) > 0;
  }
  return order.status === 'Confirmed';
}

/** Next-step actions for inbound dispatch orders (hub / standalone warehouse). */
export function getDispatchOrderListActions(
  order: DispatchOrder,
  basePath: '/hub' | '/warehouse',
  options?: { canCreateAuthorization?: boolean }
): ListRowActions {
  const detailPath = `${basePath}/dispatches/${order.id}`;
  const createPath = `${basePath}/dispatch-authorizations/new?dispatch_order_id=${order.id}`;
  const canCreate = options?.canCreateAuthorization !== false && dispatchOrderCanAuthorizeMore(order);

  if (order.status === 'Completed') {
    return {
      primary: { label: 'View Details', path: detailPath, variant: 'light' },
    };
  }

  if (canCreate && (order.status === 'Confirmed' || dispatchOrderCanAuthorizeMore(order))) {
    return {
      primary: { label: 'Create Authorization', path: createPath, color: 'blue' },
      secondary: { label: 'View Order', path: detailPath, variant: 'light' },
    };
  }

  if (['Assigned', 'Reserved', 'In Progress'].includes(order.status)) {
    return {
      primary: { label: 'View Progress', path: detailPath, color: 'blue', variant: 'light' },
      ...(canCreate
        ? { secondary: { label: 'Add Authorization', path: createPath, variant: 'subtle' } }
        : {}),
    };
  }

  return {
    primary: { label: 'View Details', path: detailPath, variant: 'light' },
  };
}

/** Next-step actions for dispatch authorizations (hub / warehouse manager). */
export function getDispatchAuthorizationListActions(
  dao: DispatchOrderAuthorization,
  basePath: '/hub' | '/warehouse',
  options?: { canManageAssignment?: boolean }
): ListRowActions {
  const detailPath = `${basePath}/dispatch-authorizations/${dao.id}`;
  const canAssign = options?.canManageAssignment !== false;

  if (dao.status === 'draft') {
    return {
      primary: { label: 'Confirm Authorization', path: detailPath, color: 'blue' },
      secondary: { label: 'Review Draft', path: detailPath, variant: 'light' },
    };
  }

  if (dao.status === 'cancelled') {
    return {
      primary: { label: 'View Details', path: detailPath, variant: 'default' },
    };
  }

  if (dao.status === 'confirmed' && dao.awaiting_storekeeper_assignment && canAssign) {
    return {
      primary: { label: 'Assign Storekeeper', path: detailPath, color: 'orange' },
      secondary: { label: 'View Details', path: detailPath, variant: 'light' },
    };
  }

  if (dao.status === 'confirmed') {
    if (dao.assigned_storekeeper_name) {
      return {
        primary: { label: 'Track Loading', path: detailPath, color: 'teal', variant: 'light' },
        secondary: { label: 'View Details', path: detailPath, variant: 'subtle' },
      };
    }
    return {
      primary: { label: 'View Details', path: detailPath, variant: 'light' },
    };
  }

  return {
    primary: { label: 'View Details', path: detailPath, variant: 'light' },
  };
}
