import { useState, useEffect } from 'react';
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
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
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

  // Load confirmed receipt orders for this hub
  const { data: receiptOrders = [] } = useQuery({
    queryKey: ['receipt_orders', { status: 'confirmed' }],
    queryFn: () => getReceiptOrders(),
    select: (orders) =>
      orders.filter((o) => {
        const s = String(o.status || '').toLowerCase();
        return s === 'confirmed' || s === 'assigned' || s === 'reserved';
      }),
  });

  // Load stores for the selected receipt order's warehouse
  const selectedOrder = receiptOrders.find((o) => String(o.id) === receiptOrderId);
  const warehouseId = selectedOrder?.warehouse_id;

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', { warehouse_id: warehouseId }],
    queryFn: () => getStores({ warehouse_id: warehouseId }),
    enabled: !!warehouseId,
  });

  // Load transporters
  const { data: transporters = [] } = useQuery({
    queryKey: ['reference-data', 'transporters'],
    queryFn: getTransporterReferences,
  });

  // Reset store when order changes
  useEffect(() => {
    setStoreId(null);
    setAssignmentId(null);
  }, [receiptOrderId]);

  const receiptOrderOptions = receiptOrders.map((o) => ({
    value: String(o.id),
    label: `${o.reference_no || `RO-${o.id}`} — ${o.warehouse_name || o.hub_name || 'Unknown destination'}`,
  }));

  const storeOptions = stores.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const transporterOptions = transporters.map((t) => ({
    value: String(t.id),
    label: t.name,
  }));

  // Assignments for the selected order (to cap quantity)
  const assignments = selectedOrder?.receipt_order_assignments ?? selectedOrder?.assignments ?? [];
  const assignmentOptions = assignments
    .filter((a) => a.warehouse_id != null)
    .map((a) => ({
      value: String(a.id),
      label: `${a.warehouse_name || `Warehouse #${a.warehouse_id}`} — ${Number(a.quantity ?? 0).toLocaleString()} units`,
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

          {assignmentOptions.length > 0 && (
            <Select
              label="Warehouse Assignment (optional)"
              placeholder="Select warehouse allocation"
              data={assignmentOptions}
              value={assignmentId}
              onChange={setAssignmentId}
              clearable
              description="Link this RA to a specific warehouse allocation for quantity validation"
            />
          )}

          <Select
            label="Destination Store"
            placeholder={warehouseId ? 'Select store' : 'Select a receipt order first'}
            data={storeOptions}
            value={storeId}
            onChange={setStoreId}
            searchable
            required
            disabled={!warehouseId}
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
