/**
 * HubDispatchOrderDetailPage — Read-only dispatch order detail for Hub Managers.
 *
 * Displayed when a Hub Manager clicks a row in HubDispatchOrdersPage.
 * Shows the order details filtered to the manager's hub lines.
 * Provides a shortcut to create a Dispatch Authorization for this order.
 */
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stack, Title, Button, Group, Card, Table, Text, SimpleGrid,
} from '@mantine/core';
import { getDispatchOrder } from '../../api/dispatchOrders';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';

export default function HubDispatchOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((s) => s.role));
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const userHubId       = activeAssignment?.hub?.id;
  const userWarehouseId = activeAssignment?.warehouse?.id;

  // Determine which prefix to use for back-nav and DA creation
  const prefix = location.pathname.startsWith('/warehouse') ? '/warehouse' : '/hub';
  const backPath = `${prefix}/dispatches`;
  const newDaPath = `${prefix}/dispatch-authorizations/new`;

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_orders', id],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) {
        return getDispatchOrder(Number(id), { warehouse_id: userWarehouseId });
      }
      if (!isWarehouseManager && userHubId) {
        return getDispatchOrder(Number(id), { hub_id: userHubId });
      }
      return getDispatchOrder(Number(id));
    },
  });

  if (isLoading) return <LoadingState message="Loading dispatch order…" />;
  if (error || !order) return <ErrorState message="Failed to load dispatch order." onRetry={refetch} />;

  // Lines visible to current user
  const visibleLines = (() => {
    if (isWarehouseManager && userWarehouseId) {
      const f = (order.lines ?? []).filter((l) => l.warehouse_id === userWarehouseId);
      return f.length > 0 ? f : (order.lines ?? []);
    }
    if (userHubId) {
      const f = (order.lines ?? []).filter((l) => l.hub_id === userHubId || !l.hub_id);
      return f.length > 0 ? f : (order.lines ?? []);
    }
    return order.lines ?? [];
  })();

  const canAuthorize = order.status !== 'Draft';

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Group gap="sm" align="center">
            <Title order={2}>
              Dispatch Order {order.reference_no || `DO-${order.id}`}
            </Title>
            <StatusBadge status={order.status} />
          </Group>
          <Text c="dimmed" size="sm">
            Created {new Date(order.created_at).toLocaleDateString()}
          </Text>
        </div>
        <Group>
          <Button variant="default" onClick={() => navigate(backPath)}>
            ← Back
          </Button>
          {canAuthorize && (
            <Button
              onClick={() =>
                navigate(`${newDaPath}?dispatch_order_id=${order.id}`)
              }
            >
              Create Dispatch Authorization
            </Button>
          )}
        </Group>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={700} size="sm" tt="uppercase" c="dimmed">Order Details</Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <div>
              <Text size="xs" c="dimmed">Reference</Text>
              <Text fw={600}>{order.reference_no || `DO-${order.id}`}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Response Plan Ref</Text>
              <Text fw={600}>{order.response_plan_ref || '—'}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">FDP / Destination</Text>
              <Text fw={600}>{order.fdp_name || order.destination_name || '—'}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Source Warehouse</Text>
              <Text fw={600}>{order.source_warehouse_name || '—'}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Expected Date</Text>
              <Text fw={600}>
                {order.expected_pickup_date
                  ? new Date(order.expected_pickup_date).toLocaleDateString()
                  : '—'}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Status</Text>
              <StatusBadge status={order.status} />
            </div>
          </SimpleGrid>
          {(order.description || order.notes) && (
            <div>
              <Text size="xs" c="dimmed">Description</Text>
              <Text size="sm">{order.description || order.notes}</Text>
            </div>
          )}
        </Stack>
      </Card>

      <div>
        <Text fw={600} size="sm" mb="md">
          Order Items {isWarehouseManager ? '(your warehouse)' : userHubId ? '(your hub)' : ''}
        </Text>
        <Table.ScrollContainer minWidth={700}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Commodity</Table.Th>
                <Table.Th>Source Warehouse</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Unit</Table.Th>
                <Table.Th>FDP</Table.Th>
                <Table.Th>Expected Receive</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibleLines.map((line, idx) => (
                <Table.Tr key={line.id ?? idx}>
                  <Table.Td>{line.commodity_name || line.commodity_id}</Table.Td>
                  <Table.Td>{line.warehouse_name || line.hub_name || '—'}</Table.Td>
                  <Table.Td>{line.quantity}</Table.Td>
                  <Table.Td>{line.unit_name || line.unit_id}</Table.Td>
                  <Table.Td>{line.fdp_name || '—'}</Table.Td>
                  <Table.Td>
                    {line.expected_receive_at
                      ? new Date(line.expected_receive_at).toLocaleDateString()
                      : '—'}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </div>
    </Stack>
  );
}
