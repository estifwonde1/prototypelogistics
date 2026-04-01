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
  getReceiptOrder,
  confirmReceiptOrder,
  deleteReceiptOrder,
  assignReceiptOrder,
  reserveSpace,
  getReceiptOrderWorkflow,
} from '../../api/receiptOrders';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { AssignmentCard } from '../../components/common/AssignmentCard';
import { ReservationCard } from '../../components/common/ReservationCard';
import { WorkflowTimeline } from '../../components/common/WorkflowTimeline';
import type { ApiError } from '../../types/common';
import { useState } from 'react';

function ReceiptOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('details');
  
  // Assignment form state
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  
  // Space reservation form state
  const [showSpaceReservationForm, setShowSpaceReservationForm] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [reservedQuantity, setReservedQuantity] = useState<number>(0);
  const [spaceReservationNotes, setSpaceReservationNotes] = useState('');

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['receipt_orders', id],
    queryFn: () => getReceiptOrder(Number(id)),
  });

  const { data: workflowEvents = [] } = useQuery({
    queryKey: ['receipt_orders', id, 'workflow'],
    queryFn: () => getReceiptOrderWorkflow(Number(id)),
    enabled: !!order && order.status !== 'Draft',
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmReceiptOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Receipt Order confirmed successfully',
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
          'Failed to confirm Receipt Order',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReceiptOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Receipt Order deleted successfully',
        color: 'green',
      });
      navigate('/officer/receipt-orders');
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to delete Receipt Order',
        color: 'red',
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (payload: any) => assignReceiptOrder(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders', id] });
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

  const reserveSpaceMutation = useMutation({
    mutationFn: (payload: any) => reserveSpace(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders', id] });
      notifications.show({
        title: 'Success',
        message: 'Space reservation created successfully',
        color: 'green',
      });
      setShowSpaceReservationForm(false);
      setSelectedStoreId(null);
      setReservedQuantity(0);
      setSpaceReservationNotes('');
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create space reservation',
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

  const handleCreateSpaceReservation = () => {
    if (!selectedStoreId || !reservedQuantity) {
      notifications.show({
        title: 'Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }
    reserveSpaceMutation.mutate({
      reservations: [{
        store_id: Number(selectedStoreId),
        reserved_quantity: reservedQuantity,
        notes: spaceReservationNotes,
      }],
    });
  };

  if (isLoading) {
    return <LoadingState message="Loading Receipt Order..." />;
  }

  if (error || !order) {
    return (
      <ErrorState
        message="Failed to load Receipt Order. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const isLoading_ = confirmMutation.isPending || deleteMutation.isPending || assignMutation.isPending || reserveSpaceMutation.isPending;
  const assignments = order.assignments || [];
  const spaceReservations = order.space_reservations || [];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Receipt Order RO-{order.id}</Title>
          <Text c="dimmed" size="sm">
            Created on {new Date(order.created_at).toLocaleDateString()}
          </Text>
        </div>
        <StatusBadge status={order.status} />
      </Group>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'details')}>
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          {order.status !== 'Draft' && (
            <>
              <Tabs.Tab value="assignments">Assignments</Tabs.Tab>
              <Tabs.Tab value="space-reservations">Space Reservations</Tabs.Tab>
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
                      Source
                    </Text>
                    <Text size="sm" fw={600} mt="xs">
                      {order.source_type} - {order.source_name}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Destination Warehouse
                    </Text>
                    <Text size="sm" fw={600} mt="xs">
                      {order.destination_warehouse_name || 'N/A'}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Expected Delivery
                    </Text>
                    <Text size="sm" fw={600} mt="xs">
                      {new Date(order.expected_delivery_date).toLocaleDateString()}
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
                      <Table.Th>Unit Price</Table.Th>
                      <Table.Th>Notes</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {order.lines?.map((line, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>{line.commodity_id}</Table.Td>
                        <Table.Td>{line.quantity}</Table.Td>
                        <Table.Td>{line.unit_id}</Table.Td>
                        <Table.Td>{line.unit_price || '-'}</Table.Td>
                        <Table.Td>{line.notes || '-'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </div>

            <Group justify="flex-end">
              {order.status === 'Draft' && (
                <>
                  <Button
                    variant="light"
                    onClick={() => navigate(`/officer/receipt-orders/${order.id}/edit`)}
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
              {order.status !== 'Draft' && (
                <Button variant="light" onClick={() => navigate('/officer/receipt-orders')}>
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

        <Tabs.Panel value="space-reservations" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>Reserved Space</Text>
              {order.status === 'Confirmed' && (
                <Button
                  size="sm"
                  onClick={() => setShowSpaceReservationForm(true)}
                >
                  + Reserve Space
                </Button>
              )}
            </Group>

            {spaceReservations.length === 0 ? (
              <Text c="dimmed">No space reservations yet</Text>
            ) : (
              spaceReservations.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  type="space"
                />
              ))
            )}

            {showSpaceReservationForm && (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Select
                    label="Store"
                    placeholder="Select store"
                    data={[
                      { value: '1', label: 'Store 1' },
                      { value: '2', label: 'Store 2' },
                    ]}
                    value={selectedStoreId}
                    onChange={setSelectedStoreId}
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
                    value={spaceReservationNotes}
                    onChange={(e) => setSpaceReservationNotes(e.target.value)}
                  />
                  <Group gap="sm">
                    <Button
                      onClick={handleCreateSpaceReservation}
                      loading={isLoading_}
                    >
                      Reserve Space
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => setShowSpaceReservationForm(false)}
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
        title="Confirm Receipt Order?"
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

export default ReceiptOrderDetailPage;
