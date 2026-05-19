import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useAuthStore, type OfficerAssignment } from '../store/authStore';
import { normalizeRoleSlug, getDefaultRouteForRole, type RoleSlug } from '../contracts/warehouse';
import { postRoleSwitch, type StorekeeperStore } from '../api/me';

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
  const { assignments, activeAssignment, role: currentRole, setActiveAssignment } = useAuthStore();
  const [switchState, setSwitchState] = useState<SwitchState>({ type: 'idle' });

  /**
   * Commits the role switch: updates the store, invalidates all queries,
   * fires the audit log, and navigates to the new role's default route.
   */
  const commitSwitch = useCallback(
    async (assignment: OfficerAssignment) => {
      const toRole = normalizeRoleSlug(assignment.role_name) as RoleSlug | null;
      if (!toRole) return;

      const facilityLabel =
        assignment.hub?.name ??
        assignment.warehouse?.name ??
        assignment.store?.name ??
        assignment.location?.name ??
        'Federal';

      // 1. Update local state immediately (optimistic)
      setActiveAssignment(assignment);

      // 2. Wipe all cached queries so the new role sees fresh scoped data
      queryClient.clear();

      // 3. Navigate to the new role's default route
      navigate(getDefaultRouteForRole(toRole), { replace: true });

      // 4. Fire audit log in the background (non-blocking)
      postRoleSwitch({
        assignment_id: assignment.id,
        from_role: currentRole,
        to_role: assignment.role_name,
        facility_name: facilityLabel,
      }).catch(() => {
        // Audit failure is non-fatal — the switch already happened
      });

      notifications.show({
        title: 'Role switched',
        message: `Now operating as ${assignment.role_name} at ${facilityLabel}`,
        color: 'blue',
        autoClose: 3000,
      });

      setSwitchState({ type: 'idle' });
    },
    [currentRole, navigate, queryClient, setActiveAssignment]
  );

  /**
   * Main entry point. Call this with the role_name string the user clicked.
   *
   * Decision tree:
   * 1. Warehouse Manager → Storekeeper (dual-role): open store picker
   * 2. One matching assignment that shares the current facility: switch directly
   * 3. One matching assignment with a different facility: switch directly
   * 4. Multiple matching assignments: open facility picker
   */
  const switchToRole = useCallback(
    (targetRoleName: string) => {
      const candidates = assignments.filter(
        (a) => a.role_name === targetRoleName
      );

      if (candidates.length === 0) return;

      // Special case: WM switching to Storekeeper — they need to pick a store
      const currentRoleSlug = normalizeRoleSlug(currentRole ?? '');
      const targetSlug = normalizeRoleSlug(targetRoleName);
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

  /**
   * Called when the user picks a facility from the FacilityPickerModal.
   */
  const onFacilitySelected = useCallback(
    (assignment: OfficerAssignment) => {
      void commitSwitch(assignment);
    },
    [commitSwitch]
  );

  /**
   * Called when the user picks a store from the StorekeeperStorePickerModal.
   * We synthesise a virtual OfficerAssignment from the store data so the
   * existing commitSwitch path works unchanged.
   */
  const onStoreSelected = useCallback(
    (store: StorekeeperStore) => {
      // Find the real Storekeeper assignment for this warehouse (if any)
      const realAssignment = assignments.find(
        (a) =>
          a.role_name === 'Storekeeper' &&
          (a.warehouse?.id === store.warehouse_id || a.store?.id === store.id)
      );

      if (realAssignment) {
        void commitSwitch(realAssignment);
        return;
      }

      // No pre-existing Storekeeper assignment for this store — build a synthetic one.
      // The backend will validate via the assignment_id audit call, but the frontend
      // can still operate using the WM's warehouse assignment as context.
      const wmAssignment = assignments.find(
        (a) =>
          a.role_name === 'Warehouse Manager' &&
          a.warehouse?.id === store.warehouse_id
      );

      if (!wmAssignment) return;

      const synthetic: OfficerAssignment = {
        id: wmAssignment.id, // reuse WM assignment id for audit
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
