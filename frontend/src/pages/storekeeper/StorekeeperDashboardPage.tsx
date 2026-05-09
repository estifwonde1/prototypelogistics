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
  Paper,
  Box,
  LoadingOverlay,
  List,
  ThemeIcon,
  Alert,
  Modal,
  Table,
  Anchor
} from '@mantine/core';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { 
  IconTruckDelivery, 
  IconStack, 
  IconSearch,
  IconClipboardCheck,
  IconArrowRight,
  IconClock,
  IconCheck,
  IconAlertCircle,
  IconInfoCircle
} from '@tabler/icons-react';
import { useAuthStore } from '../../store/authStore';
import { getRoleLabel } from '../../contracts/warehouse';
import { getStockBalances } from '../../api/stockBalances';
import { 
  searchDeliveryByReference, 
  getStorekeeperDashboardData,
  type DeliverySearchResult 
} from '../../api/storekeeperdashboard';

export default function StorekeeperDashboardPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const storeId = activeAssignment?.store?.id;
  const storeName = activeAssignment?.store?.name ?? 'Unknown Store';
  const roleLabel = getRoleLabel(activeAssignment?.role_name);

  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<DeliverySearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['storekeeper_dashboard', { store_id: storeId }],
    queryFn: () => getStorekeeperDashboardData(storeId),
  });

  // 1. Inventory scoped to store
  const { data: stockBalances, isLoading: stockLoading } = useQuery({
    queryKey: ['stock_balances', { store_id: storeId }],
    queryFn: () => getStockBalances({ store_id: storeId }),
    enabled: !!storeId,
  });

  const searchMutation = useMutation({
    mutationFn: (refNo: string) => {
      const warehouseId = activeAssignment?.warehouse?.id;
      return searchDeliveryByReference(refNo, warehouseId, storeId);
    },
    onSuccess: (data) => {
      setSearchResults(data.results);
      setSearchMessage(data.message);
      setShowSearchModal(true);
    },
    onError: (error: any) => {
      setSearchResults([]);
      setSearchMessage(error.response?.data?.message || 'Search failed. Please try again.');
      setShowSearchModal(true);
    }
  });

  const handleSearch = () => {
    if (searchValue.trim()) {
      searchMutation.mutate(searchValue.trim());
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const receiptAssignments = data?.receipt_assignments ?? [];
  const dispatchAssignments = data?.dispatch_assignments ?? [];
  const completedTransactions = data?.completed_transactions ?? [];
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
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </Stack>
            <Button 
              size="md" 
              radius="md" 
              leftSection={<IconTruckDelivery size={20} />}
              onClick={handleSearch}
              loading={searchMutation.isPending}
              disabled={!searchValue.trim()}
            >
              Find Delivery
            </Button>
          </Group>
        </Paper>

        {/* Search Results Modal */}
        <Modal
          opened={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          title="Delivery Search Results"
          size="xl"
        >
          <Stack gap="md">
            <Alert 
              icon={searchResults.length > 0 ? <IconInfoCircle size={16} /> : <IconAlertCircle size={16} />}
              color={searchResults.length > 0 ? "blue" : "yellow"}
            >
              {searchMessage}
            </Alert>
            
            {searchResults.length > 0 && (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Reference</Table.Th>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {searchResults.map((result, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Badge variant="light" color={result.type === 'Receipt Order' ? 'green' : 'blue'}>
                          {result.type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{result.reference_no}</Text>
                      </Table.Td>
                      <Table.Td>{result.commodity}</Table.Td>
                      <Table.Td>{result.quantity.toLocaleString()} {result.unit}</Table.Td>
                      <Table.Td>{result.source_location}</Table.Td>
                      <Table.Td>
                        <Badge color={result.status === 'confirmed' ? 'green' : 'yellow'}>
                          {result.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {result.can_start_receipt ? (
                          <Button 
                            size="xs" 
                            variant="light" 
                            color="green"
                            onClick={() => {
                              setShowSearchModal(false);
                              navigate(`/receipt-orders/${result.id}`);
                            }}
                          >
                            Start Receipt
                          </Button>
                        ) : (
                          <Button 
                            size="xs" 
                            variant="light"
                            onClick={() => {
                              setShowSearchModal(false);
                              navigate(result.type === 'Receipt Order' ? `/receipt-orders/${result.id}` : `/dispatch-orders/${result.id}`);
                            }}
                          >
                            View Details
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Modal>

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

          {/* Recent Completed Transactions */}
          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="md">Recent Completed Transactions</Title>
            <Stack gap="sm">
              {completedTransactions.length > 0 ? completedTransactions.slice(0, 5).map((transaction, index) => (
                <Group key={index} gap="sm" wrap="nowrap" align="flex-start">
                  <ThemeIcon 
                    variant="light" 
                    color={transaction.type === 'Receipt' ? 'green' : 'blue'} 
                    size="sm"
                  >
                    {transaction.type === 'Receipt' ? <IconTruckDelivery size={12} /> : <IconStack size={12} />}
                  </ThemeIcon>
                  <Box flex={1}>
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text size="sm" fw={500}>
                          {transaction.type}: {transaction.reference_no}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Order: {transaction.order_reference}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {transaction.completed_by} • {new Date(transaction.completed_at).toLocaleString()}
                        </Text>
                      </div>
                      <Badge size="xs" color={transaction.status === 'completed' ? 'green' : 'yellow'}>
                        {transaction.status}
                      </Badge>
                    </Group>
                  </Box>
                </Group>
              )) : (
                <Group gap="sm">
                  <IconClock size={16} color="gray" />
                  <Text size="sm">No completed transactions found.</Text>
                </Group>
              )}
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Detailed Task Lists */}
        <Divider my="xl" label="Detailed Task Lists" labelPosition="center" />

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
          {/* Pending Receipt Authorizations */}
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>Pending Receipt Authorizations</Title>
              <Badge color="yellow">{pendingReceipts.length}</Badge>
            </Group>
            <Stack gap="sm">
              {pendingReceipts.length > 0 ? pendingReceipts.slice(0, 3).map((assignment: any) => (
                <Card key={assignment.id} withBorder p="sm" radius="sm">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text size="sm" fw={500}>
                        {assignment.receipt_order?.reference_no || 'No Reference'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Assigned by: {assignment.assigned_by?.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {new Date(assignment.created_at).toLocaleDateString()}
                      </Text>
                    </div>
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="yellow"
                      onClick={() => navigate('/storekeeper/assignments')}
                    >
                      Review
                    </Button>
                  </Group>
                </Card>
              )) : (
                <Text c="dimmed" ta="center" py="md">No pending receipt authorizations.</Text>
              )}
              {pendingReceipts.length > 3 && (
                <Anchor 
                  size="sm" 
                  ta="center" 
                  onClick={() => navigate('/storekeeper/assignments')}
                >
                  View all {pendingReceipts.length} pending receipts
                </Anchor>
              )}
            </Stack>
          </Paper>

          {/* Pending Dispatch Authorizations */}
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>Pending Dispatch Authorizations</Title>
              <Badge color="teal">{pendingDispatches.length}</Badge>
            </Group>
            <Stack gap="sm">
              {pendingDispatches.length > 0 ? pendingDispatches.slice(0, 3).map((assignment: any) => (
                <Card key={assignment.id} withBorder p="sm" radius="sm">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text size="sm" fw={500}>
                        {assignment.dispatch_order?.reference_no || 'No Reference'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Assigned by: {assignment.assigned_by?.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {new Date(assignment.created_at).toLocaleDateString()}
                      </Text>
                    </div>
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="teal"
                      onClick={() => navigate('/storekeeper/assignments')}
                    >
                      Review
                    </Button>
                  </Group>
                </Card>
              )) : (
                <Text c="dimmed" ta="center" py="md">No pending dispatch authorizations.</Text>
              )}
              {pendingDispatches.length > 3 && (
                <Anchor 
                  size="sm" 
                  ta="center" 
                  onClick={() => navigate('/storekeeper/assignments')}
                >
                  View all {pendingDispatches.length} pending dispatches
                </Anchor>
              )}
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Recent Work Activity */}
        <Paper withBorder p="md" radius="md" mt="xl">
          <Title order={4} mb="md">Recent Work Activity</Title>
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
      </Box>
    </Stack>
  );
}
