import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBox,
  IconBuildingWarehouse,
  IconEdit,
  IconEye,
  IconLayoutGrid,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { AxiosError } from 'axios';
import { deleteStack, getStacks } from '../../api/stacks';
import { getStores } from '../../api/stores';
import { getWarehouses } from '../../api/warehouses';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { StatusBadge } from '../../components/common/StatusBadge';
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

function StackListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [stackToDelete, setStackToDelete] = useState<number | null>(null);

  const { data: stacks, isLoading, error, refetch } = useQuery({
    queryKey: ['stacks'],
    queryFn: () => getStacks(),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStores(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
  });

  const warehouseOptions =
    warehouses?.map((warehouse) => ({
      value: warehouse.id.toString(),
      label: `${warehouse.name} (${warehouse.code})`,
    })) || [];

  const filteredStoreOptions = useMemo(() => {
    if (!warehouseFilter) {
      return (
        stores?.map((store) => ({
          value: store.id.toString(),
          label: `${store.name} (${store.code})`,
        })) || []
      );
    }

    return (
      stores
        ?.filter((store) => store.warehouse_id?.toString() === warehouseFilter)
        .map((store) => ({
          value: store.id.toString(),
          label: `${store.name} (${store.code})`,
        })) || []
    );
  }, [stores, warehouseFilter]);

  const filteredStacks = useMemo(() => {
    return (
      stacks?.filter((stack) => {
        const matchesSearch = (stack.code || '').toLowerCase().includes(search.toLowerCase());
        const matchesStore = !storeFilter || stack.store_id?.toString() === storeFilter;
        const stackStore = stores?.find((store) => store.id === stack.store_id);
        const matchesWarehouse =
          !warehouseFilter || stackStore?.warehouse_id?.toString() === warehouseFilter;
        return matchesSearch && matchesStore && matchesWarehouse;
      }) || []
    );
  }, [search, stacks, storeFilter, stores, warehouseFilter]);

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
    onError: (mutationError: AxiosError<ApiError>) => {
      notifications.show({
        title: 'Error',
        message: mutationError.response?.data?.error?.message || 'Failed to delete stack',
        color: 'red',
      });
    },
  });

  const totalArea = filteredStacks.reduce((sum, stack) => sum + stack.length * stack.width, 0);
  const activeStacks = filteredStacks.filter((stack) => stack.stack_status === 'active').length;
  const reservedStacks = filteredStacks.filter((stack) => stack.stack_status === 'reserved').length;

  if (isLoading) {
    return <LoadingState message="Loading stacks..." />;
  }

  if (error) {
    return (
      <ErrorState message="Failed to load stacks. Please try again." onRetry={() => refetch()} />
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
                Stack Registry
              </Badge>
              <Title order={2} c="#1d3354">
                Stacks
              </Title>
              <Text c="#64748b" mt={6}>
                Manage commodity stacks with the same layout-ready operational style used in the
                stacking board.
              </Text>
            </div>

            <Group gap="sm">
              <Button
                variant="light"
                radius="md"
                leftSection={<IconLayoutGrid size={16} />}
                onClick={() => navigate('/stacks/layout')}
              >
                Open Layout
              </Button>
              {can('stacks', 'create') && (
                <Button
                  radius="md"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => navigate('/stacks/layout?mode=create')}
                >
                  Create Stack
                </Button>
              )}
            </Group>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
              <Group align="center" gap="md">
                <ThemeIcon size={42} radius="md" variant="light" color="blue">
                  <IconBuildingWarehouse size={22} />
                </ThemeIcon>
                <div>
                  <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                    Visible Stacks
                  </Text>
                  <Title order={2} c="#1d3354">
                    {filteredStacks.length}
                  </Title>
                </div>
              </Group>
            </Card>

            <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
              <Group align="center" gap="md">
                <ThemeIcon size={42} radius="md" variant="light" color="blue">
                  <IconBox size={22} />
                </ThemeIcon>
                <div>
                  <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                    Active / Reserved
                  </Text>
                  <Title order={2} c="#1d57a8">
                    {activeStacks} / {reservedStacks}
                  </Title>
                </div>
              </Group>
            </Card>

            <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
              <Group align="center" gap="md">
                <ThemeIcon size={42} radius="md" variant="light" color="gray">
                  <IconLayoutGrid size={22} />
                </ThemeIcon>
                <div>
                  <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                    Stacked Area
                  </Text>
                  <Title order={2} c="#44526b">
                    {numberFormatter.format(totalArea)} m²
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
            <Group gap="md" wrap="wrap" align="end">
              <TextInput
                label="Search Stack Code"
                placeholder="STK-001"
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                styles={{
                  label: { fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' },
                  input: { backgroundColor: '#edf4ff', borderColor: '#d5def2' },
                }}
                style={{ flex: 1, minWidth: 220 }}
              />
              <Select
                label="Warehouse"
                placeholder="All warehouses"
                data={warehouseOptions}
                value={warehouseFilter}
                onChange={(value) => {
                  setWarehouseFilter(value);
                  setStoreFilter(null);
                }}
                clearable
                styles={{
                  label: { fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' },
                  input: { backgroundColor: '#edf4ff', borderColor: '#d5def2' },
                }}
                w={260}
              />
              <Select
                label="Store"
                placeholder="All stores"
                data={filteredStoreOptions}
                value={storeFilter}
                onChange={setStoreFilter}
                clearable
                styles={{
                  label: { fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' },
                  input: { backgroundColor: '#edf4ff', borderColor: '#d5def2' },
                }}
                w={280}
              />
            </Group>
          </Card>

          {filteredStacks.length === 0 ? (
            <Card radius="xl" padding="xl" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
              <EmptyState
                title="No stacks found"
                description={
                  search || storeFilter || warehouseFilter
                    ? 'Try adjusting your filters to widen the result set.'
                    : 'Start by creating your first stack for this workflow.'
                }
                action={
                  !search && !storeFilter && !warehouseFilter && can('stacks', 'create')
                    ? {
                        label: 'Create Stack',
                        onClick: () => navigate('/stacks/layout?mode=create'),
                      }
                    : undefined
                }
              />
            </Card>
          ) : (
            <Card
              radius="xl"
              padding="lg"
              style={{
                background: '#ffffff',
                border: '1px solid #dce5f5',
                boxShadow: '0 16px 36px rgba(56, 84, 128, 0.10)',
              }}
            >
              <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Code</Table.Th>
                    <Table.Th>Store</Table.Th>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Dimensions</Table.Th>
                    <Table.Th>Position</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th style={{ width: 132 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredStacks.map((stack) => (
                    <Table.Tr key={stack.id}>
                      <Table.Td>
                        <Text fw={800} c="#1d3354">
                          {stack.code}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600}>{stack.store_name || stack.store_code || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text fw={700}>{stack.commodity_name || stack.commodity_code || '-'}</Text>
                          <Text size="xs" c="dimmed">
                            {stack.commodity_status}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600}>
                          {numberFormatter.format(stack.length)} x {numberFormatter.format(stack.width)} x{' '}
                          {numberFormatter.format(stack.height)} m
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600}>
                          X: {numberFormatter.format(stack.start_x)} / Y:{' '}
                          {numberFormatter.format(stack.start_y)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={700}>
                          {numberFormatter.format(stack.quantity)} {stack.unit_abbreviation || stack.unit_name || ''}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge status={stack.stack_status} />
                      </Table.Td>
                      <Table.Td>
                        <Group gap={8} wrap="nowrap">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            onClick={() => navigate('/stacks/layout')}
                            aria-label="View stack layout"
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                          {can('stacks', 'update') && (
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() => navigate(`/stacks/${stack.id}/edit`)}
                              aria-label="Edit stack"
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          )}
                          {can('stacks', 'delete') && (
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => {
                                setStackToDelete(stack.id);
                                setDeleteModalOpen(true);
                              }}
                              aria-label="Delete stack"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}
        </Stack>
      </Stack>

      <Modal
        opened={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setStackToDelete(null);
        }}
        title="Delete Stack"
        centered
        radius="xl"
      >
        <Stack gap="lg">
          <Text c="#55657f">
            Are you sure you want to delete this stack? This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => {
                setDeleteModalOpen(false);
                setStackToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (stackToDelete) {
                  deleteMutation.mutate(stackToDelete);
                }
              }}
            >
              Delete Stack
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default StackListPage;
