/**
 * DADetailPage — View a Dispatch Authorization (Hub Manager & Warehouse Manager)
 */
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack, Title, Text, Button, Group, Card, Badge, SimpleGrid,
  Table, Alert,
} from '@mantine/core';
import { IconCheck, IconTruck, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import {
  getDispatchOrderAuthorization,
  confirmDispatchOrderAuthorization,
  cancelDispatchOrderAuthorization,
  getAssignableStorekeepers,
  assignStorekeeperToDa,
} from '../../api/dispatchOrderAuthorizations';
import type { DispatchOrderAuthorization } from '../../api/dispatchOrderAuthorizations';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import type { ApiError } from '../../types/common';

function statusColor(status: DispatchOrderAuthorization['status']) {
  switch (status) {
    case 'draft':     return 'yellow';
    case 'confirmed': return 'blue';
    case 'cancelled': return 'red';
    default:          return 'gray';
  }
}

export default function DADetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const location  = useLocation();
  const queryClient = useQueryClient();
  const roleSlug = normalizeRoleSlug(
    useAuthStore((s) => s.activeAssignment?.role_name || s.role)
  );
  const isAdmin = roleSlug === 'admin' || roleSlug === 'superadmin';
  const isHubManager       = roleSlug === 'hub_manager';
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const isStorekeeper      = roleSlug === 'storekeeper';

  const basePath = location.pathname.startsWith('/warehouse')
    ? '/warehouse/dispatch-authorizations'
    : '/hub/dispatch-authorizations';

  const { data: dao, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_order_authorizations', id],
    queryFn: () => getDispatchOrderAuthorization(Number(id)),
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmDispatchOrderAuthorization(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations'] });
      notifications.show({ title: 'Confirmed', message: 'Dispatch Authorization confirmed.', color: 'green' });
      refetch();
    },
    onError: (e: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<ApiError>(e) ? e.response?.data?.error?.message : undefined) || 'Failed to confirm',
        color: 'red',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelDispatchOrderAuthorization(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations'] });
      notifications.show({ title: 'Cancelled', message: 'Dispatch Authorization cancelled.', color: 'orange' });
      refetch();
    },
    onError: (e: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<ApiError>(e) ? e.response?.data?.error?.message : undefined) || 'Failed to cancel',
        color: 'red',
      });
    },
  });

  const [selectedStorekeeperId, setSelectedStorekeeperId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);

  // Load assignable storekeepers if we have a warehouse_id
  const { data: assignableStorekeepers = [], isLoading: storekeepersLoading } = useQuery({
    queryKey: ['dispatch_order_assignable_storekeepers', dao?.warehouse_id],
    queryFn: () => getAssignableStorekeepers(dao!.warehouse_id),
    enabled: !!dao?.warehouse_id && (isAdmin || isWarehouseManager),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignStorekeeperToDa(Number(id), {
        storekeeper_user_id: Number(selectedStorekeeperId),
        store_id: selectedStoreId ? Number(selectedStoreId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations'] });
      notifications.show({ title: 'Success', message: 'Storekeeper assigned.', color: 'green' });
      setShowReassign(false);
      refetch();
    },
    onError: (e: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<ApiError>(e) ? e.response?.data?.error?.message : undefined) || 'Failed to assign',
        color: 'red',
      });
    },
  });

  if (isLoading) return <LoadingState message="Loading Dispatch Authorization…" />;
  if (error || !dao) return <ErrorState message="Failed to load Dispatch Authorization." onRetry={refetch} />;

  const canConfirm = dao.status === 'draft' && (isAdmin || isHubManager || isWarehouseManager);
  const canCancel  = dao.status === 'draft' && (isAdmin || isHubManager || isWarehouseManager);

  const directToStorekeepers = !!dao.direct_to_storekeepers;
  const canManageAssignment =
    (isAdmin || isWarehouseManager) &&
    !directToStorekeepers &&
    (dao.status === 'draft' || dao.status === 'confirmed');
  const awaitingAssignment = !!dao.awaiting_storekeeper_assignment;
  const showAssignBlock = canManageAssignment && (awaitingAssignment || showReassign);
  const canReassign = canManageAssignment && !awaitingAssignment && !!dao.assigned_storekeeper_id;

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

  const displayQty = Number(dao.authorized_quantity_input ?? dao.authorized_quantity);
  const displayUnit = dao.authorized_quantity_input_unit_abbreviation
    || dao.authorized_quantity_input_unit_name || '';
  const canonicalUnit = displayUnit; // simplified; could differ

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Group gap="sm" align="center">
            <Title order={2}>Dispatch Authorization</Title>
            <Badge color={statusColor(dao.status)} size="lg" variant="light">
              {dao.status.charAt(0).toUpperCase() + dao.status.slice(1)}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>
            {dao.reference_no || `DA-${dao.id}`}
          </Text>
        </div>
        <Group>
          <Button variant="default" onClick={() => navigate(basePath)}>← Back</Button>
          {canCancel && (
            <Button color="red" variant="light"
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}>
              Cancel
            </Button>
          )}
          {canConfirm && (
            <Button leftSection={<IconCheck size={16} />}
              loading={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}>
              Confirm Authorization
            </Button>
          )}
        </Group>
      </Group>

      {dao.status === 'draft' && (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
          This authorization is in Draft. Review the details and click "Confirm Authorization" to activate it.
        </Alert>
      )}
      {dao.status === 'confirmed' && (
        <Alert color="green" icon={<IconCheck size={16} />}>
          Authorization confirmed on{' '}
          {dao.confirmed_at ? new Date(dao.confirmed_at).toLocaleString() : '—'}
          {dao.confirmed_by_name ? ` by ${dao.confirmed_by_name}` : ''}.
        </Alert>
      )}

      {/* Dispatch Order & Warehouse */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={700} size="sm" tt="uppercase" c="dimmed">Dispatch Order & Source</Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <div>
              <Text size="xs" c="dimmed">Dispatch Order</Text>
              <Text fw={600}>{dao.dispatch_order_reference_no || `DO-${dao.dispatch_order_id}`}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Source Warehouse</Text>
              <Text fw={600}>{dao.warehouse_name || `Warehouse #${dao.warehouse_id}`}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Commodity</Text>
              <Text fw={600}>{dao.commodity_name || '—'}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Authorized Quantity</Text>
              <Text fw={700} size="lg">
                {displayQty.toLocaleString()}{displayUnit ? ` ${displayUnit}` : ''}
              </Text>
              {displayUnit && displayUnit !== canonicalUnit && (
                <Text size="xs" c="dimmed">
                  = {Number(dao.authorized_quantity).toLocaleString()} {canonicalUnit}
                </Text>
              )}
            </div>
            <div>
              <Text size="xs" c="dimmed">Created by</Text>
              <Text fw={600}>{dao.created_by_name || '—'}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Created on</Text>
              <Text fw={600}>{new Date(dao.created_at).toLocaleDateString()}</Text>
            </div>
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Transport */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="sm">
          <Group gap="xs">
            <IconTruck size={18} />
            <Text fw={700} size="sm" tt="uppercase" c="dimmed">Vehicle & Driver</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <div>
              <Text size="xs" c="dimmed">Transporter</Text>
              <Text fw={600}>{dao.transporter_name || '—'}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Driver Name</Text>
              <Text fw={600}>{dao.driver_name}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Driver ID</Text>
              <Text fw={600}>{dao.driver_id_number}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Driver Phone</Text>
              <Text fw={600}>{dao.driver_phone || '—'}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Plate Number</Text>
              <Text fw={600} style={{ fontFamily: 'monospace' }}>{dao.truck_plate_number}</Text>
            </div>
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Storekeeper Assignment */}
      {(isWarehouseManager || isAdmin) && directToStorekeepers && (
        <Alert color="teal" icon={<IconTruck size={16} />}>
          This warehouse has a single store. All storekeepers were notified automatically — no manual assignment is required.
        </Alert>
      )}

      {(isWarehouseManager || isAdmin) && !directToStorekeepers && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="sm">
            <Text fw={700} size="sm" tt="uppercase" c="dimmed">
              Store assignment
            </Text>
            {!awaitingAssignment && dao.assigned_storekeeper_name && !showReassign && (
              <Group justify="space-between">
                <Text>
                  Assigned to <strong>{dao.assigned_storekeeper_name}</strong>
                  {dao.assigned_storekeeper_at
                    ? ` on ${new Date(dao.assigned_storekeeper_at).toLocaleString()}`
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
                <SearchableSelect
                  label="Storekeeper"
                  placeholder={storekeepersLoading ? 'Loading…' : 'Select storekeeper'}
                  data={storekeeperOptions}
                  value={selectedStorekeeperId}
                  onChange={setSelectedStorekeeperId}
                  searchable
                  disabled={storekeepersLoading || storekeeperOptions.length === 0}
                />
                {storeOptions.length > 0 && (
                  <SearchableSelect
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
                    {awaitingAssignment ? 'Assign store' : 'Save assignment'}
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

      {/* Store Allocations */}
      {dao.authorization_stores && dao.authorization_stores.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="sm">
            <Text fw={700} size="sm" tt="uppercase" c="dimmed">Store Allocations</Text>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Store</Table.Th>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Authorized</Table.Th>
                  <Table.Th>Dispatched</Table.Th>
                  <Table.Th>Remaining</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dao.authorization_stores.map((s) => (
                  <Table.Tr key={s.id ?? `${s.store_id}-${s.commodity_id}`}>
                    <Table.Td>{s.store_name || `Store #${s.store_id}`}</Table.Td>
                    <Table.Td>{s.commodity_name || `Commodity #${s.commodity_id}`}</Table.Td>
                    <Table.Td>{Number(s.authorized_quantity).toLocaleString()}</Table.Td>
                    <Table.Td>{Number(s.dispatched_quantity ?? 0).toLocaleString()}</Table.Td>
                    <Table.Td>{Number(s.remaining_quantity ?? s.authorized_quantity).toLocaleString()}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
