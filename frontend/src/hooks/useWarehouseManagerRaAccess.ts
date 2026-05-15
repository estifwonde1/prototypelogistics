import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWarehouse } from '../api/warehouses';
import { normalizeRoleSlug } from '../contracts/warehouse';
import { useAuthStore } from '../store/authStore';

/**
 * Warehouse Managers may create/manage Receipt Authorizations only at independent
 * warehouses (hub_id is null). Resolves hub_id from the active assignment or,
 * when missing on stale sessions, from the warehouse API.
 */
export function useWarehouseManagerRaAccess() {
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(
    activeAssignment?.role_name || useAuthStore((state) => state.role)
  );
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const warehouseId = activeAssignment?.warehouse?.id;
  const hubIdFromAssignment = activeAssignment?.warehouse?.hub_id;

  const needsWarehouseLookup =
    isWarehouseManager && warehouseId != null && hubIdFromAssignment === undefined;

  const { data: warehouse, isLoading: warehouseLoading } = useQuery({
    queryKey: ['warehouse', warehouseId, 'ra-hub-check'],
    queryFn: () => getWarehouse(warehouseId!),
    enabled: needsWarehouseLookup,
    staleTime: 5 * 60 * 1000,
  });

  const hubIdResolved =
    hubIdFromAssignment !== undefined ? hubIdFromAssignment : warehouse?.hub_id;

  const hubIdKnown =
    hubIdFromAssignment !== undefined || warehouse != null || !needsWarehouseLookup;

  // Backfill hub_id on stale persisted assignments so sidebar/guards match the warehouse record.
  useEffect(() => {
    if (!warehouse || warehouseId == null || hubIdFromAssignment !== undefined) return;

    const { activeAssignment, assignments, setActiveAssignment, setAssignments } =
      useAuthStore.getState();
    if (activeAssignment?.warehouse?.id !== warehouseId) return;

    const warehouseWithHub = {
      ...activeAssignment.warehouse!,
      hub_id: warehouse.hub_id ?? null,
    };

    setActiveAssignment({ ...activeAssignment, warehouse: warehouseWithHub });
    setAssignments(
      assignments.map((a) =>
        a.id === activeAssignment.id && a.warehouse?.id === warehouseId
          ? { ...a, warehouse: warehouseWithHub }
          : a
      )
    );
  }, [warehouse, warehouseId, hubIdFromAssignment]);

  const isStandaloneWarehouse =
    isWarehouseManager &&
    warehouseId != null &&
    hubIdKnown &&
    (hubIdResolved == null);

  const isResolving = isWarehouseManager && needsWarehouseLookup && warehouseLoading;

  return {
    isWarehouseManager,
    isStandaloneWarehouse,
    canAccessRaWorkspace: !isWarehouseManager || isStandaloneWarehouse,
    canCreateRa: isStandaloneWarehouse,
    isResolving,
    hubIdResolved,
  };
}
