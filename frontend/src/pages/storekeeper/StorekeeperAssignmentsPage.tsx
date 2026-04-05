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
import { IconCheck, IconClipboardList, IconBoxMultiple } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import type { ApiError } from '../../types/common';

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
}

async function getStorekeeperAssignments(): Promise<StoreAssignment[]> {
  const response = await apiClient.get('/storekeeper_assignments');
  const data = response.data.data || response.data;
  return Array.isArray(data.assignments) ? data.assignments : (Array.isArray(data) ? data : []);
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

  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['storekeeper_assignments'],
    queryFn: getStorekeeperAssignments,
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
    () => assignments.filter((a) => ['pending', 'assigned'].includes(a.status.toLowerCase())),
    [assignments]
  );

  const completedAssignments = useMemo(
    () => assignments.filter((a) => ['accepted', 'in_progress', 'completed'].includes(a.status.toLowerCase())),
    [assignments]
  );

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

      {pendingAssignments.length === 0 && completedAssignments.length === 0 && (
        <Alert title="No assignments" color="blue">
          You have no pending or completed assignments.
        </Alert>
      )}

      {pendingAssignments.length > 0 && (
        <>
          <Title order={4}>Pending Orders</Title>
          {pendingAssignments.map((assignment) => (
            <Card key={assignment.id} shadow="sm" padding="lg" radius="md" withBorder>
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

