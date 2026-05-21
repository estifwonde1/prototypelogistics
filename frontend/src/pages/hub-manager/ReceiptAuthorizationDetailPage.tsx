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
  Alert,
  Select,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconTruck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  getReceiptAuthorization,
  cancelReceiptAuthorization,
  driverConfirm,
  getAssignableStorekeepers,
  assignStorekeeperToRa,
} from '../../api/receiptAuthorizations';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { receiptAuthorizationBasePath } from '../../utils/receiptAuthorizationPaths';
import { useWarehouseManagerRaAccess } from '../../hooks/useWarehouseManagerRaAccess';
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

function raDisplayUnit(ra: ReceiptAuthorization): string {
  const inputName = (ra.authorized_quantity_input_unit_name ?? '').trim();
  const inputAbbr = (ra.authorized_quantity_input_unit_abbreviation ?? '').trim();
  return inputName || inputAbbr || (ra.unit_label ?? ra.unit_name ?? ra.unit_abbreviation ?? '').trim();
}

function raLineUnit(ra: ReceiptAuthorization): string {
  return (ra.unit_label ?? ra.unit_name ?? ra.unit_abbreviation ?? '').trim();
}

function raDisplayQty(ra: ReceiptAuthorization): number {
  const v = ra.authorized_quantity_input;
  if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) return Number(v);
  return Number(ra.authorized_quantity);
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
  const { canCreateRa: wmCanCreateRa } = useWarehouseManagerRaAccess();
  const [selectedStorekeeperId, setSelectedStorekeeperId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);

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

  const warehouseIdForAssign = ra?.warehouse_id;

  const { data: assignableStorekeepers = [], isLoading: storekeepersLoading } = useQuery({
    queryKey: ['assignable_storekeepers', warehouseIdForAssign],
    queryFn: () => getAssignableStorekeepers(warehouseIdForAssign!),
    enabled: isWM && !!warehouseIdForAssign && !!ra,
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignStorekeeperToRa(Number(id), {
        storekeeper_user_id: Number(selectedStorekeeperId),
        ...(selectedStoreId ? { store_id: Number(selectedStoreId) } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations', id] });
      setSelectedStorekeeperId(null);
      setSelectedStoreId(null);
      setShowReassign(false);
      notifications.show({
        title: 'Storekeeper assigned',
        message: 'The assigned storekeeper has been notified.',
        color: 'green',
      });
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to assign storekeeper',
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

  const canCancel =
    ra.status === 'pending' &&
    !ra.inspection_id &&
    (isAdmin || isHubManager || (isWM && wmCanCreateRa));
  const directToStorekeepers = !!ra.direct_to_storekeepers;
  const canManageAssignment =
    isWM &&
    !directToStorekeepers &&
    (ra.status === 'pending' || ra.status === 'active') &&
    !ra.inspection_id;
  const awaitingAssignment = !!ra.awaiting_storekeeper_assignment;
  const showAssignBlock =
    canManageAssignment && (awaitingAssignment || showReassign);
  const canReassign =
    canManageAssignment && !awaitingAssignment && !!ra.assigned_storekeeper_id;
  const storekeeperOptions = assignableStorekeepers.map((sk) => ({
    value: String(sk.id),
    label: sk.store_name ? `${sk.name} (${sk.store_name})` : sk.name,
  }));
  const storeOptions = Array.from(
    new Map(
      assignableStorekeepers
        .filter((sk) => sk.store_id != null)
        .map((sk) => [String(sk.store_id), sk.store_name || `Store #${sk.store_id}`])
    ).entries()
  ).map(([value, label]) => ({ value, label }));
  const canDriverConfirm = (isStorekeeper || isAdmin) && ra.status === 'active' && !ra.driver_confirmed_at;
  const backPath = isStorekeeper
    ? '/storekeeper/assignments'
    : receiptAuthorizationBasePath(roleSlug);

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

      {isWM && directToStorekeepers && (
        <Alert color="teal" icon={<IconTruck size={16} />}>
          This warehouse has a single store. All storekeepers were notified automatically — no manual assignment is required.
        </Alert>
      )}

      {isWM && !directToStorekeepers && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="sm">
            <Text fw={700} size="sm" tt="uppercase" c="dimmed">
              Storekeeper assignment
            </Text>
            {!awaitingAssignment && ra.assigned_storekeeper_name && !showReassign && (
              <Group justify="space-between">
                <Text>
                  Assigned to <strong>{ra.assigned_storekeeper_name}</strong>
                  {ra.assigned_storekeeper_at
                    ? ` on ${new Date(ra.assigned_storekeeper_at).toLocaleString()}`
                    : ''}
                </Text>
                {canReassign && (
                  <Button variant="light" size="xs" onClick={() => setShowReassign(true)}>
                    Reassign
                  </Button>
                )}
              </Group>
            )}
            {showAssignBlock && (
              <Stack gap="xs">
                <Select
                  label="Storekeeper"
                  placeholder={storekeepersLoading ? 'Loading…' : 'Select storekeeper'}
                  data={storekeeperOptions}
                  value={selectedStorekeeperId}
                  onChange={setSelectedStorekeeperId}
                  searchable
                  disabled={storekeepersLoading || storekeeperOptions.length === 0}
                />
                {storeOptions.length > 0 && (
                  <Select
                    label="Store (optional)"
                    placeholder="Use storekeeper default"
                    data={storeOptions}
                    value={selectedStoreId}
                    onChange={setSelectedStoreId}
                    clearable
                  />
                )}
                <Group>
                  <Button
                    onClick={() => assignMutation.mutate()}
                    loading={assignMutation.isPending}
                    disabled={!selectedStorekeeperId}
                  >
                    {awaitingAssignment ? 'Assign storekeeper' : 'Save assignment'}
                  </Button>
                  {!awaitingAssignment && (
                    <Button variant="default" onClick={() => setShowReassign(false)}>
                      Cancel
                    </Button>
                  )}
                </Group>
              </Stack>
            )}
          </Stack>
        </Card>
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
              <Text fw={600}>{ra.store_name || (ra.store_id != null ? `Store #${ra.store_id}` : 'Not set yet')}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Authorized Quantity</Text>
              <Text fw={700} size="lg">
                {raDisplayQty(ra).toLocaleString()} {raDisplayUnit(ra)}
              </Text>
              {raDisplayUnit(ra) && raLineUnit(ra) && raDisplayUnit(ra) !== raLineUnit(ra) ? (
                <Text size="xs" c="dimmed">
                  = {Number(ra.authorized_quantity).toLocaleString()} {raLineUnit(ra)}
                </Text>
              ) : null}
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
              <Text size="xs" c="dimmed">Waybill</Text>
              <Text fw={600} style={{ fontFamily: 'monospace' }}>{ra.waybill_number || '—'}</Text>
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
