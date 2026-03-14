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
import { getStacks, deleteStack } from '../../api/stacks';
import { getStores } from '../../api/stores';
import { getWarehouses } from '../../api/warehouses';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { notifications } from '@mantine/notifications';

function StackListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [stackToDelete, setStackToDelete] = useState<number | null>(null);

  const { data: stacks, isLoading, error, refetch } = useQuery({
    queryKey: ['stacks'],
    queryFn: getStacks,
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      notifications.show({
        title: 'Success',
        message: 'Stack deleted successfully',
        color: 'green',
      });
      setDeleteModalOpen(false);
      setStackToDelete(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to delete stack',
        color: 'red',
      });
    },
  });

  const handleDelete = () => {
    if (stackToDelete) {
      deleteMutation.mutate(stackToDelete);
    }
  };

  const filteredStacks = stacks?.filter((stack) => {
    const matchesSearch = stack.code.toLowerCase().includes(search.toLowerCase());
    const matchesStore = !storeFilter || stack.store_id?.toString() === storeFilter;
    
    let matchesWarehouse = true;
    if (warehouseFilter) {
      const store = stores?.find((s) => s.id === stack.store_id);
      matchesWarehouse = store?.warehouse_id?.toString() === warehouseFilter;
    }
    
    return matchesSearch && matchesStore && matchesWarehouse;
  });

  const storeOptions = stores?.map((store) => ({
    value: store.id.toString(),
    label: `${store.name} (${store.code})`,
  }));

  const warehouseOptions = warehouses?.map((warehouse) => ({
    value: warehouse.id.toString(),
    label: `${warehouse.name} (${warehouse.code})`,
  }));

  if (isLoading) {
    return <LoadingState message="Loading stacks..." />;
  }

  if (error) {
    return (
      <ErrorState message="Failed to load stacks. Please try again." onRetry={() => refetch()} />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Stacks</Title>
          <Text c="dimmed" size="sm">
            Manage commodity stacks within stores
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/stacks/new')}>
          Create Stack
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by code..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 300 }}
        />
        <Select
          placeholder="Filter by warehouse"
          data={warehouseOptions || []}
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          clearable
          style={{ width: 250 }}
        />
        <Select
          placeholder="Filter by store"
          data={storeOptions || []}
          value={storeFilter}
          onChange={setStoreFilter}
          clearable
          style={{ width: 250 }}
        />
      </Group>

      {filteredStacks && filteredStacks.length === 0 ? (
        <EmptyState
          title="No stacks found"
          description={
            search || storeFilter || warehouseFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first stack'
          }
          action={
            !search && !storeFilter && !warehouseFilter
              ? {
                  label: 'Create Stack',
                  onClick: () => navigate('/stacks/new'),
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
                <Table.Th>Store</Table.Th>
                <Table.Th>Commodity ID</Table.Th>
                <Table.Th>Dimensions (L×W×H)</Table.Th>
                <Table.Th>Position (X, Y)</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Unit ID</Table.Th>
                <Table.Th>Commodity Status</Table.Th>
                <Table.Th>Stack Status</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredStacks?.map((stack) => {
                const store = stores?.find((s) => s.id === stack.store_id);
                return (
                  <Table.Tr key={stack.id}>
                    <Table.Td>{stack.code}</Table.Td>
                    <Table.Td>{store?.name || '-'}</Table.Td>
                    <Table.Td>{stack.commodity_id}</Table.Td>
                    <Table.Td>
                      {stack.length}×{stack.width}×{stack.height}m
                    </Table.Td>
                    <Table.Td>
                      ({stack.start_x}, {stack.start_y})
                    </Table.Td>
                    <Table.Td>{stack.quantity}</Table.Td>
                    <Table.Td>{stack.unit_id}</Table.Td>
                    <Table.Td>
                      <StatusBadge status={stack.commodity_status} />
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={stack.stack_status} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={() => navigate(`/stacks/${stack.id}/edit`)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => {
                            setStackToDelete(stack.id);
                            setDeleteModalOpen(true);
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
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
        title="Delete Stack"
      >
        <Text mb="md">
          Are you sure you want to delete this stack? This action cannot be undone.
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

export default StackListPage;
