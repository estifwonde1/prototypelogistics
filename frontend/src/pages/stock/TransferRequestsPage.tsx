import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
  Title,
  SimpleGrid,
  Alert,
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconClock,
  IconAlertCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { AxiosError } from 'axios';
import {
  getTransferRequests,
  approveTransferRequest,
  rejectTransferRequest,
  type TransferRequest,
} from '../../api/transferRequests';
import { getStacks } from '../../api/stacks';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';

type ApiError = {
  error?: {
    message?: string;
  };
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const getStatusColor = (status: TransferRequest['status']) => {
  switch (status) {
    case 'Pending':
      return 'yellow';
    case 'Approved':
      return 'blue';
    case 'Completed':
      return 'green';
    case 'Rejected':
      return 'red';
    default:
      return 'gray';
  }
};

function TransferRequestsPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.role);
  const { can } = usePermission();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);
  const [destinationStackId, setDestinationStackId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const isWarehouseManager = role === 'warehouse_manager' || role === 'admin';

  const { data: requests, isLoading, error, refetch } = useQuery({
    queryKey: ['transfer_requests', statusFilter],
    queryFn: () => getTransferRequests(statusFilter || undefined),
  });

  const { data: stacks = [] } = useQuery({
    queryKey: ['stacks'],
    queryFn: () => getStacks(),
  });

  const filteredStacks = useMemo(() => {
    if (!selectedRequest) return [];
    return stacks.filter(
      (stack) =>
        stack.store_id === selectedRequest.destination_store.id &&
        stack.commodity_id === selectedRequest.commodity.id
    );
  }, [stacks, selectedRequest]);

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { destination_stack_id?: number; notes?: string } }) =>
      approveTransferRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer_requests'] });
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      notifications.show({
        title: 'Success',
        message: 'Transfer request approved and executed successfully',
        color: 'green',
      });
      setApproveModalOpen(false);
      setSelectedRequest(null);
      setDestinationStackId(null);
      setNotes('');
    },
    onError: (mutationError: AxiosError<ApiError>) => {
      notifications.show({
        title: 'Error',
        message: mutationError.response?.data?.error?.message || 'Failed to approve transfer request',
        color: 'red',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => rejectTransferRequest(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer_requests'] });
      notifications.show({
        title: 'Success',
        message: 'Transfer request rejected',
        color: 'green',
      });
      setRejectModalOpen(false);
      setSelectedRequest(null);
      setNotes('');
    },
    onError: (mutationError: AxiosError<ApiError>) => {
      notifications.show({
        title: 'Error',
        message: mutationError.response?.data?.error?.message || 'Failed to reject transfer request',
        color: 'red',
      });
    },
  });

  const handleApprove = () => {
    if (!selectedRequest) return;
    
    // Verify the request is still pending
    if (selectedRequest.status !== 'Pending') {
      notifications.show({
        title: 'Error',
        message: `This request has already been ${selectedRequest.status.toLowerCase()}. Please refresh the page.`,
        color: 'red',
      });
      setApproveModalOpen(false);
      return;
    }
    
    approveMutation.mutate({
      id: selectedRequest.id,
      data: {
        destination_stack_id: destinationStackId ? parseInt(destinationStackId) : undefined,
        notes: notes.trim() || undefined,
      },
    });
  };

  const handleReject = () => {
    if (!selectedRequest || !notes.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Please provide rejection notes',
        color: 'red',
      });
      return;
    }
    rejectMutation.mutate({
      id: selectedRequest.id,
      notes: notes.trim(),
    });
  };

  const pendingCount = requests?.filter((r) => r.status === 'Pending').length || 0;
  const approvedCount = requests?.filter((r) => r.status === 'Approved' || r.status === 'Completed').length || 0;
  const rejectedCount = requests?.filter((r) => r.status === 'Rejected').length || 0;

  if (isLoading) {
    return <LoadingState message="Loading transfer requests..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load transfer requests. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const stackOptions = filteredStacks.map((stack) => ({
    value: stack.id.toString(),
    label: `${stack.code} - ${stack.commodity_name} (${stack.quantity} ${stack.unit_abbreviation})`,
  }));

  return (
    <>
      <Stack gap="xl" style={{ padding: '0.25rem' }}>
        <Stack
          gap="lg"
          style={{
            padding: '1.25rem',
            borderRadius: 24,
            background: 'linear-gradient(180deg, #edf4ff 0%, #e7f0ff 100%)',
            boxShadow: '0 18px 44px rgba(76, 106, 158, 0.12)',
          }}
        >
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <div>
              <Badge
                variant="light"
                radius="xl"
                size="lg"
                style={{ backgroundColor: '#dce8ff', color: '#1b4f9c', marginBottom: 12 }}
              >
                Stock Transfer Management
              </Badge>
              <Title order={2} c="#1d3354">
                Transfer Requests
              </Title>
              <Text c="#64748b" mt={6}>
                {isWarehouseManager
                  ? 'Review and approve store-to-store transfer requests from storekeepers'
                  : 'View your submitted transfer requests and their status'}
              </Text>
            </div>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
              <Group align="center" gap="md">
                <ThemeIcon size={42} radius="md" variant="light" color="yellow">
                  <IconClock size={22} />
                </ThemeIcon>
                <div>
                  <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                    Pending
                  </Text>
                  <Title order={2} c="#d97706">
                    {pendingCount}
                  </Title>
                </div>
              </Group>
            </Card>

            <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
              <Group align="center" gap="md">
                <ThemeIcon size={42} radius="md" variant="light" color="green">
                  <IconCheck size={22} />
                </ThemeIcon>
                <div>
                  <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                    Approved
                  </Text>
                  <Title order={2} c="#16a34a">
                    {approvedCount}
                  </Title>
                </div>
              </Group>
            </Card>

            <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
              <Group align="center" gap="md">
                <ThemeIcon size={42} radius="md" variant="light" color="red">
                  <IconX size={22} />
                </ThemeIcon>
                <div>
                  <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                    Rejected
                  </Text>
                  <Title order={2} c="#dc2626">
                    {rejectedCount}
                  </Title>
                </div>
              </Group>
            </Card>
          </SimpleGrid>

          <Card
            radius="xl"
            padding="lg"
            style={{
              background: '#ffffff',
              border: '1px solid #dce5f5',
              boxShadow: '0 12px 28px rgba(56, 84, 128, 0.08)',
            }}
          >
            <Group gap="md" wrap="wrap" align="end" mb="lg">
              <Select
                label="Filter by Status"
                placeholder="All statuses"
                data={[
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Completed', label: 'Completed' },
                  { value: 'Rejected', label: 'Rejected' },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                clearable
                styles={{
                  label: { fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' },
                  input: { backgroundColor: '#edf4ff', borderColor: '#d5def2' },
                }}
                w={260}
              />
            </Group>

            {!requests || requests.length === 0 ? (
              <EmptyState
                title="No transfer requests found"
                description={
                  statusFilter
                    ? 'Try adjusting your filters to widen the result set.'
                    : isWarehouseManager
                    ? 'No transfer requests have been submitted yet.'
                    : 'You have not submitted any transfer requests yet.'
                }
              />
            ) : (
              <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Destination</Table.Th>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Reason</Table.Th>
                    <Table.Th>Requested By</Table.Th>
                    <Table.Th>Status</Table.Th>
                    {isWarehouseManager && <Table.Th>Actions</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {requests.map((request) => (
                    <Table.Tr key={request.id}>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text fw={700}>{request.source_store.name}</Text>
                          <Text size="xs" c="dimmed">
                            Stack: {request.source_stack.code}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600}>{request.destination_store.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600}>{request.commodity.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700}>
                          {numberFormatter.format(request.quantity)} {request.unit.abbreviation}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {request.reason}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text fw={600}>{request.requested_by.name}</Text>
                          <Text size="xs" c="dimmed">
                            {new Date(request.created_at).toLocaleDateString()}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(request.status)} variant="light">
                          {request.status}
                        </Badge>
                      </Table.Td>
                      {isWarehouseManager && (
                        <Table.Td>
                          {request.status === 'Pending' && can('transfer_requests', 'update') && (
                            <Group gap={8} wrap="nowrap">
                              <Button
                                size="xs"
                                variant="light"
                                color="green"
                                leftSection={<IconCheck size={14} />}
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setApproveModalOpen(true);
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="xs"
                                variant="light"
                                color="red"
                                leftSection={<IconX size={14} />}
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setRejectModalOpen(true);
                                }}
                              >
                                Reject
                              </Button>
                            </Group>
                          )}
                          {request.status !== 'Pending' && request.reviewed_by && (
                            <Stack gap={2}>
                              <Text size="xs" c="dimmed">
                                By: {request.reviewed_by.name}
                              </Text>
                              {request.review_notes && (
                                <Text size="xs" c="dimmed" lineClamp={1}>
                                  {request.review_notes}
                                </Text>
                              )}
                            </Stack>
                          )}
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </Stack>
      </Stack>

      {/* Approve Modal */}
      <Modal
        opened={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
          setSelectedRequest(null);
          setDestinationStackId(null);
          setNotes('');
        }}
        title="Approve Transfer Request"
        size="md"
        radius="xl"
        centered
      >
        {selectedRequest && (
          <Stack gap="md">
            <Alert icon={<IconAlertCircle size={16} />} title="Transfer Details" color="blue">
              <Text size="sm">
                <strong>From:</strong> {selectedRequest.source_store.name} (Stack:{' '}
                {selectedRequest.source_stack.code})
              </Text>
              <Text size="sm">
                <strong>To:</strong> {selectedRequest.destination_store.name}
              </Text>
              <Text size="sm">
                <strong>Commodity:</strong> {selectedRequest.commodity.name}
              </Text>
              <Text size="sm">
                <strong>Quantity:</strong> {numberFormatter.format(selectedRequest.quantity)}{' '}
                {selectedRequest.unit.abbreviation}
              </Text>
              <Text size="sm">
                <strong>Reason:</strong> {selectedRequest.reason}
              </Text>
            </Alert>

            <Select
              label="Destination Stack (Optional)"
              placeholder="Auto-create new stack if not selected"
              data={stackOptions}
              value={destinationStackId}
              onChange={setDestinationStackId}
              searchable
              description="Select an existing stack or leave empty to auto-create a new stack"
            />

            <Textarea
              label="Approval Notes (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              minRows={3}
              placeholder="Add any notes about this approval..."
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => {
                  setApproveModalOpen(false);
                  setSelectedRequest(null);
                  setDestinationStackId(null);
                  setNotes('');
                }}
                disabled={approveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={handleApprove}
                loading={approveMutation.isPending}
              >
                Approve & Execute Transfer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        opened={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setSelectedRequest(null);
          setNotes('');
        }}
        title="Reject Transfer Request"
        size="md"
        radius="xl"
        centered
      >
        {selectedRequest && (
          <Stack gap="md">
            <Alert icon={<IconAlertCircle size={16} />} title="Transfer Details" color="red">
              <Text size="sm">
                <strong>From:</strong> {selectedRequest.source_store.name}
              </Text>
              <Text size="sm">
                <strong>To:</strong> {selectedRequest.destination_store.name}
              </Text>
              <Text size="sm">
                <strong>Commodity:</strong> {selectedRequest.commodity.name}
              </Text>
              <Text size="sm">
                <strong>Quantity:</strong> {numberFormatter.format(selectedRequest.quantity)}{' '}
                {selectedRequest.unit.abbreviation}
              </Text>
            </Alert>

            <Textarea
              label="Rejection Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              minRows={3}
              placeholder="Explain why this request is being rejected..."
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => {
                  setRejectModalOpen(false);
                  setSelectedRequest(null);
                  setNotes('');
                }}
                disabled={rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                color="red"
                leftSection={<IconX size={16} />}
                onClick={handleReject}
                loading={rejectMutation.isPending}
              >
                Reject Request
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

export default TransferRequestsPage;
