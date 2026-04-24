import { 
  Stack, 
  Title, 
  Text, 
  SimpleGrid, 
  Card, 
  Group, 
  Badge, 
  Divider, 
  Button, 
  TextInput,
  ActionIcon,
  Paper,
  Box,
  LoadingOverlay,
  List,
  ThemeIcon
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  IconTruckDelivery, 
  IconStack, 
  IconSearch,
  IconClipboardCheck,
  IconArrowRight,
  IconClock,
  IconBell,
  IconCheck
} from '@tabler/icons-react';
import { useAuthStore } from '../../store/authStore';
import { getRoleLabel } from '../../contracts/warehouse';
import apiClient from '../../api/client';
import { getStockBalances } from '../../api/stockBalances';

// Local API functions for dashboard specific summaries
async function getStorekeeperDashboardData() {
  const response = await apiClient.get('/storekeeper_assignments');
  return response.data.data || response.data;
}

export default function StorekeeperDashboardPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const storeId = activeAssignment?.store?.id;
  const storeName = activeAssignment?.store?.name ?? 'Unknown Store';
  const roleLabel = getRoleLabel(activeAssignment?.role_name);

  const { data, isLoading } = useQuery({
    queryKey: ['storekeeper_dashboard'],
    queryFn: () => getStorekeeperDashboardData(),
  });

  // 1. Inventory scoped to store
  const { data: stockBalances, isLoading: stockLoading } = useQuery({
    queryKey: ['stock_balances', { store_id: storeId }],
    queryFn: () => getStockBalances({ store_id: storeId }),
    enabled: !!storeId,
  });

  const receiptAssignments = data?.receipt_assignments ?? [];
  const dispatchAssignments = data?.dispatch_assignments ?? [];
  const activity = data?.activity ?? [];

  const pendingReceipts = receiptAssignments.filter((a: any) => 
    ['pending', 'assigned'].includes(a.status.toLowerCase()) && 
    (storeId ? a.store_id === storeId : true)
  );

  const inProgressReceipts = receiptAssignments.filter((a: any) => 
    ['accepted', 'in_progress'].includes(a.status.toLowerCase()) &&
    (storeId ? a.store_id === storeId : true)
  );

  const pendingDispatches = dispatchAssignments.filter((a: any) => 
    ['pending', 'assigned'].includes(a.status.toLowerCase()) &&
    (storeId ? a.store_id === storeId : true)
  );

  return (
    <Stack gap="xl">
      <Box pos="relative">
        <LoadingOverlay visible={isLoading || stockLoading} overlayProps={{ blur: 2 }} />
        
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Group align="center" gap="sm" mb={4}>
              <Title order={2}>{roleLabel} Dashboard</Title>
              <Badge color="blue" variant="light" size="lg">
                {storeName}
              </Badge>
            </Group>
            <Text c="dimmed" size="sm">
              Manage your daily tasks, incoming trucks, and store inventory.
            </Text>
          </div>
          <Box pos="relative">
            <ActionIcon variant="light" color="blue" size="xl" radius="md">
              <IconBell size={24} />
            </ActionIcon>
            {pendingReceipts.length + pendingDispatches.length > 0 && (
              <Badge 
                size="xs" 
                circle 
                color="red" 
                pos="absolute" 
                top={-5} 
                right={-5}
              >
                {pendingReceipts.length + pendingDispatches.length}
              </Badge>
            )}
          </Box>
        </Group>

        {/* Quick Search for Driver Arrival */}
        <Paper withBorder p="lg" radius="md" mt="md" bg="blue.0">
          <Group align="flex-end" gap="md">
            <Stack gap={4} flex={1}>
              <Text fw={700} size="sm" c="blue.9">Driver Arrival</Text>
              <TextInput 
                placeholder="Enter Waybill or Dispatch Reference Number (e.g. WB-12345)" 
                leftSection={<IconSearch size={16} />}
                size="md"
                radius="md"
              />
            </Stack>
            <Button size="md" radius="md" leftSection={<IconTruckDelivery size={20} />}>
              Find Delivery
            </Button>
          </Group>
        </Paper>

        {/* Task Summary Grid */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} mt="xl">
          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between">
              <ThemeIcon variant="light" color="yellow" size="xl" radius="md">
                <IconClipboardCheck size={28} />
              </ThemeIcon>
              <Badge color="yellow">{pendingReceipts.length} New</Badge>
            </Group>
            <Text fw={700} size="lg" mt="md">Pending Receipts</Text>
            <Text size="xs" c="dimmed" mt={4}>Incoming orders awaiting your confirmation.</Text>
            <Button 
              variant="light" 
              color="yellow" 
              fullWidth 
              mt="lg" 
              rightSection={<IconArrowRight size={14} />}
              onClick={() => navigate('/storekeeper/assignments')}
            >
              Confirm Receipts
            </Button>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between">
              <ThemeIcon variant="light" color="cyan" size="xl" radius="md">
                <IconStack size={28} />
              </ThemeIcon>
              <Badge color="cyan">{inProgressReceipts.length} Active</Badge>
            </Group>
            <Text fw={700} size="lg" mt="md">In-Progress Receipts</Text>
            <Text size="xs" c="dimmed" mt={4}>Orders currently being received and stacked.</Text>
            <Button 
              variant="light" 
              color="cyan" 
              fullWidth 
              mt="lg" 
              rightSection={<IconArrowRight size={14} />}
              onClick={() => navigate('/stacks/layout')}
            >
              Manage Stacks
            </Button>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between">
              <ThemeIcon variant="light" color="teal" size="xl" radius="md">
                <IconTruckDelivery size={28} />
              </ThemeIcon>
              <Badge color="teal">{pendingDispatches.length} New</Badge>
            </Group>
            <Text fw={700} size="lg" mt="md">Pending Dispatches</Text>
            <Text size="xs" c="dimmed" mt={4}>Outgoing shipments authorized for pickup.</Text>
            <Button 
              variant="light" 
              color="teal" 
              fullWidth 
              mt="lg" 
              rightSection={<IconArrowRight size={14} />}
              onClick={() => navigate('/storekeeper/assignments')}
            >
              Confirm Dispatches
            </Button>
          </Card>
        </SimpleGrid>

        <Divider my="xl" label="Store Overview" labelPosition="center" />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          {/* Recent Stock Status */}
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>On-Hand Stock</Title>
              <Button variant="subtle" size="xs" onClick={() => navigate('/stock-balances')}>View Full List</Button>
            </Group>
            {stockBalances && stockBalances.length > 0 ? (
              <List
                spacing="sm"
                size="sm"
                center
                icon={
                  <ThemeIcon color="teal" size={20} radius="xl">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                {stockBalances.slice(0, 5).map((stock: any) => (
                  <List.Item key={stock.id}>
                    <Group justify="space-between" style={{ width: '100%' }}>
                      <Text size="sm" fw={500}>{stock.commodity_name}</Text>
                      <Text size="sm" fw={700}>{(stock.quantity || 0).toLocaleString()} {stock.unit_name}</Text>
                    </Group>
                  </List.Item>
                ))}
              </List>
            ) : (
              <Text c="dimmed" py="xl" ta="center">No stock currently recorded in this store.</Text>
            )}
          </Paper>

          {/* Recent Work Activity */}
          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="md">Recent Activity</Title>
            <Stack gap="sm">
              {activity.length > 0 ? activity.map((event: any) => (
                <Group key={event.id} gap="sm" wrap="nowrap" align="flex-start">
                  <ThemeIcon variant="light" color="gray" size="sm">
                    <IconClock size={12} />
                  </ThemeIcon>
                  <Box>
                    <Text size="sm" fw={500}>{event.event_type.replace(/_/g, ' ')}</Text>
                    <Text size="xs" c="dimmed">
                      {event.actor_name} • {new Date(event.occurred_at || event.created_at).toLocaleString()}
                    </Text>
                  </Box>
                </Group>
              )) : (
                <Group gap="sm">
                  <IconClock size={16} color="gray" />
                  <Text size="sm">No recent activity found.</Text>
                </Group>
              )}
            </Stack>
          </Paper>
        </SimpleGrid>
      </Box>
    </Stack>
  );
}
