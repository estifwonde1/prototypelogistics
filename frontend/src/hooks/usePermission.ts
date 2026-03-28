import { useAuthStore } from '../store/authStore';
import { hasPermission, type Action, type Resource, type RoleSlug } from '../contracts/warehouse';

/**
 * Hook to check user permissions based on the centralized Phase 0
 * capability matrix, which mirrors backend policy enforcement.
 */
export const usePermission = () => {
  const role = useAuthStore((state) => state.role);

  const can = (resource: Resource, action: Action): boolean => {
    return hasPermission((role as RoleSlug | null) ?? null, resource, action);
  };

  return { can, role };
};
