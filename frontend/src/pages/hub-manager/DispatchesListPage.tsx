import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Stack, Title, Group, Card, Table, Text, Badge, SimpleGrid } from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { getDispatchOrders, type DispatchOrder } from '../../api/dispatchOrders';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

const OPERATIONAL_STATUSES = ['Draft', 'Confirmed', 'Assigned', 'Reserved', 'In Progress', 'Completed'];

export default function DispatchesListPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((state) => state.role));
  const userHubId = activeAssignment?.hub?.id;
  const isHubManager = roleSlug === 'hub_manager';

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_orders', 'hub', userHubId],
    queryFn: () => {
      if (isHubManager && userHubId) return getDispatchOrders({ hub_id: userHubId });
      return getDispatchOrders({});
    },
    enabled: Boolean(userHubId) || !isHubManager,
  });

  const hubAssignedLinesForOrder = (order: DispatchOrder) => {
    if (!isHubManager || !userHubId) return order.lines ?? [];
    return (order.lines ?? []).filter((line) => line.hub_id === userHubId);
  };

  const inboundDispatches = useMemo(() => {
    return orders.filter((order) => {
      const hasHubLines = (hubAssignedLinesForOrder(order).length ?? 0) > 0;
      return OPERATIONAL_STATUSES.includes(order.status) && (hasHubLines || (order.fdp_id ?? null) != null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, userHubId, isHubManager]);

  const filteredOrders = useMemo(() => {
    if (!statusFilter) return inboundDispatches;
    return inboundDispatches.filter((order) => order.status === statusFilter);
  }, [inboundDispatches, statusFilter]);

  const fdpLabelForOrder = (order: DispatchOrder) => {
    const lines = hubAssignedLinesForOrder(order);
    const fdpIds = new Set((lines ?? []).map((l) => l.fdp_id).filter((id): id is number => id != null));
    if (fdpIds.size > 1) return 'Multiple FDPs';
    if (fdpIds.size === 1) {
      const line = lines.find((l) => l.fdp_id != null);
      return line?.fdp_name || order.fdp_name || order.destination_name || '—';
    }
    return order.fdp_name || order.destination_name || '—';
  };

  const detailPath = (order: DispatchOrder) => `/hub/dispatch-authorizations/${order.id}`;

  const pending = inboundDispatches.filter((o) => o.status === 'Confirmed').length;
  const active = inboundDispatches.filter((o) => ['Assigned', 'Reserved', 'In Progress'].includes(o.status)).length;
  const completed = inboundDispatches.filter((o) => o.status === 'Completed').length;

  if (isLoading) return <LoadingState message="Loading Dispatches..." />;
  if (error) return <ErrorState message="Failed to load Dispatches" onRetry={refetch} />;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Dispatches</Title>
        <Text c="dimmed" size="sm">
          Dispatch orders sourced for {activeAssignment?.hub?.name ?? 'this hub'}
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
          No dispatches found for this hub.
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
              {filteredOrders.map((order) => {
                const hubLines = hubAssignedLinesForOrder(order);
                return (
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
                        {hubLines.length ?? 0} item{hubLines.length === 1 ? '' : 's'}
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
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
