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
  Divider,
  Alert,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconCheck,
  IconAlertCircle,
  IconExternalLink,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  getReceiptAuthorization,
  driverConfirm,
} from '../../api/receiptAuthorizations';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import type { ApiError } from '../../types/common';

// ── Helpers ───────────────────────────────────────────────────────────────

function statusColor(status: ReceiptAuthorization['status']) {
  switch (status) {
    case 'pending':   return 'yellow';
    case 'active':    return 'blue';
    case 'closed':    return 'green';
    case 'cancelled': return 'red';
    default:          return 'gray';
  }
}

function statusLabel(status: ReceiptAuthorization['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

// ── Detail field component ────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={500} tt="uppercase">
        {label}
      </Text>
      <Text size="sm">{value ?? '—'}</Text>
    </Stack>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function StorekeeperRADetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: ra, isLoading, error, refetch } = useQuery({
    queryKey: ['receipt_authorizations', id],
    queryFn: () => getReceiptAuthorization(Number(id)),
    enabled: !!id,
  });

  const driverConfirmMutation = useMutation({
    mutationFn: () => driverConfirm(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      notifications.show({
        title: 'Driver Confirmed',
        message: 'Driver delivery has been confirmed. A Draft GRN has been generated.',
        color: 'green',
      });
      refetch();
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
          'Failed to confirm driver delivery.',
        color: 'red',
      });
    },
  });

  if (isLoading) return <LoadingState message="Loading Receipt Authorization..." />;
  if (error || !ra)
    return (
      <ErrorState
        message="Failed to load Receipt Authorization."
        onRetry={refetch}
      />
    );

  const isActive = ra.status === 'active';
  const canDriverConfirm = isActive && !ra.driver_confirmed_at;
  const driverConfirmStatus = ra.driver_confirmed_at ? 'confirmed' : 'pending';

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" wrap="nowrap">
        <Group>
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          <Title order={2}>Receipt Authorization</Title>
          <Badge
            color={statusColor(ra.status)}
            variant="light"
            size="lg"
          >
            {statusLabel(ra.status)}
          </Badge>
        </Group>

        {/* Driver Confirm button — shown when RA is Active and not yet confirmed */}
        {canDriverConfirm && (
          <Button
            color="green"
            leftSection={<IconTruckDelivery size={16} />}
            onClick={() => driverConfirmMutation.mutate()}
            loading={driverConfirmMutation.isPending}
          >
            Driver Confirmed Delivery
          </Button>
        )}
      </Group>

      {/* Reference */}
      <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>
        {ra.reference_no}
      </Text>

      {/* Driver Confirm prompt */}
      {canDriverConfirm && (
        <Alert
          icon={<IconTruckDelivery size={16} />}
          color="blue"
          variant="light"
          title="Driver Confirmation Required"
        >
          The truck has arrived and the Inspection has been recorded. Click "Driver Confirmed
          Delivery" to acknowledge the driver's delivery and generate the Draft GRN.
        </Alert>
      )}

      {/* Core details */}
      <Card withBorder padding="lg">
        <Stack gap="md">
          <Title order={4}>Authorization Details</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <DetailField label="Reference No" value={
              <Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>
            } />
            <DetailField label="Status" value={
              <Badge color={statusColor(ra.status)} variant="light">
                {statusLabel(ra.status)}
              </Badge>
            } />
            <DetailField label="Created At" value={formatDate(ra.created_at)} />
            <DetailField label="Authorized Quantity" value={
              <Text size="sm" fw={600}>{Number(ra.authorized_quantity).toLocaleString()}</Text>
            } />
          </SimpleGrid>

          <Divider label="Receipt Order & Destination" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <DetailField label="Receipt Order" value={
              ra.receipt_order_reference_no
                ? <Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.receipt_order_reference_no}</Text>
                : `Order #${ra.receipt_order_id}`
            } />
            <DetailField label="Warehouse" value={ra.warehouse_name || `Warehouse #${ra.warehouse_id}`} />
            <DetailField label="Store" value={ra.store_name || `Store #${ra.store_id}`} />
          </SimpleGrid>

          <Divider label="Vehicle & Driver Details" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <DetailField label="Driver Name" value={ra.driver_name} />
            <DetailField label="Driver ID Number" value={
              <Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.driver_id_number}</Text>
            } />
            <DetailField label="Truck Plate Number" value={
              <Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.truck_plate_number}</Text>
            } />
            <DetailField label="Transporter" value={ra.transporter_name || `Transporter #${ra.transporter_id}`} />
            <DetailField label="Waybill Number" value={
              <Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.waybill_number}</Text>
            } />
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Inspection summary */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Title order={4}>Linked Inspection</Title>
          {ra.inspection_id ? (
            <Group>
              <Text size="sm">
                Inspection #{ra.inspection_id} is linked to this authorization.
              </Text>
              <Button
                variant="subtle"
                size="xs"
                rightSection={<IconExternalLink size={14} />}
                onClick={() => navigate(`/inspections/${ra.inspection_id}`)}
              >
                View Inspection
              </Button>
            </Group>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
              No inspection has been linked to this Receipt Authorization yet.
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Driver Confirm status */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>Driver Confirmation</Title>
            <Badge
              color={driverConfirmStatus === 'confirmed' ? 'green' : 'yellow'}
              variant="light"
              size="md"
              leftSection={driverConfirmStatus === 'confirmed' ? <IconCheck size={12} /> : undefined}
            >
              {driverConfirmStatus === 'confirmed' ? 'Confirmed' : 'Pending'}
            </Badge>
          </Group>
          {ra.driver_confirmed_at ? (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <DetailField label="Confirmed At" value={formatDateTime(ra.driver_confirmed_at)} />
              <DetailField label="Confirmed By" value={ra.driver_confirmed_by_name} />
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              Driver confirmation has not been recorded yet.
            </Text>
          )}
        </Stack>
      </Card>

      {/* GRN link — shown after Driver Confirm */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Title order={4}>Goods Received Note (GRN)</Title>
          {ra.grn_id ? (
            <Group>
              <Text size="sm" style={{ fontFamily: 'monospace' }}>
                {ra.grn_reference_no || `GRN #${ra.grn_id}`}
              </Text>
              {ra.grn_status && (
                <Badge color={ra.grn_status === 'confirmed' ? 'green' : 'blue'} variant="light">
                  {ra.grn_status.charAt(0).toUpperCase() + ra.grn_status.slice(1)}
                </Badge>
              )}
              <Button
                variant="subtle"
                size="xs"
                rightSection={<IconExternalLink size={14} />}
                onClick={() => navigate(`/grns/${ra.grn_id}`)}
              >
                View GRN
              </Button>
            </Group>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
              {ra.driver_confirmed_at
                ? 'GRN is being generated...'
                : 'GRN will be generated after Driver Confirmation.'}
            </Alert>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
