import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Button,
  Group,
  Card,
  Text,
  Badge,
  SimpleGrid,
  Alert,
  Divider,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconTruck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  getReceiptAuthorization,
  cancelReceiptAuthorization,
  driverConfirm,
} from '../../api/receiptAuthorizations';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import type { ApiError } from '../../types/common';

function statusColor(status: ReceiptAuthorization['status']) {
  switch (status) {
    case 'pending':   return 'yellow';
    case 'active':    return 'blue';
    case 'closed':    return 'green';
    case 'cancelled': return 'red';
    default:          return 'gray';
  }
}

export default function ReceiptAuthorizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const isStorekeeper = roleSlug === 'storekeeper';
  const isHubManager  = roleSlug === 'hub_manager';
  const isWM          = roleSlug === 'warehouse_manager';
  const isAdmin       = roleSlug === 'admin' || roleSlug === 'superadmin';

  const { data: ra, isLoading, error, refetch } = useQuery({
    queryKey: ['receipt_authorizations', id],
    queryFn: () => getReceiptAuthorization(Number(id)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelReceiptAuthorization(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      notifications.show({ title: 'Cancelled', message: 'Receipt Authorization cancelled.', color: 'orange' });
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) || 'Failed to cancel',
        color: 'red',
      });
    },
  });

  const driverConfirmMutation = useMutation({
    mutationFn: () => driverConfirm(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations', id] });
      notifications.show({
        title: 'Driver Confirmed',
        message: 'Delivery acknowledged. GRN has been created in Draft status.',
        color: 'green',
      });
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) || 'Failed to confirm driver',
        color: 'red',
      });
    },
  });

  if (isLoading) return <LoadingState message="Loading Receipt Authorization..." />;
  if (error || !ra) return <ErrorState message="Failed to load Receipt Authorization." onRetry={refetch} />;

  const canCancel = (isHubManager || isWM || isAdmin) && ra.status === 'pending' && !ra.inspection_id;
  const canDriverConfirm = (isStorekeeper || isAdmin) && ra.status === 'active' && !ra.driver_confirmed_at;
  const backPath = isStorekeeper ? '/storekeeper/assignments' : '/hub/receipt-authorizations';

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button variant="default" onClick={() => navigate(backPath)}>← Back</Button>
          <div>
            <Group gap="sm">
              <Title order={2}>Receipt Authorization</Title>
              <Badge color={statusColor(ra.status)} size="lg" variant="light">
                {ra.status.charAt(0).toUpperCase() + ra.status.slice(1)}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>
          </div>
        </Group>
        <Group>
          {canCancel && (
            <Button
              color="red"
              variant="light"
              onClick={() => cancelMutation.mutate()}
              loading={cancelMutation.isPending}
            >
              Cancel RA
            </Button>
          )}
          {canDriverConfirm && (
            <Button
              color="green"
              leftSection={<IconCheck size={16} />}
              onClick={() => driverConfirmMutation.mutate()}
              loading={driverConfirmMutation.isPending}
            >
              Driver Confirmed Delivery
            </Button>
          )}
        </Group>
      </Group>

      {/* Driver confirm hint for storekeeper */}
      {isStorekeeper && ra.status === 'active' && !ra.driver_confirmed_at && (
        <Alert color="blue" icon={<IconAlertCircle size={16} />}>
          The truck has arrived. Record the inspection below, then click "Driver Confirmed Delivery" once the driver acknowledges.
        </Alert>
      )}

      {/* GRN created notice */}
      {ra.driver_confirmed_at && ra.grn_id && (
        <Alert color="green" icon={<IconCheck size={16} />}>
          Driver confirmed delivery. GRN <strong>{ra.grn_reference_no}</strong> has been created in Draft status.
          {ra.grn_status === 'confirmed' && ' Stacking is complete — GRN is confirmed.'}
        </Alert>
      )}

      {/* Order & Destination */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={700} size="sm" tt="uppercase" c="dimmed">Receipt Order & Destination</Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <div>
              <Text size="xs" c="dimmed">Receipt Order</Text>
              <Text fw={600}>{ra.receipt_order_reference_no || `RO-${ra.receipt_order_id}`}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Warehouse</Text>
              <Text fw={600}>{ra.warehouse_name || `Warehouse #${ra.warehouse_id}`}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Store</Text>
              <Text fw={600}>{ra.store_name || `Store #${ra.store_id}`}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Authorized Quantity</Text>
              <Text fw={700} size="lg">{Number(ra.authorized_quantity).toLocaleString()}</Text>
            </div>
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Vehicle & Driver */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="sm">
          <Group gap="xs">
            <IconTruck size={18} />
            <Text fw={700} size="sm" tt="uppercase" c="dimmed">Vehicle & Driver</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <div>
              <Text size="xs" c="dimmed">Transporter</Text>
              <Text fw={600}>{ra.transporter_name || `Transporter #${ra.transporter_id}`}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Driver Name</Text>
              <Text fw={600}>{ra.driver_name}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Driver ID</Text>
              <Text fw={600}>{ra.driver_id_number}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Plate Number</Text>
              <Text fw={600} style={{ fontFamily: 'monospace' }}>{ra.truck_plate_number}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Waybill Number</Text>
              <Text fw={600}>{ra.waybill_number}</Text>
            </div>
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Driver Confirmation */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={700} size="sm" tt="uppercase" c="dimmed">Driver Confirmation</Text>
          {ra.driver_confirmed_at ? (
            <Group gap="xs">
              <Badge color="green" leftSection={<IconCheck size={12} />}>Confirmed</Badge>
              <Text size="sm" c="dimmed">
                by {ra.driver_confirmed_by_name} on {new Date(ra.driver_confirmed_at).toLocaleString()}
              </Text>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">Not yet confirmed</Text>
          )}
        </Stack>
      </Card>

      {/* Linked Documents */}
      {(ra.inspection_id || ra.grn_id) && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="sm">
            <Text fw={700} size="sm" tt="uppercase" c="dimmed">Linked Documents</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {ra.inspection_id && (
                <div>
                  <Text size="xs" c="dimmed">Inspection</Text>
                  <Text fw={600}>#{ra.inspection_id}</Text>
                </div>
              )}
              {ra.grn_id && (
                <div>
                  <Text size="xs" c="dimmed">GRN</Text>
                  <Group gap="xs">
                    <Text fw={600}>{ra.grn_reference_no}</Text>
                    <Badge
                      color={ra.grn_status === 'confirmed' ? 'green' : 'yellow'}
                      variant="light"
                      size="sm"
                    >
                      {ra.grn_status}
                    </Badge>
                  </Group>
                </div>
              )}
            </SimpleGrid>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
