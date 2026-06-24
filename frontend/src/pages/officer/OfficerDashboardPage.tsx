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
import { getOfficerDashboard, officerDashboardQueryKey } from '../../api/dashboard';
import { getRoleLabel } from '../../contracts/warehouse';
import { useOfficerScope } from '../../hooks/useOfficerScope';
import { useAuthStore } from '../../store/authStore';
import { workspaceScopeKey } from '../../utils/workspaceSwitch';

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
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const { roleSlug, scopeLabel, scopeDescription, isFullAccess } = useOfficerScope();
  const roleLabel = getRoleLabel(roleSlug ?? 'officer');

  // Single summary query replaces 4 full-list fetches
  const { data: summary, isLoading } = useQuery({
    queryKey: officerDashboardQueryKey(workspaceScopeKey(activeAssignment)),
    queryFn: getOfficerDashboard,
  });

  const ro = summary?.receipt_orders ?? {};
  const receiptStats = {
    draft:      ro['Draft']       ?? ro['draft']       ?? 0,
    confirmed:  ro['Confirmed']   ?? ro['confirmed']   ?? 0,
    inProgress: ro['In Progress'] ?? ro['in_progress'] ?? ro['In progress'] ?? 0,
    completed:  ro['Completed']   ?? ro['completed']   ?? 0,
  };

  const doc = summary?.dispatch_orders ?? {};
  const dispatchStats = {
    draft:      doc['Draft']       ?? doc['draft']       ?? 0,
    confirmed:  doc['Confirmed']   ?? doc['confirmed']   ?? 0,
    inProgress: doc['In Progress'] ?? doc['in_progress'] ?? doc['In progress'] ?? 0,
    completed:  doc['Completed']   ?? doc['completed']   ?? 0,
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
            value={summary?.hubs_count ?? 0}
            icon={<IconBuilding size={32} />}
            loading={isLoading}
            color="blue"
          />
          {showWarehouseBreakdown && (
            <StatCard
              title="Warehouses"
              value={summary?.warehouses_count ?? 0}
              icon={<IconBuildingWarehouse size={32} />}
              loading={isLoading}
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
            loading={isLoading}
            color="gray"
          />
          <StatCard
            title="Confirmed"
            value={receiptStats.confirmed}
            icon={<IconFileImport size={28} />}
            loading={isLoading}
            color="blue"
          />
          <StatCard
            title="In Progress"
            value={receiptStats.inProgress}
            icon={<IconFileImport size={28} />}
            loading={isLoading}
            color="orange"
          />
          <StatCard
            title="Completed"
            value={receiptStats.completed}
            icon={<IconFileImport size={28} />}
            loading={isLoading}
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
            loading={isLoading}
            color="gray"
          />
          <StatCard
            title="Confirmed"
            value={dispatchStats.confirmed}
            icon={<IconFileExport size={28} />}
            loading={isLoading}
            color="blue"
          />
          <StatCard
            title="In Progress"
            value={dispatchStats.inProgress}
            icon={<IconFileExport size={28} />}
            loading={isLoading}
            color="orange"
          />
          <StatCard
            title="Completed"
            value={dispatchStats.completed}
            icon={<IconFileExport size={28} />}
            loading={isLoading}
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
              onClick={() => navigate('/officer/dispatch-plan/new')}
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
