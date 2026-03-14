import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';
import { getDefaultRouteForRole, PATH_SEGMENT_TO_RESOURCE, type RoleSlug } from '../../utils/constants';

/**
 * Protects routes by role: if the current path maps to a resource the user
 * cannot read, redirects to their role's default page.
 */
export function RouteGuard() {
  const location = useLocation();
  const { can } = usePermission();
  const roleFromStore = useAuthStore((state) => state.role);

  const pathSegment = location.pathname.split('/').filter(Boolean)[0];
  const resource = pathSegment ? PATH_SEGMENT_TO_RESOURCE[pathSegment] : null;

  // Dashboard (/) or unknown path: allow
  if (!resource) {
    return <Outlet />;
  }

  if (!can(resource, 'read')) {
    const roleSlug = (roleFromStore || null) as RoleSlug | null;
    return <Navigate to={getDefaultRouteForRole(roleSlug)} replace />;
  }

  return <Outlet />;
}
