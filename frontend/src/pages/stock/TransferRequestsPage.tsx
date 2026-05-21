import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
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
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconClock,
  IconAlertCircle,
  IconEye,
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
import { normalizeRoleSlug } from '../../contracts/warehouse';
import TransferRequestApprovePanel from '../../components/stacks/TransferRequestApprovePanel';
import TransferRequestDetailsModal from '../../components/stacks/TransferRequestDetailsModal';
import type { useStackTransferForm } from '../../hooks/useStackTransferForm';

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
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsRequestId, setDetailsRequestId] = useState<number | null>(null);
  const [detailsPreview, setDetailsPreview] = useState<TransferRequest | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);
  const [destinationStackId, setDestinationStackId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const approveFormRef = useRef<ReturnType<typeof useStackTransferForm> | null>(null);
  const [canApproveTransfer, setCanApproveTransfer] = useState(false);

  const handleApproveFormReady = useCallback(
    (form: ReturnType<typeof useStackTransferForm>, canApprove: boolean) => {
      approveFormRef.current = form;
      setCanApproveTransfer(canApprove);
    },
    []
  );

  const isWarehouseManager = role === 'warehouse_manager' || role === 'admin';

  // Get active assignment context for filtering
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((state) => state.role));
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userStoreId = activeAssignment?.store?.id;
  const userHubId = activeAssignment?.hub?.id;
  const isWarehouseManagerByRole = roleSlug === 'warehouse_manager';
  const isStorekeeper = roleSlug === 'storekeeper';
  const isHubManager = roleSlug === 'hub_manager';

  const { data: requests, isLoading, error, refetch } = useQuery({
    queryKey: ['transfer_requests', statusFilter],
    queryFn: () => getTransferRequests(statusFilter || undefined),
  });

  const { data: stacks = [] } = useQuery({
    queryKey: ['stacks', { 
      warehouse_id: isWarehouseManagerByRole ? userWarehouseId : undefined,
      store_id: isStorekeeper ? userStoreId : undefined,
      hub_id: isHubManager ? userHubId : undefined 
    }],
    queryFn: () => {
      if (isWarehouseManagerByRole && userWarehouseId) {
        return getStacks({ warehouse_id: userWarehouseId });
      } else if (isStorekeeper && userStoreId) {
        return getStacks({ store_id: userStoreId });
      } else if (isHubManager && userHubId) {
        return getStacks(); // Backend should handle hub-level filtering
      }
      return getStacks();
    },
  });

  const filteredStacks = useMemo(() => {
    if (!selectedRequest) return [];
    return stacks.filter((stack) => {
      if (stack.store_id !== selectedRequest.destination_store.id) return false;
      const qty = Number(stack.quantity) || 0;
      if (qty <= 0) return true;
      return stack.commodity_id === selectedRequest.commodity.id;
    });
  }, [stacks, selectedRequest]);

  const sourceStackForApprove = useMemo(() => {
    if (!selectedRequest) return null;
    return stacks.find((s) => s.id === selectedRequest.source_stack.id) ?? null;
  }, [stacks, selectedRequest]);

  const approveMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Parameters<typeof approveTransferRequest>[1];
    }) => approveTransferRequest(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['transfer_requests'] });
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      const remaining = updated.remaining_quantity ?? 0;
      if (updated.status === 'Pending' && remaining > 0.001) {
        notifications.show({
          title: 'Transfer recorded',
          message: `${numberFormatter.format(remaining)} ${updated.unit.abbreviation} still open on this request. You can transfer more or reject the remainder.`,
          color: 'blue',
        });
        setSelectedRequest(updated);
        setDestinationStackId(null);
        setNotes('');
      } else {
        notifications.show({
          title: 'Success',
          message:
            updated.status === 'Rejected'
              ? 'Transfer request closed (remainder rejected)'
              : 'Transfer request completed',
          color: 'green',
        });
        setApproveModalOpen(false);
        setSelectedRequest(null);
        setDestinationStackId(null);
        setNotes('');
        setCanApproveTransfer(false);
      }
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
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      rejectTransferRequest(id, { notes }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['transfer_requests'] });
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      const hadFulfillment = (updated.fulfilled_quantity ?? 0) > 0;
      notifications.show({
        title: 'Success',
        message: hadFulfillment
          ? 'Remaining quantity rejected; request closed'
          : 'Transfer request rejected',
        color: 'green',
      });
      setRejectModalOpen(false);
      setApproveModalOpen(false);
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

    if (selectedRequest.status !== 'Pending') {
      notifications.show({
        title: 'Error',
        message: `This request has already been ${selectedRequest.status.toLowerCase()}. Please refresh the page.`,
        color: 'red',
      });
      setApproveModalOpen(false);
      return;
    }

    const form = approveFormRef.current;
    if (!form) {
      notifications.show({
        title: 'Error',
        message: 'Transfer form is not ready. Close and reopen the modal.',
        color: 'red',
      });
      return;
    }

    if (!canApproveTransfer) {
      notifications.show({
        title: 'Cannot transfer this amount',
        message:
          form.quantityError ||
          'Reduce the quantity to the maximum allowed for this request, or fix the destination stack.',
        color: 'red',
      });
      return;
    }

    const validationError = form.validate();
    if (validationError) {
      notifications.show({
        title: 'Error',
        message: validationError,
        color: 'red',
      });
      return;
    }

    const payload = form.buildSubmitPayload();
    if (!payload) {
      notifications.show({
        title: 'Error',
        message: 'Could not build transfer payload. Check quantity and unit.',
        color: 'red',
      });
      return;
    }

    approveMutation.mutate({
      id: selectedRequest.id,
      data: {
        ...payload,
        destination_stack_id: destinationStackId ? parseInt(destinationStackId, 10) : undefined,
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

  const openDetails = (request: TransferRequest) => {
    setDetailsRequestId(request.id);
    setDetailsPreview(request);
    setDetailsModalOpen(true);
  };

  const resolveRemaining = (request: TransferRequest) => {
    if (request.remaining_quantity != null) return request.remaining_quantity;
    const fulfilled = request.fulfilled_quantity ?? 0;
    const rejected = request.rejected_quantity ?? 0;
    return Math.max(0, request.quantity - fulfilled - rejected);
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
                    <Table.Th>Actions</Table.Th>
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
                        <Stack gap={2}>
                          <Text fw={700}>
                            {numberFormatter.format(request.quantity)} {request.unit.abbreviation}
                          </Text>
                          {request.status === 'Pending' &&
                            (request.fulfilled_quantity ?? 0) > 0 && (
                              <Text size="xs" c="blue">
                                Open: {numberFormatter.format(resolveRemaining(request))}{' '}
                                {request.unit.abbreviation}
                              </Text>
                            )}
                        </Stack>
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
                          {request.status === 'Pending' && (request.fulfilled_quantity ?? 0) > 0
                            ? 'Pending (partial)'
                            : request.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <Tooltip label="View details">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="md"
                              aria-label="View transfer request details"
                              onClick={() => openDetails(request)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {isWarehouseManager &&
                            request.status === 'Pending' &&
                            can('transfer_requests', 'update') && (
                              <>
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="green"
                                  leftSection={<IconCheck size={14} />}
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setDestinationStackId(null);
                                    setNotes('');
                                    setCanApproveTransfer(false);
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
                              </>
                            )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </Stack>
      </Stack>

      <TransferRequestDetailsModal
        requestId={detailsRequestId}
        opened={detailsModalOpen}
        preview={detailsPreview}
        onClose={() => {
          setDetailsModalOpen(false);
          setDetailsRequestId(null);
          setDetailsPreview(null);
        }}
      />

      {/* Approve Modal */}
      <Modal
        opened={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
          setSelectedRequest(null);
          setDestinationStackId(null);
          setNotes('');
          setCanApproveTransfer(false);
        }}
        title="Approve Transfer Request"
        size="lg"
        radius="xl"
        centered
      >
        {selectedRequest && sourceStackForApprove && (
          <Stack gap="md">
            <TransferRequestApprovePanel
              key={`${selectedRequest.id}-${selectedRequest.fulfilled_quantity ?? 0}-${selectedRequest.rejected_quantity ?? 0}`}
              request={selectedRequest}
              sourceStack={sourceStackForApprove}
              destinationStacks={filteredStacks}
              destinationStackId={destinationStackId}
              onDestinationStackIdChange={setDestinationStackId}
              notes={notes}
              onNotesChange={setNotes}
              onFormReady={handleApproveFormReady}
            />

            <Group justify="space-between" mt="md" wrap="wrap">
              <Button
                variant="light"
                color="red"
                leftSection={<IconX size={16} />}
                onClick={() => {
                  setRejectModalOpen(true);
                }}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                Reject remaining
              </Button>
              <Group gap="sm">
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
                  disabled={!canApproveTransfer}
                >
                  Transfer this amount
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
        {selectedRequest && !sourceStackForApprove && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Source stack unavailable">
            <Text size="sm">
              Could not load the source stack for this request. Refresh stacks and try again.
            </Text>
          </Alert>
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
        title={
          selectedRequest && (selectedRequest.fulfilled_quantity ?? 0) > 0
            ? 'Reject remaining quantity'
            : 'Reject transfer request'
        }
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
                <strong>Requested:</strong> {numberFormatter.format(selectedRequest.quantity)}{' '}
                {selectedRequest.unit.abbreviation}
              </Text>
              {(selectedRequest.fulfilled_quantity ?? 0) > 0 && (
                <Text size="sm">
                  <strong>Already transferred:</strong>{' '}
                  {numberFormatter.format(selectedRequest.fulfilled_quantity ?? 0)}{' '}
                  {selectedRequest.unit.abbreviation}
                </Text>
              )}
              <Text size="sm" fw={600}>
                <strong>
                  {(selectedRequest.fulfilled_quantity ?? 0) > 0
                    ? 'Remaining to reject:'
                    : 'Quantity to reject:'}
                </strong>{' '}
                {numberFormatter.format(resolveRemaining(selectedRequest))}{' '}
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
                {(selectedRequest.fulfilled_quantity ?? 0) > 0
                  ? 'Reject remaining & close'
                  : 'Reject request'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

export default TransferRequestsPage;
