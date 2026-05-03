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
import { IconTruckDelivery, IconArrowRight } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getReceiptAuthorizations } from '../../api/receiptAuthorizations';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuthStore } from '../../store/authStore';

function statusColor(status: ReceiptAuthorization['status']) {
  switch (status) {
    case 'pending':   return 'yellow';
    case 'active':    return 'blue';
    case 'closed':    return 'green';
    case 'cancelled': return 'red';
    default:          return 'gray';
  }
}

export default function StorekeeperRAListPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const storeId = activeAssignment?.store?.id;

  // Fetch Active RAs for the storekeeper's store (these need Driver Confirm)
  const { data: activeRAs = [], isLoading: activeLoading, error: activeError } = useQuery({
    queryKey: ['receipt_authorizations', { store_id: storeId, status: 'active' }],
    queryFn: () => getReceiptAuthorizations({ store_id: storeId, status: 'active' }),
    enabled: !!storeId,
  });

  // Fetch Pending RAs for the storekeeper's store (awaiting inspection)
  const { data: pendingRAs = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['receipt_authorizations', { store_id: storeId, status: 'pending' }],
    queryFn: () => getReceiptAuthorizations({ store_id: storeId, status: 'pending' }),
    enabled: !!storeId,
  });

  if (activeLoading || pendingLoading) return <LoadingState message="Loading Receipt Authorizations..." />;
  if (activeError) return <ErrorState message="Failed to load Receipt Authorizations" />;

  const needsDriverConfirm = activeRAs.filter((ra) => !ra.driver_confirmed_at);
  const awaitingStacking = activeRAs.filter((ra) => ra.driver_confirmed_at && ra.grn_id);

  return (
    <Stack gap="md">
      <Group>
        <IconTruckDelivery size={28} />
        <Title order={2}>Receipt Authorizations</Title>
      </Group>

      <Text c="dimmed">
        Manage incoming truck deliveries for your store.
      </Text>

      {/* Summary counts */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pending Inspection</Text>
          <Text size="xl" fw={700} c="yellow">{pendingRAs.length}</Text>
        </Card>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Needs Driver Confirm</Text>
          <Text size="xl" fw={700} c="blue">{needsDriverConfirm.length}</Text>
        </Card>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Awaiting Stacking</Text>
          <Text size="xl" fw={700} c="cyan">{awaitingStacking.length}</Text>
        </Card>
      </SimpleGrid>

      {/* Active RAs needing Driver Confirm */}
      {needsDriverConfirm.length > 0 && (
        <>
          <Title order={4}>Needs Driver Confirmation</Title>
          {needsDriverConfirm.map((ra) => (
            <Card key={ra.id} shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" mb={4}>
                    <Text fw={600} style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>
                    <Badge color={statusColor(ra.status)} variant="light" size="sm">
                      {ra.status}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {ra.driver_name} — {ra.truck_plate_number}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Qty: {Number(ra.authorized_quantity).toLocaleString()}
                    {ra.transporter_name ? ` · ${ra.transporter_name}` : ''}
                  </Text>
                </div>
                <Button
                  size="sm"
                  color="blue"
                  rightSection={<IconArrowRight size={14} />}
                  onClick={() => navigate(`/storekeeper/receipt-authorizations/${ra.id}`)}
                >
                  Confirm Driver
                </Button>
              </Group>
            </Card>
          ))}
        </>
      )}

      {/* Active RAs awaiting stacking */}
      {awaitingStacking.length > 0 && (
        <>
          <Title order={4}>Ready for Stacking</Title>
          {awaitingStacking.map((ra) => (
            <Card key={ra.id} shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" mb={4}>
                    <Text fw={600} style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>
                    <Badge color="cyan" variant="light" size="sm">Ready to Stack</Badge>
                    {ra.grn_reference_no && (
                      <Badge color="blue" variant="outline" size="sm">
                        GRN: {ra.grn_reference_no}
                      </Badge>
                    )}
                  </Group>
                  <Text size="sm" c="dimmed">
                    {ra.driver_name} — {ra.truck_plate_number}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Qty: {Number(ra.authorized_quantity).toLocaleString()}
                  </Text>
                </div>
                <Button
                  size="sm"
                  color="cyan"
                  rightSection={<IconArrowRight size={14} />}
                  onClick={() => navigate(`/stacks/layout`)}
                >
                  Go to Stacking
                </Button>
              </Group>
            </Card>
          ))}
        </>
      )}

      {/* Pending RAs */}
      {pendingRAs.length > 0 && (
        <>
          <Title order={4}>Pending — Awaiting Inspection</Title>
          {pendingRAs.map((ra) => (
            <Card key={ra.id} shadow="sm" padding="lg" radius="md" withBorder opacity={0.85}>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" mb={4}>
                    <Text fw={600} style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>
                    <Badge color="yellow" variant="light" size="sm">Pending</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {ra.driver_name} — {ra.truck_plate_number}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Qty: {Number(ra.authorized_quantity).toLocaleString()}
                    {ra.transporter_name ? ` · ${ra.transporter_name}` : ''}
                  </Text>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  rightSection={<IconArrowRight size={14} />}
                  onClick={() => navigate(`/storekeeper/receipt-authorizations/${ra.id}`)}
                >
                  View
                </Button>
              </Group>
            </Card>
          ))}
        </>
      )}

      {pendingRAs.length === 0 && activeRAs.length === 0 && (
        <Alert color="blue" title="No Receipt Authorizations">
          There are no Receipt Authorizations for your store at this time.
        </Alert>
      )}
    </Stack>
  );
}
