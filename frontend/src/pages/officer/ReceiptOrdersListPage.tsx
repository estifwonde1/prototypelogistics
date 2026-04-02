import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  Table,
  ActionIcon,
  Text,
  Select,
} from '@mantine/core';
import { IconPlus, IconSearch, IconEye } from '@tabler/icons-react';
import { getReceiptOrders } from '../../api/receiptOrders';
import { getWarehouses } from '../../api/warehouses';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

function ReceiptOrdersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);

  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['receipt_orders'],
    queryFn: getReceiptOrders,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const filteredOrders = orders?.filter((order) => {
    const sourceLabel = (
      order.source_name ||
      order.name ||
      (order.source_reference != null ? String(order.source_reference) : '') ||
      ''
    ).toLowerCase();
    const matchesSearch =
      order.id.toString().includes(search) || sourceLabel.includes(search.toLowerCase());
    const matchesStatus = !statusFilter || order.status === statusFilter;
    const whId = order.destination_warehouse_id ?? order.warehouse_id;
    const matchesWarehouse =
      !warehouseFilter || (whId != null && String(whId) === warehouseFilter);
    return matchesSearch && matchesStatus && matchesWarehouse;
  });

  const statusOptions = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Confirmed', label: 'Confirmed' },
  ];

  const warehouseOptions =
    warehouses?.map((w) => ({
      value: w.id.toString(),
      label: w.name,
    })) || [];

  if (isLoading) {
    return <LoadingState message="Loading Receipt Orders..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load Receipt Orders. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Receipt Orders</Title>
          <Text c="dimmed" size="sm">
            Create and manage inbound warehouse orders
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/officer/receipt-orders/new')}
        >
          Create Receipt Order
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by order ID or source..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="Filter by status"
          data={statusOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          style={{ width: 200 }}
        />
        <Select
          placeholder="Filter by warehouse"
          data={warehouseOptions}
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          clearable
          style={{ width: 200 }}
        />
      </Group>

      {filteredOrders && filteredOrders.length === 0 ? (
        <EmptyState
          title="No Receipt Orders found"
          description={
            search || statusFilter || warehouseFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first Receipt Order'
          }
          action={
            !search && !statusFilter && !warehouseFilter
              ? {
                  label: 'Create Receipt Order',
                  onClick: () => navigate('/officer/receipt-orders/new'),
                }
              : undefined
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order ID</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Destination</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Items</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredOrders?.map((order) => (
                <Table.Tr
                  key={order.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/officer/receipt-orders/${order.id}`)}
                >
                  <Table.Td style={{ fontWeight: 600 }}>RO-{order.id}</Table.Td>
                  <Table.Td>
                    {order.source_name ||
                      order.name ||
                      (order.source_reference != null ? String(order.source_reference) : '—')}
                  </Table.Td>
                  <Table.Td>
                    {order.warehouse_name || order.destination_warehouse_name || '—'}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={order.status} />
                  </Table.Td>
                  <Table.Td>
                    {order.receipt_order_lines?.length ?? order.lines?.length ?? 0}
                  </Table.Td>
                  <Table.Td>
                    {new Date(order.created_at).toLocaleDateString()}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => navigate(`/officer/receipt-orders/${order.id}`)}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}

export default ReceiptOrdersListPage;
