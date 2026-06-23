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
} from '@mantine/core';
import { IconTruckDelivery, IconArrowRight, IconCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getDispatchOrderAuthorizations } from '../../api/dispatchOrderAuthorizations';
import type { DispatchOrderAuthorization } from '../../api/dispatchOrderAuthorizations';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuthStore } from '../../store/authStore';

function getMyStatus(da: DispatchOrderAuthorization): 'not_recorded' | 'recorded' | 'done' {
  if (!da.my_gin) return 'not_recorded';
  if (da.my_gin.status === 'draft') return 'recorded'; // GIN is draft, needs driver confirm
  if (da.my_gin.status === 'confirmed') return 'done';
  return 'recorded';
}

function myStatusLabel(status: ReturnType<typeof getMyStatus>): string {
  switch (status) {
    case 'not_recorded': return 'Record Loading';
    case 'recorded': return 'Confirm Driver';
    case 'done': return 'Completed';
  }
}

function myStatusColor(status: ReturnType<typeof getMyStatus>): string {
  switch (status) {
    case 'not_recorded': return 'yellow';
    case 'recorded': return 'blue';
    case 'done': return 'green';
  }
}

export default function StorekeeperDAListPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const userId = useAuthStore((state) => state.user?.id);
  const storeId = activeAssignment?.store?.id;
  const warehouseId = activeAssignment?.warehouse?.id;

  const { data: allDAs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_order_authorizations', 'storekeeper_assigned', { warehouse_id: warehouseId, store_id: storeId, user_id: userId }],
    queryFn: () =>
      getDispatchOrderAuthorizations({
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      }),
    enabled: !!(storeId || warehouseId),
  });

  if (isLoading) return <LoadingState message="Loading dispatch authorizations..." />;
  if (error) return <ErrorState message="Failed to load dispatch authorizations" onRetry={refetch} />;

  const activeDAs = allDAs.filter((da) => da.status === 'confirmed');
  const needsMyAction = activeDAs.filter((da) => getMyStatus(da) !== 'done');
  const myDone = activeDAs.filter((da) => getMyStatus(da) === 'done');

  const notRecorded = activeDAs.filter((da) => getMyStatus(da) === 'not_recorded').length;
  const needsDriverConfirm = activeDAs.filter((da) => getMyStatus(da) === 'recorded').length;

  return (
    <Stack gap="md">
      <Group>
        <IconTruckDelivery size={28} />
        <Title order={2}>Dispatch Authorizations</Title>
      </Group>

      <Text c="dimmed">
        Dispatch authorizations assigned to you. Pick from stacks, load the truck, and confirm the driver.
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Awaiting Your Loading</Text>
          <Text size="xl" fw={700} c="yellow">{notRecorded}</Text>
        </Card>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Needs Driver Confirm</Text>
          <Text size="xl" fw={700} c="blue">{needsDriverConfirm}</Text>
        </Card>
      </SimpleGrid>

      {needsMyAction.length > 0 && (
        <>
          <Title order={4}>Outgoing Trucks</Title>
          {needsMyAction.map((da) => {
            const myStatus = getMyStatus(da);

            return (
              <Card key={da.id} shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Group gap="xs" mb={4}>
                        <Text fw={600} style={{ fontFamily: 'monospace' }}>{da.reference_no}</Text>
                        <Badge color={myStatusColor(myStatus)} variant="light" size="sm">
                          {myStatusLabel(myStatus)}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {da.driver_name} — {da.truck_plate_number}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {da.commodity_name ? `${da.commodity_name}` : 'Commodity info'}
                        {da.transporter_name ? ` · ${da.transporter_name}` : ''}
                      </Text>
                    </div>
                    <Group gap="xs">
                      <Button
                        size="sm"
                        variant="light"
                        onClick={() => navigate(`/storekeeper/dispatch-authorizations/${da.id}`)}
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        color={myStatusColor(myStatus)}
                        rightSection={<IconArrowRight size={14} />}
                        onClick={() => navigate(`/storekeeper/dispatch-authorizations/${da.id}`)}
                      >
                        {myStatusLabel(myStatus)}
                      </Button>
                    </Group>
                  </Group>

                  {da.my_gin && (
                    <Group gap="xs">
                      <Badge color="blue" variant="light" size="xs" leftSection={<IconCheck size={10} />}>
                        You recorded loading
                      </Badge>
                    </Group>
                  )}
                </Stack>
              </Card>
            );
          })}
        </>
      )}

      {myDone.length > 0 && (
        <>
          <Title order={4}>My Completed Portions</Title>
          {myDone.map((da) => (
            <Card key={da.id} shadow="sm" padding="lg" radius="md" withBorder opacity={0.75}>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" mb={4}>
                    <Text fw={600} style={{ fontFamily: 'monospace' }}>{da.reference_no}</Text>
                    <Badge color="green" variant="light" size="sm" leftSection={<IconCheck size={12} />}>
                      Your portion done
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {da.driver_name} — {da.truck_plate_number}
                  </Text>
                </div>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => navigate(`/storekeeper/dispatch-authorizations/${da.id}`)}
                >
                  View
                </Button>
              </Group>
            </Card>
          ))}
        </>
      )}

      {activeDAs.length === 0 && (
        <Alert color="blue" title="No dispatch authorizations">
          You have no outgoing trucks right now. New dispatches appear here when a dispatch authorization is assigned to your store.
        </Alert>
      )}
    </Stack>
  );
}
