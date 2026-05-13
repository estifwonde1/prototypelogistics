import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  Select,
  Card,
  Table,
  ActionIcon,
  Text,
  NumberInput,
  Textarea,
  Alert,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { createInspection } from '../../api/inspections';
import { getWarehouses } from '../../api/warehouses';
import { getReceipts } from '../../api/receipts';
import { getWaybills } from '../../api/waybills';
import { getGrns } from '../../api/grns';
import { getReceiptAuthorizations } from '../../api/receiptAuthorizations';
import { getReceiptOrders, type ReceiptOrder } from '../../api/receiptOrders';
import { getCommodityReferences, getUnitReferences, getUomConversions } from '../../api/referenceData';
import { notifications } from '@mantine/notifications';
import { QualityStatus, PackagingCondition } from '../../utils/constants';
import { generateSourceDetailReference } from '../../utils/sourceDetailReference';
import { convertQuantityToTargetUnit } from '../../utils/uomConversions';
import type { InspectionItem } from '../../types/inspection';
import type { ApiError } from '../../types/common';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';

function raAuthDisplayParts(ra: ReceiptAuthorization) {
  const inputQty = ra.authorized_quantity_input;
  const hasInput = inputQty != null && Number.isFinite(Number(inputQty)) && Number(inputQty) > 0;
  const qty = hasInput ? Number(inputQty) : Number(ra.authorized_quantity);
  const uDisp = (ra.authorized_quantity_input_unit_name ?? ra.authorized_quantity_input_unit_abbreviation ?? '').trim();
  const uLine = (ra.unit_label ?? ra.unit_name ?? ra.unit_abbreviation ?? '').trim();
  const lineQty = Number(ra.authorized_quantity);
  return { qty, uPrimary: uDisp || uLine, uLine, lineQty, showEquiv: Boolean(uDisp && uLine && uDisp !== uLine) };
}

function uniqueLineRefsForInspectionItems(list: InspectionItem[]): InspectionItem[] {
  const used = new Set<string>();
  return list.map((item) => {
    let ref = (item.line_reference_no || '').trim();
    if (!ref) ref = generateSourceDetailReference();
    while (used.has(ref)) ref = generateSourceDetailReference();
    used.add(ref);
    return { ...item, line_reference_no: ref, batch_no: ref };
  });
}

function InspectionCreatePage() {
  const sourceTypeOptions = [
    { value: 'Receipt', label: 'Receipt' },
    { value: 'Waybill', label: 'Waybill' },
    { value: 'Grn', label: 'GRN' },
  ];

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loggedInUserId = useAuthStore((s) => s.userId);
  const defaultedInspectorRef = useRef(false);
  const raItemPrefillKeyRef = useRef('');

  // Form state
  const [referenceNo, setReferenceNo] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [inspectedOn, setInspectedOn] = useState<Date | null>(new Date());
  const [inspectorId, setInspectorId] = useState('');

  useEffect(() => {
    if (loggedInUserId != null && !defaultedInspectorRef.current) {
      setInspectorId(String(loggedInUserId));
      defaultedInspectorRef.current = true;
    }
  }, [loggedInUserId]);
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [items, setItems] = useState<InspectionItem[]>([
    {
      commodity_id: 0,
      quantity_received: 0,
      quantity_damaged: 0,
      quantity_lost: 0,
      quality_status: QualityStatus.GOOD,
      packaging_condition: PackagingCondition.INTACT,
      remarks: '',
      line_reference_no: '',
    },
  ]);

  // Get active assignment context for filtering
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userHubId = activeAssignment?.hub?.id;
  const isHubManager = roleSlug === 'hub_manager';
  const isStorekeeper = roleSlug === 'storekeeper';

  // Receipt Authorization selector state
  const [receiptAuthorizationId, setReceiptAuthorizationId] = useState<string | null>(null);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => {
      if (isHubManager && userHubId) {
        return getWarehouses({ hub_id: userHubId });
      }
      return getWarehouses();
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => getReceipts(),
  });

  const { data: waybills = [] } = useQuery({
    queryKey: ['waybills'],
    queryFn: () => getWaybills(),
  });

  const { data: grns = [] } = useQuery({
    queryKey: ['grns'],
    queryFn: () => getGrns(),
  });
  const { data: receiptOrders = [] } = useQuery({
    queryKey: ['receipt_orders_for_inspection'],
    queryFn: () => getReceiptOrders(),
    enabled: isStorekeeper,
  });
  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: () => getCommodityReferences(),
  });
  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: () => getUnitReferences(),
  });
  const { data: uomConversions = [] } = useQuery({
    queryKey: ['reference-data', 'uom-conversions'],
    queryFn: () => getUomConversions(),
  });

  // Fetch pending Receipt Authorizations for storekeeper via policy scope.
  // Do not over-filter by active store id on client side; backend policy already enforces visibility.
  const { data: pendingRAs = [] } = useQuery({
    queryKey: ['receipt_authorizations', { status: 'pending', role: roleSlug }],
    queryFn: () => getReceiptAuthorizations({ status: 'pending' }),
    enabled: isStorekeeper,
  });

  const selectedRA = pendingRAs.find((ra) => String(ra.id) === receiptAuthorizationId);
  const expectedQty = selectedRA ? Number(selectedRA.authorized_quantity || 0) : null;
  const matchingWaybills = selectedRA
    ? waybills.filter(
        (wb) =>
          (wb.reference_no || '').trim().toLowerCase() ===
          (selectedRA.waybill_number || '').trim().toLowerCase()
      )
    : [];
  const selectedWaybillForRA =
    sourceType === 'Waybill'
      ? waybills.find((wb) => String(wb.id) === sourceId) || matchingWaybills[0]
      : undefined;
  const linkedOrder: ReceiptOrder | undefined = selectedRA
    ? receiptOrders.find((o) => Number(o.id) === Number(selectedRA.receipt_order_id))
    : undefined;
  const linkedOrderAssignments = linkedOrder?.receipt_order_assignments ?? linkedOrder?.assignments ?? [];
  const linkedAssignment = selectedRA
    ? linkedOrderAssignments.find(
        (assignment) => Number(assignment.id) === Number(selectedRA.receipt_order_assignment_id)
      )
    : undefined;
  const linkedOrderLines = linkedOrder?.receipt_order_lines ?? linkedOrder?.lines ?? [];
  const linkedAssignmentLine =
    linkedAssignment?.receipt_order_line_id != null
      ? linkedOrderLines.find((line) => Number(line.id) === Number(linkedAssignment.receipt_order_line_id))
      : linkedOrderLines[0];
  const expectedUnitId =
    linkedAssignment?.quantity_unit_id ??
    linkedAssignmentLine?.unit_id ??
    selectedWaybillForRA?.waybill_items?.[0]?.unit_id ??
    null;
  const enteredTotalQty = items.reduce((sum, item) => sum + Number(item.quantity_received || 0), 0);
  const enteredTotalQtyForComparison =
    expectedQty == null || expectedUnitId == null
      ? enteredTotalQty
      : items.reduce((sum, item) => {
          const qty = Number(item.quantity_received || 0);
          if (!qty) return sum;
          const fromUnitId = Number(item.unit_id || expectedUnitId);
          if (!fromUnitId || fromUnitId === expectedUnitId) return sum + qty;
          const converted = convertQuantityToTargetUnit(
            qty,
            fromUnitId,
            expectedUnitId,
            Number(item.commodity_id || 0),
            uomConversions
          );
          return sum + Number(converted ?? 0);
        }, 0);
  const exceedsExpectedQty =
    expectedQty != null && enteredTotalQtyForComparison - expectedQty > 0.0001;

  // When storekeeper selects RA, guide the form to Waybill path and match by RA.waybill_number when possible.
  useEffect(() => {
    if (!isStorekeeper || !selectedRA) return;

    setWarehouseId(String(selectedRA.warehouse_id));
    setSourceType('Waybill');
    setSourceId(matchingWaybills.length > 0 ? String(matchingWaybills[0].id) : '');
  }, [isStorekeeper, selectedRA, matchingWaybills]);

  // For storekeeper flow: once RA is selected, prefill inspection items
  // from matched Waybill with commodity + batch only.
  useEffect(() => {
    if (!isStorekeeper || !selectedRA || !selectedWaybillForRA?.waybill_items?.length) return;
    const prefillKey = `${selectedRA.id}:${selectedWaybillForRA.id}`;
    if (raItemPrefillKeyRef.current === prefillKey) return;
    raItemPrefillKeyRef.current = prefillKey;

    setItems(
      selectedWaybillForRA.waybill_items.map((item) => ({
        commodity_id: Number(item.commodity_id || 0),
        quantity_received: 0,
        quantity_damaged: 0,
        quantity_lost: 0,
        quality_status: QualityStatus.GOOD,
        packaging_condition: PackagingCondition.INTACT,
        remarks: '',
        unit_id: Number(item.unit_id || expectedUnitId || 0),
        entered_unit_id: Number(item.unit_id || expectedUnitId || 0),
        line_reference_no:
          item.batch_no || linkedAssignmentLine?.commodity_batch_no || linkedAssignmentLine?.line_reference_no || '',
        batch_no:
          item.batch_no || linkedAssignmentLine?.commodity_batch_no || linkedAssignmentLine?.line_reference_no || '',
      }))
    );
  }, [isStorekeeper, selectedRA, selectedWaybillForRA, expectedUnitId, linkedAssignmentLine]);

  useEffect(() => {
    if (!isStorekeeper || !selectedRA || selectedWaybillForRA?.waybill_items?.length) return;
    const prefillKey = `${selectedRA.id}:fallback`;
    if (raItemPrefillKeyRef.current === prefillKey) return;
    raItemPrefillKeyRef.current = prefillKey;
    if (!linkedOrderLines.length) return;

    const fallbackLines = linkedAssignmentLine ? [linkedAssignmentLine] : linkedOrderLines;
    setItems(
      fallbackLines.map((line) => ({
        commodity_id: Number(line.commodity_id || 0),
        quantity_received: 0,
        quantity_damaged: 0,
        quantity_lost: 0,
        quality_status: QualityStatus.GOOD,
        packaging_condition: PackagingCondition.INTACT,
        remarks: '',
        unit_id: Number(line.unit_id || expectedUnitId || 0),
        entered_unit_id: Number(line.unit_id || expectedUnitId || 0),
        line_reference_no: line.commodity_batch_no || line.line_reference_no || '',
        batch_no: line.commodity_batch_no || line.line_reference_no || '',
      }))
    );
  }, [isStorekeeper, selectedRA, selectedWaybillForRA, linkedOrderLines, linkedAssignmentLine, expectedUnitId]);

  useEffect(() => {
    if (receiptAuthorizationId) return;
    raItemPrefillKeyRef.current = '';
  }, [receiptAuthorizationId]);

  const createMutation = useMutation({
    mutationFn: createInspection,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      notifications.show({
        title: 'Success',
        message: 'Inspection created successfully',
        color: 'green',
      });
      navigate(`/inspections/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create inspection',
        color: 'red',
      });
    },
  });

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        commodity_id: 0,
        quantity_received: 0,
        quantity_damaged: 0,
        quantity_lost: 0,
        quality_status: QualityStatus.GOOD,
        packaging_condition: PackagingCondition.INTACT,
        remarks: '',
        line_reference_no: '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof InspectionItem>(
    index: number,
    field: K,
    value: InspectionItem[K]
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (!referenceNo || !warehouseId || !inspectedOn) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }

    if (isStorekeeper && !receiptAuthorizationId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please select the Receipt Authorization for this truck',
        color: 'red',
      });
      return;
    }

    if (items.length === 0 || items.some((item) => !item.commodity_id || !item.quantity_received || !item.unit_id)) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please add at least one valid item with commodity, quantity received, and unit',
        color: 'red',
      });
      return;
    }

    const allowStorekeeperRaWithoutWaybillSource =
      isStorekeeper && !!receiptAuthorizationId && sourceType === 'Waybill' && !sourceId;

    if (!allowStorekeeperRaWithoutWaybillSource && ((sourceType && !sourceId) || (!sourceType && sourceId))) {
      notifications.show({
        title: 'Validation Error',
        message: 'Source type and source ID must be provided together.',
        color: 'red',
      });
      return;
    }

    const normalizedItems: InspectionItem[] = [];
    for (const item of items) {
      const enteredUnitId = Number(item.unit_id || 0);
      let normalizedQty = Number(item.quantity_received || 0);
      let normalizedUnitId = enteredUnitId || undefined;

      if (selectedRA && expectedUnitId != null && enteredUnitId && enteredUnitId !== expectedUnitId) {
        const convertedQty = convertQuantityToTargetUnit(
          normalizedQty,
          enteredUnitId,
          expectedUnitId,
          Number(item.commodity_id || 0),
          uomConversions
        );
        if (convertedQty == null) {
          notifications.show({
            title: 'Validation Error',
            message: 'Cannot convert selected unit to expected RA unit for one or more items.',
            color: 'red',
          });
          return;
        }
        normalizedQty = Number(convertedQty);
        normalizedUnitId = expectedUnitId;
      }

      normalizedItems.push({
        ...item,
        quantity_received: normalizedQty,
        entered_unit_id: enteredUnitId || undefined,
        base_unit_id: normalizedUnitId,
        base_quantity: normalizedQty,
        unit_id: normalizedUnitId,
      });
    }

    createMutation.mutate({
      reference_no: referenceNo,
      warehouse_id: parseInt(warehouseId),
      inspected_on: inspectedOn.toISOString().split('T')[0],
      inspector_id: inspectorId ? parseInt(inspectorId) : undefined,
      source_type: sourceType || undefined,
      source_id: sourceId ? parseInt(sourceId) : undefined,
      items: uniqueLineRefsForInspectionItems(normalizedItems),
      receipt_authorization_id: receiptAuthorizationId ? parseInt(receiptAuthorizationId) : undefined,
    });
  };

  const warehouseOptions = warehouses?.map((w) => ({
    value: w.id.toString(),
    label: `${w.name} (${w.code})`,
  }));

  const receiptAuthorizationOptions = pendingRAs.map((ra) => ({
    value: ra.id.toString(),
    label: `${ra.reference_no} — ${ra.driver_name} (${ra.truck_plate_number})`,
  }));

  const sourceOptions =
    sourceType === 'Receipt'
      ? receipts.map((receipt) => ({
          value: receipt.id.toString(),
          label: `${receipt.reference_no || 'Receipt'} (#${receipt.id})`,
        }))
      : sourceType === 'Waybill'
        ? (selectedRA && matchingWaybills.length > 0 ? matchingWaybills : waybills).map((waybill) => ({
            value: waybill.id.toString(),
            label: `${waybill.reference_no || 'Waybill'} (#${waybill.id})`,
          }))
        : sourceType === 'Grn'
          ? grns.map((grn) => ({
              value: grn.id.toString(),
              label: `${grn.reference_no || 'GRN'} (#${grn.id})`,
            }))
          : [];

  const qualityOptions = Object.entries(QualityStatus).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));
  const commodityOptions = commodities.map((c) => ({
    value: String(c.id),
    label: c.code ? `${c.name} (${c.code})` : c.name,
  }));
  const unitOptions = units.map((u) => ({
    value: String(u.id),
    label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name,
  }));

  const packagingOptions = Object.entries(PackagingCondition).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Create Inspection</Title>
          <Text c="dimmed" size="sm">
            Record quality inspection and assessment
          </Text>
        </div>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Header Information</Title>

          <Group grow>
            <TextInput
              label="Reference Number"
              placeholder="INS-2024-001"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              required
            />
            <Select
              label="Warehouse"
              placeholder="Select warehouse"
              data={warehouseOptions || []}
              value={warehouseId}
              onChange={setWarehouseId}
              searchable
              required
            />
          </Group>

          <Group grow>
            <DateInput
              label="Inspected On"
              placeholder="Select date"
              value={inspectedOn}
              onChange={(value) => setInspectedOn(value ? new Date(value) : null)}
              required
            />
            <TextInput
              label="Inspector (User ID)"
              placeholder="Enter inspector user ID"
              description="Defaults to the signed-in user; change if a different inspector applies."
              value={inspectorId}
              onChange={(e) => setInspectorId(e.target.value)}
            />
          </Group>

          <Group grow>
            <Select
              label="Source Type"
              placeholder="Select source type"
              data={sourceTypeOptions}
              value={sourceType}
              onChange={(value) => {
                setSourceType(value || '');
                setSourceId('');
              }}
              clearable
            />
            <Select
              label="Source Reference"
              placeholder={
                sourceType ? 'Select source reference' : 'Select source type first'
              }
              data={sourceOptions}
              value={sourceId || null}
              onChange={(value) => {
                const nextSourceId = value || '';
                setSourceId(nextSourceId);

                if (sourceType !== 'Grn' || !nextSourceId) return;

                const selectedGrn = grns.find((grn) => grn.id === Number(nextSourceId));
                if (!selectedGrn?.grn_items) return;

                setWarehouseId(String(selectedGrn.warehouse_id));
                setItems(
                  selectedGrn.grn_items.map((item) => ({
                    commodity_id: item.commodity_id,
                    quantity_received: item.quantity,
                    quantity_damaged: 0,
                    quantity_lost: 0,
                    quality_status: item.quality_status || QualityStatus.GOOD,
                    packaging_condition: PackagingCondition.INTACT,
                    remarks: '',
                    line_reference_no: item.line_reference_no || item.batch_no || '',
                  }))
                );
              }}
              searchable
              clearable
              disabled={!sourceType}
            />
          </Group>
          {sourceType === 'Waybill' && (
            <Text size="xs" c="dimmed">
              Source Reference expects a Waybill document reference. When you pick a Receipt Authorization, this list is
              narrowed to matching waybill reference when found.
            </Text>
          )}

          {isStorekeeper && (
            <>
              <Select
                label="Receipt Authorization"
                description="Select the Receipt Authorization for the arriving truck"
                placeholder={
                  isStorekeeper
                    ? pendingRAs.length === 0
                      ? 'No pending Receipt Authorizations available for your current assignment'
                      : 'Select Receipt Authorization'
                    : 'No store/warehouse assigned to your account'
                }
                data={receiptAuthorizationOptions}
                value={receiptAuthorizationId}
                onChange={setReceiptAuthorizationId}
                searchable
                required
                disabled={pendingRAs.length === 0}
              />
              {selectedRA && (
                <Alert color="blue" variant="light" title="Receipt Authorization Details">
                  {(() => {
                    const d = raAuthDisplayParts(selectedRA);
                    return `Expected quantity: ${d.qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}${d.uPrimary ? ` ${d.uPrimary}` : ''}${d.showEquiv ? ` (= ${d.lineQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${d.uLine})` : ''}. Truck plate: ${selectedRA.truck_plate_number}.`;
                  })()}
                </Alert>
              )}
              {selectedRA && sourceType === 'Waybill' && matchingWaybills.length === 0 && (
                <Alert color="yellow" variant="light" title="Waybill record not found">
                  No Waybill document matched this Receipt Authorization&apos;s transport reference. Inspection can
                  proceed from the RA only, or pick a Waybill explicitly if one exists under Waybills.
                </Alert>
              )}
              {!selectedRA && pendingRAs.length === 0 && (
                <Alert color="yellow" variant="light" title="No pending RAs visible">
                  No pending Receipt Authorizations are visible for your current storekeeper access. Check the storekeeper assignment (store/warehouse) and confirm the RA is still in pending status.
                </Alert>
              )}
            </>
          )}
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          {selectedRA && (
            <Alert color={exceedsExpectedQty ? 'red' : 'teal'} variant="light" title="Expected Quantity Check">
              {`Received so far: ${enteredTotalQtyForComparison.toLocaleString()} / ${Number(expectedQty).toLocaleString()}${
                expectedUnitId != null
                  ? ` (${units.find((u) => u.id === expectedUnitId)?.abbreviation || 'base unit'})`
                  : ' units'
              }${
                exceedsExpectedQty ? ' (exceeds expected quantity)' : ''
              }.`}
            </Alert>
          )}
          <Text size="xs" c="dimmed">
            Line ref / batch is the lot identifier. If RA-linked waybill has a batch, it is prefilled; otherwise generate or enter it manually.
          </Text>
          <Group justify="space-between">
            <Title order={4}>Inspection Items</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={handleAddItem}
            >
              Add Item
            </Button>
          </Group>

          <Table.ScrollContainer minWidth={1320}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Line ref / batch</Table.Th>
                  <Table.Th>Qty Received</Table.Th>
                  <Table.Th>Qty Damaged</Table.Th>
                  <Table.Th>Qty Lost</Table.Th>
                  <Table.Th>Quality</Table.Th>
                  <Table.Th>Packaging</Table.Th>
                  <Table.Th>Remarks</Table.Th>
                  <Table.Th style={{ width: 50 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Select
                        placeholder="Select commodity"
                        data={commodityOptions}
                        value={item.commodity_id ? String(item.commodity_id) : null}
                        onChange={(value) => {
                          const nextId = value ? Number(value) : 0;
                          const selectedCommodity = commodities.find((c) => c.id === nextId);
                          handleItemChange(index, 'commodity_id', nextId);
                          handleItemChange(index, 'commodity_name', selectedCommodity?.name || '');
                        }}
                        searchable
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <TextInput
                          placeholder="Unique ref"
                          value={item.line_reference_no || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            handleItemChange(index, 'line_reference_no', v);
                            handleItemChange(index, 'batch_no', v);
                          }}
                          style={{ minWidth: 130 }}
                        />
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => {
                            const ref = generateSourceDetailReference();
                            handleItemChange(index, 'line_reference_no', ref);
                            handleItemChange(index, 'batch_no', ref);
                          }}
                        >
                          Gen
                        </Button>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <NumberInput
                          placeholder="Received"
                          value={item.quantity_received || ''}
                          onChange={(val) =>
                            handleItemChange(index, 'quantity_received', Number(val))
                          }
                          min={0}
                          hideControls
                          style={{ minWidth: 110 }}
                        />
                        <Select
                          placeholder="Unit"
                          data={unitOptions}
                          value={item.unit_id ? String(item.unit_id) : null}
                          onChange={(value) =>
                            handleItemChange(index, 'unit_id', value ? Number(value) : 0)
                          }
                          searchable
                          style={{ minWidth: 120 }}
                        />
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Damaged"
                        value={item.quantity_damaged || ''}
                        onChange={(val) =>
                          handleItemChange(index, 'quantity_damaged', Number(val))
                        }
                        min={0}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Lost"
                        value={item.quantity_lost || ''}
                        onChange={(val) =>
                          handleItemChange(index, 'quantity_lost', Number(val))
                        }
                        min={0}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        placeholder="Quality"
                        data={qualityOptions}
                        value={item.quality_status}
                        onChange={(val) =>
                          handleItemChange(
                            index,
                            'quality_status',
                            val || QualityStatus.GOOD
                          )
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        placeholder="Packaging"
                        data={packagingOptions}
                        value={item.packaging_condition}
                        onChange={(val) =>
                          handleItemChange(
                            index,
                            'packaging_condition',
                            val || PackagingCondition.INTACT
                          )
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Textarea
                        placeholder="Remarks"
                        value={item.remarks || ''}
                        onChange={(e) =>
                          handleItemChange(index, 'remarks', e.target.value)
                        }
                        rows={1}
                        autosize
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => handleRemoveItem(index)}
                        disabled={items.length === 1}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button variant="default" onClick={() => navigate('/inspections')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={createMutation.isPending}>
          Create Inspection
        </Button>
      </Group>
    </Stack>
  );
}

export default InspectionCreatePage;


