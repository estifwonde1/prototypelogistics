import { SimpleGrid, Card, Text, Group, Button, Stack, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  IconBuilding,
  IconFileImport,
  IconFileExport,
  IconPlus,
} from '@tabler/icons-react';
import { getReceiptOrders } from '../../api/receiptOrders';
import { getDispatchOrders } from '../../api/dispatchOrders';
import { getHubs } from '../../api/hubs';

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

function OfficerDashboardPage() {
  const navigate = useNavigate();

  const { data: hubs, isLoading: hubsLoading } = useQuery({
    queryKey: ['hubs'],
    queryFn: getHubs,
  });

  const { data: receiptOrders, isLoading: receiptOrdersLoading } = useQuery({
    queryKey: ['receipt_orders'],
    queryFn: getReceiptOrders,
  });

  const { data: dispatchOrders, isLoading: dispatchOrdersLoading } = useQuery({
    queryKey: ['dispatch_orders'],
    queryFn: getDispatchOrders,
  });

  const receiptOrderStats = {
    draft: Array.isArray(receiptOrders) ? receiptOrders.filter((o) => o.status === 'Draft').length : 0,
    confirmed: Array.isArray(receiptOrders) ? receiptOrders.filter((o) => o.status === 'Confirmed').length : 0,
  };

  const dispatchOrderStats = {
    draft: Array.isArray(dispatchOrders) ? dispatchOrders.filter((o) => o.status === 'Draft').length : 0,
    confirmed: Array.isArray(dispatchOrders) ? dispatchOrders.filter((o) => o.status === 'Confirmed').length : 0,
  };

  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>Officer Dashboard</Title>
        <Text c="dimmed" size="sm">
          Orchestrate warehouse receipt and dispatch operations
        </Text>
      </div>

      <div>
        <Text size="sm" fw={600} mb="md">
          Hubs Overview
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          <StatCard
            title="Total Hubs"
            value={hubs?.length || 0}
            icon={<IconBuilding size={32} />}
            loading={hubsLoading}
          />
        </SimpleGrid>
      </div>

      <div>
        <Text size="sm" fw={600} mb="md">
          Inbound Summary (Receipt Orders)
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
          <StatCard
            title="Draft"
            value={receiptOrderStats.draft}
            icon={<IconFileImport size={32} />}
            loading={receiptOrdersLoading}
          />
          <StatCard
            title="Confirmed"
            value={receiptOrderStats.confirmed}
            icon={<IconFileImport size={32} />}
            loading={receiptOrdersLoading}
          />
        </SimpleGrid>
      </div>

      <div>
        <Text size="sm" fw={600} mb="md">
          Outbound Summary (Dispatch Orders)
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
          <StatCard
            title="Draft"
            value={dispatchOrderStats.draft}
            icon={<IconFileExport size={32} />}
            loading={dispatchOrdersLoading}
          />
          <StatCard
            title="Confirmed"
            value={dispatchOrderStats.confirmed}
            icon={<IconFileExport size={32} />}
            loading={dispatchOrdersLoading}
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
      </div>
    </Stack>
  );
}

export default OfficerDashboardPage;
