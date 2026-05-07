import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Button,
  Group,
  Card,
  Select,
  NumberInput,
  TextInput,
  Text,
  Alert,
  Divider,
  Checkbox,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  createReceiptAuthorization,
  getReceiptAuthorizations,
} from '../../api/receiptAuthorizations';
import { getReceiptOrders, type ReceiptOrderLine } from '../../api/receiptOrders';
import { getTransporterReferences, getUnitReferences, getUomConversions } from '../../api/referenceData';
import { useAuthStore } from '../../store/authStore';
import { findDirectedMultiplier } from '../../utils/uomConversions';
import type { ApiError } from '../../types/common';

function lineForAssignment(assignmentLineId: number | undefined, lines: ReceiptOrderLine[]): ReceiptOrderLine | undefined {
  if (assignmentLineId != null) {
    return lines.find((ln) => ln.id != null && Number(ln.id) === Number(assignmentLineId));
  }
  return lines[0];
}

export default function ReceiptAuthorizationFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const scopedHubId = activeAssignment?.hub?.id;
  const scopedWarehouseId = activeAssignment?.warehouse?.id;

  // Form state
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [transporterId, setTransporterId] = useState<string | null>(null);
  const [authorizedUnitId, setAuthorizedUnitId] = useState<string | null>(null);
  const [authorizedQuantity, setAuthorizedQuantity] = useState<number | string>('');
  const [driverName, setDriverName] = useState('');
  const [driverIdNumber, setDriverIdNumber] = useState('');
  const [truckPlateNumber, setTruckPlateNumber] = useState('');
  const [waybillNumber, setWaybillNumber] = useState('');
  const [autoGenerateWaybill, setAutoGenerateWaybill] = useState(true);

  // Load confirmed receipt orders for this hub
  const { data: receiptOrders = [] } = useQuery({
    queryKey: ['receipt_orders', { status: 'confirmed', hub_id: scopedHubId, warehouse_id: scopedWarehouseId }],
    queryFn: () =>
      getReceiptOrders(
        scopedWarehouseId
          ? { warehouse_id: scopedWarehouseId }
          : scopedHubId
            ? { hub_id: scopedHubId }
            : undefined
      ),
    select: (orders) =>
      orders.filter((o) => {
        const s = String(o.status || '').toLowerCase();
        const statusMatch = s === 'confirmed' || s === 'assigned' || s === 'reserved';
        if (!statusMatch) return false;

        const assignments = o.receipt_order_assignments ?? o.assignments ?? [];
        if (scopedWarehouseId) {
          if (Number(o.warehouse_id) === Number(scopedWarehouseId)) return true;
          return assignments.some((a) => Number(a.warehouse_id) === Number(scopedWarehouseId));
        }
        if (scopedHubId) {
          if (Number(o.hub_id) === Number(scopedHubId)) return true;
          return assignments.some((a) => Number(a.hub_id) === Number(scopedHubId));
        }
        return true;
      }),
  });

  const selectedOrder = receiptOrders.find((o) => String(o.id) === receiptOrderId);

  // Load transporters
  const { data: transporters = [] } = useQuery({
    queryKey: ['reference-data', 'transporters'],
    queryFn: getTransporterReferences,
  });
  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: getUnitReferences,
  });
  const { data: uomConversions = [] } = useQuery({
    queryKey: ['reference-data', 'uom_conversions'],
    queryFn: getUomConversions,
  });

  useEffect(() => {
    setAssignmentId(null);
    setAuthorizedUnitId(null);
  }, [receiptOrderId]);

  const receiptOrderOptions = receiptOrders.map((o) => ({
    value: String(o.id),
    label: `RO-${o.id} — ${o.warehouse_name || o.hub_name || 'Unknown destination'}`,
  }));

  const transporterOptions = transporters.map((t) => ({
    value: String(t.id),
    label: t.name,
  }));

  const assignments = selectedOrder?.receipt_order_assignments ?? selectedOrder?.assignments ?? [];
  const warehouseAssignments = assignments.filter((a) => a.warehouse_id != null);
  const assignmentOptions = warehouseAssignments.map((a) => ({
    value: String(a.id),
    label:
      `${a.warehouse_name || `Warehouse #${a.warehouse_id}`} — ` +
      `${Number(a.quantity ?? 0).toLocaleString()} ${a.quantity_unit_abbreviation || ''}`.trim(),
  }));

  const selectedAssignment = warehouseAssignments.find((a) => String(a.id) === assignmentId);
  const orderLines = selectedOrder?.receipt_order_lines ?? selectedOrder?.lines ?? [];
  const selectedLine = lineForAssignment(
    selectedAssignment?.receipt_order_line_id != null ? Number(selectedAssignment.receipt_order_line_id) : undefined,
    orderLines
  );
  const assignmentUnitId =
    selectedAssignment?.quantity_unit_id != null
      ? Number(selectedAssignment.quantity_unit_id)
      : selectedLine?.unit_id != null
        ? Number(selectedLine.unit_id)
        : undefined;
  const assignmentCommodityId =
    selectedLine?.commodity_id != null ? Number(selectedLine.commodity_id) : undefined;
  const assignmentUnitLabel = useMemo(() => {
    if (selectedAssignment?.quantity_unit_abbreviation) return selectedAssignment.quantity_unit_abbreviation;
    if (selectedLine?.unit_name) return selectedLine.unit_name;
    if (assignmentUnitId == null) return 'units';
    const unit = units.find((u) => u.id === assignmentUnitId);
    return unit?.abbreviation || unit?.name || 'units';
  }, [selectedAssignment?.quantity_unit_abbreviation, selectedLine?.unit_name, assignmentUnitId, units]);

  useEffect(() => {
    if (assignmentUnitId == null) {
      setAuthorizedUnitId(null);
      return;
    }
    setAuthorizedUnitId(String(assignmentUnitId));
  }, [assignmentUnitId]);

  const requiresAssignmentPick = warehouseAssignments.length > 0;
  const { data: relatedRAs = [] } = useQuery({
    queryKey: ['receipt_authorizations', { receipt_order_id: selectedOrder?.id, warehouse_id: selectedAssignment?.warehouse_id }],
    queryFn: () =>
      getReceiptAuthorizations({
        receipt_order_id: selectedOrder?.id,
        warehouse_id: selectedAssignment?.warehouse_id,
      }),
    enabled: !!selectedOrder?.id && !!selectedAssignment?.warehouse_id,
  });
  const usedOnAssignment = relatedRAs
    .filter(
      (ra) =>
        selectedAssignment != null &&
        ra.status !== 'cancelled' &&
        Number(ra.receipt_order_assignment_id) === Number(selectedAssignment.id)
    )
    .reduce((sum, ra) => sum + Number(ra.authorized_quantity || 0), 0);
  const allocatedOnAssignment = Number(selectedAssignment?.quantity ?? 0);
  const remainingOnAssignment = Math.max(0, allocatedOnAssignment - usedOnAssignment);
  const allowedUnitOptions =
    assignmentUnitId != null && assignmentCommodityId != null
      ? units
          .filter((unit) => findDirectedMultiplier(unit.id, assignmentUnitId, assignmentCommodityId, uomConversions) != null)
          .map((unit) => ({
            value: String(unit.id),
            label: unit.abbreviation ? `${unit.name} (${unit.abbreviation})` : unit.name,
          }))
      : [];
  const enteredQty = Number(authorizedQuantity);
  const previewMultiplier =
    selectedAssignment && authorizedUnitId && assignmentUnitId != null && assignmentCommodityId != null
      ? findDirectedMultiplier(Number(authorizedUnitId), assignmentUnitId, assignmentCommodityId, uomConversions)
      : null;
  const previewNormalizedQty =
    Number.isFinite(enteredQty) && enteredQty > 0 && previewMultiplier != null
      ? Number((enteredQty * previewMultiplier).toFixed(6))
      : null;
  const exceedsRemaining =
    previewNormalizedQty != null && previewNormalizedQty - remainingOnAssignment > 0.0001;
  const remainingAfterThisTruck =
    previewNormalizedQty != null ? Math.max(0, Number((remainingOnAssignment - previewNormalizedQty).toFixed(6))) : null;
  const selectedInputUnit = authorizedUnitId ? units.find((u) => u.id === Number(authorizedUnitId)) : undefined;
  const selectedInputUnitLabel = selectedInputUnit
    ? selectedInputUnit.abbreviation || selectedInputUnit.name
    : '';

  const createMutation = useMutation({
    mutationFn: () => {
      if (
        !receiptOrderId ||
        !transporterId ||
        !authorizedUnitId ||
        !authorizedQuantity ||
        !driverName ||
        !driverIdNumber ||
        !truckPlateNumber
      ) {
        throw new Error('Please fill in all required fields');
      }
      if (!autoGenerateWaybill && !waybillNumber.trim()) {
        throw new Error('Enter waybill number or enable auto-generate');
      }
      if (requiresAssignmentPick && !assignmentId) {
        throw new Error('Select a warehouse assignment for this receipt order');
      }

      const enteredQty = Number(authorizedQuantity);
      if (!Number.isFinite(enteredQty) || enteredQty <= 0) {
        throw new Error('Enter a quantity greater than zero');
      }
      if (assignmentUnitId == null || assignmentCommodityId == null) {
        throw new Error('Unable to resolve assignment unit/commodity. Please check receipt order assignment setup.');
      }
      const unitMultiplier = findDirectedMultiplier(
        Number(authorizedUnitId),
        assignmentUnitId,
        assignmentCommodityId,
        uomConversions
      );
      if (unitMultiplier == null) {
        throw new Error('Selected unit cannot be converted to the warehouse assignment unit');
      }
      const normalizedQty = Number((enteredQty * unitMultiplier).toFixed(6));
      if (normalizedQty - remainingOnAssignment > 0.0001) {
        throw new Error(
          `Cannot authorize ${normalizedQty.toLocaleString()} ${assignmentUnitLabel}; only ${remainingOnAssignment.toLocaleString()} ${assignmentUnitLabel} remains for this warehouse`
        );
      }

      return createReceiptAuthorization({
        receipt_order_id: Number(receiptOrderId),
        receipt_order_assignment_id: assignmentId ? Number(assignmentId) : null,
        transporter_id: Number(transporterId),
        authorized_quantity: normalizedQty,
        driver_name: driverName.trim(),
        driver_id_number: driverIdNumber.trim(),
        truck_plate_number: truckPlateNumber.trim(),
        waybill_number: autoGenerateWaybill ? undefined : waybillNumber.trim(),
      });
    },
    onSuccess: (ra) => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      notifications.show({
        title: 'Receipt Authorization Created',
        message: `${ra.reference_no} created. Warehouse staff will be notified.`,
        color: 'green',
      });
      navigate(`/hub/receipt-authorizations/${ra.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          (error instanceof Error ? error.message : 'Failed to create Receipt Authorization'),
        color: 'red',
      });
    },
  });

  return (
    <Stack gap="md">
      <Group>
        <Button variant="default" onClick={() => navigate('/hub/receipt-authorizations')}>
          ← Back
        </Button>
        <Title order={2}>New Receipt Authorization</Title>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Create one Receipt Authorization per truck against a warehouse allocation on the receipt order. Store-level
            assignment is handled separately on the Receipt Order — this step authorizes inbound transport to the hub
            warehouse only.
          </Text>

          <Divider label="Receipt Order" labelPosition="left" />

          <Select
            label="Receipt Order"
            placeholder="Select a confirmed receipt order"
            data={receiptOrderOptions}
            value={receiptOrderId}
            onChange={setReceiptOrderId}
            searchable
            required
            description="Only confirmed, assigned, or reserved orders are shown"
          />

          {assignmentOptions.length > 0 ? (
            <Select
              label="Warehouse Assignment"
              placeholder="Select warehouse allocation"
              data={assignmentOptions}
              value={assignmentId}
              onChange={setAssignmentId}
              searchable
              required
              description="Hub authorizes freight against the hub→warehouse allocation (not an individual store)"
            />
          ) : receiptOrderId ? (
            <Alert icon={<IconAlertCircle size={16} />} title="Warehouse allocation missing" color="yellow">
              This receipt order has no hub→warehouse assignment yet. Assign warehouses on the Receipt Order detail page
              before creating an authorization.
            </Alert>
          ) : null}

          {selectedAssignment && (
            <Alert color="blue" variant="light" title="Selected Warehouse Allocation">
              {`Warehouse: ${selectedAssignment.warehouse_name || `Warehouse #${selectedAssignment.warehouse_id}`}. Assigned: ${allocatedOnAssignment.toLocaleString()} ${assignmentUnitLabel}. Used in RAs: ${usedOnAssignment.toLocaleString()} ${assignmentUnitLabel}. Remaining: ${remainingOnAssignment.toLocaleString()} ${assignmentUnitLabel}.`}
            </Alert>
          )}
          {selectedAssignment && exceedsRemaining && previewNormalizedQty != null && (
            <Alert color="red" title="Quantity exceeds allocation">
              {`This truck quantity converts to ${previewNormalizedQty.toLocaleString()} ${assignmentUnitLabel}, but only ${remainingOnAssignment.toLocaleString()} ${assignmentUnitLabel} remains for this warehouse assignment.`}
            </Alert>
          )}
          {selectedAssignment && previewNormalizedQty != null && (
            <Alert color={exceedsRemaining ? 'red' : 'teal'} variant="light" title="Unit Conversion Preview">
              {`${enteredQty.toLocaleString()} ${selectedInputUnitLabel} = ${previewNormalizedQty.toLocaleString()} ${assignmentUnitLabel}. Remaining after this truck: ${remainingAfterThisTruck?.toLocaleString()} ${assignmentUnitLabel}.`}
            </Alert>
          )}

          <Group grow align="flex-start">
            <NumberInput
              label="Authorized Quantity"
              placeholder="e.g. 500"
              value={authorizedQuantity}
              onChange={setAuthorizedQuantity}
              min={0.001}
              decimalScale={3}
              required
              error={
                exceedsRemaining
                  ? `Exceeded: ${previewNormalizedQty?.toLocaleString()} ${assignmentUnitLabel} > ${remainingOnAssignment.toLocaleString()} ${assignmentUnitLabel} remaining`
                  : undefined
              }
              description={
                selectedAssignment
                  ? `Per truck amount. Converts to ${assignmentUnitLabel} and is capped by remaining allocation`
                  : 'Quantity on this specific truck'
              }
            />
            <Select
              label="Quantity Unit"
              placeholder="Select unit"
              data={allowedUnitOptions}
              value={authorizedUnitId}
              onChange={setAuthorizedUnitId}
              searchable
              required
              disabled={!selectedAssignment || allowedUnitOptions.length === 0}
              description={
                selectedAssignment
                  ? `Only units convertible to ${assignmentUnitLabel} are allowed`
                  : 'Select warehouse assignment first'
              }
            />
          </Group>

          <Divider label="Vehicle & Driver Details" labelPosition="left" />

          <Select
            label="Transporter"
            placeholder="Select transporter"
            data={transporterOptions}
            value={transporterId}
            onChange={setTransporterId}
            searchable
            required
          />

          <Group grow>
            <TextInput
              label="Driver Name"
              placeholder="Full name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              required
            />
            <TextInput
              label="Driver ID Number"
              placeholder="National ID or license number"
              value={driverIdNumber}
              onChange={(e) => setDriverIdNumber(e.target.value)}
              required
            />
          </Group>

          <Group grow>
            <TextInput
              label="Truck Plate Number"
              placeholder="e.g. AA-12345"
              value={truckPlateNumber}
              onChange={(e) => setTruckPlateNumber(e.target.value)}
              required
              style={{ fontFamily: 'monospace' }}
            />
            <Stack gap={6}>
              <Checkbox
                label="Auto-generate Waybill Number"
                checked={autoGenerateWaybill}
                onChange={(e) => setAutoGenerateWaybill(e.currentTarget.checked)}
              />
              <TextInput
                label="Waybill Number"
                placeholder={autoGenerateWaybill ? 'Will be auto-generated on create' : 'Transport waybill reference'}
                value={waybillNumber}
                onChange={(e) => setWaybillNumber(e.target.value)}
                disabled={autoGenerateWaybill}
                required={!autoGenerateWaybill}
              />
            </Stack>
          </Group>

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => navigate('/hub/receipt-authorizations')}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={
                (requiresAssignmentPick && !assignmentId) ||
                !!selectedAssignment && (!authorizedUnitId || remainingOnAssignment <= 0 || exceedsRemaining)
              }
            >
              Create Receipt Authorization
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
