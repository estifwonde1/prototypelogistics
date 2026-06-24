/**
 * HubDispatchOrdersPage — Hub Manager's "Dispatches" view
 *
 * Lists dispatch orders relevant to the current hub. Hub managers see only
 * the lines that belong to their hub. Clicking a row opens a read-only
 * detail view of that dispatch order.
 */
import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stack, Title, Text, Table, Badge, Card, SimpleGrid,
} from '@mantine/core';
import { getDispatchOrders } from '../../api/dispatchOrders';
import type { DispatchOrder } from '../../api/dispatchOrders';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { DispatchListActionButtons } from '../../components/dispatch/DispatchListActionButtons';
import { getDispatchOrderListActions } from '../../utils/dispatchListActions';
import { useWarehouseManagerRaAccess } from '../../hooks/useWarehouseManagerRaAccess';

export default function HubDispatchOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((s) => s.role));
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const isHubManager = roleSlug === 'hub_manager';
  const userHubId       = activeAssignment?.hub?.id;
  const userWarehouseId = activeAssignment?.warehouse?.id;

  // Base path differs by role — used for row click navigation
  const basePath = location.pathname.startsWith('/warehouse') ? '/warehouse' : '/hub';
  const dispatchesPath = `${basePath}/dispatches`;

  const { isStandaloneWarehouse } = useWarehouseManagerRaAccess();
  const canCreateAuthorization = isHubManager || isStandaloneWarehouse;

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_orders', 'dispatches_view', { hub_id: userHubId, warehouse_id: userWarehouseId }],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) return getDispatchOrders({ warehouse_id: userWarehouseId });
      if (userHubId) return getDispatchOrders({ hub_id: userHubId });
      return getDispatchOrders({});
    },
  });

  // Filter to confirmed+ orders (not Draft — those are officer-only)
  const relevantOrders = useMemo(
    () =>
      orders.filter((o) => o.status !== 'Draft'),
    [orders]
  );

  // Lines visible to current user — hub managers see only lines tagged to their hub
  const visibleLinesForOrder = (order: DispatchOrder) => {
    if (isWarehouseManager && userWarehouseId) {
      const filtered = (order.lines ?? []).filter((l) => l.warehouse_id === userWarehouseId);
      return filtered.length > 0 ? filtered : (order.lines ?? []);
    }
    if (userHubId) {
      const filtered = (order.lines ?? []).filter((l) => l.hub_id === userHubId);
      return filtered.length > 0 ? filtered : (order.lines ?? []);
    }
    return order.lines ?? [];
  };

  const pendingCount  = relevantOrders.filter((o) => o.status === 'Confirmed').length;
  const activeCount   = relevantOrders.filter((o) =>
    ['Assigned', 'Reserved', 'In Progress'].includes(o.status)
  ).length;
  const doneCount     = relevantOrders.filter((o) => o.status === 'Completed').length;

  if (isLoading) return <LoadingState message="Loading dispatch orders…" />;
  if (error)     return <ErrorState message="Failed to load dispatch orders." onRetry={refetch} />;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Dispatches</Title>
        <Text c="dimmed" size="sm">
          {isWarehouseManager
            ? 'Dispatch orders assigned to your warehouse — use the action button on each row for the next step.'
            : 'Dispatch orders assigned to your hub — use the action button on each row for the next step.'}
        </Text>
      </div>

      <SimpleGrid cols={{ base: 3, sm: 3 }}>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="yellow">{pendingCount}</Text>
          <Text size="sm" c="dimmed">Confirmed</Text>
        </Card>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="blue">{activeCount}</Text>
          <Text size="sm" c="dimmed">In Progress</Text>
        </Card>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="green">{doneCount}</Text>
          <Text size="sm" c="dimmed">Completed</Text>
        </Card>
      </SimpleGrid>

      {relevantOrders.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No dispatch orders found.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={800}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reference</Table.Th>
                <Table.Th>FDP / Destination</Table.Th>
                <Table.Th>Items</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Expected Date</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Next Step</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {relevantOrders.map((order) => {
                const lines = visibleLinesForOrder(order);
                const actions = getDispatchOrderListActions(order, basePath, {
                  canCreateAuthorization,
                });
                return (
                  <Table.Tr
                    key={order.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`${dispatchesPath}/${order.id}`)}
                  >
                    <Table.Td>
                      <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
                        {order.reference_no || `DO-${order.id}`}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {order.fdp_name || order.destination_name || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {lines.length} item{lines.length === 1 ? '' : 's'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={order.status} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {order.expected_pickup_date
                          ? new Date(order.expected_pickup_date).toLocaleDateString()
                          : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <DispatchListActionButtons actions={actions} />
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
