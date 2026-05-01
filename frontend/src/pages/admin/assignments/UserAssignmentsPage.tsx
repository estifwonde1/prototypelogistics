/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Stack, Title, Group, Select, MultiSelect, Button, Table, Badge, Text } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { getAdminUsers } from '../../../api/adminUsers';
import { getAssignments, bulkUpdateAssignments, deleteAssignment } from '../../../api/adminAssignments';
import { getHubsForAssignment, getKebeles, getRegions, getWarehousesForAssignment, getWoredas, getZones } from '../../../api/locations';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';

const ROLE_OPTIONS = [
  'Hub Manager',
  'Warehouse Manager',
  'Storekeeper',
  'Federal Officer',
  'Regional Officer',
  'Zonal Officer',
  'Woreda Officer',
  'Kebele Officer',
];

export default function UserAssignmentsPage() {
  const queryClient = useQueryClient();
  const [roleName, setRoleName] = useState<string | null>(ROLE_OPTIONS[0]);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [woredaId, setWoredaId] = useState<string | null>(null);

  const { data: users } = useQuery({
    queryKey: ['admin-users', roleName],
    queryFn: () => getAdminUsers({ role_name: roleName || undefined }),
    enabled: !!roleName,
  });

  const isRegionalOfficer = roleName === 'Regional Officer';
  const isZonalOfficer = roleName === 'Zonal Officer';
  const isWoredaOfficer = roleName === 'Woreda Officer';
  const isKebeleOfficer = roleName === 'Kebele Officer';
  const isFederalOfficer = roleName === 'Federal Officer';
  const canAssign = !!roleName && !!userId && !isFederalOfficer;

  const { data: regions } = useQuery({
    queryKey: ['assignment-regions'],
    queryFn: getRegions,
    enabled: isRegionalOfficer || isZonalOfficer || isWoredaOfficer || isKebeleOfficer,
  });

  const { data: zones } = useQuery({
    queryKey: ['assignment-zones', regionId],
    queryFn: () => getZones(regionId ? Number(regionId) : undefined),
    enabled: (isZonalOfficer || isWoredaOfficer || isKebeleOfficer) && !!regionId,
  });

  const { data: woredas } = useQuery({
    queryKey: ['assignment-woredas', zoneId],
    queryFn: () => getWoredas(Number(zoneId)),
    enabled: (isWoredaOfficer || isKebeleOfficer) && !!zoneId,
  });

  // Kebeles query - data fetched but not directly used in this component
  useQuery({
    queryKey: ['assignment-kebeles', woredaId],
    queryFn: () => getKebeles(Number(woredaId)),
    enabled: isKebeleOfficer && !!woredaId,
  });

  const { data: locations } = useQuery({
    queryKey: ['assignment-locations', roleName, regionId, zoneId, woredaId],
    queryFn: () => {
      if (roleName === 'Hub Manager') return getHubsForAssignment();
      if (roleName === 'Warehouse Manager') return getWarehousesForAssignment();
      if (roleName === 'Storekeeper') return getWarehousesForAssignment(); // Admin assigns storekeepers to warehouses
      if (isRegionalOfficer) return getRegions();
      if (isZonalOfficer) return getZones(regionId ? Number(regionId) : undefined);
      if (isWoredaOfficer) return getWoredas(Number(zoneId));
      if (isKebeleOfficer) return getKebeles(Number(woredaId));
      return [];
    },
    enabled: !!roleName && !isFederalOfficer,
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

  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments', roleName] });
      notifications.show({ title: 'Success', message: 'Assignment removed', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Failed to remove assignment',
        color: 'red',
      });
    },
  });

  const locationOptions = useMemo(
    () => locations?.map((l) => ({ value: String(l.id), label: l.name })) || [],
    [locations]
  );

  useEffect(() => {
    if (!roleName || !userId || !assignments) {
      setSelectedIds([]);
      return;
    }

    const selectedUserId = Number(userId);
    const existingIds = assignments
      .filter((assignment) => assignment.user?.id === selectedUserId)
      .map((assignment) => {
        if (roleName === 'Hub Manager') return assignment.hub?.id;
        if (roleName === 'Warehouse Manager' || roleName === 'Storekeeper') return assignment.warehouse?.id;
        if (isRegionalOfficer || isZonalOfficer || isWoredaOfficer || isKebeleOfficer) {
          return assignment.location?.id;
        }
        return undefined;
      })
      .filter((id): id is number => id !== undefined);

    setSelectedIds(Array.from(new Set(existingIds.map(String))));
  }, [roleName, userId, assignments, isRegionalOfficer, isZonalOfficer, isWoredaOfficer, isKebeleOfficer]);

  const handleAssign = () => {
    if (!roleName || !userId) return;

    const payload: any = { user_id: Number(userId), role_name: roleName };
    if (roleName === 'Hub Manager') payload.hub_ids = selectedIds.map(Number);
    if (roleName === 'Warehouse Manager') payload.warehouse_ids = selectedIds.map(Number);
    if (roleName === 'Storekeeper') payload.warehouse_ids = selectedIds.map(Number); // Admin assigns storekeepers to warehouses
    if (isRegionalOfficer || isZonalOfficer || isWoredaOfficer || isKebeleOfficer) {
      payload.location_ids = selectedIds.map(Number);
    }

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
            setRegionId(null);
            setZoneId(null);
            setWoredaId(null);
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
        {(isZonalOfficer || isWoredaOfficer || isKebeleOfficer) && (
          <Select
            label="Region"
            placeholder="Select region"
            data={regions?.map((r) => ({ value: String(r.id), label: r.name })) || []}
            value={regionId}
            onChange={(value) => {
              setRegionId(value);
              setZoneId(null);
              setWoredaId(null);
              setSelectedIds([]);
            }}
            w={260}
          />
        )}
        {(isWoredaOfficer || isKebeleOfficer) && (
          <Select
            label="Zone"
            placeholder="Select zone"
            data={zones?.map((z) => ({ value: String(z.id), label: z.name })) || []}
            value={zoneId}
            onChange={(value) => {
              setZoneId(value);
              setWoredaId(null);
              setSelectedIds([]);
            }}
            w={260}
            disabled={!regionId}
          />
        )}
        {isKebeleOfficer && (
          <Select
            label="Woreda"
            placeholder="Select woreda"
            data={woredas?.map((w) => ({ value: String(w.id), label: w.name })) || []}
            value={woredaId}
            onChange={(value) => {
              setWoredaId(value);
              setSelectedIds([]);
            }}
            w={260}
            disabled={!zoneId}
          />
        )}
        <MultiSelect
          label="Assign Locations"
          placeholder="Select locations"
          data={locationOptions}
          value={selectedIds}
          onChange={setSelectedIds}
          w={380}
          disabled={isFederalOfficer}
        />
        <Button onClick={handleAssign} loading={bulkMutation.isPending} disabled={!canAssign}>
          Save Assignments
        </Button>
      </Group>
      {isFederalOfficer && (
        <Text c="dimmed" size="sm">
          Federal officers do not require assignments; access is system-wide by role.
        </Text>
      )}

      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Role</Table.Th>
              <Table.Th>User</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {assignments?.map((a) => (
              <Table.Tr key={a.id}>
                <Table.Td>
                  <Badge variant="light">{a.role_name}</Badge>
                </Table.Td>
                <Table.Td>{a.user?.name || '-'}</Table.Td>
                <Table.Td>{a.hub?.name || a.warehouse?.name || a.store?.name || a.location?.name || '-'}</Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    loading={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(a.id)}
                  >
                    Unassign
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
