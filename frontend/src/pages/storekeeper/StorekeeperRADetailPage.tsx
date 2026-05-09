import { useState } from 'react';
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
  NumberInput,
  Select,
  Progress,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconCheck,
  IconAlertCircle,
  IconExternalLink,
  IconTruckDelivery,
  IconClipboardCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  getReceiptAuthorization,
  driverConfirm,
} from '../../api/receiptAuthorizations';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { createInspection } from '../../api/inspections';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuthStore } from '../../store/authStore';
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

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={500} tt="uppercase">{label}</Text>
      <Text size="sm">{value ?? '—'}</Text>
    </Stack>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function StorekeeperRADetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeAssignment = useAuthStore((s) => s.activeAssignment);
  const userId = useAuthStore((s) => s.userId);

  // Receipt recording form state
  const [showRecordingForm, setShowRecordingForm] = useState(false);
  const [qtyReceived, setQtyReceived] = useState<number | string>('');
  const [grade, setGrade] = useState<string | null>('Good');

  const { data: ra, isLoading, error, refetch } = useQuery({
    queryKey: ['receipt_authorizations', id],
    queryFn: () => getReceiptAuthorization(Number(id)),
    enabled: !!id,
  });

  // ── Receipt Recording mutation (creates Inspection → RA goes Active) ──
  const recordReceiptMutation = useMutation({
    mutationFn: () => {
      if (!ra) throw new Error('No RA loaded');
      const warehouseId = activeAssignment?.warehouse?.id ?? ra.warehouse_id;
      if (!warehouseId) throw new Error('Cannot determine warehouse');
      const commodityId = (ra as any).commodity_id;
      const unitId = (ra as any).unit_id;
      if (!commodityId) throw new Error('Commodity not found on this receipt order. Please contact your manager.');

      const received = Number(qtyReceived);
      const authorized = Number(ra.authorized_quantity);
      const lost = Math.max(0, authorized - received);

      return createInspection({
        warehouse_id: warehouseId,
        inspected_on: new Date().toISOString().split('T')[0],
        inspector_id: userId ?? 0,
        receipt_order_id: ra.receipt_order_id,
        receipt_authorization_id: ra.id,
        status: 'confirmed',
        items: [{
          commodity_id: commodityId,
          ...(unitId ? { unit_id: unitId } : {}),
          quantity_received: received,
          quantity_lost: lost > 0 ? lost : undefined,
          quality_status: grade ?? 'Good',
          packaging_condition: 'Standard',
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      notifications.show({
        title: 'Receipt Recorded',
        message: 'Receipt recorded successfully. RA is now Active.',
        color: 'green',
      });
      setShowRecordingForm(false);
      setQtyReceived('');
      setGrade('Good');
      refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
        (err instanceof Error ? err.message : 'Failed to record receipt.');
      notifications.show({ title: 'Error', message: msg, color: 'red', autoClose: 8000 });
    },
  });

  // ── Driver Confirm mutation (creates Draft GRN) ──
  const driverConfirmMutation = useMutation({
    mutationFn: () => driverConfirm(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      notifications.show({
        title: 'Driver Confirmed',
        message: 'Driver delivery confirmed. GRN has been generated in Draft.',
        color: 'green',
      });
      refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
        'Failed to confirm driver delivery.';
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    },
  });

  if (isLoading) return <LoadingState message="Loading Receipt Authorization..." />;
  if (error || !ra) return <ErrorState message="Failed to load Receipt Authorization." onRetry={refetch} />;

  const isPending = ra.status === 'pending';
  const isActive = ra.status === 'active';
  const canDriverConfirm = isActive && !ra.driver_confirmed_at;
  const driverConfirmed = !!ra.driver_confirmed_at;

  const authorized = Number(ra.authorized_quantity);
  const received = Number(qtyReceived) || 0;
  const lost = showRecordingForm ? Math.max(0, authorized - received) : 0;
  const receivedPct = authorized > 0 ? Math.min(100, (received / authorized) * 100) : 0;

  return (
    <Stack gap="md">
      {/* ── Header ── */}
      <Group justify="space-between" wrap="nowrap">
        <Group>
          <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Title order={2}>Receipt Authorization</Title>
          <Badge color={statusColor(ra.status)} variant="light" size="lg">
            {statusLabel(ra.status)}
          </Badge>
        </Group>

        {/* Driver Confirm button — only when Active and inspection recorded, not yet confirmed */}
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

      <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>

      {/* Prompt after inspection — waiting for driver confirm */}
      {canDriverConfirm && (
        <Alert icon={<IconTruckDelivery size={16} />} color="blue" variant="light" title="Action Required">
          Receipt recorded. Click "Driver Confirmed Delivery" above to generate the GRN.
        </Alert>
      )}

      {/* ── Authorization Details ── */}
      <Card withBorder padding="lg">
        <Stack gap="md">
          <Title order={4}>Authorization Details</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <DetailField label="Reference No" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>} />
            <DetailField label="Status" value={<Badge color={statusColor(ra.status)} variant="light">{statusLabel(ra.status)}</Badge>} />
            <DetailField label="Created" value={formatDate(ra.created_at)} />
            <DetailField label="Authorized Quantity" value={
              <Text size="sm" fw={700}>{authorized.toLocaleString()} {(ra as any).unit_name || ''}</Text>
            } />
            <DetailField label="Commodity" value={(ra as any).commodity_name || '—'} />
          </SimpleGrid>

          <Divider label="Receipt Order & Destination" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <DetailField label="Receipt Order" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.receipt_order_reference_no || `Order #${ra.receipt_order_id}`}</Text>} />
            <DetailField label="Warehouse" value={ra.warehouse_name || `Warehouse #${ra.warehouse_id}`} />
            <DetailField
              label="Store"
              value={ra.store_name || (ra.store_id != null ? `Store #${ra.store_id}` : '—')}
            />
          </SimpleGrid>

          <Divider label="Vehicle & Driver Details" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <DetailField label="Driver Name" value={ra.driver_name} />
            <DetailField label="Driver ID" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.driver_id_number}</Text>} />
            <DetailField label="Plate Number" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.truck_plate_number}</Text>} />
            <DetailField label="Transporter" value={ra.transporter_name || `Transporter #${ra.transporter_id}`} />
            <DetailField label="Waybill Number" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.waybill_number}</Text>} />
          </SimpleGrid>
        </Stack>
      </Card>

      {/* ── Receipt Recording ── */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>Receipt Recording</Title>
            {isPending && !ra.inspection_id && (
              <Button
                size="sm"
                leftSection={<IconClipboardCheck size={16} />}
                onClick={() => setShowRecordingForm((v) => !v)}
                variant={showRecordingForm ? 'light' : 'filled'}
              >
                {showRecordingForm ? 'Cancel' : 'Record Receipt'}
              </Button>
            )}
          </Group>

          {ra.inspection_id ? (
            /* Already recorded — show summary */
            <Group gap="md" align="center">
              <Badge color="green" variant="light" leftSection={<IconCheck size={12} />} size="md">
                Receipt Recorded
              </Badge>
              <Button
                variant="subtle"
                size="xs"
                rightSection={<IconExternalLink size={14} />}
                onClick={() => navigate(`/inspections/${ra.inspection_id}`)}
              >
                View Details
              </Button>
            </Group>
          ) : showRecordingForm ? (
            /* Recording form */
            <Stack gap="md" mt="xs">
              <Divider label="What did the truck deliver?" labelPosition="left" />

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Stack gap={4}>
                  <NumberInput
                    label="Quantity Received"
                    description={`Authorized: ${authorized.toLocaleString()} ${(ra as any).unit_name || ''}`}
                    placeholder={`Max ${authorized.toLocaleString()}`}
                    value={qtyReceived}
                    onChange={setQtyReceived}
                    min={0.001}
                    max={authorized}
                    decimalScale={3}
                    required
                  />
                  {/* Live progress bar */}
                  {received > 0 && (
                    <Progress
                      value={receivedPct}
                      color={receivedPct < 100 ? 'orange' : 'green'}
                      size="sm"
                      mt={4}
                    />
                  )}
                </Stack>

                <Select
                  label="Grade / Condition"
                  description="Quality of goods received"
                  data={['Good', 'Fair', 'Poor']}
                  value={grade}
                  onChange={setGrade}
                  required
                />
              </SimpleGrid>

              {/* Loss display — auto-calculated, read-only */}
              {received > 0 && lost > 0 && (
                <Alert color="orange" variant="light" title={`Loss: ${lost.toLocaleString()} ${(ra as any).unit_name || ''}`}>
                  The quantity received ({received.toLocaleString()}) is less than authorized ({authorized.toLocaleString()}).
                  The difference ({lost.toLocaleString()}) will be recorded as lost.
                </Alert>
              )}

              {received > 0 && lost === 0 && (
                <Alert color="green" variant="light" title="Full quantity received">
                  All {authorized.toLocaleString()} {(ra as any).unit_name || ''} accounted for. No loss.
                </Alert>
              )}

              <Group justify="flex-end">
                <Button variant="light" onClick={() => setShowRecordingForm(false)}>Cancel</Button>
                <Button
                  onClick={() => recordReceiptMutation.mutate()}
                  loading={recordReceiptMutation.isPending}
                  disabled={!qtyReceived || Number(qtyReceived) <= 0}
                >
                  Save Receipt
                </Button>
              </Group>
            </Stack>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
              No receipt recorded yet. Click "Record Receipt" when the truck arrives.
            </Alert>
          )}
        </Stack>
      </Card>

      {/* ── Driver Confirmation ── */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>Driver Confirmation</Title>
            <Badge
              color={driverConfirmed ? 'green' : 'yellow'}
              variant="light"
              size="md"
              leftSection={driverConfirmed ? <IconCheck size={12} /> : undefined}
            >
              {driverConfirmed ? 'Confirmed' : 'Pending'}
            </Badge>
          </Group>
          {driverConfirmed ? (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <DetailField label="Confirmed At" value={formatDateTime(ra.driver_confirmed_at)} />
              <DetailField label="Confirmed By" value={ra.driver_confirmed_by_name} />
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              {isActive
                ? 'Receipt recorded. Use the "Driver Confirmed Delivery" button at the top of this page.'
                : 'Driver confirmation will be available after the receipt is recorded.'}
            </Text>
          )}
        </Stack>
      </Card>

      {/* ── GRN ── */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Title order={4}>Goods Received Note (GRN)</Title>
          {ra.grn_id ? (
            <Group>
              <Text size="sm" style={{ fontFamily: 'monospace' }} fw={600}>
                {ra.grn_reference_no || `GRN #${ra.grn_id}`}
              </Text>
              <Badge color={ra.grn_status === 'confirmed' ? 'green' : 'blue'} variant="light">
                {ra.grn_status ? ra.grn_status.charAt(0).toUpperCase() + ra.grn_status.slice(1) : 'Draft'}
              </Badge>
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
              {driverConfirmed
                ? 'GRN is being generated...'
                : 'GRN will be automatically created after Driver Confirmation.'}
            </Alert>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
