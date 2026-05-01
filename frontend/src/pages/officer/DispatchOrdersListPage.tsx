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
  Badge,
} from '@mantine/core';
import { IconPlus, IconSearch, IconEye } from '@tabler/icons-react';
import { getDispatchOrders } from '../../api/dispatchOrders';
import { getWarehouses } from '../../api/warehouses';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';

function DispatchOrdersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);

  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const isWarehouseManager = roleSlug === 'warehouse_manager';

  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_orders', { warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
    queryFn: () => {
      const params = isWarehouseManager && userWarehouseId ? { warehouse_id: userWarehouseId } : {};
      return getDispatchOrders(params);
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
  });

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      order.id.toString().includes(search) ||
      order.destination_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesWarehouse =
      !warehouseFilter || order.source_warehouse_id.toString() === warehouseFilter;
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
    return <LoadingState message="Loading Dispatch Orders..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load Dispatch Orders. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Dispatch Orders</Title>
          <Text c="dimmed" size="sm">
            Create and manage outbound warehouse orders
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/officer/dispatch-orders/new')}
        >
          Create Dispatch Order
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by order ID or destination..."
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
          title="No Dispatch Orders found"
          description={
            search || statusFilter || warehouseFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first Dispatch Order'
          }
          action={
            !search && !statusFilter && !warehouseFilter
              ? {
                  label: 'Create Dispatch Order',
                  onClick: () => navigate('/officer/dispatch-orders/new'),
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
                <Table.Th>Jurisdiction</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Items</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredOrders?.map((order) => {
                const isFederal = !order.location_name || !order.hierarchical_level || order.hierarchical_level === 'Federal';
                return (
                  <Table.Tr
                    key={order.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/officer/dispatch-orders/${order.id}`)}
                  >
                    <Table.Td style={{ fontWeight: 600 }}>DO-{order.id}</Table.Td>
                    <Table.Td>{order.source_warehouse_name || 'N/A'}</Table.Td>
                    <Table.Td>{order.destination_name}</Table.Td>
                    <Table.Td>
                      {isFederal ? (
                        <Badge color="gray" variant="light" size="sm">Federal</Badge>
                      ) : (
                        <Badge color="blue" variant="light" size="sm">
                          {order.location_name} — {order.hierarchical_level}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={order.status} />
                    </Table.Td>
                    <Table.Td>{order.lines?.length || 0}</Table.Td>
                    <Table.Td>
                      {new Date(order.created_at).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => navigate(`/officer/dispatch-orders/${order.id}`)}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}

export default DispatchOrdersListPage;

