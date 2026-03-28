/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { Stack, Title, Group, Select, MultiSelect, Button, Table, Badge } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { getAdminUsers } from '../../../api/adminUsers';
import { getAssignments, bulkUpdateAssignments } from '../../../api/adminAssignments';
import { getHubsForAssignment, getWarehousesForAssignment, getStoresForAssignment } from '../../../api/locations';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';

const ROLE_OPTIONS = ['Hub Manager', 'Warehouse Manager', 'Storekeeper'];

export default function UserAssignmentsPage() {
  const queryClient = useQueryClient();
  const [roleName, setRoleName] = useState<string | null>(ROLE_OPTIONS[0]);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: users } = useQuery({
    queryKey: ['admin-users', roleName],
    queryFn: () => getAdminUsers({ role_name: roleName || undefined }),
    enabled: !!roleName,
  });

  const { data: locations } = useQuery({
    queryKey: ['assignment-locations', roleName],
    queryFn: () => {
      if (roleName === 'Hub Manager') return getHubsForAssignment();
      if (roleName === 'Warehouse Manager') return getWarehousesForAssignment();
      return getStoresForAssignment();
    },
    enabled: !!roleName,
  });

  const { data: assignments, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-assignments', roleName],
    queryFn: () => getAssignments({ role_name: roleName || undefined }),
    enabled: !!roleName,
  });

  const bulkMutation = useMutation({
    mutationFn: bulkUpdateAssignments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments', roleName] });
      notifications.show({ title: 'Success', message: 'Assignments updated', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Failed to update assignments',
        color: 'red',
      });
    },
  });

  const locationOptions = useMemo(
    () => locations?.map((l) => ({ value: String(l.id), label: l.name })) || [],
    [locations]
  );

  const handleAssign = () => {
    if (!roleName || !userId) return;

    const payload: any = { user_id: Number(userId), role_name: roleName };
    if (roleName === 'Hub Manager') payload.hub_ids = selectedIds.map(Number);
    if (roleName === 'Warehouse Manager') payload.warehouse_ids = selectedIds.map(Number);
    if (roleName === 'Storekeeper') payload.store_ids = selectedIds.map(Number);

    bulkMutation.mutate(payload);
  };

  if (isLoading) return <LoadingState message="Loading assignments..." />;
  if (error) return <ErrorState message="Failed to load assignments" onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      <Title order={2}>User Assignments</Title>

      <Group align="end">
        <Select
          label="Role"
          data={ROLE_OPTIONS.map((r) => ({ value: r, label: r }))}
          value={roleName}
          onChange={(value) => {
            setRoleName(value);
            setUserId(null);
            setSelectedIds([]);
          }}
          w={260}
        />
        <Select
          label="User"
          placeholder="Select user"
          data={users?.map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}` })) || []}
          value={userId}
          onChange={setUserId}
          w={320}
        />
        <MultiSelect
          label="Assign Locations"
          placeholder="Select locations"
          data={locationOptions}
          value={selectedIds}
          onChange={setSelectedIds}
          w={380}
        />
        <Button onClick={handleAssign} loading={bulkMutation.isPending}>
          Save Assignments
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Role</Table.Th>
              <Table.Th>User</Table.Th>
              <Table.Th>Location</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {assignments?.map((a) => (
              <Table.Tr key={a.id}>
                <Table.Td>
                  <Badge variant="light">{a.role_name}</Badge>
                </Table.Td>
                <Table.Td>{a.user?.name || '-'}</Table.Td>
                <Table.Td>{a.hub?.name || a.warehouse?.name || a.store?.name || '-'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
