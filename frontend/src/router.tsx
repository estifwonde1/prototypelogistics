import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuthStore } from './store/authStore';

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

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<div>Loading...</div>}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: <ProtectedRoute><DashboardPage /></ProtectedRoute>,
  },
  {
    path: '/hubs',
    element: <ProtectedRoute><HubListPage /></ProtectedRoute>,
  },
  {
    path: '/hubs/new',
    element: <ProtectedRoute><HubFormPage /></ProtectedRoute>,
  },
  {
    path: '/hubs/:id',
    element: <ProtectedRoute><HubDetailPage /></ProtectedRoute>,
  },
  {
    path: '/hubs/:id/edit',
    element: <ProtectedRoute><HubFormPage /></ProtectedRoute>,
  },
  {
    path: '/warehouses',
    element: <ProtectedRoute><WarehouseListPage /></ProtectedRoute>,
  },
  {
    path: '/warehouses/new',
    element: <ProtectedRoute><WarehouseFormPage /></ProtectedRoute>,
  },
  {
    path: '/warehouses/:id',
    element: <ProtectedRoute><WarehouseDetailPage /></ProtectedRoute>,
  },
  {
    path: '/warehouses/:id/edit',
    element: <ProtectedRoute><WarehouseFormPage /></ProtectedRoute>,
  },
  {
    path: '/stores',
    element: <ProtectedRoute><StoreListPage /></ProtectedRoute>,
  },
  {
    path: '/stores/new',
    element: <ProtectedRoute><StoreFormPage /></ProtectedRoute>,
  },
  {
    path: '/stores/:id/edit',
    element: <ProtectedRoute><StoreFormPage /></ProtectedRoute>,
  },
  {
    path: '/stacks',
    element: <ProtectedRoute><StackListPage /></ProtectedRoute>,
  },
  {
    path: '/stacks/new',
    element: <ProtectedRoute><StackFormPage /></ProtectedRoute>,
  },
  {
    path: '/stacks/:id/edit',
    element: <ProtectedRoute><StackFormPage /></ProtectedRoute>,
  },
  {
    path: '/stock-balances',
    element: <ProtectedRoute><StockBalancePage /></ProtectedRoute>,
  },
  {
    path: '/grns',
    element: <ProtectedRoute><GrnListPage /></ProtectedRoute>,
  },
  {
    path: '/grns/new',
    element: <ProtectedRoute><GrnCreatePage /></ProtectedRoute>,
  },
  {
    path: '/grns/:id',
    element: <ProtectedRoute><GrnDetailPage /></ProtectedRoute>,
  },
  {
    path: '/gins',
    element: <ProtectedRoute><GinListPage /></ProtectedRoute>,
  },
  {
    path: '/gins/new',
    element: <ProtectedRoute><GinCreatePage /></ProtectedRoute>,
  },
  {
    path: '/gins/:id',
    element: <ProtectedRoute><GinDetailPage /></ProtectedRoute>,
  },
  {
    path: '/inspections',
    element: <ProtectedRoute><InspectionListPage /></ProtectedRoute>,
  },
  {
    path: '/inspections/new',
    element: <ProtectedRoute><InspectionCreatePage /></ProtectedRoute>,
  },
  {
    path: '/inspections/:id',
    element: <ProtectedRoute><InspectionDetailPage /></ProtectedRoute>,
  },
  {
    path: '/waybills',
    element: <ProtectedRoute><WaybillListPage /></ProtectedRoute>,
  },
  {
    path: '/waybills/new',
    element: <ProtectedRoute><WaybillCreatePage /></ProtectedRoute>,
  },
  {
    path: '/waybills/:id',
    element: <ProtectedRoute><WaybillDetailPage /></ProtectedRoute>,
  },
]);
