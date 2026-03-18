import { useAuthStore } from '../store/authStore';

type Resource =
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
  | 'reports';
type Action = 'read' | 'create' | 'update' | 'delete' | 'confirm';

/**
 * Hook to check user permissions based on role
 * 
 * Role permissions:
 * - Admin: Full access to everything
 * - Hub Manager: Hubs (CRUD)
 * - Warehouse Manager: Warehouses, Stores, Stacks, GRNs, GINs, Inspections, Waybills, Stock Balances
 * - Storekeeper: Stores, Stacks, GRNs, GINs, Stock Balances (read + create)
 * - Inspector: Inspections, GRNs (read + create + confirm)
 * - Dispatcher: Waybills, GINs (read + create + confirm)
 */
export const usePermission = () => {
  const role = useAuthStore((state) => state.role);

  const can = (resource: Resource, action: Action): boolean => {
    if (!role) return false;

    // Admin has full access
    if (role === 'admin' || role === 'superadmin') return true;

    // Hub Manager
    if (role === 'hub_manager') {
      const allowedResources: Resource[] = ['hubs', 'receipts', 'dispatches', 'grns', 'gins'];
      if (!allowedResources.includes(resource)) return false;
      if (resource === 'hubs') {
        return action === 'read' || action === 'update';
      }
      return action === 'read' || action === 'create';
    }

    // Warehouse Manager
    if (role === 'warehouse_manager') {
      const allowedResources: Resource[] = [
        'warehouses',
        'stores',
        'stacks',
        'grns',
        'gins',
        'receipts',
        'dispatches',
        'stock_balances',
      ];
      if (!allowedResources.includes(resource)) return false;
      if (resource === 'warehouses') {
        return action === 'read' || action === 'update';
      }
      return true;
    }

    // Storekeeper
    if (role === 'storekeeper') {
      const allowedResources: Resource[] = ['stores', 'stacks', 'stock_balances', 'reports'];
      if (!allowedResources.includes(resource)) return false;
      // Can read/create; allow updating stacks
      if (resource === 'stacks' && action === 'update') return true;
      return action === 'read' || action === 'create';
    }

    // Inspector
    if (role === 'inspector') {
      if (resource === 'inspections') return true;
      if (resource === 'grns') {
        // Can read, create, and confirm GRNs
        return action === 'read' || action === 'create' || action === 'confirm';
      }
      return false;
    }


    // Dispatcher
    if (role === 'dispatcher') {
      if (resource === 'waybills') return true;
      if (resource === 'gins') {
        // Can read, create, and confirm GINs
        return action === 'read' || action === 'create' || action === 'confirm';
      }
      return false;
    }

    return false;
  };

  return { can, role };
};
