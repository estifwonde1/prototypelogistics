import { useMemo, useState } from 'react';
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
import { getReceiptOrders, type ReceiptOrder } from '../../api/receiptOrders';
import { getWarehouses } from '../../api/warehouses';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';

/** Matches Rails `ReceiptOrderSerializer#status` (enum value + `.titleize`). */
const RECEIPT_ORDER_STATUS_FILTER_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Assigned', label: 'Assigned' },
  { value: 'Reserved', label: 'Reserved' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
] as const;

const NO_DESTINATION_WAREHOUSE_VALUE = '__none__';

function normalizeStatusKey(status: string | null | undefined): string {
  return (status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function receiptOrderMatchesSearch(order: ReceiptOrder, raw: string): boolean {
  const q = raw.trim();
  if (!q) return true;

  const roMatch = /^ro[-\s]?(\d+)$/i.exec(q);
  if (roMatch) {
    return order.id === Number(roMatch[1]);
  }

  if (/^\d+$/.test(q)) {
    return order.id === Number(q);
  }

  const lower = q.toLowerCase();
  const sourceLabel = (
    order.source_name ||
    order.name ||
    (order.source_reference != null ? String(order.source_reference) : '') ||
    ''
  ).toLowerCase();
  const ref = order.reference_no ? String(order.reference_no).toLowerCase() : '';
  const displayRo = `ro-${order.id}`;
  return (
    sourceLabel.includes(lower) ||
    ref.includes(lower) ||
    displayRo.includes(lower) ||
    String(order.id).includes(q)
  );
}

function ReceiptOrdersListPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);

  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const isWarehouseManager = roleSlug === 'warehouse_manager';

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['receipt_orders', { warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
    queryFn: () => {
      const params = isWarehouseManager && userWarehouseId ? { warehouse_id: userWarehouseId } : {};
      return getReceiptOrders(params);
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
  });

  const filteredOrders = useMemo(() => {
    if (!orders?.length) return orders;

    return orders.filter((order) => {
      // CRITICAL: Warehouse managers should ONLY see orders explicitly assigned to their warehouse
      // NOT orders assigned only to the hub (hub manager handles those first)
      if (isWarehouseManager && userWarehouseId) {
        const hasWarehouseAssignment = order.warehouse_id === userWarehouseId || 
                                       order.destination_warehouse_id === userWarehouseId;
        
        // If order is assigned to hub but not to specific warehouse, hide it
        if (order.hub_id && !hasWarehouseAssignment) {
          return false;
        }
        
        // If order has no warehouse assignment at all, hide it
        if (!hasWarehouseAssignment) {
          return false;
        }
      }

      if (!receiptOrderMatchesSearch(order, search)) return false;

      if (statusFilter) {
        const selected = normalizeStatusKey(statusFilter);
        const actual = normalizeStatusKey(order.status);
        if (selected !== actual) return false;
      }

      if (warehouseFilter) {
        if (warehouseFilter === NO_DESTINATION_WAREHOUSE_VALUE) {
          const whId = order.destination_warehouse_id ?? order.warehouse_id;
          if (whId != null) return false;
        } else {
          const whId = order.destination_warehouse_id ?? order.warehouse_id;
          if (whId == null || String(whId) !== warehouseFilter) return false;
        }
      }

      return true;
    });
  }, [orders, search, statusFilter, warehouseFilter, isWarehouseManager, userWarehouseId]);

  const statusOptions = [...RECEIPT_ORDER_STATUS_FILTER_OPTIONS];

  const warehouseOptions = [
    { value: NO_DESTINATION_WAREHOUSE_VALUE, label: 'No destination warehouse' },
    ...(warehouses?.map((w) => ({
      value: w.id.toString(),
      label: w.name,
    })) ?? []),
  ];
  const canCreateReceiptOrder = can('receipt_orders', 'create');

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
        {canCreateReceiptOrder ? (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/officer/receipt-orders/new')}
          >
            Create Receipt Order
          </Button>
        ) : null}
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
              : canCreateReceiptOrder
                ? 'Get started by creating your first Receipt Order'
                : 'No assigned receipt orders yet'
          }
          action={
            !search && !statusFilter && !warehouseFilter && canCreateReceiptOrder
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
                    onClick={() => navigate(`/receipt-orders/${order.id}`)}
                  >
                    <Table.Td style={{ fontWeight: 600 }}>RO-{order.id}</Table.Td>
                    <Table.Td>
                      {order.source_name ||
                        order.name ||
                        (order.source_reference != null ? String(order.source_reference) : '—')}
                    </Table.Td>
                    <Table.Td>
                      {order.warehouse_name || order.destination_warehouse_name || order.hub_name || '—'}
                    </Table.Td>
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
                          onClick={() => navigate(`/receipt-orders/${order.id}`)}
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

export default ReceiptOrdersListPage;
