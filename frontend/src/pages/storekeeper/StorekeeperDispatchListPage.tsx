import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Card,
  Group,
  Badge,
  Button,
  SimpleGrid,
  Progress,
  Table,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconTruck,
  IconArrowRight,
  IconPackageExport,
  IconCheck,
  IconEye,
  IconHistory,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getDispatchOrderAuthorizations } from '../../api/dispatchOrderAuthorizations';
import { getDispatchOrder } from '../../api/dispatchOrders';
import { getGins } from '../../api/gins';
import type { DispatchOrderAuthorization } from '../../types/dispatchV2';
import { getDispatchOrderReference } from '../../utils/dispatchOrderReference';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

type SkProgress =
  | 'awaiting_execution'
  | 'awaiting_driver_confirm'
  | 'awaiting_stacks'
  | 'done';

function getSkProgress(auth: DispatchOrderAuthorization): SkProgress {
  const status = String(auth.status ?? '').toLowerCase();
  if (status === 'completed') return 'done';

  const stores = auth.dispatch_order_authorization_stores ?? [];
  const executions = auth.dispatch_order_authorization_executions ?? [];
  if (stores.length === 0) return 'awaiting_execution';
  const hasExecutionWithQty = executions.some((e) => Number(e.quantity) > 0);
  const allStoresDispatched = stores.every((s) => Number(s.remaining_quantity ?? 0) <= 0);

  if (!hasExecutionWithQty && !allStoresDispatched) return 'awaiting_execution';
  if (!auth.driver_confirmed_at) return 'awaiting_driver_confirm';
  if (status !== 'completed') return 'awaiting_stacks';
  return 'done';
}

function progressLabel(p: SkProgress): string {
  switch (p) {
    case 'awaiting_execution':
      return 'Record dispatch';
    case 'awaiting_driver_confirm':
      return 'Confirm driver';
    case 'awaiting_stacks':
      return 'Assign stacks';
    case 'done':
      return 'Completed';
  }
}

function progressColor(p: SkProgress): string {
  switch (p) {
    case 'awaiting_execution':
      return 'yellow';
    case 'awaiting_driver_confirm':
      return 'blue';
    case 'awaiting_stacks':
      return 'cyan';
    case 'done':
      return 'green';
  }
}

function storeProgress(auth: DispatchOrderAuthorization): number {
  const stores = auth.dispatch_order_authorization_stores ?? [];
  if (stores.length === 0) return 0;
  const total = stores.reduce((s, r) => s + Number(r.authorized_quantity ?? 0), 0);
  const dispatched = stores.reduce(
    (s, r) => s + Number(r.dispatched_quantity ?? r.authorized_quantity - r.remaining_quantity),
    0
  );
  if (total <= 0) return 0;
  return Math.min(100, (dispatched / total) * 100);
}

function commoditySummary(auth: DispatchOrderAuthorization): string {
  const stores = auth.dispatch_order_authorization_stores ?? [];
  const names = [...new Set(stores.map((s) => s.commodity_name).filter(Boolean))];
  return names.join(', ') || '—';
}

function storeSummary(auth: DispatchOrderAuthorization): string {
  const stores = auth.dispatch_order_authorization_stores ?? [];
  const names = [...new Set(stores.map((s) => s.store_name).filter(Boolean))];
  return names.join(', ') || '—';
}

function formatCompletedAt(auth: DispatchOrderAuthorization): string {
  const raw = auth.confirmed_at ?? auth.driver_confirmed_at;
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function StorekeeperDispatchListPage() {
  const navigate = useNavigate();

  const { data: auths = [], isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_order_authorizations', 'storekeeper'],
    queryFn: () => getDispatchOrderAuthorizations({ storekeeper_scope: true }),
    refetchOnMount: 'always',
  });

  const orderIds = useMemo(
    () => [...new Set(auths.map((a) => a.dispatch_order_id))],
    [auths]
  );

  const { data: orderRefMap = new Map<number, string>() } = useQuery({
    queryKey: ['dispatch_orders', 'storekeeper_refs', orderIds],
    queryFn: async () => {
      const m = new Map<number, string>();
      await Promise.all(
        orderIds.map(async (oid) => {
          const o = await getDispatchOrder(oid);
          m.set(o.id, getDispatchOrderReference(o));
        })
      );
      return m;
    },
    enabled: orderIds.length > 0,
  });

  const completedAuths = useMemo(
    () =>
      auths
        .filter((a) => String(a.status ?? '').toLowerCase() === 'completed')
        .sort((a, b) => b.id - a.id),
    [auths]
  );

  const completedAuthIds = useMemo(() => completedAuths.map((a) => a.id), [completedAuths]);

  const { data: ginRefByAuthId = new Map<number, string>() } = useQuery({
    queryKey: ['gins', 'storekeeper_history', completedAuthIds],
    queryFn: async () => {
      const m = new Map<number, string>();
      await Promise.all(
        completedAuthIds.map(async (authId) => {
          const gins = await getGins({ dispatch_order_authorization_id: authId });
          const gin = gins[0];
          if (gin) m.set(authId, gin.reference_no || `GIN-${gin.id}`);
        })
      );
      return m;
    },
    enabled: completedAuthIds.length > 0,
  });

  const activeAuths = auths.filter((a) => {
    const s = String(a.status ?? '').toLowerCase();
    return s === 'confirmed' || s === 'in_progress';
  });

  const needsAction = activeAuths.filter((a) => getSkProgress(a) !== 'done');

  const awaitingExecution = activeAuths.filter((a) => getSkProgress(a) === 'awaiting_execution').length;
  const awaitingDriver = activeAuths.filter((a) => getSkProgress(a) === 'awaiting_driver_confirm').length;
  const awaitingStacks = activeAuths.filter((a) => getSkProgress(a) === 'awaiting_stacks').length;

  if (isLoading) return <LoadingState message="Loading outbound dispatches..." />;
  if (error) return <ErrorState message="Failed to load outbound dispatches" onRetry={refetch} />;

  return (
    <Stack gap="md">
      <Group>
        <IconPackageExport size={28} />
        <Title order={2}>Outbound Dispatches</Title>
      </Group>

      <Text c="dimmed">
        Dispatch authorizations for your stores. Record quantities issued, confirm the driver, assign
        stacks, and finish the GIN.
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Record dispatch
          </Text>
          <Text size="xl" fw={700} c="yellow">
            {awaitingExecution}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Confirm driver
          </Text>
          <Text size="xl" fw={700} c="blue">
            {awaitingDriver}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Assign stacks
          </Text>
          <Text size="xl" fw={700} c="cyan">
            {awaitingStacks}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Completed
          </Text>
          <Text size="xl" fw={700} c="green">
            {completedAuths.length}
          </Text>
        </Card>
      </SimpleGrid>

      {needsAction.length === 0 ? (
        <Card withBorder padding="xl">
          <Text c="dimmed" ta="center">
            No outbound dispatches need your action right now.
          </Text>
        </Card>
      ) : (
        <>
          <Title order={4}>Action required</Title>
          {needsAction.map((auth) => {
            const progress = getSkProgress(auth);
            const dispatchRef = orderRefMap.get(auth.dispatch_order_id) || `DO-${auth.dispatch_order_id}`;
            const pct = storeProgress(auth);

            return (
              <Card key={auth.id} withBorder padding="lg">
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Group gap="xs" mb={4}>
                        <Text fw={600} style={{ fontFamily: 'monospace' }}>
                          {auth.reference_no || `DA-${auth.id}`}
                        </Text>
                        <Badge color={progressColor(progress)} variant="light">
                          {progressLabel(progress)}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        Dispatch ref: {dispatchRef}
                      </Text>
                      <Text size="sm" c="dimmed">
                        <IconTruck size={14} style={{ verticalAlign: 'middle' }} />{' '}
                        {auth.driver_name || '—'} — {auth.truck_plate_number || '—'}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {commoditySummary(auth)} · {auth.authorized_quantity} authorized ·{' '}
                        {storeSummary(auth)}
                      </Text>
                    </div>
                    <Button
                      size="sm"
                      color={progressColor(progress)}
                      rightSection={<IconArrowRight size={14} />}
                      onClick={() => navigate(`/storekeeper/dispatch-authorizations/${auth.id}`)}
                    >
                      {progressLabel(progress)}
                    </Button>
                  </Group>
                  {pct > 0 && (
                    <Progress value={pct} size="xs" color={pct >= 100 ? 'green' : 'blue'} />
                  )}
                </Stack>
              </Card>
            );
          })}
        </>
      )}

      <Group gap="xs" mt="sm">
        <IconHistory size={20} />
        <Title order={4}>Dispatch history</Title>
      </Group>
      <Text size="sm" c="dimmed">
        Completed outbound dispatches for your stores, listed by dispatch reference.
      </Text>

      {completedAuths.length === 0 ? (
        <EmptyState
          title="No completed dispatches yet"
          description="Finished outbound dispatches for your stores will appear here with dispatch reference, GIN, and completion status."
        />
      ) : (
        <Card withBorder padding={0}>
          <Table.ScrollContainer minWidth={900}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Dispatch ref</Table.Th>
                  <Table.Th>Authorization</Table.Th>
                  <Table.Th>GIN</Table.Th>
                  <Table.Th>Driver / plate</Table.Th>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Qty</Table.Th>
                  <Table.Th>Store</Table.Th>
                  <Table.Th>Completed</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={100}>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {completedAuths.map((auth) => {
                  const dispatchRef =
                    orderRefMap.get(auth.dispatch_order_id) || `DO-${auth.dispatch_order_id}`;
                  const ginRef = ginRefByAuthId.get(auth.id);

                  return (
                    <Table.Tr key={auth.id}>
                      <Table.Td>
                        <Text fw={600} style={{ fontFamily: 'monospace' }}>
                          {dispatchRef}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" style={{ fontFamily: 'monospace' }}>
                          {auth.reference_no || `DA-${auth.id}`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c={ginRef ? undefined : 'dimmed'}>
                          {ginRef || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {auth.driver_name || '—'}
                          {auth.truck_plate_number ? ` · ${auth.truck_plate_number}` : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td>{commoditySummary(auth)}</Table.Td>
                      <Table.Td>{auth.authorized_quantity}</Table.Td>
                      <Table.Td>{storeSummary(auth)}</Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {formatCompletedAt(auth)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color="green"
                          variant="light"
                          leftSection={<IconCheck size={12} />}
                        >
                          Complete
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label="View dispatch detail">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            aria-label="View dispatch detail"
                            onClick={() =>
                              navigate(`/storekeeper/dispatch-authorizations/${auth.id}`)
                            }
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </Stack>
  );
}
