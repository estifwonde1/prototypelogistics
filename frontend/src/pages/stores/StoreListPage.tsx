/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  Table,
  ActionIcon,
  Modal,
  Text,
  Select,
  Badge,
  Tooltip,
  Avatar,
} from '@mantine/core';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye, IconUsers } from '@tabler/icons-react';
import { getStores, deleteStore, getStoreStorekeepers, assignStorekeeper } from '../../api/stores';
import { getWarehouses } from '../../api/warehouses';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { AssignStorekeeperModal } from '../../components/stores/AssignStorekeeperModal';
import { notifications } from '@mantine/notifications';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../hooks/useAuth';

function StoreListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<number | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const { data: stores = [], isLoading, error, refetch } = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStores(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
  });

  const { data: storekeepers = [] } = useQuery({
    queryKey: ['store-storekeepers'],
    queryFn: () => getStoreStorekeepers(),
    enabled: role === 'Warehouse Manager' || role === 'Admin',
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      notifications.show({
        title: 'Success',
        message: 'Store deleted successfully',
        color: 'green',
      });
      setDeleteModalOpen(false);
      setStoreToDelete(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to delete store',
        color: 'red',
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ userId, storeIds }: { userId: number; storeIds?: number[] }) => {
      // Use the first store in the list, or any store if assigning to all
      const storeId = storeIds && storeIds.length > 0 ? storeIds[0] : stores[0]?.id;
      return assignStorekeeper(storeId, { user_id: userId, store_ids: storeIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-storekeepers'] });
      notifications.show({
        title: 'Success',
        message: 'Storekeeper assigned successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to assign storekeeper',
        color: 'red',
      });
    },
  });

  const handleDelete = () => {
    if (storeToDelete) {
      deleteMutation.mutate(storeToDelete);
    }
  };

  const handleAssign = async (userId: number, storeIds?: number[]) => {
    await assignMutation.mutateAsync({ userId, storeIds });
  };

  const filteredStores = stores?.filter((store) => {
    const matchesSearch =
      store.name.toLowerCase().includes(search.toLowerCase()) ||
      store.code.toLowerCase().includes(search.toLowerCase());
    const matchesWarehouse = !warehouseFilter || store.warehouse_id?.toString() === warehouseFilter;
    return matchesSearch && matchesWarehouse;
  });

  const warehouseOptions = warehouses?.map((warehouse) => ({
    value: warehouse.id.toString(),
    label: `${warehouse.name} (${warehouse.code})`,
  }));

  const canManageStorekeepers = role === 'Warehouse Manager' || role === 'Admin';

  if (isLoading) {
    return <LoadingState message="Loading stores..." />;
  }

  if (error) {
    return (
      <ErrorState message="Failed to load stores. Please try again." onRetry={() => refetch()} />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Stores</Title>
          <Text c="dimmed" size="sm">
            Manage storage spaces within warehouses
          </Text>
        </div>
        <Group>
          {canManageStorekeepers && storekeepers.length > 0 && (
            <Button
              leftSection={<IconUsers size={16} />}
              variant="light"
              onClick={() => setAssignModalOpen(true)}
            >
              Assign Storekeeper
            </Button>
          )}
          {can('stores', 'create') && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/stores/new')}>
              Create Store
            </Button>
          )}
        </Group>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by name or code..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="Filter by warehouse"
          data={warehouseOptions || []}
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          clearable
          style={{ width: 250 }}
        />
      </Group>

      {filteredStores && filteredStores.length === 0 ? (
        <EmptyState
          title="No stores found"
          description={
            search || warehouseFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first store'
          }
          action={
            !search && !warehouseFilter && can('stores', 'create')
              ? {
                  label: 'Create Store',
                  onClick: () => navigate('/stores/new'),
                }
              : undefined
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={1200}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Warehouse</Table.Th>
                <Table.Th>Dimensions (L×W×H)</Table.Th>
                <Table.Th>Usable Space</Table.Th>
                <Table.Th>Available Space</Table.Th>
                <Table.Th>Type</Table.Th>
                {canManageStorekeepers && <Table.Th>Assigned Storekeepers</Table.Th>}
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredStores?.map((store) => {
                const warehouse = warehouses?.find((w) => w.id === store.warehouse_id);
                const canUpdate = can('stores', 'update');
                const canDelete = can('stores', 'delete');
                const canView = can('stores', 'read');
                
                return (
                  <Table.Tr key={store.id}>
                    <Table.Td>{store.code}</Table.Td>
                    <Table.Td>{store.name}</Table.Td>
                    <Table.Td>{warehouse?.name || '-'}</Table.Td>
                    <Table.Td>
                      {store.length}×{store.width}×{store.height}m
                    </Table.Td>
                    <Table.Td>{store.usable_space} m³</Table.Td>
                    <Table.Td>{store.available_space} m³</Table.Td>
                    <Table.Td>
                      <Badge color={store.temporary ? 'yellow' : 'blue'}>
                        {store.temporary ? 'Temporary' : 'Permanent'}
                      </Badge>
                    </Table.Td>
                    {canManageStorekeepers && (
                      <Table.Td>
                        {store.assigned_storekeepers && store.assigned_storekeepers.length > 0 ? (
                          <Tooltip
                            label={store.assigned_storekeepers.map((sk) => sk.name).join(', ')}
                            multiline
                            w={220}
                          >
                            <Avatar.Group spacing="sm">
                              {store.assigned_storekeepers.slice(0, 3).map((sk) => (
                                <Avatar key={sk.id} size="sm" radius="xl" color="blue">
                                  {sk.name.charAt(0).toUpperCase()}
                                </Avatar>
                              ))}
                              {store.assigned_storekeepers.length > 3 && (
                                <Avatar size="sm" radius="xl">
                                  +{store.assigned_storekeepers.length - 3}
                                </Avatar>
                              )}
                            </Avatar.Group>
                          </Tooltip>
                        ) : (
                          <Text size="sm" c="dimmed">
                            None
                          </Text>
                        )}
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        {!canUpdate && !canDelete && canView && (
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => navigate(`/stores/${store.id}`)}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        )}
                        {canUpdate && (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => navigate(`/stores/${store.id}/edit`)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        )}
                        {canDelete && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => {
                              setStoreToDelete(store.id);
                              setDeleteModalOpen(true);
                            }}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Store"
      >
        <Text mb="md">
          Are you sure you want to delete this store? This action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDelete} loading={deleteMutation.isPending}>
            Delete
          </Button>
        </Group>
      </Modal>

      {canManageStorekeepers && (
        <AssignStorekeeperModal
          opened={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          storekeepers={storekeepers}
          stores={stores}
          onAssign={handleAssign}
          isLoading={assignMutation.isPending}
        />
      )}
    </Stack>
  );
}

export default StoreListPage;
