import { useState, useEffect, useMemo } from 'react';
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
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  createReceiptAuthorization,
} from '../../api/receiptAuthorizations';
import { getReceiptOrders } from '../../api/receiptOrders';
import { getStores } from '../../api/stores';
import { getTransporterReferences } from '../../api/referenceData';
import { useAuthStore } from '../../store/authStore';
import type { ApiError } from '../../types/common';

export default function ReceiptAuthorizationFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const userHubId = activeAssignment?.hub?.id;

  // Form state
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [transporterId, setTransporterId] = useState<string | null>(null);
  const [authorizedQuantity, setAuthorizedQuantity] = useState<number | string>('');
  const [driverName, setDriverName] = useState('');
  const [driverIdNumber, setDriverIdNumber] = useState('');
  const [truckPlateNumber, setTruckPlateNumber] = useState('');
  const [waybillNumber, setWaybillNumber] = useState('');

  // Load confirmed receipt orders — filtered to this hub's orders
  const { data: receiptOrders = [] } = useQuery({
    queryKey: ['receipt_orders', { hub_id: userHubId }],
    queryFn: () => getReceiptOrders(),
    select: (orders) =>
      orders.filter((o) => {
        const s = String(o.status || '').toLowerCase();
        const validStatus = s === 'confirmed' || s === 'assigned' || s === 'reserved' || s === 'in_progress';
        const matchesHub = !userHubId || Number(o.hub_id) === Number(userHubId);
        return validStatus && matchesHub;
      }),
  });

  const selectedOrder = receiptOrders.find((o) => String(o.id) === receiptOrderId);

  // Warehouse-level assignments on the selected order
  const assignments = useMemo(() => {
    const raw = selectedOrder?.receipt_order_assignments ?? selectedOrder?.assignments ?? [];
    return raw.filter((a: any) => a.warehouse_id != null);
  }, [selectedOrder]);

  const selectedAssignment = useMemo(
    () => assignments.find((a: any) => String(a.id) === assignmentId),
    [assignments, assignmentId]
  );

  // Resolve warehouse for store loading:
  // 1. From selected assignment's warehouse_id (hub orders)
  // 2. From order's direct warehouse_id (standalone warehouse orders)
  // 3. Auto-use if only one assignment exists
  const warehouseIdForStores = useMemo(() => {
    if (selectedAssignment?.warehouse_id) return Number(selectedAssignment.warehouse_id);
    if (selectedOrder?.warehouse_id) return Number(selectedOrder.warehouse_id);
    if (assignments.length === 1) return Number((assignments[0] as any).warehouse_id);
    return null;
  }, [selectedAssignment, selectedOrder, assignments]);

  // Auto-select assignment when there's only one
  useEffect(() => {
    if (assignments.length === 1 && !assignmentId) {
      setAssignmentId(String((assignments[0] as any).id));
    }
  }, [assignments, assignmentId]);

  const { data: stores = [], isFetching: storesLoading } = useQuery({
    queryKey: ['stores', { warehouse_id: warehouseIdForStores }],
    queryFn: () => getStores({ warehouse_id: warehouseIdForStores! }),
    enabled: !!warehouseIdForStores,
  });

  // Load transporters
  const { data: transporters = [] } = useQuery({
    queryKey: ['reference-data', 'transporters'],
    queryFn: getTransporterReferences,
  });

  // Reset downstream fields when order changes
  useEffect(() => {
    setStoreId(null);
    setAssignmentId(null);
    setAuthorizedQuantity('');
  }, [receiptOrderId]);

  // Reset store when assignment changes
  useEffect(() => {
    setStoreId(null);
  }, [assignmentId]);

  const receiptOrderOptions = receiptOrders.map((o) => ({
    value: String(o.id),
    label: `${o.reference_no || `RO-${o.id}`} — ${o.hub_name || o.warehouse_name || 'Unknown destination'}`,
  }));

  const assignmentOptions = assignments.map((a: any) => ({
    value: String(a.id),
    label: `${a.warehouse_name || `Warehouse #${a.warehouse_id}`} — ${Number(a.quantity ?? 0).toLocaleString()} units`,
  }));

  const storeOptions = stores.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const transporterOptions = transporters.map((t) => ({
    value: String(t.id),
    label: t.name,
  }));

  const createMutation = useMutation({
    mutationFn: () => {
      if (!receiptOrderId || !storeId || !transporterId || !authorizedQuantity || !driverName || !driverIdNumber || !truckPlateNumber || !waybillNumber) {
        throw new Error('Please fill in all required fields');
      }
      return createReceiptAuthorization({
        receipt_order_id: Number(receiptOrderId),
        receipt_order_assignment_id: assignmentId ? Number(assignmentId) : null,
        store_id: Number(storeId),
        transporter_id: Number(transporterId),
        authorized_quantity: Number(authorizedQuantity),
        driver_name: driverName.trim(),
        driver_id_number: driverIdNumber.trim(),
        truck_plate_number: truckPlateNumber.trim(),
        waybill_number: waybillNumber.trim(),
      });
    },
    onSuccess: (ra) => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      notifications.show({
        title: 'Receipt Authorization Created',
        message: `${ra.reference_no} created. Storekeeper has been notified.`,
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
            Create one Receipt Authorization per truck. The Storekeeper of the destination store will be notified automatically.
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

          {/* Warehouse Assignment — required when order has multiple hub assignments */}
          {receiptOrderId && assignments.length > 1 && (
            <Select
              label="Warehouse Assignment"
              placeholder="Select which warehouse this truck is delivering to"
              data={assignmentOptions}
              value={assignmentId}
              onChange={setAssignmentId}
              required
              description="Select the warehouse allocation for this truck"
            />
          )}

          {/* Show single assignment as read-only info */}
          {receiptOrderId && assignments.length === 1 && (
            <Text size="sm" c="dimmed">
              Warehouse: <strong>{(assignments[0] as any).warehouse_name || `Warehouse #${(assignments[0] as any).warehouse_id}`}</strong> — {Number((assignments[0] as any).quantity ?? 0).toLocaleString()} units allocated
            </Text>
          )}

          <Select
            label="Destination Store"
            placeholder={
              !receiptOrderId
                ? 'Select a receipt order first'
                : assignments.length > 1 && !assignmentId
                ? 'Select a warehouse assignment first'
                : storesLoading
                ? 'Loading stores…'
                : storeOptions.length === 0 && warehouseIdForStores
                ? 'No stores found for this warehouse'
                : 'Select store'
            }
            data={storeOptions}
            value={storeId}
            onChange={setStoreId}
            searchable
            required
            disabled={!warehouseIdForStores || storesLoading}
          />

          <NumberInput
            label="Authorized Quantity"
            placeholder="e.g. 500"
            value={authorizedQuantity}
            onChange={setAuthorizedQuantity}
            min={0.001}
            decimalScale={3}
            required
            description="Quantity on this specific truck"
          />

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
            <TextInput
              label="Waybill Number"
              placeholder="Transport waybill reference"
              value={waybillNumber}
              onChange={(e) => setWaybillNumber(e.target.value)}
              required
            />
          </Group>

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => navigate('/hub/receipt-authorizations')}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
            >
              Create Receipt Authorization
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
