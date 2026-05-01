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
  Table, 
  ActionIcon, 
  Tooltip,
  Paper,
  Box,
  LoadingOverlay
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  IconPackage, 
  IconFileCheck, 
  IconArrowRight,
  IconAlertCircle,
  IconFileImport,
  IconFileExport,
  IconBell
} from '@tabler/icons-react';
import { useAuthStore } from '../../store/authStore';
import { getRoleLabel } from '../../contracts/warehouse';
import { getReceiptOrders } from '../../api/receiptOrders';
import { getDispatchOrders } from '../../api/dispatchOrders';
import { getStockBalances } from '../../api/stockBalances';
import { getInspections } from '../../api/inspections';
import type { Inspection } from '../../types/inspection';

export default function WarehouseManagerDashboardPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const warehouseId = activeAssignment?.warehouse?.id;
  const warehouseName = activeAssignment?.warehouse?.name ?? 'Unknown Warehouse';
  const roleLabel = getRoleLabel(activeAssignment?.role_name);

  // 1. Receipt Orders pending Storekeeper assignment
  const { data: receiptOrders, isLoading: receiptsLoading } = useQuery({
    queryKey: ['receipt_orders', { warehouse_id: warehouseId }],
    queryFn: () => getReceiptOrders({ warehouse_id: warehouseId }),
    enabled: !!warehouseId,
  });

  // 2. Dispatch Orders pending authorization (Draft) & Active Authorizations (Confirmed)
  const { data: dispatchOrders, isLoading: dispatchesLoading } = useQuery({
    queryKey: ['dispatch_orders', { warehouse_id: warehouseId }],
    queryFn: () => getDispatchOrders({ warehouse_id: warehouseId }),
    enabled: !!warehouseId,
  });

  // 3. Stock Levels
  const { data: stockBalances, isLoading: stockLoading } = useQuery({
    queryKey: ['stock_balances', { warehouse_id: warehouseId }],
    queryFn: () => getStockBalances({ warehouse_id: warehouseId }),
    enabled: !!warehouseId,
  });

  const pendingReceiptAssignments = receiptOrders?.filter(o => {
    const status = String(o.status || '').toLowerCase();
    // Backend now filters by warehouse, so we only need to filter by status
    // Show orders that are confirmed or draft (pending storekeeper assignment)
    return status === 'confirmed' || status === 'draft';
  }) ?? [];
  
  const pendingDispatchAuthorizations = dispatchOrders?.filter(o => {
    const status = String(o.status || '').toLowerCase();
    return status === 'draft';
  }) ?? [];
  
  const activeDispatchAuthorizations = dispatchOrders?.filter(o => {
    const status = String(o.status || '').toLowerCase();
    return status === 'confirmed';
  }) ?? [];

  // 4. Lost Commodity records
  const { data: inspectionsData } = useQuery({
    queryKey: ['inspections', { warehouse_id: warehouseId }],
    queryFn: () => getInspections(),
    enabled: !!warehouseId,
  });
  const lostCommodityRecords = ((inspectionsData as Inspection[]) ?? [])
    .filter(i => Number(i.warehouse_id) === Number(warehouseId))
    .flatMap(i => (i.inspection_items ?? [])
      .filter(item => Number(item.quantity_lost ?? 0) > 0)
      .map(item => ({ ...item, inspected_on: i.inspected_on, receipt_order_id: i.receipt_order_id }))
    );

  return (
    <Stack gap="xl">
      <Box pos="relative">
        <LoadingOverlay visible={receiptsLoading || dispatchesLoading || stockLoading} overlayProps={{ blur: 2 }} />
        
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Group align="center" gap="sm" mb={4}>
              <Title order={2}>{roleLabel} Dashboard</Title>
              <Badge color="violet" variant="light" size="lg">
                {warehouseName}
              </Badge>
            </Group>
            <Text c="dimmed" size="sm">
              Operational overview and pending actions for your warehouse.
            </Text>
          </div>
          <Tooltip label="You have 0 unread notifications">
            <ActionIcon variant="light" color="blue" size="xl" radius="md">
              <IconBell size={24} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Action Summary Cards */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} mt="md">
          <Card withBorder padding="lg" radius="md" bg="blue.0">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="blue.7" tt="uppercase" fw={700}>Pending Assignments</Text>
                <Text size="xl" fw={700} mt="xs">{pendingReceiptAssignments.length} Receipt Orders</Text>
              </div>
              <IconFileImport size={32} color="var(--mantine-color-blue-6)" />
            </Group>
            <Text size="xs" c="dimmed" mt="sm">Needs Storekeeper assignment</Text>
          </Card>

          <Card withBorder padding="lg" radius="md" bg="orange.0">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="orange.7" tt="uppercase" fw={700}>Pending Authorizations</Text>
                <Text size="xl" fw={700} mt="xs">{pendingDispatchAuthorizations.length} Dispatch Orders</Text>
              </div>
              <IconFileExport size={32} color="var(--mantine-color-orange-6)" />
            </Group>
            <Text size="xs" c="dimmed" mt="sm">Awaiting your approval</Text>
          </Card>

          <Card withBorder padding="lg" radius="md" bg="teal.0">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="teal.7" tt="uppercase" fw={700}>Active Dispatches</Text>
                <Text size="xl" fw={700} mt="xs">{activeDispatchAuthorizations.length} Confirmed</Text>
              </div>
              <IconFileCheck size={32} color="var(--mantine-color-teal-6)" />
            </Group>
            <Text size="xs" c="dimmed" mt="sm">Ready for Storekeeper pickup</Text>
          </Card>
        </SimpleGrid>

        <Divider my="xl" label="Attention Required" labelPosition="center" />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          {/* Pending Receipt Assignments Table */}
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>Assign Storekeepers</Title>
              <Button variant="subtle" size="xs" onClick={() => navigate('/receipts')}>View All</Button>
            </Group>
            {pendingReceiptAssignments.length === 0 ? (
              <Text c="dimmed" py="xl" ta="center">No receipt orders awaiting assignment.</Text>
            ) : (
              <Table variant="vertical" layout="fixed">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Ref #</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th w={40}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pendingReceiptAssignments.map((order) => (
                    <Table.Tr key={order.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{order.reference_no}</Text>
                        <Text size="xs" c="dimmed">{new Date(order.created_at).toLocaleDateString()}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" truncate>{order.source_name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon 
                          variant="subtle" 
                          onClick={() => navigate(`/officer/receipt-orders/${order.id}`)}
                        >
                          <IconArrowRight size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>

          {/* Pending Dispatch Authorizations Table */}
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>Authorize Dispatches</Title>
              <Button variant="subtle" size="xs" onClick={() => navigate('/dispatches')}>View All</Button>
            </Group>
            {pendingDispatchAuthorizations.length === 0 ? (
              <Text c="dimmed" py="xl" ta="center">No dispatch orders awaiting authorization.</Text>
            ) : (
              <Table variant="vertical" layout="fixed">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Destination</Table.Th>
                    <Table.Th>Expected</Table.Th>
                    <Table.Th w={40}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pendingDispatchAuthorizations.map((order) => (
                    <Table.Tr key={order.id}>
                      <Table.Td>
                        <Text size="sm" fw={500} truncate>{order.destination_name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{new Date(order.expected_pickup_date).toLocaleDateString()}</Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon 
                          variant="subtle" 
                          onClick={() => navigate(`/officer/dispatch-orders/${order.id}`)}
                        >
                          <IconArrowRight size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </SimpleGrid>

        {/* Inventory Summary */}
        <Paper withBorder p="md" radius="md" mt="xl">
          <Group justify="space-between" mb="md">
            <Title order={4}>Inventory Status</Title>
            <Button variant="outline" size="xs" leftSection={<IconPackage size={14} />} onClick={() => navigate('/stock-balances')}>
              Full Stock Report
            </Button>
          </Group>
          {stockBalances && stockBalances.length > 0 ? (
            <SimpleGrid cols={{ base: 2, sm: 4, md: 6 }}>
              {stockBalances.slice(0, 6).map((stock) => (
                <Card key={stock.id} withBorder p="sm" radius="md">
                  <Text size="xs" c="dimmed" fw={700} truncate>{stock.commodity_name}</Text>
                  <Group justify="space-between" align="flex-end" mt={4}>
                    <Text fw={700} size="lg">{(stock.quantity || 0).toLocaleString()}</Text>
                    <Text size="xs" c="dimmed">{stock.unit_name}</Text>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Text c="dimmed" py="xl" ta="center">No inventory records found for this warehouse.</Text>
          )}
        </Paper>

        {/* Lost Commodity Records */}
        <Paper withBorder p="md" radius="md" mt="xl">
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <Title order={4}>Lost Commodity Records</Title>
              {lostCommodityRecords.length > 0 && (
                <Badge color="red" variant="light">{lostCommodityRecords.length}</Badge>
              )}
            </Group>
          </Group>
          {lostCommodityRecords.length === 0 ? (
            <Text c="dimmed" py="xl" ta="center">No lost commodity records for this warehouse.</Text>
          ) : (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Receipt Order</Table.Th>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Qty Lost</Table.Th>
                  <Table.Th>Loss Type</Table.Th>
                  <Table.Th>Remarks</Table.Th>
                  <Table.Th>Recorded On</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lostCommodityRecords.map((record, idx) => {
                  const remarks = record.remarks ?? '';
                  const lossTypeMatch = remarks.match(/Loss type: ([^|]+)/);
                  const lossType = lossTypeMatch ? lossTypeMatch[1].trim() : '—';
                  const cleanRemarks = remarks.replace(/\s*\|\s*Loss type:[^|]+/, '').trim() || '—';
                  return (
                    <Table.Tr key={idx}>
                      <Table.Td>
                        {record.receipt_order_id ? (
                          <Text size="sm" fw={500}>RO-{record.receipt_order_id}</Text>
                        ) : <Text size="sm" c="dimmed">—</Text>}
                      </Table.Td>
                      <Table.Td><Text size="sm">{record.commodity_name || '—'}</Text></Table.Td>
                      <Table.Td><Badge color="red" variant="light">{Number(record.quantity_lost).toLocaleString()}</Badge></Table.Td>
                      <Table.Td><Badge color="orange" variant="light">{lossType}</Badge></Table.Td>
                      <Table.Td><Text size="sm" c="dimmed">{cleanRemarks}</Text></Table.Td>
                      <Table.Td><Text size="xs" c="dimmed">{new Date(record.inspected_on).toLocaleDateString()}</Text></Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {/* Placeholder for Inventory Adjustments (Not yet implemented) */}
        <Paper withBorder p="md" radius="md" mt="xl" bg="gray.0" style={{ borderStyle: 'dashed' }}>
          <Group gap="xs" c="dimmed">
            <IconAlertCircle size={20} />
            <Text size="sm" fw={500}>Inventory Adjustments module is coming soon.</Text>
          </Group>
        </Paper>
      </Box>
    </Stack>
  );
}
