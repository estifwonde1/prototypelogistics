import { useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Group,
  Button,
  Card,
  Table,
  ActionIcon,
  Modal,
  TextInput,
  Select,
  Badge,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconEdit, IconTrash, IconLeaf, IconBox } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import {
  getCommodityDefinitions,
  createCommodityDefinition,
  updateCommodityDefinition,
  deleteCommodityDefinition,
  type CommodityDefinition,
} from '../../../api/commodityDefinitions';
import { getCategoryReferences } from '../../../api/referenceData';
import { LoadingState } from '../../../components/common/LoadingState';
import { safeTextFilter, sanitizeSearchInput } from '../../../utils/filterUtils';
import { ErrorState } from '../../../components/common/ErrorState';
import { EmptyState } from '../../../components/common/EmptyState';
import type { ApiError } from '../../../types/common';

const CATEGORY_COLORS: Record<string, string> = {
  Food: 'green',
  'Non-Food': 'blue',
};

export default function CommoditiesSetupPage() {
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CommodityDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommodityDefinition | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const {
    data: definitions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['commodity-definitions'],
    queryFn: () => getCommodityDefinitions(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['reference-data', 'categories'],
    queryFn: getCategoryReferences,
  });

  const categoryOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  // ── Create ────────────────────────────────────────────────────────────────
  const createForm = useForm({
    initialValues: { name: '', category_id: '' },
    validate: {
      name: (v) => (!v.trim() ? 'Commodity name is required' : null),
      category_id: (v) => (!v ? 'Category is required' : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: createCommodityDefinition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commodity-definitions'] });
      notifications.show({ title: 'Success', message: 'Commodity created', color: 'green' });
      createForm.reset();
      setCreateModalOpen(false);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create commodity',
        color: 'red',
      });
    },
  });

  // ── Edit ──────────────────────────────────────────────────────────────────
  const editForm = useForm({
    initialValues: { name: '', category_id: '' },
    validate: {
      name: (v) => (!v.trim() ? 'Commodity name is required' : null),
      category_id: (v) => (!v ? 'Category is required' : null),
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name: string; commodity_category_id: number } }) =>
      updateCommodityDefinition(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commodity-definitions'] });
      notifications.show({ title: 'Success', message: 'Commodity updated', color: 'green' });
      setEditTarget(null);
      editForm.reset();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to update commodity',
        color: 'red',
      });
    },
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: deleteCommodityDefinition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commodity-definitions'] });
      notifications.show({ title: 'Success', message: 'Commodity deleted', color: 'green' });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to delete commodity',
        color: 'red',
      });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreate = createForm.onSubmit((values) => {
    createMutation.mutate({
      name: values.name.trim(),
      commodity_category_id: parseInt(values.category_id),
    });
  });

  const openEdit = (definition: CommodityDefinition) => {
    setEditTarget(definition);
    editForm.setValues({
      name: definition.name,
      category_id: definition.category_id ? String(definition.category_id) : '',
    });
  };

  const handleUpdate = editForm.onSubmit((values) => {
    if (!editTarget) return;
    updateMutation.mutate({
      id: editTarget.id,
      payload: {
        name: values.name.trim(),
        commodity_category_id: parseInt(values.category_id),
      },
    });
  });

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) return <LoadingState message="Loading commodities..." />;
  if (error) return <ErrorState message="Failed to load commodities" onRetry={() => refetch()} />;

  const foodCount = definitions.filter((d) => d.category_name === 'Food').length;
  const nonFoodCount = definitions.filter((d) => d.category_name === 'Non-Food').length;

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Commodities</Title>
          <Text c="dimmed" size="sm">
            Register commodities and assign them a category. Officers will select from this list
            when creating orders.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          New Commodity
        </Button>
      </Group>

      {/* Summary */}
      <Group grow>
        <Card withBorder padding="md" radius="md">
          <Group gap="sm">
            <IconBox size={28} color="var(--mantine-color-blue-6)" />
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total</Text>
              <Title order={3}>{definitions.length}</Title>
            </div>
          </Group>
        </Card>
        <Card withBorder padding="md" radius="md">
          <Group gap="sm">
            <IconLeaf size={28} color="var(--mantine-color-green-6)" />
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Food</Text>
              <Title order={3}>{foodCount}</Title>
            </div>
          </Group>
        </Card>
        <Card withBorder padding="md" radius="md">
          <Group gap="sm">
            <IconBox size={28} color="var(--mantine-color-blue-4)" />
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Non-Food</Text>
              <Title order={3}>{nonFoodCount}</Title>
            </div>
          </Group>
        </Card>
      </Group>

      {/* Table */}
      <Card withBorder padding="lg">
        <Stack gap="sm" mb="md">
          <Group gap="sm">
            <TextInput
              placeholder="Search by name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="All categories"
              data={[
                { value: 'Food', label: 'Food' },
                { value: 'Non-Food', label: 'Non-Food' },
              ]}
              value={categoryFilter}
              onChange={setCategoryFilter}
              clearable
              w={160}
            />
          </Group>
        </Stack>
        {(() => {
          const filtered = definitions.filter((d) => {
            const sanitizedNameFilter = sanitizeSearchInput(nameFilter);
            const matchesName = safeTextFilter(d.name, sanitizedNameFilter);
            const matchesCategory = !categoryFilter || d.category_name === categoryFilter;
            return matchesName && matchesCategory;
          });
          return filtered.length === 0 ? (
            <EmptyState
              title={definitions.length === 0 ? "No commodities yet" : "No commodities match your filters"}
              description={definitions.length === 0 ? "Create your first commodity to get started." : "Try adjusting your search or category filter."}
              action={definitions.length === 0 ? { label: 'New Commodity', onClick: () => setCreateModalOpen(true) } : undefined}
            />
          ) : (
            <Table.ScrollContainer minWidth={500}>
              <Table striped highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Commodity Name</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th style={{ width: 100, textAlign: 'right' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filtered.map((definition) => (
                    <Table.Tr key={definition.id}>
                      <Table.Td>
                        <Text fw={500}>{definition.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        {definition.category_name ? (
                          <Badge
                            variant="light"
                            color={CATEGORY_COLORS[definition.category_name] ?? 'gray'}
                          >
                            {definition.category_name}
                          </Badge>
                        ) : (
                          <Text size="sm" c="dimmed">—</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6} justify="flex-end">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => openEdit(definition)}
                            aria-label="Edit commodity"
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => setDeleteTarget(definition)}
                            aria-label="Delete commodity"
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          );
        })()}
      </Card>

      {/* Create Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => { setCreateModalOpen(false); createForm.reset(); }}
        title={<Text fw={600} size="lg">New Commodity</Text>}
        centered
        radius="md"
      >
        <form onSubmit={handleCreate}>
          <Stack gap="md">
            <TextInput
              label="Commodity Name"
              placeholder="e.g. Rice, Wheat Flour, Blankets"
              required
              {...createForm.getInputProps('name')}
            />
            <Select
              label="Category"
              placeholder="Select a category"
              data={categoryOptions}
              required
              {...createForm.getInputProps('category_id')}
            />
            <Divider />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => { setCreateModalOpen(false); createForm.reset(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending} leftSection={<IconPlus size={16} />}>
                Create
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        opened={!!editTarget}
        onClose={() => { setEditTarget(null); editForm.reset(); }}
        title={<Text fw={600} size="lg">Edit Commodity</Text>}
        centered
        radius="md"
      >
        <form onSubmit={handleUpdate}>
          <Stack gap="md">
            <TextInput
              label="Commodity Name"
              placeholder="e.g. Rice, Wheat Flour, Blankets"
              required
              {...editForm.getInputProps('name')}
            />
            <Select
              label="Category"
              placeholder="Select a category"
              data={categoryOptions}
              required
              {...editForm.getInputProps('category_id')}
            />
            <Divider />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => { setEditTarget(null); editForm.reset(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={updateMutation.isPending}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={<Text fw={600} size="lg">Delete Commodity</Text>}
        centered
        radius="md"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete{' '}
            <Text span fw={600}>{deleteTarget?.name}</Text>? This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              color="red"
              loading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}


