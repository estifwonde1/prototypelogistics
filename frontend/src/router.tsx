/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Center, Loader } from '@mantine/core';
import { useAuthStore } from './store/authStore';
import { AppShell } from './components/layout/AppShell';
import { usePermission } from './hooks/usePermission';
import { AccessDenied } from './components/common/AccessDenied';
import { RequireStandaloneWarehouseRa } from './components/common/RequireStandaloneWarehouseRa';
import { getDefaultRouteForRole, type RoleSlug } from './contracts/warehouse';
import {
  assignmentHasRequiredFacility,
  effectiveActiveAssignment,
  needsWorkspaceSelection,
} from './utils/workspaceSelection';

const CHUNK_RELOAD_KEY = 'cats:chunk-reload-attempted';

function isChunkLoadError(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error);
  return /dynamically imported module|failed to fetch dynamically imported module|importing a module script failed|loading chunk/i.test(
    message
  );
}

function lazyWithReload<T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T }>
) {
  return lazy(() =>
    importer()
      .then((module) => {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return module;
      })
      .catch((error) => {
        if (
          isChunkLoadError(error) &&
          sessionStorage.getItem(CHUNK_RELOAD_KEY) !== 'true'
        ) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
        throw error;
      })
  );
}

// Lazy load pages
const LoginPage = lazyWithReload(() => import('./pages/auth/LoginPage'));
const RoleSelectionPage = lazyWithReload(() => import('./pages/auth/RoleSelectionPage'));
const DashboardPage = lazyWithReload(() => import('./pages/dashboard/DashboardPage'));
const OfficerDashboardPage = lazyWithReload(() => import('./pages/officer/OfficerDashboardPage'));
const HubManagerDashboardPage = lazyWithReload(() => import('./pages/hubs/HubManagerDashboardPage'));
const WarehouseManagerDashboardPage = lazyWithReload(() => import('./pages/warehouses/WarehouseManagerDashboardPage'));
const StorekeeperDashboardPage = lazyWithReload(() => import('./pages/storekeeper/StorekeeperDashboardPage'));
const FacilitiesOverviewPage = lazyWithReload(() => import('./pages/officer/FacilitiesOverviewPage'));
const ReceiptOrdersListPage = lazyWithReload(() => import('./pages/officer/ReceiptOrdersListPage'));
const ReceiptOrderFormPage = lazyWithReload(() => import('./pages/officer/ReceiptOrderFormPage'));
const ReceiptOrderDetailPage = lazyWithReload(() => import('./pages/officer/ReceiptOrderDetailPage'));
const CommodityFormPage = lazyWithReload(() => import('./pages/officer/CommodityFormPage'));
const CommoditiesSetupPage = lazyWithReload(() => import('./pages/admin/setup/CommoditiesSetupPage'));
const DispatchOrderDetailPage = lazyWithReload(() => import('./pages/officer/DispatchOrderDetailPage'));
const DispatchPlanListPage = lazyWithReload(() => import('./pages/officer/DispatchPlanListPage'));
const DispatchPlanFormPage = lazyWithReload(() => import('./pages/officer/DispatchPlanFormPage'));
const FdpSetupPage = lazyWithReload(() => import('./pages/admin/setup/FdpSetupPage'));
const DispatchAuthorizationListPage = lazyWithReload(() => import('./pages/hub-manager/DispatchAuthorizationListPage'));
const HubListPage = lazyWithReload(() => import('./pages/hubs/HubListPage'));
const HubDetailPage = lazyWithReload(() => import('./pages/hubs/HubDetailPage'));
const HubFormPage = lazyWithReload(() => import('./pages/hubs/HubFormPage'));
const WarehouseListPage = lazyWithReload(() => import('./pages/warehouses/WarehouseListPage'));
const WarehouseDetailPage = lazyWithReload(() => import('./pages/warehouses/WarehouseDetailPage'));
const WarehouseFormPage = lazyWithReload(() => import('./pages/warehouses/WarehouseFormPage'));
const StoreListPage = lazyWithReload(() => import('./pages/stores/StoreListPage'));
const StoreDetailPage = lazyWithReload(() => import('./pages/stores/StoreDetailPage'));
const StoreFormPage = lazyWithReload(() => import('./pages/stores/StoreFormPage'));
const StackListPage = lazyWithReload(() => import('./pages/stacks/StackListPage'));
const StackFormPage = lazyWithReload(() => import('./pages/stacks/StackFormPage'));
const StockBalancePage = lazyWithReload(() => import('./pages/stock/StockBalancePage'));
const GrnListPage = lazyWithReload(() => import('./pages/grns/GrnListPage'));
const GrnCreatePage = lazyWithReload(() => import('./pages/grns/GrnCreatePage'));
const GrnDetailPage = lazyWithReload(() => import('./pages/grns/GrnDetailPage'));
const GinListPage = lazyWithReload(() => import('./pages/gins/GinListPage'));
const GinCreatePage = lazyWithReload(() => import('./pages/gins/GinCreatePage'));
const GinDetailPage = lazyWithReload(() => import('./pages/gins/GinDetailPage'));
const InspectionListPage = lazyWithReload(() => import('./pages/inspections/InspectionListPage'));
const InspectionCreatePage = lazyWithReload(() => import('./pages/inspections/InspectionCreatePage'));
const InspectionDetailPage = lazyWithReload(() => import('./pages/inspections/InspectionDetailPage'));
const WaybillListPage = lazyWithReload(() => import('./pages/waybills/WaybillListPage'));
const WaybillCreatePage = lazyWithReload(() => import('./pages/waybills/WaybillCreatePage'));
const WaybillDetailPage = lazyWithReload(() => import('./pages/waybills/WaybillDetailPage'));
const AdminUsersPage = lazyWithReload(() => import('./pages/admin/users/AdminUsersPage'));
const ProfilePage = lazyWithReload(() => import('./pages/profile/ProfilePage'));
const UserAssignmentsPage = lazyWithReload(() => import('./pages/admin/assignments/UserAssignmentsPage'));
const RolesManagementPage = lazyWithReload(() => import('./pages/admin/roles/RolesManagementPage'));
const LocationsSetupPage = lazyWithReload(() => import('./pages/admin/setup/LocationsSetupPage'));
const HubSetupPage = lazyWithReload(() => import('./pages/admin/setup/HubSetupPage'));
const WarehouseSetupPage = lazyWithReload(() => import('./pages/admin/setup/WarehouseSetupPage'));
const StorekeeperAssignmentsPage = lazyWithReload(() => import('./pages/storekeeper/StorekeeperAssignmentsPage'));
const DispatchListPage = lazyWithReload(() => import('./pages/dispatches/DispatchListPage'));
const BinCardReportPage = lazyWithReload(() => import('./pages/reports/BinCardReportPage'));
const StackLayoutPage = lazyWithReload(() => import('./pages/stacks/StackLayoutPage'));
const TransferRequestsPage = lazyWithReload(() => import('./pages/stock/TransferRequestsPage'));
const ReceiptAuthorizationListPage = lazyWithReload(() => import('./pages/hub-manager/ReceiptAuthorizationListPage'));
const ReceiptAuthorizationFormPage = lazyWithReload(() => import('./pages/hub-manager/ReceiptAuthorizationFormPage'));
const ReceiptAuthorizationDetailPage = lazyWithReload(() => import('./pages/hub-manager/ReceiptAuthorizationDetailPage'));
const StorekeeperRAListPage = lazyWithReload(() => import('./pages/storekeeper/StorekeeperRAListPage'));
const StorekeeperRADetailPage = lazyWithReload(() => import('./pages/storekeeper/StorekeeperRADetailPage'));

// Loading fallback
const LoadingFallback = () => (
  <Center h="100vh">
    <Loader size="lg" />
  </Center>
);

type PermissionArgs = Parameters<ReturnType<typeof usePermission>['can']>;
type PermissionResource = PermissionArgs[0];
type PermissionAction = PermissionArgs[1];

// Protected Route Component
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
};

const RequirePermission = ({
  resource,
  action,
  children,
}: {
  resource: PermissionResource;
  action: PermissionAction;
  children: ReactNode;
}) => {
  const { can } = usePermission();
  if (!can(resource, action)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
};

const RequireAdmin = ({ children }: { children: ReactNode }) => {
  const role = useAuthStore((state) => state.role);
  if (role !== 'admin' && role !== 'superadmin') {
    return <AccessDenied />;
  }
  return <>{children}</>;
};

function HubEditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/admin/setup/hubs?id=${id}`} replace />;
}

function RedirectOfficerDispatchOrderToPlan() {
  const { id } = useParams();
  return <Navigate to={`/officer/dispatch-plan/${id}`} replace />;
}

const EntryRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const role = useAuthStore((state) => state.role);
  const assignments = useAuthStore((state) => state.assignments);
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const setActiveAssignment = useAuthStore((state) => state.setActiveAssignment);

  useEffect(() => {
    if (assignments.length !== 1) return;
    const only = assignments[0];
    if (!activeAssignment || activeAssignment.id !== only.id) {
      setActiveAssignment(only);
    }
  }, [assignments, activeAssignment, setActiveAssignment]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const workspace = effectiveActiveAssignment(assignments, activeAssignment);

  if (assignments.length > 1 && needsWorkspaceSelection(assignments, activeAssignment)) {
    return <Navigate to="/select-role" replace state={{ fromLogin: true }} />;
  }

  if (assignments.length > 0 && !assignmentHasRequiredFacility(workspace, role)) {
    return <Navigate to="/select-role" replace state={{ fromLogin: true }} />;
  }

  return <Navigate to={getDefaultRouteForRole((role as RoleSlug | null) ?? null)} replace />;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/select-role',
    element: (
      <ProtectedRoute>
        <Suspense fallback={<LoadingFallback />}>
          <RoleSelectionPage />
        </Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <EntryRoute />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'officer/dashboard',
        element: (
          <RequirePermission resource="receipt_orders" action="read">
            <OfficerDashboardPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hub/dashboard',
        element: (
          <RequirePermission resource="hubs" action="read">
            <HubManagerDashboardPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hub/receipt-authorizations',
        element: (
          <RequirePermission resource="receipt_authorizations" action="read">
            <ReceiptAuthorizationListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hub/receipt-authorizations/new',
        element: (
          <RequirePermission resource="receipt_authorizations" action="read">
            <ReceiptAuthorizationFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hub/receipt-authorizations/:id',
        element: (
          <RequirePermission resource="receipt_authorizations" action="read">
            <ReceiptAuthorizationDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hub/receipt-authorizations/:id/edit',
        element: (
          <RequirePermission resource="receipt_authorizations" action="read">
            <ReceiptAuthorizationFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hub/dispatch-authorizations',
        element: (
          <RequirePermission resource="dispatch_orders" action="read">
            <DispatchAuthorizationListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hub/dispatch-authorizations/:id',
        element: (
          <RequirePermission resource="dispatch_orders" action="read">
            <DispatchOrderDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'warehouse/dashboard',
        element: (
          <RequirePermission resource="warehouses" action="read">
            <WarehouseManagerDashboardPage />
          </RequirePermission>
        ),
      },
      {
        path: 'warehouse/receipt-authorizations',
        element: (
          <RequirePermission resource="receipt_authorizations" action="read">
            <RequireStandaloneWarehouseRa>
              <ReceiptAuthorizationListPage />
            </RequireStandaloneWarehouseRa>
          </RequirePermission>
        ),
      },
      {
        path: 'warehouse/receipt-authorizations/new',
        element: (
          <RequirePermission resource="receipt_authorizations" action="read">
            <RequireStandaloneWarehouseRa requireCreate>
              <ReceiptAuthorizationFormPage />
            </RequireStandaloneWarehouseRa>
          </RequirePermission>
        ),
      },
      {
        path: 'warehouse/receipt-authorizations/:id',
        element: (
          <RequirePermission resource="receipt_authorizations" action="read">
            <RequireStandaloneWarehouseRa>
              <ReceiptAuthorizationDetailPage />
            </RequireStandaloneWarehouseRa>
          </RequirePermission>
        ),
      },
      {
        path: 'warehouse/receipt-authorizations/:id/edit',
        element: (
          <RequirePermission resource="receipt_authorizations" action="read">
            <RequireStandaloneWarehouseRa requireCreate>
              <ReceiptAuthorizationFormPage />
            </RequireStandaloneWarehouseRa>
          </RequirePermission>
        ),
      },
      {
        path: 'warehouse/dispatch-authorizations',
        element: (
          <RequirePermission resource="dispatch_orders" action="read">
            <DispatchAuthorizationListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'warehouse/dispatch-authorizations/:id',
        element: (
          <RequirePermission resource="dispatch_orders" action="read">
            <DispatchOrderDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'storekeeper/dashboard',
        element: (
          <RequirePermission resource="stores" action="read">
            <StorekeeperDashboardPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/facilities',
        element: (
          <RequirePermission resource="receipt_orders" action="read">
            <FacilitiesOverviewPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/receipt-orders',
        element: (
          <RequirePermission resource="receipt_orders" action="read">
            <ReceiptOrdersListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'receipt-orders',
        element: (
          <RequirePermission resource="receipt_orders" action="read">
            <ReceiptOrdersListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/receipt-orders/new',
        element: (
          <RequirePermission resource="receipt_orders" action="create">
            <ReceiptOrderFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/receipt-orders/:id',
        element: (
          <RequirePermission resource="receipt_orders" action="read">
            <ReceiptOrderDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'receipt-orders/:id',
        element: (
          <RequirePermission resource="receipt_orders" action="read">
            <ReceiptOrderDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/receipt-orders/:id/edit',
        element: (
          <RequirePermission resource="receipt_orders" action="update">
            <ReceiptOrderFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/commodities',
        element: (
          <RequirePermission resource="receipt_orders" action="create">
            <CommodityFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/commodities/new',
        element: <Navigate to="/officer/commodities?tab=create" replace />,
      },
      {
        path: 'officer/dispatch-orders',
        element: <Navigate to="/officer/dispatch-plan" replace />,
      },
      {
        path: 'officer/dispatch-orders/new',
        element: <Navigate to="/officer/dispatch-plan/new" replace />,
      },
      {
        path: 'officer/dispatch-orders/:id',
        element: <RedirectOfficerDispatchOrderToPlan />,
      },
      {
        path: 'dispatch-orders/:id',
        element: (
          <RequirePermission resource="dispatch_orders" action="read">
            <DispatchOrderDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/dispatch-orders/:id/edit',
        element: <RedirectOfficerDispatchOrderToPlan />,
      },
      {
        path: 'officer/dispatch-plan',
        element: (
          <RequirePermission resource="dispatch_orders" action="read">
            <DispatchPlanListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/dispatch-plan/new',
        element: (
          <RequirePermission resource="dispatch_orders" action="create">
            <DispatchPlanFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/dispatch-plan/:id',
        element: (
          <RequirePermission resource="dispatch_orders" action="read">
            <DispatchOrderDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hubs',
        element: (
          <RequirePermission resource="hubs" action="read">
            <HubListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hubs/new',
        element: (
          <RequirePermission resource="hubs" action="create">
            <HubFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hubs/:id',
        element: (
          <RequirePermission resource="hubs" action="read">
            <HubDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'hubs/:id/edit',
        element: (
          <RequirePermission resource="hubs" action="update">
            <HubEditRedirect />
          </RequirePermission>
        ),
      },
      {
        path: 'warehouses',
        element: (
          <RequirePermission resource="warehouses" action="read">
            <WarehouseListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'warehouses/new',
        element: (
          <RequirePermission resource="warehouses" action="create">
            <WarehouseFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'warehouses/:id',
        element: (
          <RequirePermission resource="warehouses" action="read">
            <WarehouseDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'warehouses/:id/edit',
        element: (
          <RequirePermission resource="warehouses" action="update">
            <WarehouseFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'stores',
        element: (
          <RequirePermission resource="stores" action="read">
            <StoreListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'stores/new',
        element: (
          <RequirePermission resource="stores" action="create">
            <StoreFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'stores/:id',
        element: (
          <RequirePermission resource="stores" action="read">
            <StoreDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'stores/:id/edit',
        element: (
          <RequirePermission resource="stores" action="update">
            <StoreFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'stacks',
        element: (
          <RequirePermission resource="stacks" action="read">
            <StackListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'stacks/new',
        element: (
          <RequirePermission resource="stacks" action="create">
            <StackFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'stacks/:id/edit',
        element: (
          <RequirePermission resource="stacks" action="update">
            <StackFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'stock-balances',
        element: (
          <RequirePermission resource="stock_balances" action="read">
            <StockBalancePage />
          </RequirePermission>
        ),
      },
      {
        path: 'grns',
        element: (
          <RequirePermission resource="grns" action="read">
            <GrnListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'grns/new',
        element: (
          <RequirePermission resource="grns" action="create">
            <GrnCreatePage />
          </RequirePermission>
        ),
      },
      {
        path: 'grns/:id',
        element: (
          <RequirePermission resource="grns" action="read">
            <GrnDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'gins',
        element: (
          <RequirePermission resource="gins" action="read">
            <GinListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'gins/new',
        element: (
          <RequirePermission resource="gins" action="create">
            <GinCreatePage />
          </RequirePermission>
        ),
      },
      {
        path: 'gins/:id',
        element: (
          <RequirePermission resource="gins" action="read">
            <GinDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'inspections',
        element: (
          <RequirePermission resource="inspections" action="read">
            <InspectionListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'inspections/new',
        element: (
          <RequirePermission resource="inspections" action="create">
            <InspectionCreatePage />
          </RequirePermission>
        ),
      },
      {
        path: 'inspections/:id',
        element: (
          <RequirePermission resource="inspections" action="read">
            <InspectionDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'waybills',
        element: (
          <RequirePermission resource="waybills" action="read">
            <WaybillListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'waybills/new',
        element: (
          <RequirePermission resource="waybills" action="create">
            <WaybillCreatePage />
          </RequirePermission>
        ),
      },
      {
        path: 'waybills/:id',
        element: (
          <RequirePermission resource="waybills" action="read">
            <WaybillDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'receipts',
        element: (
          <RequirePermission resource="receipt_orders" action="read">
            <ReceiptOrdersListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'dispatches',
        element: (
          <RequirePermission resource="dispatches" action="read">
            <DispatchListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'storekeeper/assignments',
        element: (
          <RequirePermission resource="receipt_orders" action="read">
            <StorekeeperAssignmentsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'storekeeper/receipt-authorizations',
        element: (
          <RequirePermission resource="receipt_orders" action="read">
            <StorekeeperRAListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'storekeeper/receipt-authorizations/:id',
        element: (
          <RequirePermission resource="receipt_orders" action="read">
            <StorekeeperRADetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'reports/bin-card',
        element: (
          <RequirePermission resource="reports" action="read">
            <BinCardReportPage />
          </RequirePermission>
        ),
      },
      {
        path: 'stacks/layout',
        element: (
          <RequirePermission resource="stacks" action="read">
            <StackLayoutPage />
          </RequirePermission>
        ),
      },
      {
        path: 'transfer-requests',
        element: (
          <RequirePermission resource="transfer_requests" action="read">
            <TransferRequestsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'admin/users',
        element: (
          <RequireAdmin>
            <AdminUsersPage />
          </RequireAdmin>
        ),
      },
      {
        path: 'admin/roles',
        element: (
          <RequireAdmin>
            <RolesManagementPage />
          </RequireAdmin>
        ),
      },
      {
        path: 'admin/assignments',
        element: (
          <RequireAdmin>
            <UserAssignmentsPage />
          </RequireAdmin>
        ),
      },
      {
        path: 'admin/setup/locations',
        element: (
          <RequireAdmin>
            <LocationsSetupPage />
          </RequireAdmin>
        ),
      },
      {
        path: 'admin/setup/hubs',
        element: (
          <RequireAdmin>
            <HubSetupPage />
          </RequireAdmin>
        ),
      },
      {
        path: 'admin/setup/warehouses',
        element: (
          <RequireAdmin>
            <WarehouseSetupPage />
          </RequireAdmin>
        ),
      },
      {
        path: 'admin/setup/commodities',
        element: (
          <RequireAdmin>
            <CommoditiesSetupPage />
          </RequireAdmin>
        ),
      },
      {
        path: 'admin/setup/fdps',
        element: (
          <RequireAdmin>
            <FdpSetupPage />
          </RequireAdmin>
        ),
      },
    ],
  },
]);
