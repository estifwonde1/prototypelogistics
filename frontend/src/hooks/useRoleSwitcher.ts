import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, type OfficerAssignment } from '../store/authStore';
import { normalizeRoleSlug } from '../contracts/warehouse';
import type { StorekeeperStore } from '../api/me';
import { commitWorkspaceSwitch, prefetchDashboardForRole } from '../utils/workspaceSwitch';

/**
 * Determines whether the current facility (hub/warehouse/store) is compatible
 * with the target role. Returns the matching assignment if it is, null otherwise.
 */
function findCompatibleAssignment(
  candidates: OfficerAssignment[],
  currentAssignment: OfficerAssignment | null
): OfficerAssignment | null {
  if (!currentAssignment) return null;

  return candidates.find((c) => {
    // Same hub
    if (currentAssignment.hub?.id && c.hub?.id === currentAssignment.hub.id) return true;
    // Same warehouse (direct or via store's parent)
    const currentWarehouseId =
      currentAssignment.warehouse?.id ?? currentAssignment.store?.id ?? null;
    const candidateWarehouseId = c.warehouse?.id ?? null;
    if (currentWarehouseId && candidateWarehouseId === currentWarehouseId) return true;
    // Same store
    if (currentAssignment.store?.id && c.store?.id === currentAssignment.store.id) return true;
    return false;
  }) ?? null;
}

export type SwitchState =
  | { type: 'idle' }
  | { type: 'facility_picker'; targetRoleName: string; candidates: OfficerAssignment[] }
  | { type: 'store_picker' };

export function useRoleSwitcher() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { assignments, activeAssignment, role: currentRole } = useAuthStore();
  const [switchState, setSwitchState] = useState<SwitchState>({ type: 'idle' });

  const commitSwitch = useCallback(
    async (assignment: OfficerAssignment) => {
      await commitWorkspaceSwitch({
        assignment,
        queryClient,
        navigate,
        fromRole: currentRole,
        showNotification: true,
      });
      setSwitchState({ type: 'idle' });
    },
    [currentRole, navigate, queryClient]
  );

  const switchToRole = useCallback(
    (targetRoleName: string) => {
      const candidates = assignments.filter(
        (a) => a.role_name === targetRoleName
      );

      if (candidates.length === 0) return;

      const targetSlug = normalizeRoleSlug(targetRoleName);
      prefetchDashboardForRole(targetSlug);

      // Special case: WM switching to Storekeeper — they need to pick a store
      const currentRoleSlug = normalizeRoleSlug(currentRole ?? '');
      if (
        currentRoleSlug === 'warehouse_manager' &&
        targetSlug === 'storekeeper'
      ) {
        setSwitchState({ type: 'store_picker' });
        return;
      }

      // Try to preserve the current facility
      const compatible = findCompatibleAssignment(candidates, activeAssignment);
      if (compatible) {
        void commitSwitch(compatible);
        return;
      }

      // Single candidate — just switch
      if (candidates.length === 1) {
        void commitSwitch(candidates[0]);
        return;
      }

      // Multiple candidates, no facility match — show picker
      setSwitchState({ type: 'facility_picker', targetRoleName, candidates });
    },
    [assignments, activeAssignment, currentRole, commitSwitch]
  );

  const onFacilitySelected = useCallback(
    (assignment: OfficerAssignment) => {
      void commitSwitch(assignment);
    },
    [commitSwitch]
  );

  const onStoreSelected = useCallback(
    (store: StorekeeperStore) => {
      const realAssignment = assignments.find(
        (a) =>
          a.role_name === 'Storekeeper' &&
          (a.warehouse?.id === store.warehouse_id || a.store?.id === store.id)
      );

      if (realAssignment) {
        void commitSwitch(realAssignment);
        return;
      }

      const wmAssignment = assignments.find(
        (a) =>
          a.role_name === 'Warehouse Manager' &&
          a.warehouse?.id === store.warehouse_id
      );

      if (!wmAssignment) return;

      const synthetic: OfficerAssignment = {
        id: wmAssignment.id,
        role_name: 'Storekeeper',
        warehouse: wmAssignment.warehouse,
        store: { id: store.id, name: store.name },
        hub: null,
        location: null,
      };

      void commitSwitch(synthetic);
    },
    [assignments, commitSwitch]
  );

  const dismissPicker = useCallback(() => {
    setSwitchState({ type: 'idle' });
  }, []);

  return {
    switchState,
    switchToRole,
    onFacilitySelected,
    onStoreSelected,
    dismissPicker,
  };
}
