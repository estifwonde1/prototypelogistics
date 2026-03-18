import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Center, Loader } from '@mantine/core';
import { useAuthStore } from './store/authStore';
import { AppShell } from './components/layout/AppShell';
import { usePermission } from './hooks/usePermission';
import { AccessDenied } from './components/common/AccessDenied';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
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
const ReceiptListPage = lazy(() => import('./pages/receipts/ReceiptListPage'));
const DispatchListPage = lazy(() => import('./pages/dispatches/DispatchListPage'));
const BinCardReportPage = lazy(() => import('./pages/reports/BinCardReportPage'));
const StackLayoutPage = lazy(() => import('./pages/stacks/StackLayoutPage'));

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
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
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
  children: React.ReactNode;
}) => {
  const { can } = usePermission();
  if (!can(resource, action)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
};

const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
  const role = useAuthStore((state) => state.role);
  if (role !== 'admin' && role !== 'superadmin') {
    return <AccessDenied />;
  }
  return <>{children}</>;
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
        element: <DashboardPage />,
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
          <RequirePermission resource="receipts" action="read">
            <ReceiptListPage />
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
    ],
  },
]);
