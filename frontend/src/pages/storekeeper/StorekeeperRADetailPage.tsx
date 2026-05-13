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
  Textarea,
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
import { getStockBalances } from '../../api/stockBalances';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuthStore } from '../../store/authStore';
import type { ApiError } from '../../types/common';
import apiClient from '../../api/client';

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

// ── Fetch store assignment remaining for this storekeeper ─────────────────
async function getStoreAssignment(receiptOrderId: number, storeId: number) {
  const response = await apiClient.get('/storekeeper_assignments', { params: { store_id: storeId } });
  const data = response.data.data || response.data;
  const assignments = Array.isArray(data.receipt_assignments) ? data.receipt_assignments : [];
  const targetRo = Number(receiptOrderId);
  return (
    assignments.find((a: Record<string, unknown>) => {
      const rid = a.receipt_order_id ?? a.receiptOrderId;
      return rid != null && Number(rid) === targetRo;
    }) || null
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function StorekeeperRADetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeAssignment = useAuthStore((s) => s.activeAssignment);
  const userId = useAuthStore((s) => s.userId);
  const storeId = activeAssignment?.store?.id;

  // Receipt recording form state
  const [showRecordingForm, setShowRecordingForm] = useState(false);
  const [qtyReceived, setQtyReceived] = useState<number | string>('');
  const [grade, setGrade] = useState<string | null>('Good');
  const [remarks, setRemarks] = useState('');

  const { data: ra, isLoading, error, refetch } = useQuery({
    queryKey: ['receipt_authorizations', id],
    queryFn: () => getReceiptAuthorization(Number(id)),
    enabled: !!id,
  });

  // Fetch this storekeeper's store assignment for the receipt order
  const { data: storeAssignment } = useQuery({
    queryKey: ['store_assignment', ra?.receipt_order_id, storeId],
    queryFn: () => getStoreAssignment(ra!.receipt_order_id, storeId!),
    enabled: !!ra && !!storeId,
  });

  // ── Receipt Recording mutation ──
  const recordReceiptMutation = useMutation({
    mutationFn: () => {
      if (!ra) throw new Error('No RA loaded');
      const warehouseId = activeAssignment?.warehouse?.id ?? ra.warehouse_id;
      if (!warehouseId) throw new Error('Cannot determine warehouse');
      const commodityId = ra.commodity_id;
      const unitId = ra.unit_id;
      if (!commodityId) throw new Error('Cannot determine commodity from receipt order');

      const received = Number(qtyReceived);
      const authorized = Number(ra.authorized_quantity);

      // Already received against this RA from all inspections
      const alreadyReceived = ra.total_received ?? 0;
      const raRemaining = authorized - alreadyReceived;

      // Store assignment remaining
      const storeAssigned = Number(storeAssignment?.quantity ?? authorized);
      const storeReceived = Number(storeAssignment?.received_quantity ?? 0);
      const storeRemaining = storeAssigned - storeReceived;

      const maxAllowed = Math.min(raRemaining, storeRemaining);

      if (received > maxAllowed + 0.001) {
        throw new Error(`Cannot record more than ${maxAllowed.toLocaleString()} (RA remaining: ${raRemaining.toLocaleString()}, your store remaining: ${storeRemaining.toLocaleString()})`);
      }

      // Auto-calculate lost quantity
      const lostQty = Math.max(0, maxAllowed - received);

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
          quantity_lost: lostQty > 0 ? lostQty : undefined,
          quality_status: grade ?? 'Good',
          packaging_condition: 'Standard',
          remarks: remarks || undefined,
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      notifications.show({
        title: 'Receipt Recorded',
        message: 'Receipt recorded. You can now confirm driver delivery.',
        color: 'green',
      });
      setShowRecordingForm(false);
      setQtyReceived('');
      setGrade('Good');
      setRemarks('');
      refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
        (err instanceof Error ? err.message : 'Failed to record receipt.');
      notifications.show({ title: 'Error', message: msg, color: 'red', autoClose: 8000 });
    },
  });

  // ── Driver Confirm mutation ──
  const driverConfirmMutation = useMutation({
    mutationFn: (inspectionId: number) => driverConfirm(Number(id), inspectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      notifications.show({
        title: 'Driver Confirmed',
        message: 'Driver delivery confirmed. Your GRN has been generated.',
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

  const myInspection = ra.my_inspection ?? null;
  const myGrn = ra.my_grn ?? null;
  const canDriverConfirm = isActive && myInspection && !myGrn;

  const authorized = Number(ra.authorized_quantity);
  const alreadyReceived = ra.total_received ?? 0;
  const raRemaining = Math.max(0, authorized - alreadyReceived);

  // Match recordReceiptMutation: if no store assignment row is returned, use RA authorized qty as the cap.
  const storeAssignedQty = Number(storeAssignment?.quantity ?? authorized);
  const storeReceivedFromAssignment = Number(storeAssignment?.received_quantity ?? 0);
  const storeRemainingForRecord = Math.max(0, storeAssignedQty - storeReceivedFromAssignment);

  // "Remaining (store)" in the assignment card after this storekeeper has recorded
  const storeRemainingDisplay = myInspection
    ? Math.max(0, storeAssignedQty - storeReceivedFromAssignment - Number(myInspection.total_received ?? 0))
    : storeRemainingForRecord;

  const maxCanRecord = Math.min(raRemaining, storeRemainingForRecord);

  const received = Number(qtyReceived) || 0;
  const lostPreview = showRecordingForm && received > 0 ? Math.max(0, maxCanRecord - received) : 0;
  const receivedPct = maxCanRecord > 0 ? Math.min(100, (received / maxCanRecord) * 100) : 0;

  return (
    <Stack gap="md">
      {/* ── Header ── */}
      <Group justify="space-between" wrap="nowrap">
        <Group>
          <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Title order={2}>Driver Arrival</Title>
          <Badge color={statusColor(ra.status)} variant="light" size="lg">
            {statusLabel(ra.status)}
          </Badge>
        </Group>

        {canDriverConfirm && (
          <Button
            color="green"
            leftSection={<IconTruckDelivery size={16} />}
            onClick={() => driverConfirmMutation.mutate(myInspection.id)}
            loading={driverConfirmMutation.isPending}
          >
            Driver Confirmed Delivery
          </Button>
        )}
      </Group>

      <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>

      {canDriverConfirm && (
        <Alert icon={<IconTruckDelivery size={16} />} color="blue" variant="light" title="Action Required">
          Receipt recorded. Click "Driver Confirmed Delivery" above to generate your GRN.
        </Alert>
      )}

      {/* ── Truck Details ── */}
      <Card withBorder padding="lg">
        <Stack gap="md">
          <Title order={4}>Truck Details</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <DetailField label="Reference" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>} />
            <DetailField label="Status" value={<Badge color={statusColor(ra.status)} variant="light">{statusLabel(ra.status)}</Badge>} />
            <DetailField label="Date" value={formatDate(ra.created_at)} />
            <DetailField label="Authorized Quantity" value={<Text size="sm" fw={700}>{authorized.toLocaleString()} {ra.unit_name || ''}</Text>} />
            <DetailField label="Commodity" value={ra.commodity_name || '—'} />
          </SimpleGrid>

          <Divider label="Vehicle & Driver" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <DetailField label="Driver Name" value={ra.driver_name} />
            <DetailField label="Driver ID" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.driver_id_number}</Text>} />
            <DetailField label="Plate Number" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.truck_plate_number}</Text>} />
            <DetailField label="Transporter" value={ra.transporter_name || `Transporter #${ra.transporter_id}`} />
            <DetailField label="Waybill" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.waybill_number}</Text>} />
          </SimpleGrid>
        </Stack>
      </Card>

      {/* ── Your Store Assignment ── */}
      {storeAssignment && (
        <Card withBorder padding="lg" bg="blue.0">
          <Stack gap="xs">
            <Text size="sm" fw={700} c="blue.9">Your Store Assignment</Text>
            <Group gap="xl" wrap="wrap">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Sent in this RA</Text>
                <Text fw={700}>{authorized.toLocaleString()} {ra.unit_name || ''}</Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Received</Text>
                <Text fw={700} c="green">
                  {myInspection ? Number(myInspection.total_received ?? 0).toLocaleString() : '—'} {ra.unit_name || ''}
                </Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Lost</Text>
                <Text fw={700} c={myInspection && (authorized - Number(myInspection.total_received ?? 0)) > 0 ? 'red' : 'dimmed'}>
                  {myInspection
                    ? Math.max(0, authorized - Number(myInspection.total_received ?? 0)).toLocaleString()
                    : '—'} {ra.unit_name || ''}
                </Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Remaining (store)</Text>
                <Text fw={700} c={storeRemainingDisplay > 0 ? 'orange' : 'green'}>
                  {storeRemainingDisplay.toLocaleString()} {ra.unit_name || ''}
                </Text>
              </Stack>
            </Group>
          </Stack>
        </Card>
      )}

      {/* ── Receipt Recording ── */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>Record Receipt</Title>
            {(isPending || isActive) && !myInspection && maxCanRecord > 0 && (
              <Button
                size="sm"
                leftSection={<IconClipboardCheck size={16} />}
                onClick={() => setShowRecordingForm((v) => !v)}
                variant={showRecordingForm ? 'light' : 'filled'}
              >
                {showRecordingForm ? 'Cancel' : 'Record What Arrived'}
              </Button>
            )}
          </Group>

          {myInspection ? (
            <Group gap="md" align="center">
              <Badge color="green" variant="light" leftSection={<IconCheck size={12} />} size="md">
                Receipt Recorded
              </Badge>
              <Text size="sm" c="dimmed">
                You recorded {myInspection.total_received?.toLocaleString() ?? '—'} {ra.unit_name || ''}
              </Text>
            </Group>
          ) : showRecordingForm ? (
            <Stack gap="md" mt="xs">
              <Divider label={`Record what arrived for your store (max ${maxCanRecord.toLocaleString()} ${ra.unit_name || ''})`} labelPosition="left" />

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Stack gap={4}>
                  <NumberInput
                    label="Quantity Received"
                    description={`Your store's remaining: ${maxCanRecord.toLocaleString()} ${ra.unit_name || ''}`}
                    placeholder={`Max ${maxCanRecord.toLocaleString()}`}
                    value={qtyReceived}
                    onChange={setQtyReceived}
                    min={0.001}
                    max={maxCanRecord}
                    decimalScale={3}
                    required
                    error={received > maxCanRecord + 0.001 ? `Cannot exceed ${maxCanRecord.toLocaleString()} ${ra.unit_name || ''}` : null}
                  />
                  {received > 0 && received <= maxCanRecord && (
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
                  data={['Good', 'Fair', 'Poor', 'Damaged', 'Infested', 'Wet']}
                  value={grade}
                  onChange={setGrade}
                  required
                />
              </SimpleGrid>

              {received > maxCanRecord + 0.001 && (
                <Alert color="red" variant="light" title="Quantity too high">
                  You cannot record more than {maxCanRecord.toLocaleString()} {ra.unit_name || ''}.
                  Your store was assigned {maxCanRecord.toLocaleString()} and that is the maximum you can record.
                </Alert>
              )}

              {received > 0 && received <= maxCanRecord && lostPreview > 0 && (
                <Alert color="orange" variant="light" title={`Loss: ${lostPreview.toLocaleString()} ${ra.unit_name || ''} will be recorded as lost`}>
                  You received {received.toLocaleString()} but your store was assigned {maxCanRecord.toLocaleString()}.
                  The difference ({lostPreview.toLocaleString()}) will be automatically recorded as lost.
                </Alert>
              )}

              {received > 0 && received <= maxCanRecord && lostPreview === 0 && (
                <Alert color="green" variant="light" title="Full quantity received">
                  All {maxCanRecord.toLocaleString()} {ra.unit_name || ''} accounted for.
                </Alert>
              )}

              <Textarea
                label="Remarks (optional)"
                placeholder="Any notes about the delivery..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />

              <Group justify="flex-end">
                <Button variant="light" onClick={() => setShowRecordingForm(false)}>Cancel</Button>
                <Button
                  onClick={() => recordReceiptMutation.mutate()}
                  loading={recordReceiptMutation.isPending}
                  disabled={!qtyReceived || Number(qtyReceived) <= 0 || Number(qtyReceived) > maxCanRecord + 0.001}
                >
                  Save Receipt
                </Button>
              </Group>
            </Stack>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
              {maxCanRecord <= 0 && storeAssignedQty > 0
                ? 'Your store has received its full assigned quantity.'
                : 'Click "Record What Arrived" when the truck delivers goods to your store.'}
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
              color={myGrn ? 'green' : myInspection ? 'blue' : 'yellow'}
              variant="light"
              size="md"
            >
              {myGrn ? 'Confirmed' : myInspection ? 'Ready to Confirm' : 'Pending Receipt'}
            </Badge>
          </Group>
          {myGrn ? (
            <Text size="sm" c="dimmed">Driver confirmed. GRN generated.</Text>
          ) : myInspection ? (
            <Text size="sm" c="dimmed">
              Receipt recorded. Use the "Driver Confirmed Delivery" button at the top of this page.
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              Record the receipt first, then confirm driver delivery.
            </Text>
          )}
        </Stack>
      </Card>

      {/* ── GRN ── */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Title order={4}>Goods Received Note (GRN)</Title>
          {myGrn ? (
            <Group>
              <Text size="sm" style={{ fontFamily: 'monospace' }} fw={600}>
                {myGrn.reference_no || `GRN #${myGrn.id}`}
              </Text>
              <Badge color={myGrn.status === 'confirmed' ? 'green' : 'blue'} variant="light">
                {myGrn.status ? myGrn.status.charAt(0).toUpperCase() + myGrn.status.slice(1) : 'Draft'}
              </Badge>
              <Button
                variant="subtle"
                size="xs"
                rightSection={<IconExternalLink size={14} />}
                onClick={() => navigate(`/grns/${myGrn.id}`)}
              >
                View GRN
              </Button>
              {myGrn.status === 'draft' && (
                <Button
                  size="xs"
                  variant="light"
                  color="cyan"
                  onClick={() => {
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
                  }}
                >
                  Go to Stacking
                </Button>
              )}
            </Group>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
              GRN will be generated after Driver Confirmation.
            </Alert>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
