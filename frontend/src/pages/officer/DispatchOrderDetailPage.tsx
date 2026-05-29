import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Button,
  Group,
  Card,
  Table,
  Text,
  SimpleGrid,
  Dialog,
  Tabs,
  Select,
  Textarea,
  NumberInput,
  Alert,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  getDispatchOrder,
  confirmDispatchOrder,
  deleteDispatchOrder,
  assignDispatchOrder,
  reserveStock,
  getDispatchOrderWorkflowPayload,
  postDispatchOrderReceive,
} from '../../api/dispatchOrders';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ScopeBadge } from '../../components/common/ScopeBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { AssignmentCard } from '../../components/common/AssignmentCard';
import { ReservationCard } from '../../components/common/ReservationCard';
import { WorkflowTimeline } from '../../components/common/WorkflowTimeline';
import type { ApiError } from '../../types/common';
import { useState } from 'react';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import type { DispatchOrderLineV2 } from '../../types/dispatchV2';
import {
  formatDestinationAllocations,
  formatSourceAllocations,
} from '../../utils/dispatchAllocations';
import { getDispatchOrderReference } from '../../utils/dispatchOrderReference';

function DispatchOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const roleSlug = normalizeRoleSlug(useAuthStore((s) => s.role));
  const warehouseIdAssignment = useAuthStore((s) => s.activeAssignment?.warehouse?.id);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('details');
  
  // Assignment form state
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  
  // Stock reservation form state
  const [showStockReservationForm, setShowStockReservationForm] = useState(false);
  const [selectedCommodityId, setSelectedCommodityId] = useState<string | null>(null);
  const [reservedQuantity, setReservedQuantity] = useState<number>(0);
  const [stockReservationNotes, setStockReservationNotes] = useState('');
  const [receivingKey, setReceivingKey] = useState<string | null>(null);

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_orders', id],
    queryFn: () => getDispatchOrder(Number(id)),
  });

  const { data: workflowPayload } = useQuery({
    queryKey: ['dispatch_orders', id, 'workflow'],
    queryFn: () => getDispatchOrderWorkflowPayload(Number(id)),
    enabled: !!order,
  });
  const workflowEvents = workflowPayload?.workflow_events ?? [];

  const confirmMutation = useMutation({
    mutationFn: () => confirmDispatchOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders', 'awaiting_authorization'] });

      const v2 = (order?.dispatch_order_lines ?? []).some(
        (l) => (l.source_allocations?.length ?? 0) > 0
      );
      notifications.show({
        title: 'Order confirmed',
        message: v2
          ? 'Dispatch order confirmed and approved. Source warehouse managers can create authorizations.'
          : 'Dispatch order confirmed successfully',
        color: 'green',
      });
      setConfirmDialogOpen(false);
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to confirm Dispatch Order',
        color: 'red',
      });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (row: {
      key: string;
      warehouse_id: number;
      commodity_id: number;
      quantity: number;
      unit_id: number;
      packaging_unit_id?: number | null;
      packaging_size?: number | null;
    }) => {
      setReceivingKey(row.key);
      return postDispatchOrderReceive(Number(id), {
        warehouse_id: row.warehouse_id,
        commodity_id: row.commodity_id,
        quantity: row.quantity,
        unit_id: row.unit_id,
        packaging_unit_id: row.packaging_unit_id ?? undefined,
        packaging_size: row.packaging_size ?? undefined,
      });
    },
    onSuccess: (data) => {
      setReceivingKey(null);
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders', id] });
      notifications.show({
        title: 'Received',
        message: `Packaging transaction #${data.packaging_transaction_id}`,
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      setReceivingKey(null);
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Receive failed',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDispatchOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Dispatch Order deleted successfully',
        color: 'green',
      });
      navigate('/officer/dispatch-orders');
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to delete Dispatch Order',
        color: 'red',
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (payload: any) => assignDispatchOrder(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders', id] });
      notifications.show({
        title: 'Success',
        message: 'Assignment created successfully',
        color: 'green',
      });
      setShowAssignmentForm(false);
      setSelectedUserId(null);
      setAssignmentNotes('');
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create assignment',
        color: 'red',
      });
    },
  });

  const reserveStockMutation = useMutation({
    mutationFn: (payload: any) => reserveStock(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders', id] });
      notifications.show({
        title: 'Success',
        message: 'Stock reservation created successfully',
        color: 'green',
      });
      setShowStockReservationForm(false);
      setSelectedCommodityId(null);
      setReservedQuantity(0);
      setStockReservationNotes('');
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create stock reservation',
        color: 'red',
      });
    },
  });

  const handleCreateAssignment = () => {
    if (!selectedUserId) {
      notifications.show({
        title: 'Error',
        message: 'Please select a user to assign',
        color: 'red',
      });
      return;
    }
    assignMutation.mutate({
      assignments: [{
        assigned_to_id: Number(selectedUserId),
        notes: assignmentNotes,
      }],
    });
  };

  const handleCreateStockReservation = () => {
    if (!selectedCommodityId || !reservedQuantity) {
      notifications.show({
        title: 'Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }
    reserveStockMutation.mutate({
      reservations: [{
        commodity_id: Number(selectedCommodityId),
        reserved_quantity: reservedQuantity,
        notes: stockReservationNotes,
      }],
    });
  };

  if (isLoading) {
    return <LoadingState message="Loading Dispatch Order..." />;
  }

  if (error || !order) {
    return (
      <ErrorState
        message="Failed to load Dispatch Order. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const isLoading_ =
    confirmMutation.isPending ||
    deleteMutation.isPending ||
    assignMutation.isPending ||
    reserveStockMutation.isPending ||
    receiveMutation.isPending;
  const assignments = order.assignments || [];
  const stockReservations = order.stock_reservations || [];
  const isV2 = (order.dispatch_order_lines ?? []).some(
    (l) => (l.source_allocations?.length ?? 0) > 0
  );
  const dispatchRef = getDispatchOrderReference(order);
  const statusLower = String(order.status || '').toLowerCase();
  const isDraft = statusLower === 'draft';
  const isConfirmed = statusLower === 'confirmed';
  const canDestroy =
    order.can_destroy ??
    ((order.dispatch_order_authorizations?.length ?? 0) === 0 && can('dispatch_orders', 'delete'));
  const canCreateGin = !isV2 && can('gins', 'create') && !isDraft;
  const isManagerRole = roleSlug === 'warehouse_manager' || roleSlug === 'hub_manager';
  const v2Lines = (order.dispatch_order_lines || []) as DispatchOrderLineV2[];


  type ReceiveRow = {
    key: string;
    warehouse_id: number;
    warehouse_label: string;
    commodity_id: number;
    commodity_name: string;
    quantity: number;
    unit_id: number;
    unit_name?: string;
    packaging_unit_id?: number | null;
    packaging_size?: number | null;
  };

  const receiveRows: ReceiveRow[] = (() => {
    const rows: ReceiveRow[] = [];
    v2Lines.forEach((line) => {
      (line.destination_allocations ?? []).forEach((dest) => {
        const warehouseId = dest.destination_warehouse_id;
        if (!warehouseId) return;
        rows.push({
          key: `${line.commodity_id}-${warehouseId}-${dest.id ?? dest.destination_location_id}`,
          warehouse_id: warehouseId,
          warehouse_label:
            dest.destination_label ??
            dest.destination_warehouse_name ??
            `Warehouse #${warehouseId}`,
          commodity_id: line.commodity_id,
          commodity_name: line.commodity_name ?? `Commodity ${line.commodity_id}`,
          quantity: dest.quantity,
          unit_id: dest.unit_id,
          unit_name: dest.unit_name,
          packaging_unit_id: line.packaging_unit_id,
          packaging_size: line.packaging_size,
        });
      });
    });
    if (isManagerRole && warehouseIdAssignment) {
      return rows.filter((row) => row.warehouse_id === warehouseIdAssignment);
    }
    return rows;
  })();

  const showReceiveSection =
    order.exchange_order && can('dispatch_orders', 'read') && !isDraft && receiveRows.length > 0;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Group gap="sm" align="center">
            <Title order={2}>Dispatch Order {dispatchRef}</Title>
            <ScopeBadge locationName={order.location_name} hierarchicalLevel={order.hierarchical_level} />
          </Group>
          <Text c="dimmed" size="sm">
            Created on {new Date(order.created_at).toLocaleDateString()}
            {isV2 && order.exchange_order ? ' · Exchange order' : ''}
          </Text>
        </div>
        <Group gap="sm">
          {canCreateGin && (
            <Button
              size="sm"
              variant="light"
              onClick={() => navigate(`/gins/new?dispatch_order_id=${order.id}`)}
            >
              Create GIN
            </Button>
          )}
          <StatusBadge status={order.status} />
        </Group>
      </Group>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'details')}>
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          {!isV2 && !isDraft && (
            <>
              <Tabs.Tab value="assignments">Assignments</Tabs.Tab>
              <Tabs.Tab value="stock-reservations">Stock Reservations</Tabs.Tab>
            </>
          )}
          <Tabs.Tab value="workflow">Workflow Timeline</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <Stack gap="md">
            {isV2 ? (
              <>
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="md">
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                          Status
                        </Text>
                        <Text size="sm" fw={600} mt="xs">
                          {order.status_label || order.status}
                        </Text>
                      </div>
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                          Description
                        </Text>
                        <Text size="sm" fw={600} mt="xs">
                          {order.description || order.notes || '—'}
                        </Text>
                      </div>
                      {!isDraft && order.confirmed_at && (
                        <div>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Confirmed
                          </Text>
                          <Text size="sm" mt="xs">
                            {new Date(order.confirmed_at).toLocaleString()}
                            {order.confirmed_by_name ? ` · ${order.confirmed_by_name}` : ''}
                          </Text>
                        </div>
                      )}
                      {!isDraft && order.approved_at && (
                        <div>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Approved
                          </Text>
                          <Text size="sm" mt="xs">
                            {new Date(order.approved_at).toLocaleString()}
                            {order.approved_by_name ? ` · ${order.approved_by_name}` : ''}
                          </Text>
                        </div>
                      )}
                    </SimpleGrid>
                  </Stack>
                </Card>



                <div>
                  <Text size="sm" fw={600} mb="md">
                    Lines and allocations
                  </Text>
                  <Table.ScrollContainer minWidth={800}>
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Commodity</Table.Th>
                          <Table.Th>Qty</Table.Th>
                          <Table.Th>Sources</Table.Th>
                          <Table.Th>Destinations</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {v2Lines.map((line) => (
                          <Table.Tr key={line.id ?? `${line.commodity_id}-${line.quantity}`}>
                            <Table.Td>{line.commodity_name ?? line.commodity_id}</Table.Td>
                            <Table.Td>
                              {line.quantity} ({line.unit_name ?? line.unit_id})
                            </Table.Td>
                            <Table.Td>{formatSourceAllocations(line)}</Table.Td>
                            <Table.Td>{formatDestinationAllocations(line)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </div>

                {showReceiveSection && (
                  <Card withBorder padding="md">
                    <Text fw={600} mb="sm">
                      Exchange receive (destination warehouses)
                    </Text>
                    <Stack gap="sm">
                      {receiveRows.map((row) => (
                        <Group key={row.key} justify="space-between" align="flex-end" wrap="nowrap">
                          <div style={{ flex: 1 }}>
                            <Text size="sm" fw={600}>
                              {row.warehouse_label}
                            </Text>
                            <Text size="sm" c="dimmed">
                              {row.commodity_name}: {row.quantity}
                              {row.unit_name ? ` ${row.unit_name}` : ''}
                            </Text>
                          </div>
                          <Button
                            loading={receiveMutation.isPending && receivingKey === row.key}
                            disabled={receiveMutation.isPending && receivingKey !== row.key}
                            onClick={() => receiveMutation.mutate(row)}
                          >
                            Receive at warehouse
                          </Button>
                        </Group>
                      ))}
                    </Stack>
                  </Card>
                )}

              </>
            ) : (
              <>
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Stack gap="md">
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                          Source Warehouse
                        </Text>
                        <Text size="sm" fw={600} mt="xs">
                          {order.source_warehouse_name || 'N/A'}
                        </Text>
                      </div>
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                          Destination
                        </Text>
                        <Text size="sm" fw={600} mt="xs">
                          {order.destination_type} - {order.destination_name}
                        </Text>
                      </div>
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                          Expected Pickup
                        </Text>
                        <Text size="sm" fw={600} mt="xs">
                          {order.expected_pickup_date
                            ? new Date(order.expected_pickup_date).toLocaleDateString()
                            : '—'}
                        </Text>
                      </div>
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                          Status
                        </Text>
                        <Text size="sm" fw={600} mt="xs">
                          {order.status}
                        </Text>
                      </div>
                    </SimpleGrid>
                    {order.notes && (
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                          Notes
                        </Text>
                        <Text size="sm" mt="xs">
                          {order.notes}
                        </Text>
                      </div>
                    )}
                  </Stack>
                </Card>

                <div>
                  <Text size="sm" fw={600} mb="md">
                    Order Items
                  </Text>
                  <Table.ScrollContainer minWidth={600}>
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Commodity</Table.Th>
                          <Table.Th>Quantity</Table.Th>
                          <Table.Th>Unit</Table.Th>
                          <Table.Th>Notes</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {order.lines?.map((line, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>{line.commodity_id}</Table.Td>
                            <Table.Td>{line.quantity}</Table.Td>
                            <Table.Td>{line.unit_id}</Table.Td>
                            <Table.Td>{line.notes || '-'}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </div>
              </>
            )}

            <Group justify="flex-end">
              {isDraft && (
                <>
                  {!isV2 && (
                    <Button
                      variant="light"
                      onClick={() => navigate(`/officer/dispatch-orders/${order.id}/edit`)}
                    >
                      Edit
                    </Button>
                  )}
                  {isV2 && (
                    <Button
                      variant="light"
                      onClick={() => navigate(`/officer/dispatch-orders/${order.id}/edit`)}
                    >
                      Edit draft (v2)
                    </Button>
                  )}
                  {(isV2 ? order.can_confirm : true) && (
                    <Button onClick={() => setConfirmDialogOpen(true)} loading={isLoading_}>
                      {isV2 ? 'Confirm order' : 'Confirm Order'}
                    </Button>
                  )}
                </>
              )}
              {canDestroy && (
                <Button
                  color="red"
                  variant="light"
                  onClick={() => {
                    const label = getDispatchOrderReference(order);
                    if (
                      window.confirm(
                        `Remove dispatch order ${label}?`
                      )
                    ) {
                      deleteMutation.mutate();
                    }
                  }}
                  loading={isLoading_}
                >
                  {isDraft ? 'Delete' : 'Remove order'}
                </Button>
              )}
              {!isDraft && (
                <Button variant="light" onClick={() => navigate('/officer/dispatch-orders')}>
                  Back to List
                </Button>
              )}
            </Group>
          </Stack>
        </Tabs.Panel>

        {!isV2 && (
          <>
            <Tabs.Panel value="assignments" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>Warehouse Assignments</Text>
              {order.status === 'Confirmed' && (
                <Button
                  size="sm"
                  onClick={() => setShowAssignmentForm(true)}
                >
                  + Assign Warehouse
                </Button>
              )}
            </Group>

            {assignments.length === 0 ? (
              <Text c="dimmed">No assignments yet</Text>
            ) : (
              assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                />
              ))
            )}

            {showAssignmentForm && (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Select
                    label="Assign to User"
                    placeholder="Select warehouse manager"
                    data={[
                      { value: '1', label: 'Manager 1' },
                      { value: '2', label: 'Manager 2' },
                    ]}
                    value={selectedUserId}
                    onChange={setSelectedUserId}
                  />
                  <Textarea
                    label="Notes"
                    placeholder="Assignment notes..."
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                  />
                  <Group gap="sm">
                    <Button
                      onClick={handleCreateAssignment}
                      loading={isLoading_}
                    >
                      Create Assignment
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => setShowAssignmentForm(false)}
                    >
                      Cancel
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="stock-reservations" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>Reserved Stock</Text>
              {order.status === 'Confirmed' && (
                <Button
                  size="sm"
                  onClick={() => setShowStockReservationForm(true)}
                >
                  + Reserve Stock
                </Button>
              )}
            </Group>

            {stockReservations.length === 0 ? (
              <Text c="dimmed">No stock reservations yet</Text>
            ) : (
              stockReservations.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  type="stock"
                />
              ))
            )}

            {showStockReservationForm && (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Select
                    label="Commodity"
                    placeholder="Select commodity"
                    data={[
                      { value: '1', label: 'Commodity 1' },
                      { value: '2', label: 'Commodity 2' },
                    ]}
                    value={selectedCommodityId}
                    onChange={setSelectedCommodityId}
                  />
                  <NumberInput
                    label="Quantity to Reserve"
                    placeholder="Enter quantity"
                    value={reservedQuantity}
                    onChange={(value) => setReservedQuantity(Number(value))}
                    min={0}
                  />
                  <Textarea
                    label="Notes"
                    placeholder="Reservation notes..."
                    value={stockReservationNotes}
                    onChange={(e) => setStockReservationNotes(e.target.value)}
                  />
                  <Group gap="sm">
                    <Button
                      onClick={handleCreateStockReservation}
                      loading={isLoading_}
                    >
                      Reserve Stock
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => setShowStockReservationForm(false)}
                    >
                      Cancel
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Stack>
            </Tabs.Panel>
          </>
        )}

        <Tabs.Panel value="workflow" pt="md">
          <WorkflowTimeline events={workflowEvents} />
        </Tabs.Panel>
      </Tabs>

      <Dialog
        opened={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        title={isV2 ? 'Confirm and approve dispatch order?' : 'Confirm Dispatch Order?'}
        size="sm"
      >
        <Text size="sm" mb="md">
          {isV2
            ? 'This confirms and approves your plan, locks the commodity lines, and notifies source warehouse managers to create dispatch authorizations. You cannot edit the order after this.'
            : 'This will lock the order and create workflow for warehouse managers.'}
        </Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={() => setConfirmDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => confirmMutation.mutate()} loading={isLoading_}>
            {isV2 ? 'Confirm order' : 'Confirm'}
          </Button>
        </Group>
      </Dialog>
    </Stack>
  );
}

export default DispatchOrderDetailPage;
