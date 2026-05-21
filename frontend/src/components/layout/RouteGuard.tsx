import { useEffect } from 'react';
import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';
import { getDefaultRouteForRole, PATH_SEGMENT_TO_RESOURCE, type RoleSlug } from '../../contracts/warehouse';
import {
  assignmentHasRequiredFacility,
  effectiveActiveAssignment,
  needsWorkspaceSelection,
} from '../../utils/workspaceSelection';

/**
 * Protects routes by role: if the current path maps to a resource the user
 * cannot read, redirects to their role's default page.
 */
export function RouteGuard() {
  const location = useLocation();
  const { can } = usePermission();
  const roleFromStore = useAuthStore((state) => state.role);
  const assignments = useAuthStore((state) => state.assignments);
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const setActiveAssignment = useAuthStore((state) => state.setActiveAssignment);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  useEffect(() => {
    if (assignments.length !== 1) return;
    const only = assignments[0];
    if (!activeAssignment || activeAssignment.id !== only.id) {
      setActiveAssignment(only);
    }
  }, [assignments, activeAssignment, setActiveAssignment]);

  const workspace = effectiveActiveAssignment(assignments, activeAssignment);

  if (isAuthenticated && assignments.length > 1 && needsWorkspaceSelection(assignments, activeAssignment)) {
    return <Navigate to="/select-role" replace state={{ fromLogin: true }} />;
  }

  if (
    isAuthenticated &&
    assignments.length > 0 &&
    !assignmentHasRequiredFacility(workspace, roleFromStore)
  ) {
    return <Navigate to="/select-role" replace state={{ fromLogin: true }} />;
  }

  const pathSegment = location.pathname.split('/').filter(Boolean)[0];
  if (pathSegment === 'admin') {
    return roleFromStore === 'admin' || roleFromStore === 'superadmin' ? <Outlet /> : <Navigate to="/" replace />;
  }
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
