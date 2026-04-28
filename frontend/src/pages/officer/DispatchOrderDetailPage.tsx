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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  getDispatchOrder,
  confirmDispatchOrder,
  deleteDispatchOrder,
  assignDispatchOrder,
  reserveStock,
  getDispatchOrderWorkflow,
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

function DispatchOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
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

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_orders', id],
    queryFn: () => getDispatchOrder(Number(id)),
  });

  const { data: workflowEvents = [] } = useQuery({
    queryKey: ['dispatch_orders', id, 'workflow'],
    queryFn: () => getDispatchOrderWorkflow(Number(id)),
    enabled: !!order && order.status !== 'Draft',
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmDispatchOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Dispatch Order confirmed successfully',
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

  const isLoading_ = confirmMutation.isPending || deleteMutation.isPending || assignMutation.isPending || reserveStockMutation.isPending;
  const assignments = order.assignments || [];
  const stockReservations = order.stock_reservations || [];
  const isDraft = order.status === 'Draft';
  const canCreateGin = can('gins', 'create') && !isDraft;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Group gap="sm" align="center">
            <Title order={2}>Dispatch Order DO-{order.id}</Title>
            <ScopeBadge locationName={order.location_name} hierarchicalLevel={order.hierarchical_level} />
          </Group>
          <Text c="dimmed" size="sm">
            Created on {new Date(order.created_at).toLocaleDateString()}
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
          {!isDraft && (
            <>
              <Tabs.Tab value="assignments">Assignments</Tabs.Tab>
              <Tabs.Tab value="stock-reservations">Stock Reservations</Tabs.Tab>
              <Tabs.Tab value="workflow">Workflow Timeline</Tabs.Tab>
            </>
          )}
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <Stack gap="md">
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
                      {new Date(order.expected_pickup_date).toLocaleDateString()}
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

            <Group justify="flex-end">
              {isDraft && (
                <>
                  <Button
                    variant="light"
                    onClick={() => navigate(`/officer/dispatch-orders/${order.id}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button
                    color="red"
                    variant="light"
                    onClick={() => deleteMutation.mutate()}
                    loading={isLoading_}
                  >
                    Delete
                  </Button>
                  <Button
                    onClick={() => setConfirmDialogOpen(true)}
                    loading={isLoading_}
                  >
                    Confirm Order
                  </Button>
                </>
              )}
              {!isDraft && (
                <Button variant="light" onClick={() => navigate('/officer/dispatch-orders')}>
                  Back to List
                </Button>
              )}
            </Group>
          </Stack>
        </Tabs.Panel>

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

        <Tabs.Panel value="workflow" pt="md">
          <WorkflowTimeline events={workflowEvents} />
        </Tabs.Panel>
      </Tabs>

      <Dialog
        opened={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        title="Confirm Dispatch Order?"
        size="sm"
      >
        <Text size="sm" mb="md">
          This will lock the order and create workflow for warehouse managers.
        </Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={() => setConfirmDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => confirmMutation.mutate()} loading={isLoading_}>
            Confirm
          </Button>
        </Group>
      </Dialog>
    </Stack>
  );
}

export default DispatchOrderDetailPage;
