import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Stack, Title, Group, Card, Table, Text, Badge, SimpleGrid } from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { getDispatchOrders } from '../../api/dispatchOrders';
import type { DispatchOrder } from '../../api/dispatchOrders';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

const OPERATIONAL_STATUSES = ['Confirmed', 'Assigned', 'Reserved', 'In Progress', 'Completed'];

export default function DispatchAuthorizationListPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((state) => state.role));
  const userHubId = activeAssignment?.hub?.id;
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const isHubManager = roleSlug === 'hub_manager';
  const isWarehouseManager = roleSlug === 'warehouse_manager';

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: [
      'dispatch_orders',
      'dispatch_authorizations',
      { hub_id: isHubManager ? userHubId : undefined, warehouse_id: isWarehouseManager ? userWarehouseId : undefined },
    ],
    queryFn: () => {
      if (isHubManager && userHubId) {
        return getDispatchOrders({ hub_id: userHubId });
      }
      if (isWarehouseManager && userWarehouseId) {
        return getDispatchOrders({ warehouse_id: userWarehouseId });
      }
      return getDispatchOrders({});
    },
  });

  const inboundDispatches = useMemo(() => {
    return orders.filter(
      (order) =>
        OPERATIONAL_STATUSES.includes(order.status) &&
        (order.fdp_id || order.response_plan_ref || (order.lines?.length ?? 0) > 0)
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!statusFilter) return inboundDispatches;
    return inboundDispatches.filter((order) => order.status === statusFilter);
  }, [inboundDispatches, statusFilter]);

  const pending = inboundDispatches.filter((o) => o.status === 'Confirmed').length;
  const active = inboundDispatches.filter((o) => ['Assigned', 'Reserved', 'In Progress'].includes(o.status)).length;
  const completed = inboundDispatches.filter((o) => o.status === 'Completed').length;

  const fdpLabelForOrder = (order: DispatchOrder) => {
    const lineFdpIds = new Set(
      (order.lines ?? [])
        .map((line) => line.fdp_id)
        .filter((id): id is number => id != null)
    );
    if (lineFdpIds.size > 1) return 'Multiple FDPs';
    if (lineFdpIds.size === 1) {
      const line = order.lines?.find((l) => l.fdp_id != null);
      return line?.fdp_name || order.fdp_name || order.destination_name || '—';
    }
    return order.fdp_name || order.destination_name || '—';
  };

  const detailPath = (order: DispatchOrder) => {
    if (isHubManager) return `/hub/dispatch-authorizations/${order.id}`;
    return `/warehouse/dispatch-authorizations/${order.id}`;
  };

  if (isLoading) return <LoadingState message="Loading Dispatch Authorizations..." />;
  if (error) return <ErrorState message="Failed to load Dispatch Authorizations." onRetry={refetch} />;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Dispatch Authorization</Title>
        <Text c="dimmed" size="sm">
          Receive and authorize inbound dispatches executed from officer dispatch plans
        </Text>
      </div>

      <SimpleGrid cols={{ base: 3, sm: 3 }}>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="yellow">
            {pending}
          </Text>
          <Text size="sm" c="dimmed">
            Confirmed
          </Text>
        </Card>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="blue">
            {active}
          </Text>
          <Text size="sm" c="dimmed">
            In Progress
          </Text>
        </Card>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="green">
            {completed}
          </Text>
          <Text size="sm" c="dimmed">
            Completed
          </Text>
        </Card>
      </SimpleGrid>

      <Group>
        <SearchableSelect
          placeholder="All statuses"
          data={OPERATIONAL_STATUSES.map((s) => ({ value: s, label: s }))}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          w={200}
        />
      </Group>

      {filteredOrders.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No dispatch authorizations found.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={800}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reference</Table.Th>
                <Table.Th>FDP</Table.Th>
                <Table.Th>Source Warehouse</Table.Th>
                <Table.Th>Commodity Lines</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Expected Date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredOrders.map((order) => (
                <Table.Tr
                  key={order.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(detailPath(order))}
                >
                  <Table.Td>
                    <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
                      {order.reference_no || `DP-${order.id}`}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{fdpLabelForOrder(order)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{order.source_warehouse_name || '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {order.lines?.length ?? 0} item{(order.lines?.length ?? 0) === 1 ? '' : 's'}
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
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
