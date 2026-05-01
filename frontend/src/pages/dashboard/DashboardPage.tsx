import { SimpleGrid, Card, Text, Group, Button, Stack, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  IconBuilding,
  IconBuildingWarehouse,
  IconBox,
  IconStack2,
  IconFileImport,
  IconFileExport,
  IconClipboardCheck,
  IconPlus,
} from '@tabler/icons-react';
import { getHubs } from '../../api/hubs';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { getGrns } from '../../api/grns';
import { getGins } from '../../api/gins';
import { getInspections } from '../../api/inspections';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { usePermission } from '../../hooks/usePermission';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  loading?: boolean;
}

function StatCard({ title, value, icon, loading }: StatCardProps) {
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
        <div style={{ color: 'var(--mantine-color-blue-6)' }}>{icon}</div>
      </Group>
    </Card>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canReadHubs = can('hubs', 'read');

  const { data: hubs, isLoading: hubsLoading } = useQuery({
    queryKey: ['hubs'],
    queryFn: () => getHubs(),
    enabled: canReadHubs,
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
  });

  // Get active assignment context for filtering
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userStoreId = activeAssignment?.store?.id;
  const userHubId = activeAssignment?.hub?.id;
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const isStorekeeper = roleSlug === 'storekeeper';
  const isHubManager = roleSlug === 'hub_manager';

  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ['stores', { 
      warehouse_id: isWarehouseManager ? userWarehouseId : undefined,
      hub_id: isHubManager ? userHubId : undefined 
    }],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) {
        return getStores({ warehouse_id: userWarehouseId });
      } else if (isHubManager && userHubId) {
        return getStores(); // Backend should handle hub-level filtering
      }
      return getStores({});
    },
  });

  const { data: stacks, isLoading: stacksLoading } = useQuery({
    queryKey: ['stacks', { 
      warehouse_id: isWarehouseManager ? userWarehouseId : undefined,
      store_id: isStorekeeper ? userStoreId : undefined,
      hub_id: isHubManager ? userHubId : undefined 
    }],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) {
        return getStacks({ warehouse_id: userWarehouseId });
      } else if (isStorekeeper && userStoreId) {
        return getStacks({ store_id: userStoreId });
      } else if (isHubManager && userHubId) {
        return getStacks(); // Backend should handle hub-level filtering
      }
      return getStacks();
    },
  });

  const { data: grns, isLoading: grnsLoading } = useQuery({
    queryKey: ['grns'],
    queryFn: () => getGrns(),
  });

  const { data: gins, isLoading: ginsLoading } = useQuery({
    queryKey: ['gins'],
    queryFn: () => getGins(),
  });

  const { data: inspections, isLoading: inspectionsLoading } = useQuery({
    queryKey: ['inspections'],
    queryFn: () => getInspections(),
  });

  const pendingGrns = grns?.filter((grn) => grn.status === 'draft').length || 0;
  const pendingGins = gins?.filter((gin) => gin.status === 'draft').length || 0;
  const pendingInspections = inspections?.filter((inspection) => inspection.status === 'draft').length || 0;

  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>Dashboard</Title>
        <Text c="dimmed" size="sm">
          Overview of your warehouse management system
        </Text>
      </div>

      <div>
        <Text size="sm" fw={600} mb="md">
          Infrastructure
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
          <StatCard
            title="Total Hubs"
            value={canReadHubs ? hubs?.length || 0 : 'N/A'}
            icon={<IconBuilding size={32} />}
            loading={canReadHubs && hubsLoading}
          />
          <StatCard
            title="Total Warehouses"
            value={warehouses?.length || 0}
            icon={<IconBuildingWarehouse size={32} />}
            loading={warehousesLoading}
          />
          <StatCard
            title="Total Stores"
            value={stores?.length || 0}
            icon={<IconBox size={32} />}
            loading={storesLoading}
          />
          <StatCard
            title="Total Stacks"
            value={stacks?.length || 0}
            icon={<IconStack2 size={32} />}
            loading={stacksLoading}
          />
        </SimpleGrid>
      </div>

      <div>
        <Text size="sm" fw={600} mb="md">
          Pending Operations
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          <StatCard
            title="Pending GRNs"
            value={pendingGrns}
            icon={<IconFileImport size={32} />}
            loading={grnsLoading}
          />
          <StatCard
            title="Pending GINs"
            value={pendingGins}
            icon={<IconFileExport size={32} />}
            loading={ginsLoading}
          />
          <StatCard
            title="Pending Inspections"
            value={pendingInspections}
            icon={<IconClipboardCheck size={32} />}
            loading={inspectionsLoading}
          />
        </SimpleGrid>
      </div>

      <div>
        <Text size="sm" fw={600} mb="md">
          Quick Actions
        </Text>
        <Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/grns/new')}
          >
            Create GRN
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/gins/new')}
            variant="light"
          >
            Create GIN
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/inspections/new')}
            variant="light"
          >
            Create Inspection
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/waybills/new')}
            variant="light"
          >
            Create Waybill
          </Button>
        </Group>
      </div>
    </Stack>
  );
}

export default DashboardPage;


