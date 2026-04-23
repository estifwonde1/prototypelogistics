import { Stack, Title, Text, SimpleGrid, Card, Group, Badge, Divider, Button } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IconBuilding, IconBuildingWarehouse, IconTruck, IconChartPie, IconMapPin } from '@tabler/icons-react';
import { useAuthStore } from '../../store/authStore';
import { getRoleLabel } from '../../contracts/warehouse';
import { getWarehouses } from '../../api/warehouses';

export default function HubManagerDashboardPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleLabel = getRoleLabel(activeAssignment?.role_name);
  const hubName = activeAssignment?.hub?.name ?? 'Unknown Hub';

  const { data: warehouses, isLoading: warehousesLoading } = useQuery({
    queryKey: ['warehouses', { hub_id: activeAssignment?.hub?.id }],
    queryFn: () => getWarehouses({ hub_id: activeAssignment?.hub?.id }),
    enabled: !!activeAssignment?.hub?.id,
  });

  return (
    <Stack gap="xl">
      <div>
        <Group align="center" gap="sm" mb={4}>
          <Title order={2}>{roleLabel} Dashboard</Title>
          <Badge color="blue" variant="filled" size="lg">
            {hubName}
          </Badge>
        </Group>
        <Text c="dimmed" size="sm">
          Strategic oversight of hub operations, warehouse distribution, and high-level logistics.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Managed Warehouses</Text>
              <Text size="xl" fw={700} mt="xs">{warehousesLoading ? '...' : warehouses?.length ?? 0}</Text>
            </div>
            <IconBuildingWarehouse size={32} color="var(--mantine-color-blue-6)" />
          </Group>
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Active Waybills</Text>
              <Text size="xl" fw={700} mt="xs">45 In-Transit</Text>
            </div>
            <IconTruck size={32} color="var(--mantine-color-orange-6)" />
          </Group>
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Hub Capacity Used</Text>
              <Text size="xl" fw={700} mt="xs">68%</Text>
            </div>
            <IconChartPie size={32} color="var(--mantine-color-green-6)" />
          </Group>
        </Card>
      </SimpleGrid>

      <Divider />

      <div>
        <Text size="sm" fw={600} mb="md">Hub Operations</Text>
        <Group>
          <Button leftSection={<IconMapPin size={16} />} onClick={() => navigate('/warehouses')}>
            Warehouse Network
          </Button>
          <Button leftSection={<IconTruck size={16} />} variant="light" onClick={() => navigate('/waybills')}>
            Monitor Waybills
          </Button>
          <Button leftSection={<IconBuilding size={16} />} variant="outline" onClick={() => navigate(`/hubs/${activeAssignment?.hub?.id}`)}>
            Hub Details
          </Button>
        </Group>
      </div>
    </Stack>
  );
}
