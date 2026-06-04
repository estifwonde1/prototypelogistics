import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Stack, Title, Button, Group, Card, Text, Badge, SimpleGrid, Divider, Alert, NumberInput, Textarea, Progress } from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
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

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/** Hub line UOM (canonical) for display — kept for places that still need the line unit. */
function raLineUnit(ra: ReceiptAuthorization): string {
  return (ra.unit_label ?? ra.unit_name ?? ra.unit_abbreviation ?? '').trim();
}

/**
 * Preferred display unit for the RA — the one the user actually picked when
 * creating/updating the RA (e.g. "Kuntal"). Falls back to the line unit when the
 * API didn't record an explicit input (legacy rows).
 */
function raDisplayUnit(ra: ReceiptAuthorization): string {
  const inputName = (ra.authorized_quantity_input_unit_name ?? '').trim();
  const inputAbbr = (ra.authorized_quantity_input_unit_abbreviation ?? '').trim();
  return inputName || inputAbbr || raLineUnit(ra);
}

/** Quantity in the user-entered unit; falls back to canonical qty for legacy rows. */
function raDisplayQty(ra: ReceiptAuthorization): number {
  const v = ra.authorized_quantity_input;
  if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) return Number(v);
  return Number(ra.authorized_quantity);
}

/**
 * Multiplier to convert a value expressed in the canonical line unit into the
 * user-entered unit (e.g. 1 mt → 10 kntl). Derived from this RA's own input vs
 * canonical pair so the same conversion is applied without re-fetching the UOM
 * graph; rounding errors are bounded by the storage precision of both columns.
 */
function lineToInputMultiplier(ra: ReceiptAuthorization): number {
  const input = Number(ra.authorized_quantity_input ?? 0);
  const line = Number(ra.authorized_quantity ?? 0);
  if (input > 0 && line > 0) return input / line;
  return 1;
}

function convertLineToInput(value: number, ra: ReceiptAuthorization): number {
  return value * lineToInputMultiplier(ra);
}

function convertInputToLine(value: number, ra: ReceiptAuthorization): number {
  const m = lineToInputMultiplier(ra);
  if (m === 0) return value;
  return value / m;
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

  // ── Receive goods mutation ──
  const recordReceiptMutation = useMutation({
    mutationFn: () => {
      if (!ra) throw new Error('No RA loaded');
      const warehouseId = activeAssignment?.warehouse?.id ?? ra.warehouse_id;
      if (!warehouseId) throw new Error('Cannot determine warehouse');
      const commodityId = ra.commodity_id;
      const unitId = ra.unit_id;
      if (!commodityId) throw new Error('Cannot determine commodity from receipt order');

      // The storekeeper enters in the RA's display unit (e.g. Kuntal). Inspections
      // and all downstream totals (raRemaining, store-assignment math, GRN stacking)
      // are computed in the receipt-order line unit, so convert before sending.
      const receivedInput = Number(qtyReceived);
      const receivedLine = convertInputToLine(receivedInput, ra);
      const authorizedLine = Number(ra.authorized_quantity);
      const alreadyReceivedLine = ra.total_received ?? 0;
      const raRemLine = Math.max(0, authorizedLine - alreadyReceivedLine);
      const storeAssignedLine = Number(storeAssignment?.quantity ?? authorizedLine);
      const storeReceivedLine = Number(storeAssignment?.received_quantity ?? 0);
      const storeRemLine = Math.max(0, storeAssignedLine - storeReceivedLine);
      const capLine = Math.min(raRemLine, storeRemLine);
      const lostLine = Math.max(0, capLine - receivedLine);

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
          quantity_received: Number(receivedLine.toFixed(3)),
          quantity_lost: lostLine > 0 ? Number(lostLine.toFixed(3)) : undefined,
          quality_status: grade ?? 'Good',
          packaging_condition: 'Standard',
          remarks: remarks || undefined,
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      notifications.show({
        title: 'Goods received',
        message: 'Receipt saved. You can now confirm driver delivery.',
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
        (err instanceof Error ? err.message : 'Failed to save receipt.');
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

  // Canonical (line-unit) totals — kept for the inspection-record math
  const authorizedLine = Number(ra.authorized_quantity);
  const alreadyReceivedLine = ra.total_received ?? 0;
  const raRemainingLine = Math.max(0, authorizedLine - alreadyReceivedLine);

  // Match recordReceiptMutation: if no store assignment row is returned, use RA authorized qty as the cap.
  const storeAssignedLine = Number(storeAssignment?.quantity ?? authorizedLine);
  const storeReceivedFromAssignmentLine = Number(storeAssignment?.received_quantity ?? 0);
  const storeRemainingForRecordLine = Math.max(0, storeAssignedLine - storeReceivedFromAssignmentLine);
  const maxCanRecordLine = Math.min(raRemainingLine, storeRemainingForRecordLine);

  // Display values in the user-preferred (input) unit. The line-unit values above
  // remain authoritative for math; these are only for what the storekeeper sees.
  const u = raDisplayUnit(ra);
  const uLine = raLineUnit(ra);
  const showLineEquivalent = u && uLine && u !== uLine;

  const authorized = raDisplayQty(ra);
  const raRemaining = convertLineToInput(raRemainingLine, ra);
  const storeAssignedQty = convertLineToInput(storeAssignedLine, ra);
  const storeReceivedFromAssignment = convertLineToInput(storeReceivedFromAssignmentLine, ra);
  const storeRemainingForRecord = convertLineToInput(storeRemainingForRecordLine, ra);
  const maxCanRecord = convertLineToInput(maxCanRecordLine, ra);

  const myInspectionReceivedInput = myInspection
    ? convertLineToInput(Number(myInspection.total_received ?? 0), ra)
    : 0;
  const storeRemainingDisplay = myInspection
    ? Math.max(0, storeAssignedQty - storeReceivedFromAssignment - myInspectionReceivedInput)
    : storeRemainingForRecord;

  const received = Number(qtyReceived) || 0;
  const lostPreview = showRecordingForm && received > 0 ? Math.max(0, maxCanRecord - received) : 0;
  const receivedPct = maxCanRecord > 0 ? Math.min(100, (received / maxCanRecord) * 100) : 0;
  const exceedsStoreSuggestion = showRecordingForm && received > maxCanRecord + 0.001;
  const exceedsHubAuthorized = showRecordingForm && received > raRemaining + 0.001;

  return (
    <Stack gap="md">
      {/* ── Header ── */}
      <Group justify="space-between" wrap="nowrap">
        <Group>
          <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Title order={2}>Receive Receipt</Title>
          <Badge color={statusColor(ra.status)} variant="light" size="lg">
            {statusLabel(ra.status)}
          </Badge>
        </Group>

      </Group>

      <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>{ra.reference_no}</Text>

      {canDriverConfirm && (
        <Alert icon={<IconTruckDelivery size={16} />} color="blue" variant="light" title="Action Required">
          Goods received. Confirm driver delivery in the Driver Confirmation section to generate your GRN.
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
            <DetailField
              label="Authorized quantity"
              value={
                <Stack gap={2}>
                  <Group gap={6} align="baseline" wrap="wrap">
                    <Text size="sm" fw={700}>
                      {authorized.toLocaleString()}{u ? ` ${u}` : ''}
                    </Text>
                    {ra.unit_abbreviation && ra.unit_label && ra.unit_abbreviation !== ra.unit_label && !showLineEquivalent ? (
                      <Text size="xs" c="dimmed">({ra.unit_abbreviation})</Text>
                    ) : null}
                  </Group>
                  {showLineEquivalent ? (
                    <Text size="xs" c="dimmed">
                      = {authorizedLine.toLocaleString()} {uLine}
                    </Text>
                  ) : null}
                </Stack>
              }
            />
            <DetailField label="Commodity" value={ra.commodity_name || '—'} />
            {ra.expected_packaging_units != null && Number(ra.expected_packaging_units) > 0 ? (
              <DetailField
                label="Expected packages"
                value={
                  <Stack gap={2}>
                    <Text size="sm" fw={700}>
                      {Number(ra.expected_packaging_units).toLocaleString()}{' '}
                      {(ra.packaging_unit_name || ra.packaging_unit_abbreviation || 'packages').trim()}
                    </Text>
                    {ra.packaging_spec_label?.trim() ? (
                      <Text size="xs" c="dimmed">{ra.packaging_spec_label}</Text>
                    ) : null}
                  </Stack>
                }
              />
            ) : null}
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
                <Text fw={700}>{authorized.toLocaleString()}{u ? ` ${u}` : ''}</Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Received</Text>
                <Text fw={700} c="green">
                  {myInspection ? myInspectionReceivedInput.toLocaleString() : '—'}{u ? ` ${u}` : ''}
                </Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Lost</Text>
                <Text fw={700} c={myInspection && (authorized - myInspectionReceivedInput) > 0 ? 'red' : 'dimmed'}>
                  {myInspection
                    ? Math.max(0, authorized - myInspectionReceivedInput).toLocaleString()
                    : '—'}{u ? ` ${u}` : ''}
                </Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">Remaining (store)</Text>
                <Text fw={700} c={storeRemainingDisplay > 0 ? 'orange' : 'green'}>
                  {storeRemainingDisplay.toLocaleString()}{u ? ` ${u}` : ''}
                </Text>
              </Stack>
            </Group>
          </Stack>
        </Card>
      )}

      {/* ── Receive receipt ── */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>Receive receipt</Title>
            {(isPending || isActive) && !myInspection && (
              <Button
                size="sm"
                leftSection={<IconClipboardCheck size={16} />}
                onClick={() => setShowRecordingForm((v) => !v)}
                variant={showRecordingForm ? 'light' : 'filled'}
              >
                {showRecordingForm ? 'Cancel' : 'Enter received quantity'}
              </Button>
            )}
          </Group>

          {myInspection ? (
            <Group gap="md" align="center">
              <Badge color="green" variant="light" leftSection={<IconCheck size={12} />} size="md">
                Goods received
              </Badge>
              <Text size="sm" c="dimmed">
                You received {myInspectionReceivedInput.toLocaleString()}{u ? ` ${u}` : ''}
                {showLineEquivalent
                  ? ` (= ${Number(myInspection.total_received ?? 0).toLocaleString()} ${uLine})`
                  : ''}
              </Text>
            </Group>
          ) : showRecordingForm ? (
            <Stack gap="md" mt="xs">
              <Divider label={`Receive what arrived for your store (reference: up to ${maxCanRecord.toLocaleString()}${u ? ` ${u}` : ''} from assignment)`} labelPosition="left" />

              {exceedsHubAuthorized && (
                <Alert color="orange" variant="light" title="Above hub authorization">
                  You are entering more than remains on the hub authorization for this truck. The amount will still be saved and reflected on your GRN.
                </Alert>
              )}
              {exceedsStoreSuggestion && !exceedsHubAuthorized && (
                <Alert color="yellow" variant="light" title="Above store assignment">
                  You are entering more than this store&apos;s remaining assigned share. The amount will still be saved if you continue.
                </Alert>
              )}

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Stack gap={4}>
                  <NumberInput
                    label={`Quantity received${u ? ` (${u})` : ''}`}
                    description={`Typical cap from assignment: ${maxCanRecord.toLocaleString()}${u ? ` ${u}` : ''} (you may enter a different actual quantity).`}
                    placeholder="Enter quantity"
                    value={qtyReceived}
                    onChange={setQtyReceived}
                    min={0.001}
                    decimalScale={3}
                    required
                  />
                  {showLineEquivalent && received > 0 ? (
                    <Text size="xs" c="dimmed">
                      = {convertInputToLine(received, ra).toLocaleString(undefined, { maximumFractionDigits: 3 })} {uLine}
                    </Text>
                  ) : null}
                  {maxCanRecord > 0 && received > 0 && received <= maxCanRecord && (
                    <Progress
                      value={receivedPct}
                      color={receivedPct < 100 ? 'orange' : 'green'}
                      size="sm"
                      mt={4}
                    />
                  )}
                </Stack>

                <SearchableSelect
                  label="Grade / Condition"
                  data={['Good', 'Fair', 'Poor', 'Damaged', 'Infested', 'Wet']}
                  value={grade}
                  onChange={setGrade}
                  required
                />
              </SimpleGrid>

              {received > 0 && lostPreview > 0 && (
                <Alert color="orange" variant="light" title={`Shortfall: ${lostPreview.toLocaleString()}${u ? ` ${u}` : ''} will be recorded as lost`}>
                  Compared to the lower of hub remaining and your store&apos;s remaining assignment, the difference will be recorded as lost quantity.
                </Alert>
              )}

              {received > 0 && lostPreview === 0 && !exceedsStoreSuggestion && (
                <Alert color="green" variant="light" title="No automatic shortfall loss">
                  Received quantity meets or exceeds the reference assignment window (no shortfall loss line added).
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
                  disabled={!qtyReceived || Number(qtyReceived) <= 0}
                >
                  Save receipt
                </Button>
              </Group>
            </Stack>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
              {maxCanRecord <= 0 && storeAssignedQty > 0
                ? 'Your store assignment shows no remaining quantity; you can still enter the actual quantity received if it differs.'
                : 'Click "Enter received quantity" when the truck delivers goods to your store.'}
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
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Goods received. Confirm driver delivery to generate your GRN.
              </Text>
              <Group justify="flex-end">
                <Button
                  color="green"
                  leftSection={<IconTruckDelivery size={16} />}
                  onClick={() => driverConfirmMutation.mutate(myInspection.id)}
                  loading={driverConfirmMutation.isPending}
                >
                  Driver Confirmed Delivery
                </Button>
              </Group>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              Receive the goods first, then confirm driver delivery.
            </Text>
          )}
        </Stack>
      </Card>

      {/* ── GRN ── */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Title order={4}>Goods Received Note (GRN)</Title>
          {myGrn ? (
            <Stack gap="md">
              <Group>
                <Text size="sm" style={{ fontFamily: 'monospace' }} fw={600}>
                  {myGrn.reference_no || `GRN #${myGrn.id}`}
                </Text>
                <Badge color={myGrn.status === 'confirmed' ? 'green' : 'blue'} variant="light">
                  {myGrn.status ? myGrn.status.charAt(0).toUpperCase() + myGrn.status.slice(1) : 'Draft'}
                </Badge>
              </Group>
              <Group>
                <Button
                  variant="filled"
                  color="cyan"
                  size="md"
                  rightSection={<IconExternalLink size={16} />}
                  onClick={() => navigate(`/grns/${myGrn.id}?returnTo=/storekeeper/receipt-authorizations/${ra.id}`)}
                >
                  View GRN
                </Button>
                <Button
                  size="md"
                  variant="filled"
                  color="teal"
                  leftSection={<IconClipboardCheck size={16} />}
                  onClick={() => {
                    navigate(
                      `/stacks/layout?receipt_authorization_id=${encodeURIComponent(String(ra.id))}`
                    );
                  }}
                >
                  Go to Stacking
                </Button>
              </Group>
            </Stack>
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
