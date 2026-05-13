import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Card,
  Group,
  Badge,
  Button,
  Alert,
  SimpleGrid,
  Progress,
} from '@mantine/core';
import { IconTruck, IconArrowRight, IconCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getReceiptAuthorizations } from '../../api/receiptAuthorizations';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuthStore } from '../../store/authStore';

// ── Helpers ───────────────────────────────────────────────────────────────

function getMyStatus(ra: ReceiptAuthorization): 'not_recorded' | 'recorded' | 'driver_confirmed' | 'stacking' | 'done' {
  if (!ra.my_inspection) return 'not_recorded';
  if (!ra.my_grn) return 'recorded';
  if (ra.my_grn.status === 'draft') return 'driver_confirmed';
  if (ra.my_grn.status === 'confirmed') return 'done';
  return 'driver_confirmed';
}

function myStatusLabel(status: ReturnType<typeof getMyStatus>): string {
  switch (status) {
    case 'not_recorded': return 'Record Receipt';
    case 'recorded': return 'Confirm Driver';
    case 'driver_confirmed': return 'Stack Goods';
    case 'stacking': return 'Stack Goods';
    case 'done': return 'Completed';
  }
}

function myStatusColor(status: ReturnType<typeof getMyStatus>): string {
  switch (status) {
    case 'not_recorded': return 'yellow';
    case 'recorded': return 'blue';
    case 'driver_confirmed': return 'cyan';
    case 'stacking': return 'cyan';
    case 'done': return 'green';
  }
}

// ── Main component ────────────────────────────────────────────────────────

export default function StorekeeperRAListPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const warehouseId = activeAssignment?.warehouse?.id;
  const storeId = activeAssignment?.store?.id;

  // Fetch ALL RAs for this warehouse (pending + active) — storekeeper decides which to take
  const { data: allRAs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['receipt_authorizations', { warehouse_id: warehouseId }],
    queryFn: () => getReceiptAuthorizations({ warehouse_id: warehouseId }),
    enabled: !!warehouseId,
  });

  if (isLoading) return <LoadingState message="Loading driver arrivals..." />;
  if (error) return <ErrorState message="Failed to load driver arrivals" onRetry={refetch} />;

  // Filter to active/pending only (not closed/cancelled)
  const activeRAs = allRAs.filter((ra) => ra.status === 'pending' || ra.status === 'active');
  const closedRAs = allRAs.filter((ra) => ra.status === 'closed'); // eslint-disable-line @typescript-eslint/no-unused-vars

  // Categorize by my progress
  const needsMyAction = activeRAs.filter((ra) => getMyStatus(ra) !== 'done');
  const myDone = activeRAs.filter((ra) => getMyStatus(ra) === 'done');

  // Summary counts
  const notRecorded = activeRAs.filter((ra) => getMyStatus(ra) === 'not_recorded').length;
  const needsDriverConfirm = activeRAs.filter((ra) => getMyStatus(ra) === 'recorded').length;
  const awaitingStacking = activeRAs.filter((ra) => getMyStatus(ra) === 'driver_confirmed').length;

  return (
    <Stack gap="md">
      <Group>
        <IconTruck size={28} />
        <Title order={2}>Driver Arrivals</Title>
      </Group>

      <Text c="dimmed">
        Trucks arriving at your warehouse. Record what you receive, confirm the driver, then stack the goods.
      </Text>

      {/* Summary */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Awaiting Your Receipt</Text>
          <Text size="xl" fw={700} c="yellow">{notRecorded}</Text>
        </Card>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Needs Driver Confirm</Text>
          <Text size="xl" fw={700} c="blue">{needsDriverConfirm}</Text>
        </Card>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Ready to Stack</Text>
          <Text size="xl" fw={700} c="cyan">{awaitingStacking}</Text>
        </Card>
      </SimpleGrid>

      {/* Active RAs needing action */}
      {needsMyAction.length > 0 && (
        <>
          <Title order={4}>Incoming Trucks</Title>
          {needsMyAction.map((ra) => {
            const myStatus = getMyStatus(ra);
            const totalReceived = ra.total_received ?? 0;
            const authorized = Number(ra.authorized_quantity);
            const pct = authorized > 0 ? Math.min(100, (totalReceived / authorized) * 100) : 0;

            return (
              <Card key={ra.id} shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Group gap="xs" mb={4}>
                        <Text fw={600} style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>
                        <Badge color={myStatusColor(myStatus)} variant="light" size="sm">
                          {myStatusLabel(myStatus)}
                        </Badge>
                        {ra.status === 'active' && (
                          <Badge color="blue" variant="dot" size="xs">Active</Badge>
                        )}
                      </Group>
                      <Text size="sm" c="dimmed">
                        {ra.driver_name} — {ra.truck_plate_number}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Authorized: {authorized.toLocaleString()} {ra.unit_name || ''}
                        {ra.commodity_name ? ` · ${ra.commodity_name}` : ''}
                        {ra.transporter_name ? ` · ${ra.transporter_name}` : ''}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Button
                        size="sm"
                        variant="light"
                        onClick={() => navigate(`/storekeeper/receipt-authorizations/${ra.id}`)}
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        color={myStatusColor(myStatus)}
                        rightSection={<IconArrowRight size={14} />}
                        onClick={() => {
                          if (myStatus === 'driver_confirmed' || myStatus === 'stacking') {
                            const params = new URLSearchParams();
                            params.set('receipt_authorization_id', String(ra.id));
                            const targetStore = storeId ?? ra.store_id;
                            if (
                              targetStore != null &&
                              Number.isFinite(Number(targetStore)) &&
                              Number(targetStore) > 0
                            ) {
                              params.set('store_id', String(targetStore));
                            }
                            navigate(`/stacks/layout?${params.toString()}`);
                          } else {
                            navigate(`/storekeeper/receipt-authorizations/${ra.id}`);
                          }
                        }}
                      >
                        {myStatusLabel(myStatus)}
                      </Button>
                    </Group>
                  </Group>

                  {/* Overall RA progress (all storekeepers combined) */}
                  {totalReceived > 0 && (
                    <Stack gap={2}>
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">Total received across all stores</Text>
                        <Text size="xs" c="dimmed">{totalReceived.toLocaleString()} / {authorized.toLocaleString()}</Text>
                      </Group>
                      <Progress value={pct} size="xs" color={pct >= 100 ? 'green' : 'blue'} />
                    </Stack>
                  )}

                  {/* My receipt status */}
                  {ra.my_inspection && (
                    <Group gap="xs">
                      <Badge color="green" variant="light" size="xs" leftSection={<IconCheck size={10} />}>
                        You recorded {ra.my_inspection.total_received.toLocaleString()} {ra.unit_name || ''}
                      </Badge>
                      {ra.my_grn && (
                        <Badge color={ra.my_grn.status === 'confirmed' ? 'green' : 'blue'} variant="light" size="xs">
                          GRN: {ra.my_grn.reference_no || `#${ra.my_grn.id}`} ({ra.my_grn.status})
                        </Badge>
                      )}
                    </Group>
                  )}
                </Stack>
              </Card>
            );
          })}
        </>
      )}

      {/* My completed portions */}
      {myDone.length > 0 && (
        <>
          <Title order={4}>My Completed Portions</Title>
          {myDone.map((ra) => (
            <Card key={ra.id} shadow="sm" padding="lg" radius="md" withBorder opacity={0.75}>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" mb={4}>
                    <Text fw={600} style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>
                    <Badge color="green" variant="light" size="sm" leftSection={<IconCheck size={12} />}>
                      Your portion done
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {ra.driver_name} — {ra.truck_plate_number}
                  </Text>
                  {ra.my_inspection && (
                    <Text size="sm" c="dimmed">
                      You received: {ra.my_inspection.total_received.toLocaleString()} {ra.unit_name || ''}
                    </Text>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => navigate(`/storekeeper/receipt-authorizations/${ra.id}`)}
                >
                  View
                </Button>
              </Group>
            </Card>
          ))}
        </>
      )}

      {activeRAs.length === 0 && (
        <Alert color="blue" title="No incoming trucks">
          There are no pending truck deliveries for your warehouse at this time.
        </Alert>
      )}
    </Stack>
  );
}
