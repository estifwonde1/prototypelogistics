/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Center, Loader } from '@mantine/core';
import { useAuthStore } from './store/authStore';
import { AppShell } from './components/layout/AppShell';
import { usePermission } from './hooks/usePermission';
import { AccessDenied } from './components/common/AccessDenied';
import { getDefaultRouteForRole, type RoleSlug } from './contracts/warehouse';

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
<<<<<<< Updated upstream
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const OfficerDashboardPage = lazy(() => import('./pages/officer/OfficerDashboardPage'));
const FacilitiesOverviewPage = lazy(() => import('./pages/officer/FacilitiesOverviewPage'));
const ReceiptOrdersListPage = lazy(() => import('./pages/officer/ReceiptOrdersListPage'));
const ReceiptOrderFormPage = lazy(() => import('./pages/officer/ReceiptOrderFormPage'));
const ReceiptOrderDetailPage = lazy(() => import('./pages/officer/ReceiptOrderDetailPage'));
const CommodityFormPage = lazy(() => import('./pages/officer/CommodityFormPage'));
const CommoditiesSetupPage = lazy(() => import('./pages/admin/setup/CommoditiesSetupPage'));
const DispatchOrdersListPage = lazy(() => import('./pages/officer/DispatchOrdersListPage'));
const DispatchOrderFormPage = lazy(() => import('./pages/officer/DispatchOrderFormPage'));
const DispatchOrderDetailPage = lazy(() => import('./pages/officer/DispatchOrderDetailPage'));
const HubListPage = lazy(() => import('./pages/hubs/HubListPage'));
const HubDetailPage = lazy(() => import('./pages/hubs/HubDetailPage'));
const HubFormPage = lazy(() => import('./pages/hubs/HubFormPage'));
const WarehouseListPage = lazy(() => import('./pages/warehouses/WarehouseListPage'));
const WarehouseDetailPage = lazy(() => import('./pages/warehouses/WarehouseDetailPage'));
const WarehouseFormPage = lazy(() => import('./pages/warehouses/WarehouseFormPage'));
const StoreListPage = lazy(() => import('./pages/stores/StoreListPage'));
const StoreFormPage = lazy(() => import('./pages/stores/StoreFormPage'));
const StackListPage = lazy(() => import('./pages/stacks/StackListPage'));
const StackFormPage = lazy(() => import('./pages/stacks/StackFormPage'));
const StockBalancePage = lazy(() => import('./pages/stock/StockBalancePage'));
const GrnListPage = lazy(() => import('./pages/grns/GrnListPage'));
const GrnCreatePage = lazy(() => import('./pages/grns/GrnCreatePage'));
const GrnDetailPage = lazy(() => import('./pages/grns/GrnDetailPage'));
const GinListPage = lazy(() => import('./pages/gins/GinListPage'));
const GinCreatePage = lazy(() => import('./pages/gins/GinCreatePage'));
const GinDetailPage = lazy(() => import('./pages/gins/GinDetailPage'));
const InspectionListPage = lazy(() => import('./pages/inspections/InspectionListPage'));
const InspectionCreatePage = lazy(() => import('./pages/inspections/InspectionCreatePage'));
const InspectionDetailPage = lazy(() => import('./pages/inspections/InspectionDetailPage'));
const WaybillListPage = lazy(() => import('./pages/waybills/WaybillListPage'));
const WaybillCreatePage = lazy(() => import('./pages/waybills/WaybillCreatePage'));
const WaybillDetailPage = lazy(() => import('./pages/waybills/WaybillDetailPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/users/AdminUsersPage'));
const UserAssignmentsPage = lazy(() => import('./pages/admin/assignments/UserAssignmentsPage'));
const LocationsSetupPage = lazy(() => import('./pages/admin/setup/LocationsSetupPage'));
const HubSetupPage = lazy(() => import('./pages/admin/setup/HubSetupPage'));
const WarehouseSetupPage = lazy(() => import('./pages/admin/setup/WarehouseSetupPage'));
const StorekeeperAssignmentsPage = lazy(() => import('./pages/storekeeper/StorekeeperAssignmentsPage'));
const DispatchListPage = lazy(() => import('./pages/dispatches/DispatchListPage'));
const BinCardReportPage = lazy(() => import('./pages/reports/BinCardReportPage'));
const StackLayoutPage = lazy(() => import('./pages/stacks/StackLayoutPage'));
=======
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
const DispatchOrdersListPage = lazyWithReload(() => import('./pages/officer/DispatchOrdersListPage'));
const DispatchOrderFormPage = lazyWithReload(() => import('./pages/officer/DispatchOrderFormPage'));
const DispatchOrderDetailPage = lazyWithReload(() => import('./pages/officer/DispatchOrderDetailPage'));
const HubListPage = lazyWithReload(() => import('./pages/hubs/HubListPage'));
const HubDetailPage = lazyWithReload(() => import('./pages/hubs/HubDetailPage'));
const HubFormPage = lazyWithReload(() => import('./pages/hubs/HubFormPage'));
const WarehouseListPage = lazyWithReload(() => import('./pages/warehouses/WarehouseListPage'));
const WarehouseDetailPage = lazyWithReload(() => import('./pages/warehouses/WarehouseDetailPage'));
const WarehouseFormPage = lazyWithReload(() => import('./pages/warehouses/WarehouseFormPage'));
const StoreListPage = lazyWithReload(() => import('./pages/stores/StoreListPage'));
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
>>>>>>> Stashed changes

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

const EntryRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const role = useAuthStore((state) => state.role);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
        path: 'officer/commodities/new',
        element: (
          <RequirePermission resource="receipt_orders" action="create">
            <CommodityFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/dispatch-orders',
        element: (
          <RequirePermission resource="dispatch_orders" action="read">
            <DispatchOrdersListPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/dispatch-orders/new',
        element: (
          <RequirePermission resource="dispatch_orders" action="create">
            <DispatchOrderFormPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/dispatch-orders/:id',
        element: (
          <RequirePermission resource="dispatch_orders" action="read">
            <DispatchOrderDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: 'officer/dispatch-orders/:id/edit',
        element: (
          <RequirePermission resource="dispatch_orders" action="update">
            <DispatchOrderFormPage />
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
            <HubFormPage />
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
        path: 'admin/users',
        element: (
          <RequireAdmin>
            <AdminUsersPage />
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
    ],
  },
]);
