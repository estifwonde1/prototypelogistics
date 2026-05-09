import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Text,
  Card,
  Group,
  Badge,
  Button,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconClipboardList, IconBoxMultiple } from '@tabler/icons-react';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../api/client';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { statusArrayFilter, getPendingAssignmentStatuses, getCompletedAssignmentStatuses } from '../../utils/filterUtils';
import type { ApiError } from '../../types/common';
import { useAuthStore } from '../../store/authStore';

interface StoreAssignment {
  id: number;
  receipt_order_id: number;
  receipt_order_line_id?: number;
  hub_id?: number;
  hub_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  store_id?: number;
  store_name?: string;
  assigned_by_id: number;
  assigned_by_name: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  quantity?: number;
  status: string;
  assigned_at: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  reference_no?: string;
  commodity_name?: string;
  commodity_quantity?: number;
  unit_name?: string;
  batch_no?: string;
}

async function getStorekeeperAssignments(storeId?: number): Promise<StoreAssignment[]> {
  const params: Record<string, unknown> = {};
  if (storeId) params.store_id = storeId;
  const response = await apiClient.get('/storekeeper_assignments', { params });
  const data = response.data.data || response.data;
  return Array.isArray(data.receipt_assignments) ? data.receipt_assignments : (Array.isArray(data.assignments) ? data.assignments : (Array.isArray(data) ? data : []));
}

async function acceptAssignment(id: number) {
  return apiClient.post(`/storekeeper_assignments/${id}/accept`);
}

const statusColors: Record<string, string> = {
  pending: 'yellow',
  assigned: 'gray',
  accepted: 'blue',
  in_progress: 'cyan',
  completed: 'green',
};

export default function StorekeeperAssignmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusOrderId = Number(searchParams.get('receipt_order_id') || '') || null;
  const focusCardRef = useRef<HTMLDivElement | null>(null);

  // Use the active store from auth context so filtering respects the store selected at login
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const activeStoreId = activeAssignment?.store?.id;

  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['storekeeper_assignments', { store_id: activeStoreId }],
    queryFn: () => getStorekeeperAssignments(activeStoreId),
  });

  const acceptMutation = useMutation({
    mutationFn: ({ id, storeId }: { id: number; storeId: number }) => 
      acceptAssignment(id).then(() => ({ storeId })),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['storekeeper_assignments'] });
      notifications.show({
        title: 'Success',
        message: 'Order accepted. Redirecting to stacking layout...',
        color: 'green',
      });
      if (data?.storeId) {
        setTimeout(() => {
          navigate(`/stacks/layout?store_id=${data.storeId}&auto_prepare=true`);
        }, 800);
      }
    },
    onError: (err: unknown) => {
      const errorMsg = isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined;
      notifications.show({
        title: 'Error',
        message: errorMsg || 'Failed to accept assignment',
        color: 'red',
      });
    },
  });

  const pendingAssignments = useMemo(
    () => assignments.filter((a) => 
      statusArrayFilter(a.status, getPendingAssignmentStatuses())
    ),
    [assignments]
  );

  const completedAssignments = useMemo(
    () => assignments.filter((a) => 
      statusArrayFilter(a.status, getCompletedAssignmentStatuses())
    ),
    [assignments]
  );

  const orderedPendingAssignments = useMemo(() => {
    if (!focusOrderId) return pendingAssignments;
    const matches = pendingAssignments.filter((a) => a.receipt_order_id === focusOrderId);
    const rest = pendingAssignments.filter((a) => a.receipt_order_id !== focusOrderId);
    return [...matches, ...rest];
  }, [pendingAssignments, focusOrderId]);

  const firstFocusedPendingId = useMemo(() => {
    if (!focusOrderId) return null;
    const hit = orderedPendingAssignments.find((a) => a.receipt_order_id === focusOrderId);
    return hit?.id ?? null;
  }, [focusOrderId, orderedPendingAssignments]);

  useEffect(() => {
    if (!firstFocusedPendingId) return;
    const t = window.setTimeout(() => {
      focusCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(t);
  }, [firstFocusedPendingId, orderedPendingAssignments]);

  if (isLoading) return <LoadingState message="Loading assignments..." />;
  if (error) return <ErrorState message="Failed to load assignments" />;

  return (
    <Stack gap="md">
      <Group>
        <IconClipboardList size={28} />
        <Title order={2}>My Assignments</Title>
      </Group>

      <Text c="dimmed">
        Receipt orders assigned to your store. Accept to prepare stacking space for the incoming commodities.
      </Text>

      {focusOrderId ? (
        <Alert color="blue" variant="light">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm">
              Opened from a notification: showing assignments for receipt order #{focusOrderId} first.
            </Text>
            <Button
              size="xs"
              variant="default"
              onClick={() => {
                setSearchParams({});
              }}
            >
              Show all assignments
            </Button>
          </Group>
        </Alert>
      ) : null}

      {pendingAssignments.length === 0 && completedAssignments.length === 0 && (
        <Alert title="No assignments" color="blue">
          You have no pending or completed assignments.
        </Alert>
      )}

      {pendingAssignments.length > 0 && (
        <>
          <Title order={4}>Pending Orders</Title>
          {orderedPendingAssignments.map((assignment) => (
            <Card
              key={assignment.id}
              ref={assignment.id === firstFocusedPendingId ? focusCardRef : undefined}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              style={
                focusOrderId && assignment.receipt_order_id === focusOrderId
                  ? { borderColor: 'var(--mantine-color-blue-5)', boxShadow: 'var(--mantine-shadow-md)' }
                  : undefined
              }
            >
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>
                      Order #{assignment.receipt_order_id}
                      {assignment.reference_no ? ` - ${assignment.reference_no}` : ''}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {assignment.warehouse_name}
                      {assignment.store_name ? ` → ${assignment.store_name}` : ''}
                    </Text>
                  </div>
                  <Badge color={statusColors[assignment.status.toLowerCase()] ?? 'gray'}>
                    {assignment.status.replace(/_/g, ' ')}
                  </Badge>
                </Group>

                {assignment.commodity_name && (
                  <Text size="sm">
                    {assignment.commodity_quantity?.toLocaleString()} {assignment.unit_name} of {assignment.commodity_name}
                  </Text>
                )}

                <Group gap="xs">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Assigned Quantity</Text>
                  <Text size="sm" fw={700} c={assignment.quantity ? undefined : 'orange'}>
                    {assignment.quantity ? `${Number(assignment.quantity).toLocaleString()} ${assignment.unit_name ?? ''}` : 'No quantity specified'}
                  </Text>
                </Group>

                {assignment.batch_no && (
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Batch</Text>
                    <Text size="sm" style={{ fontFamily: 'monospace' }}>
                      {assignment.batch_no}
                    </Text>
                  </Group>
                )}

                <Text size="xs" c="dimmed">
                  Assigned by {assignment.assigned_by_name} on {new Date(assignment.assigned_at).toLocaleString()}
                </Text>

                <Group gap="sm">
                  <Button
                    size="sm"
                    color="green"
                    leftSection={<IconBoxMultiple size={16} />}
                    onClick={() => acceptMutation.mutate({
                      id: assignment.id,
                      storeId: assignment.store_id || 0,
                    })}
                    loading={acceptMutation.isPending}
                  >
                    Accept &amp; Prepare Stack
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </>
      )}

      {completedAssignments.length > 0 && (
        <>
          <Title order={4}>History</Title>
          {completedAssignments.map((assignment) => (
            <Card key={assignment.id} shadow="sm" padding="lg" radius="md" withBorder opacity={0.7}>
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Text fw={600}>
                      Order #{assignment.receipt_order_id}
                      {assignment.reference_no ? ` - ${assignment.reference_no}` : ''}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {assignment.warehouse_name}
                      {assignment.store_name ? ` → ${assignment.store_name}` : ''}
                    </Text>
                  </div>
                  <Badge color={statusColors[assignment.status.toLowerCase()] ?? 'gray'}>
                    {assignment.status.replace(/_/g, ' ')}
                  </Badge>
                </Group>

                {assignment.commodity_name && (
                  <Text size="sm">
                    {assignment.commodity_quantity?.toLocaleString()} {assignment.unit_name} of {assignment.commodity_name}
                  </Text>
                )}

                {assignment.batch_no && (
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Batch</Text>
                    <Text size="sm" style={{ fontFamily: 'monospace' }}>
                      {assignment.batch_no}
                    </Text>
                  </Group>
                )}

                <Text size="xs" c="dimmed">
                  Assigned by {assignment.assigned_by_name} on {new Date(assignment.assigned_at).toLocaleString()}
                </Text>
              </Stack>
            </Card>
          ))}
        </>
      )}
    </Stack>
  );
}

