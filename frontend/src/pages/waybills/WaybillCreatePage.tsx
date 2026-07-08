import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Stack, Title, Button, Group, TextInput, Card, Table, ActionIcon, Text, NumberInput, Alert, Divider } from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { createWaybill } from '../../api/waybills';
import { getReceiptOrders, type ReceiptOrder, type ReceiptOrderLine } from '../../api/receiptOrders';
import { getReceiptAuthorizations } from '../../api/receiptAuthorizations';
import {
  getCommodityReferences,
  getTransporterReferences,
  getUnitReferences,
} from '../../api/referenceData';
import { getWarehouses } from '../../api/warehouses';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import type { WaybillItem, WaybillTransport } from '../../types/waybill';
import { DocumentStatus } from '../../utils/constants';
import type { ApiError } from '../../types/common';

type SourceContext = 'manual' | 'receipt_order' | 'receipt_authorization';

function firstWarehouseIdFromOrder(order: ReceiptOrder | undefined): number | null {
  if (!order) return null;
  if (order.warehouse_id != null) return Number(order.warehouse_id);
  const assignments = order.receipt_order_assignments ?? order.assignments ?? [];
  const fromAssignment = assignments.find((a) => a.warehouse_id != null)?.warehouse_id;
  return fromAssignment != null ? Number(fromAssignment) : null;
}

function orderLines(order: ReceiptOrder | undefined): ReceiptOrderLine[] {
  if (!order) return [];
  return order.receipt_order_lines ?? order.lines ?? [];
}

function pickAlternativeSourceWarehouseId(
  destinationWarehouseId: string | null,
  warehouseRows: Array<{ id: number; hub_id?: number | null; location_id?: number | null }>,
  preferredHubId?: number
): string | null {
  if (!destinationWarehouseId) return null;
  const destinationIdNum = Number(destinationWarehouseId);
  const destination = warehouseRows.find((w) => Number(w.id) === destinationIdNum);
  if (!destination) return null;

  const sameHubAlternative = warehouseRows.find(
    (w) =>
      Number(w.id) !== destinationIdNum &&
      w.location_id != null &&
      destination.hub_id != null &&
      Number(w.hub_id) === Number(destination.hub_id)
  );
  if (sameHubAlternative) return String(sameHubAlternative.id);

  const preferredHubAlternative =
    preferredHubId != null
      ? warehouseRows.find(
          (w) =>
            Number(w.id) !== destinationIdNum &&
            w.location_id != null &&
            Number(w.hub_id) === Number(preferredHubId)
        )
      : undefined;
  if (preferredHubAlternative) return String(preferredHubAlternative.id);

  const anyAlternative = warehouseRows.find(
    (w) => Number(w.id) !== destinationIdNum && w.location_id != null
  );
  return anyAlternative ? String(anyAlternative.id) : null;
}

function WaybillCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state - Header
  const [referenceNo, setReferenceNo] = useState('');
  const [issuedOn, setIssuedOn] = useState<Date | null>(new Date());
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string | null>(null);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string | null>(null);
  const [dispatchId, setDispatchId] = useState('');
  const [sourceContext, setSourceContext] = useState<SourceContext>('manual');
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [receiptAuthorizationId, setReceiptAuthorizationId] = useState<string | null>(null);

  // Form state - Transport
  const [transporterId, setTransporterId] = useState<string | null>(null);
  const [vehiclePlateNo, setVehiclePlateNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');

  // Form state - Items
  const [items, setItems] = useState<WaybillItem[]>([
    {
      commodity_id: 0,
      quantity: 0,
      unit_id: 0,
    },
  ]);

  // Get active assignment context for filtering
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((state) => state.role));
  const userHubId = activeAssignment?.hub?.id;
  const isHubManager = roleSlug === 'hub_manager';

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => {
      if (isHubManager && userHubId) {
        return getWarehouses({ hub_id: userHubId });
      }
      return getWarehouses();
    },
  });

  const { data: transporters = [] } = useQuery({
    queryKey: ['reference_data', 'transporters'],
    queryFn: () => getTransporterReferences(),
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: () => getCommodityReferences(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: () => getUnitReferences(),
  });
  const { data: receiptOrders = [] } = useQuery({
    queryKey: ['receipt_orders_for_waybill', { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => getReceiptOrders(isHubManager && userHubId ? { hub_id: userHubId } : undefined),
    select: (rows) =>
      rows.filter((o) => {
        const s = String(o.status || '').toLowerCase();
        return ['confirmed', 'assigned', 'reserved', 'in progress', 'in_progress'].includes(s);
      }),
  });
  const { data: receiptAuthorizations = [] } = useQuery({
    queryKey: ['receipt_authorizations_for_waybill', { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => getReceiptAuthorizations(),
    select: (rows) =>
      rows.filter((ra) => ['pending', 'active'].includes(String(ra.status || '').toLowerCase())),
  });

  const selectedOrder = receiptOrders.find((o) => String(o.id) === receiptOrderId);
  const selectedRA = receiptAuthorizations.find((ra) => String(ra.id) === receiptAuthorizationId);

  const transporterOptions = transporters.map((t) => ({
    value: String(t.id),
    label: t.code ? `${t.code} — ${t.name}` : t.name,
  }));

  const commodityOptions = commodities.map((c) => ({
    value: String(c.id),
    label: c.code ? `${c.name} (${c.code})` : c.name,
  }));

  const unitOptions = units.map((u) => ({
    value: String(u.id),
    label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name,
  }));

  const availableWarehouses = warehouses
    .filter((warehouse) => warehouse.location_id)
    .map((warehouse) => ({
      warehouse,
      value: String(warehouse.id),
      label: `${warehouse.code} - ${warehouse.name}`,
    }));

  const sourceWarehouseOptions = availableWarehouses
    .filter((option) => option.value !== destinationWarehouseId)
    .map(({ value, label }) => ({ value, label }));

  const destinationWarehouseOptions = availableWarehouses
    .filter((option) => option.value !== sourceWarehouseId)
    .map(({ value, label }) => ({ value, label }));

  const destinationWarehouse = warehouses.find(
    (warehouse) => String(warehouse.id) === destinationWarehouseId
  );
  const receiptOrderOptions = receiptOrders.map((o) => ({
    value: String(o.id),
    label: `RO-${o.id} — ${o.warehouse_name || o.hub_name || 'Unresolved destination'}`,
  }));
  const receiptAuthorizationOptions = receiptAuthorizations.map((ra) => ({
    value: String(ra.id),
    label: `${ra.reference_no} — ${ra.driver_name} (${ra.truck_plate_number})`,
  }));

  useEffect(() => {
    if (sourceContext !== 'receipt_order') return;
    setReceiptAuthorizationId(null);

    if (!selectedOrder) return;
    const destWarehouseId = firstWarehouseIdFromOrder(selectedOrder);
    const destinationValue = destWarehouseId != null ? String(destWarehouseId) : null;
    setDestinationWarehouseId(destinationValue);
    if (!sourceWarehouseId || sourceWarehouseId === destinationValue) {
      setSourceWarehouseId(
        pickAlternativeSourceWarehouseId(destinationValue, warehouses, userHubId) ?? null
      );
    }

    const prefillLines = orderLines(selectedOrder);
    if (prefillLines.length > 0) {
      setItems(
        prefillLines.map((ln) => ({
          commodity_id: Number(ln.commodity_id || 0),
          quantity: Number(ln.quantity || 0),
          unit_id: Number(ln.unit_id || 0),
        }))
      );
    }
  }, [sourceContext, selectedOrder, sourceWarehouseId, warehouses, userHubId]);

  useEffect(() => {
    if (sourceContext !== 'receipt_authorization') return;
    if (!selectedRA) return;

    setReferenceNo(selectedRA.waybill_number || '');
    setVehiclePlateNo(selectedRA.truck_plate_number || '');
    setDriverName(selectedRA.driver_name || '');
    setTransporterId(selectedRA.transporter_id ? String(selectedRA.transporter_id) : null);
    const destinationValue = selectedRA.warehouse_id ? String(selectedRA.warehouse_id) : null;
    setDestinationWarehouseId(destinationValue);
    if (!sourceWarehouseId || sourceWarehouseId === destinationValue) {
      setSourceWarehouseId(
        pickAlternativeSourceWarehouseId(destinationValue, warehouses, userHubId) ?? null
      );
    }

    const linkedOrder = receiptOrders.find((o) => Number(o.id) === Number(selectedRA.receipt_order_id));
    if (!linkedOrder) return;

    setReceiptOrderId(String(linkedOrder.id));
    const lines = orderLines(linkedOrder);
    if (lines.length === 0) return;

    const assignments = linkedOrder.receipt_order_assignments ?? linkedOrder.assignments ?? [];
    const linkedAssignment = assignments.find(
      (a) => Number(a.id) === Number(selectedRA.receipt_order_assignment_id)
    );
    const assignmentLine =
      linkedAssignment?.receipt_order_line_id != null
        ? lines.find((ln) => Number(ln.id) === Number(linkedAssignment.receipt_order_line_id))
        : lines[0];

    if (assignmentLine) {
      setItems([
        {
          commodity_id: Number(assignmentLine.commodity_id || 0),
          quantity: Number(selectedRA.authorized_quantity || 0),
          unit_id: Number(linkedAssignment?.quantity_unit_id || assignmentLine.unit_id || 0),
        },
      ]);
      return;
    }

    setItems(
      lines.map((ln) => ({
        commodity_id: Number(ln.commodity_id || 0),
        quantity: Number(ln.quantity || 0),
        unit_id: Number(ln.unit_id || 0),
      }))
    );
  }, [sourceContext, selectedRA, receiptOrders, sourceWarehouseId, warehouses, userHubId]);

  const currentOrder = selectedOrder || (selectedRA ? receiptOrders.find((o) => Number(o.id) === Number(selectedRA.receipt_order_id)) : undefined);
  const roTotalQty = orderLines(currentOrder).reduce((sum, ln) => sum + Number(ln.quantity || 0), 0);
  const raQty = selectedRA ? Number(selectedRA.authorized_quantity || 0) : 0;
  const draftQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const createMutation = useMutation({
    mutationFn: createWaybill,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['waybills'] });
      notifications.show({
        title: 'Success',
        message: 'Waybill created successfully',
        color: 'green',
      });
      navigate(`/waybills/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create waybill',
        color: 'red',
      });
    },
  });

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        commodity_id: 0,
        quantity: 0,
        unit_id: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof WaybillItem>(
    index: number,
    field: K,
    value: WaybillItem[K]
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleCommoditySelect = (index: number, commodityIdStr: string | null) => {
    const id = commodityIdStr ? parseInt(commodityIdStr, 10) : 0;
    const commodity = commodities.find((c) => c.id === id);
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      commodity_id: id,
      unit_id: commodity?.unit_id ?? 0,
    };
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (sourceContext === 'receipt_order' && !receiptOrderId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Select a Receipt Order for this waybill context.',
        color: 'red',
      });
      return;
    }

    if (sourceContext === 'receipt_authorization' && !receiptAuthorizationId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Select a Receipt Authorization to auto-fill waybill details.',
        color: 'red',
      });
      return;
    }

    if (!referenceNo || !issuedOn || !destinationWarehouseId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required header fields',
        color: 'red',
      });
      return;
    }
    if (sourceContext === 'manual' && !sourceWarehouseId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please select source warehouse for manual waybill flow.',
        color: 'red',
      });
      return;
    }

    if (!transporterId || !vehiclePlateNo.trim() || !driverName.trim() || !driverPhone.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all transport details',
        color: 'red',
      });
      return;
    }

    if (
      items.length === 0 ||
      items.some((item) => !item.commodity_id || !item.unit_id || !item.quantity)
    ) {
      notifications.show({
        title: 'Validation Error',
        message: 'Each line item needs a commodity, unit, and quantity.',
        color: 'red',
      });
      return;
    }

    if (sourceContext === 'manual' && sourceWarehouseId === destinationWarehouseId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Destination warehouse must differ from source warehouse.',
        color: 'red',
      });
      return;
    }

    const inferredSourceWarehouseId =
      sourceWarehouseId ||
      pickAlternativeSourceWarehouseId(destinationWarehouseId, warehouses, userHubId);
    const effectiveSourceWarehouseId = inferredSourceWarehouseId || destinationWarehouseId;
    const effectiveSourceWarehouse = warehouses.find(
      (warehouse) => String(warehouse.id) === effectiveSourceWarehouseId
    );

    if (!effectiveSourceWarehouse?.location_id || !destinationWarehouse?.location_id) {
      notifications.show({
        title: 'Validation Error',
        message: 'Selected warehouses must have valid locations before creating a waybill.',
        color: 'red',
      });
      return;
    }
    if (effectiveSourceWarehouse.location_id === destinationWarehouse.location_id) {
      notifications.show({
        title: 'Validation Error',
        message:
          'Source and destination resolved to the same location. Pick a different source warehouse.',
        color: 'red',
      });
      return;
    }

    const transport: WaybillTransport = {
      transporter_id: parseInt(transporterId, 10),
      vehicle_plate_no: vehiclePlateNo,
      driver_name: driverName,
      driver_phone: driverPhone,
    };

    createMutation.mutate({
      reference_no: referenceNo,
      issued_on: issuedOn.toISOString().split('T')[0],
      source_location_id: effectiveSourceWarehouse.location_id,
      destination_location_id: destinationWarehouse.location_id,
      source_context: sourceContext,
      dispatch_id: dispatchId ? parseInt(dispatchId) : undefined,
      status: DocumentStatus.DRAFT,
      transport,
      items,
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Create Waybill</Title>
          <Text c="dimmed" size="sm">
            Create transport document for shipment
          </Text>
        </div>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Source Context</Title>
          <SearchableSelect
            label="Waybill Source Context"
            description="Choose how to prepare this waybill: manual, from Receipt Order, or from Receipt Authorization."
            data={[
              { value: 'manual', label: 'Manual' },
              { value: 'receipt_order', label: 'From Receipt Order (RO)' },
              { value: 'receipt_authorization', label: 'From Receipt Authorization (RA)' },
            ]}
            value={sourceContext}
            onChange={(value) => {
              const ctx = (value as SourceContext | null) || 'manual';
              setSourceContext(ctx);
              if (ctx === 'manual') {
                setReceiptOrderId(null);
                setReceiptAuthorizationId(null);
              }
              if (ctx === 'receipt_order') {
                setReceiptAuthorizationId(null);
              }
            }}
            required
          />
          {(sourceContext === 'receipt_order' || sourceContext === 'receipt_authorization') && (
            <SearchableSelect
              label="Receipt Order"
              placeholder="Select receipt order"
              data={receiptOrderOptions}
              value={receiptOrderId}
              onChange={setReceiptOrderId}
              searchable
              required={sourceContext === 'receipt_order'}
              disabled={sourceContext === 'receipt_authorization' && !!selectedRA}
            />
          )}
          {sourceContext === 'receipt_authorization' && (
            <SearchableSelect
              label="Receipt Authorization"
              placeholder="Select pending/active RA"
              data={receiptAuthorizationOptions}
              value={receiptAuthorizationId}
              onChange={setReceiptAuthorizationId}
              searchable
              required
            />
          )}
          {(sourceContext === 'receipt_order' || sourceContext === 'receipt_authorization') && (
            <>
              <Divider />
              <Alert color="blue" variant="light" title="Cross-document comparison">
                {`RO quantity: ${roTotalQty.toLocaleString()} | RA quantity: ${raQty.toLocaleString()} | Current Waybill draft: ${draftQty.toLocaleString()}`}
              </Alert>
              <Alert color="yellow" variant="light" title="Inbound source logic">
                For inbound RO/RA flow from supplier/officer, Source Warehouse can be left blank. The system will use the destination location as source context for document creation.
              </Alert>
            </>
          )}

          <Divider />
          <Title order={4}>Header Information</Title>

          <Group grow>
            <TextInput
              label="Reference Number"
              placeholder="WB-2024-001"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              required
            />
            <DateInput
              label="Issued On"
              placeholder="Select date"
              value={issuedOn}
              onChange={(value) => setIssuedOn(value ? new Date(value) : null)}
              required
            />
          </Group>

          <Group grow>
            <SearchableSelect
              label="Source Warehouse"
              placeholder={sourceContext === 'manual' ? 'Select source warehouse' : 'Optional for inbound RO/RA'}
              data={sourceWarehouseOptions}
              value={sourceWarehouseId}
              onChange={setSourceWarehouseId}
              searchable
              required={sourceContext === 'manual'}
            />
            <SearchableSelect
              label="Destination Warehouse"
              placeholder="Select destination warehouse"
              data={destinationWarehouseOptions}
              value={destinationWarehouseId}
              onChange={setDestinationWarehouseId}
              searchable
              required
            />
          </Group>

          <TextInput
            label="Dispatch ID (Optional)"
            placeholder="Enter dispatch ID"
            value={dispatchId}
            onChange={(e) => setDispatchId(e.target.value)}
          />
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Transport Details</Title>

          <Group grow>
            <SearchableSelect
              label="Transporter"
              placeholder="Select transporter"
              data={transporterOptions}
              value={transporterId}
              onChange={setTransporterId}
              searchable
              required
            />
            <TextInput
              label="Vehicle Plate Number"
              placeholder="e.g., ABC-1234"
              value={vehiclePlateNo}
              onChange={(e) => setVehiclePlateNo(e.target.value)}
              required
            />
          </Group>

          <Group grow>
            <TextInput
              label="Driver Name"
              placeholder="Enter driver name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              required
            />
            <TextInput
              label="Driver Phone"
              placeholder="Enter driver phone"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              required
            />
          </Group>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Line Items</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={handleAddItem}
            >
              Add Item
            </Button>
          </Group>

          <Table.ScrollContainer minWidth={600}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th style={{ width: 50 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <SearchableSelect
                        placeholder="Select commodity"
                        data={commodityOptions}
                        value={item.commodity_id ? String(item.commodity_id) : null}
                        onChange={(value) => handleCommoditySelect(index, value)}
                        searchable
                        clearable
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Quantity"
                        value={item.quantity || ''}
                        onChange={(val) => handleItemChange(index, 'quantity', Number(val))}
                        min={0}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <SearchableSelect
                        placeholder="Unit"
                        data={unitOptions}
                        value={item.unit_id ? String(item.unit_id) : null}
                        onChange={(value) =>
                          handleItemChange(index, 'unit_id', value ? parseInt(value, 10) : 0)
                        }
                        searchable
                        clearable
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
        <Button variant="default" onClick={() => navigate('/waybills')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={createMutation.isPending}>
          Create Waybill
        </Button>
      </Group>
    </Stack>
  );
}

export default WaybillCreatePage;
