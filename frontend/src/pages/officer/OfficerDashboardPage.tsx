import {
  SimpleGrid,
  Card,
  Text,
  Group,
  Button,
  Stack,
  Title,
  Badge,
  Alert,
  Divider,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  IconBuilding,
  IconBuildingWarehouse,
  IconFileImport,
  IconFileExport,
  IconPlus,
  IconMapPin,
  IconAlertCircle,
} from '@tabler/icons-react';
import { getReceiptOrders, type ReceiptOrder } from '../../api/receiptOrders';
import { getDispatchOrders, type DispatchOrder } from '../../api/dispatchOrders';
import { getHubs } from '../../api/hubs';
import { getWarehouses } from '../../api/warehouses';
import { getRoleLabel } from '../../contracts/warehouse';
import { useOfficerScope } from '../../hooks/useOfficerScope';
import type { Hub } from '../../types/hub';
import type { Warehouse } from '../../types/warehouse';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  loading?: boolean;
  color?: string;
}

function StatCard({ title, value, icon, loading, color = 'blue' }: StatCardProps) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {title}
          </Text>
          <Text size="xl" fw={700} mt="xs">
            {loading ? '...' : value}
          </Text>
        </div>
        <div style={{ color: `var(--mantine-color-${color}-6)` }}>{icon}</div>
      </Group>
    </Card>
  );
}

function ScopeAlert({ scopeLabel, isFullAccess }: { scopeLabel: string; isFullAccess: boolean }) {
  if (isFullAccess) return null;
  return (
    <Alert icon={<IconMapPin size={16} />} color="blue" variant="light">
      <Text size="sm">
        Your data is scoped to: <strong>{scopeLabel}</strong>
      </Text>
    </Alert>
  );
}

function OfficerDashboardPage() {
  const navigate = useNavigate();
  const { roleSlug, scopeLabel, scopeDescription, isFullAccess } = useOfficerScope();
  const roleLabel = getRoleLabel(roleSlug ?? 'officer');

  const hubsQuery = useQuery({
    queryKey: ['hubs'],
    queryFn: () => getHubs(),
  });
  const hubs = hubsQuery.data as Hub[] | undefined;
  const hubsLoading = hubsQuery.isLoading;

  const warehousesQuery = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
  });
  const warehouses = warehousesQuery.data as Warehouse[] | undefined;
  const warehousesLoading = warehousesQuery.isLoading;

  const receiptOrdersQuery = useQuery({
    queryKey: ['receipt_orders'],
    queryFn: () => getReceiptOrders({}),
  });
  const receiptOrders = receiptOrdersQuery.data as ReceiptOrder[] | undefined;
  const receiptOrdersLoading = receiptOrdersQuery.isLoading;

  const dispatchOrdersQuery = useQuery({
    queryKey: ['dispatch_orders'],
    queryFn: () => getDispatchOrders({}),
  });
  const dispatchOrders = dispatchOrdersQuery.data as DispatchOrder[] | undefined;
  const dispatchOrdersLoading = dispatchOrdersQuery.isLoading;

  const receiptStats = {
    draft: Array.isArray(receiptOrders) ? receiptOrders.filter((o) => o.status === 'Draft').length : 0,
    confirmed: Array.isArray(receiptOrders) ? receiptOrders.filter((o) => o.status === 'Confirmed').length : 0,
    inProgress: Array.isArray(receiptOrders) ? receiptOrders.filter((o) => o.status === 'In Progress').length : 0,
    completed: Array.isArray(receiptOrders) ? receiptOrders.filter((o) => o.status === 'Completed').length : 0,
  };

  const dispatchStats = {
    draft: Array.isArray(dispatchOrders) ? dispatchOrders.filter((o) => o.status === 'Draft').length : 0,
    confirmed: Array.isArray(dispatchOrders) ? dispatchOrders.filter((o) => o.status === 'Confirmed').length : 0,
    inProgress: Array.isArray(dispatchOrders) ? dispatchOrders.filter((o) => o.status === 'In Progress').length : 0,
    completed: Array.isArray(dispatchOrders) ? dispatchOrders.filter((o) => o.status === 'Completed').length : 0,
  };

  // Federal officers see all hubs; sub-federal officers see only their scoped hubs (backend-filtered)
  const showWarehouseBreakdown = roleSlug === 'federal_officer' || roleSlug === 'officer' || roleSlug === 'regional_officer';

  return (
    <Stack gap="xl">
      {/* Header */}
      <div>
        <Group align="center" gap="sm" mb={4}>
          <Title order={2}>{roleLabel} Dashboard</Title>
          {!isFullAccess && (
            <Badge color="blue" variant="light" size="lg">
              {scopeLabel}
            </Badge>
          )}
          {isFullAccess && (
            <Badge color="green" variant="light" size="lg">
              System-wide
            </Badge>
          )}
        </Group>
        <Text c="dimmed" size="sm">
          {scopeDescription}
        </Text>
      </div>

      <ScopeAlert scopeLabel={scopeLabel} isFullAccess={isFullAccess} />

      {/* Facilities Overview — scoped by backend Pundit policy */}
      <div>
        <Text size="sm" fw={600} mb="md">
          Facilities Overview
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: showWarehouseBreakdown ? 4 : 2 }}>
          <StatCard
            title="Hubs"
            value={hubs ? hubs.length : 0}
            icon={<IconBuilding size={32} />}
            loading={hubsLoading}
            color="blue"
          />
          {showWarehouseBreakdown && (
            <StatCard
              title="Warehouses"
              value={warehouses ? warehouses.length : 0}
              icon={<IconBuildingWarehouse size={32} />}
              loading={warehousesLoading}
              color="violet"
            />
          )}
        </SimpleGrid>
      </div>

      <Divider />

      {/* Inbound Summary */}
      <div>
        <Text size="sm" fw={600} mb="md">
          Inbound Summary (Receipt Orders)
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <StatCard
            title="Draft"
            value={receiptStats.draft}
            icon={<IconFileImport size={28} />}
            loading={receiptOrdersLoading}
            color="gray"
          />
          <StatCard
            title="Confirmed"
            value={receiptStats.confirmed}
            icon={<IconFileImport size={28} />}
            loading={receiptOrdersLoading}
            color="blue"
          />
          <StatCard
            title="In Progress"
            value={receiptStats.inProgress}
            icon={<IconFileImport size={28} />}
            loading={receiptOrdersLoading}
            color="orange"
          />
          <StatCard
            title="Completed"
            value={receiptStats.completed}
            icon={<IconFileImport size={28} />}
            loading={receiptOrdersLoading}
            color="green"
          />
        </SimpleGrid>
      </div>

      {/* Outbound Summary */}
      <div>
        <Text size="sm" fw={600} mb="md">
          Outbound Summary (Dispatch Orders)
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <StatCard
            title="Draft"
            value={dispatchStats.draft}
            icon={<IconFileExport size={28} />}
            loading={dispatchOrdersLoading}
            color="gray"
          />
          <StatCard
            title="Confirmed"
            value={dispatchStats.confirmed}
            icon={<IconFileExport size={28} />}
            loading={dispatchOrdersLoading}
            color="blue"
          />
          <StatCard
            title="In Progress"
            value={dispatchStats.inProgress}
            icon={<IconFileExport size={28} />}
            loading={dispatchOrdersLoading}
            color="orange"
          />
          <StatCard
            title="Completed"
            value={dispatchStats.completed}
            icon={<IconFileExport size={28} />}
            loading={dispatchOrdersLoading}
            color="green"
          />
        </SimpleGrid>
      </div>

      <Divider />

      {/* Quick Actions — federal officers get full create access; sub-federal are read-only monitors */}
      <div>
        <Text size="sm" fw={600} mb="md">
          Quick Actions
        </Text>
        {isFullAccess ? (
          <Group>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate('/officer/receipt-orders/new')}
            >
              Create Receipt Order
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={() => navigate('/officer/dispatch-orders/new')}
            >
              Create Dispatch Order
            </Button>
          </Group>
        ) : (
          <Group>
            <Button variant="light" onClick={() => navigate('/officer/receipt-orders')}>
              View Receipt Orders
            </Button>
            <Button variant="light" onClick={() => navigate('/officer/dispatch-orders')}>
              View Dispatch Orders
            </Button>
            <Button variant="subtle" leftSection={<IconAlertCircle size={16} />} onClick={() => navigate('/officer/facilities')}>
              View Facilities
            </Button>
          </Group>
        )}
      </div>
    </Stack>
  );
}

export default OfficerDashboardPage;
