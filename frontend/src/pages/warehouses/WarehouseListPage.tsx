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
} from '@mantine/core';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import { getWarehouses, deleteWarehouse } from '../../api/warehouses';
import { getHubs } from '../../api/hubs';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { notifications } from '@mantine/notifications';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';

function WarehouseListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [hubFilter, setHubFilter] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState<number | null>(null);
  const { can } = usePermission();
  const role = useAuthStore((state) => state.role);
  const isWarehouseManager = role === 'warehouse_manager';
  const canCreate = can('warehouses', 'create');
  const canUpdate = can('warehouses', 'update');
  const canDelete = can('warehouses', 'delete');
  const canReadHubs = can('hubs', 'read');

  const { data: warehouses = [], isLoading, error, refetch } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
  });

  const { data: hubs } = useQuery({
    queryKey: ['hubs'],
    queryFn: () => getHubs(),
    enabled: canReadHubs,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      notifications.show({
        title: 'Success',
        message: 'Warehouse deleted successfully',
        color: 'green',
      });
      setDeleteModalOpen(false);
      setWarehouseToDelete(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to delete warehouse',
        color: 'red',
      });
    },
  });

  const handleDelete = () => {
    if (warehouseToDelete) {
      deleteMutation.mutate(warehouseToDelete);
    }
  };

  const filteredWarehouses = warehouses?.filter((warehouse) => {
    const matchesSearch =
      warehouse.name.toLowerCase().includes(search.toLowerCase()) ||
      warehouse.code.toLowerCase().includes(search.toLowerCase());
    const matchesHub = !hubFilter || warehouse.hub_id?.toString() === hubFilter;
    return matchesSearch && matchesHub;
  });

  const hubOptions = hubs?.map((hub) => ({
    value: hub.id.toString(),
    label: `${hub.name} (${hub.code})`,
  }));

  if (isLoading) {
    return <LoadingState message="Loading warehouses..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load warehouses. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Warehouses</Title>
          <Text c="dimmed" size="sm">
            Manage main, satellite, and temporary warehouses
          </Text>
        </div>
        {canCreate && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/warehouses/new')}
          >
            Create Warehouse
          </Button>
        )}
      </Group>

      <Group>
        <TextInput
          placeholder="Search by name or code..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        {canReadHubs && (
          <Select
            placeholder="Filter by hub"
            data={hubOptions || []}
            value={hubFilter}
            onChange={setHubFilter}
            clearable
            style={{ width: 250 }}
          />
        )}
      </Group>

      {filteredWarehouses && filteredWarehouses.length === 0 ? (
        <EmptyState
          title="No warehouses found"
          description={
            search || hubFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first warehouse'
          }
          action={
            !search && !hubFilter && canCreate
              ? {
                  label: 'Create Warehouse',
                  onClick: () => navigate('/warehouses/new'),
                }
              : undefined
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Hub</Table.Th>
                <Table.Th>Subcity</Table.Th>
                <Table.Th>Woreda</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredWarehouses?.map((warehouse) => {
                const hub = hubs?.find((h) => h.id === warehouse.hub_id);
                return (
                  <Table.Tr
                    key={warehouse.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/warehouses/${warehouse.id}`)}
                  >
                    <Table.Td>{warehouse.code}</Table.Td>
                    <Table.Td>{warehouse.name}</Table.Td>
                    <Table.Td style={{ textTransform: 'capitalize' }}>
                      {warehouse.warehouse_type}
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={warehouse.status} />
                    </Table.Td>
                    <Table.Td>{warehouse.hub_name || hub?.name || '-'}</Table.Td>
                    <Table.Td>{warehouse.subcity_name || '-'}</Table.Td>
                    <Table.Td>{warehouse.woreda_name || warehouse.location_name || '-'}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => navigate(`/warehouses/${warehouse.id}`)}
                        >
                          Details
                        </Button>
                        {canUpdate && !isWarehouseManager && (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => navigate(`/warehouses/${warehouse.id}/edit`)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        )}
                        {canDelete && !isWarehouseManager && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => {
                              setWarehouseToDelete(warehouse.id);
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
        title="Delete Warehouse"
      >
        <Text mb="md">
          Are you sure you want to delete this warehouse? This action cannot be undone.
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
    </Stack>
  );
}

export default WarehouseListPage;
