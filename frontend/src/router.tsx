import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Center, Loader } from '@mantine/core';
import { useAuthStore } from './store/authStore';
import { AppShell } from './components/layout/AppShell';

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

// Loading fallback
const LoadingFallback = () => (
  <Center h="100vh">
    <Loader size="lg" />
  </Center>
);

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
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
        element: <HubListPage />,
      },
      {
        path: 'hubs/new',
        element: <HubFormPage />,
      },
      {
        path: 'hubs/:id',
        element: <HubDetailPage />,
      },
      {
        path: 'hubs/:id/edit',
        element: <HubFormPage />,
      },
      {
        path: 'warehouses',
        element: <WarehouseListPage />,
      },
      {
        path: 'warehouses/new',
        element: <WarehouseFormPage />,
      },
      {
        path: 'warehouses/:id',
        element: <WarehouseDetailPage />,
      },
      {
        path: 'warehouses/:id/edit',
        element: <WarehouseFormPage />,
      },
      {
        path: 'stores',
        element: <StoreListPage />,
      },
      {
        path: 'stores/new',
        element: <StoreFormPage />,
      },
      {
        path: 'stores/:id/edit',
        element: <StoreFormPage />,
      },
      {
        path: 'stacks',
        element: <StackListPage />,
      },
      {
        path: 'stacks/new',
        element: <StackFormPage />,
      },
      {
        path: 'stacks/:id/edit',
        element: <StackFormPage />,
      },
      {
        path: 'stock-balances',
        element: <StockBalancePage />,
      },
      {
        path: 'grns',
        element: <GrnListPage />,
      },
      {
        path: 'grns/new',
        element: <GrnCreatePage />,
      },
      {
        path: 'grns/:id',
        element: <GrnDetailPage />,
      },
      {
        path: 'gins',
        element: <GinListPage />,
      },
      {
        path: 'gins/new',
        element: <GinCreatePage />,
      },
      {
        path: 'gins/:id',
        element: <GinDetailPage />,
      },
      {
        path: 'inspections',
        element: <InspectionListPage />,
      },
      {
        path: 'inspections/new',
        element: <InspectionCreatePage />,
      },
      {
        path: 'inspections/:id',
        element: <InspectionDetailPage />,
      },
      {
        path: 'waybills',
        element: <WaybillListPage />,
      },
      {
        path: 'waybills/new',
        element: <WaybillCreatePage />,
      },
      {
        path: 'waybills/:id',
        element: <WaybillDetailPage />,
      },
    ],
  },
]);
