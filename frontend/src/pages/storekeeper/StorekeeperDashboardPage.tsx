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
async function getStorekeeperAssignments() {
  const response = await apiClient.get('/storekeeper_assignments');
  const data = response.data.data || response.data;
  return Array.isArray(data.assignments) ? data.assignments : (Array.isArray(data) ? data : []);
}

export default function StorekeeperDashboardPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const storeId = activeAssignment?.store?.id;
  const storeName = activeAssignment?.store?.name ?? 'Unknown Store';
  const roleLabel = getRoleLabel(activeAssignment?.role_name);

  // 1. Pending Receipt Assignments (Authorizations to confirm)
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['storekeeper_assignments'],
    queryFn: () => getStorekeeperAssignments(),
  });

  // 2. Inventory scoped to store
  const { data: stockBalances, isLoading: stockLoading } = useQuery({
    queryKey: ['stock_balances', { store_id: storeId }],
    queryFn: () => getStockBalances({ store_id: storeId }),
    enabled: !!storeId,
  });

  const pendingAssignments = assignments?.filter((a: any) => 
    ['pending', 'assigned'].includes(a.status.toLowerCase()) && 
    (storeId ? a.store_id === storeId : true)
  ) ?? [];

  const inProgressAssignments = assignments?.filter((a: any) => 
    ['accepted', 'in_progress'].includes(a.status.toLowerCase()) &&
    (storeId ? a.store_id === storeId : true)
  ) ?? [];

  return (
    <Stack gap="xl">
      <Box pos="relative">
        <LoadingOverlay visible={assignmentsLoading || stockLoading} overlayProps={{ blur: 2 }} />
        
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
          <ActionIcon variant="light" color="blue" size="xl" radius="md">
            <IconBell size={24} />
          </ActionIcon>
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
              <Badge color="yellow">{pendingAssignments.length} Pending</Badge>
            </Group>
            <Text fw={700} size="lg" mt="md">New Receipts</Text>
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
              <Badge color="cyan">{inProgressAssignments.length} In Progress</Badge>
            </Group>
            <Text fw={700} size="lg" mt="md">Stacking Layout</Text>
            <Text size="xs" c="dimmed" mt={4}>Active stacking tasks and space management.</Text>
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
              <Badge color="teal">0 Ready</Badge>
            </Group>
            <Text fw={700} size="lg" mt="md">Pending Dispatches</Text>
            <Text size="xs" c="dimmed" mt={4}>Outgoing shipments authorized for pickup.</Text>
            <Button 
              variant="light" 
              color="teal" 
              fullWidth 
              mt="lg" 
              rightSection={<IconArrowRight size={14} />}
              disabled
            >
              View Dispatches
            </Button>
          </Card>
        </SimpleGrid>

        <Divider my="xl" label="Store Inventory Summary" labelPosition="center" />

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
                {stockBalances.slice(0, 5).map((stock) => (
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

          {/* Recent Work Activity Placeholder */}
          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="md">Recent Activity</Title>
            <Stack gap="sm">
              <Group gap="sm">
                <IconClock size={16} color="gray" />
                <Text size="sm">No recent activity found.</Text>
              </Group>
            </Stack>
          </Paper>
        </SimpleGrid>
      </Box>
    </Stack>
  );
}
