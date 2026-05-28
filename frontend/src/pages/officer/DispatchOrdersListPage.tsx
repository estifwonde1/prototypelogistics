import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
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
  Tooltip,
} from '@mantine/core';
import { IconPlus, IconSearch, IconEye, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { deleteDispatchOrder, getDispatchOrders, type DispatchOrder } from '../../api/dispatchOrders';
import { getWarehouses } from '../../api/warehouses';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { usePermission } from '../../hooks/usePermission';
import type { ApiError } from '../../types/common';
import { getDispatchOrderReference } from '../../utils/dispatchOrderReference';

function orderCanBeRemoved(order: DispatchOrder): boolean {
  if (order.can_destroy !== undefined) return order.can_destroy;
  const auths = order.dispatch_order_authorizations ?? [];
  return auths.length === 0;
}

function DispatchOrdersListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const canDeleteOrders = can('dispatch_orders', 'delete');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userHubId = activeAssignment?.hub?.id;
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const isHubManager = roleSlug === 'hub_manager';

  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_orders', {
      warehouse_id: isWarehouseManager ? userWarehouseId : undefined,
      hub_id: isHubManager ? userHubId : undefined,
    }],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) {
        return getDispatchOrders({ warehouse_id: userWarehouseId });
      } else if (isHubManager && userHubId) {
        return getDispatchOrders();
      }
      return getDispatchOrders({});
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDispatchOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({
        title: 'Removed',
        message: 'Dispatch order deleted. You can create a new one.',
        color: 'green',
      });
      setDeletingId(null);
    },
    onError: (err: unknown) => {
      setDeletingId(null);
      notifications.show({
        title: 'Could not remove',
        message:
          (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
          'Failed to delete dispatch order',
        color: 'red',
      });
    },
  });

  const handleRemove = (order: DispatchOrder) => {
    const label = getDispatchOrderReference(order);
    const confirmed = window.confirm(
      `Remove dispatch order ${label}?\n\nThis is only allowed before any warehouse manager creates an authorization.`
    );
    if (!confirmed) return;
    setDeletingId(order.id);
    deleteMutation.mutate(order.id);
  };

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => {
      if (isHubManager && userHubId) {
        return getWarehouses({ hub_id: userHubId });
      }
      return getWarehouses({});
    },
  });

  const filteredOrders = orders?.filter((order) => {
    const dest = (order.destination_name || '').toLowerCase();
    const dispatchRef = getDispatchOrderReference(order).toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      order.id.toString().includes(search) ||
      dest.includes(q) ||
      dispatchRef.includes(q);
    const st = String(order.status || '');
    const matchesStatus =
      !statusFilter || st === statusFilter || st.toLowerCase() === String(statusFilter).toLowerCase();
    const matchesWarehouse =
      !warehouseFilter ||
      (order.source_warehouse_id && order.source_warehouse_id.toString() === warehouseFilter);
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
        <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/officer/dispatch-orders/new')}>
          New dispatch order
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
                <Table.Th>Dispatch reference</Table.Th>
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
                const showRemove = canDeleteOrders && orderCanBeRemoved(order);

                const v2Lines = order.dispatch_order_lines ?? [];
                const sourceNames = v2Lines.length > 0
                  ? [...new Set(
                      v2Lines.flatMap((l) =>
                        (l.source_allocations ?? []).map(
                          (s) => s.warehouse?.label || s.warehouse?.name || (s.warehouse_id ? `WH-${s.warehouse_id}` : null)
                        ).filter(Boolean)
                      )
                    )].join(', ') || order.source_warehouse_name || '—'
                  : order.source_warehouse_name || '—';

                const destNames = v2Lines.length > 0
                  ? [...new Set(
                      v2Lines.flatMap((l) =>
                        (l.destination_allocations ?? []).map(
                          (d) => d.destination_label || d.destination_location?.label || d.destination_location?.name || null
                        ).filter(Boolean)
                      )
                    )].join(', ') || order.destination_name || '—'
                  : order.destination_name || '—';

                const itemCount = v2Lines.length || order.lines?.length || 0;

                return (
                  <Table.Tr
                    key={order.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/officer/dispatch-orders/${order.id}`)}
                  >
                    <Table.Td style={{ fontWeight: 600 }}>{getDispatchOrderReference(order)}</Table.Td>
                    <Table.Td>{sourceNames}</Table.Td>
                    <Table.Td>{destNames}</Table.Td>
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
                    <Table.Td>{itemCount}</Table.Td>
                    <Table.Td>
                      {new Date(order.created_at).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
                        <Tooltip label="View">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => navigate(`/officer/dispatch-orders/${order.id}`)}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                        {showRemove && (
                          <Tooltip label="Remove (before warehouse authorization)">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              loading={deletingId === order.id}
                              onClick={() => handleRemove(order)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
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
