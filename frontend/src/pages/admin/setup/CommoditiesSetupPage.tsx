import { useState, useMemo } from 'react';
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
  Tabs,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconLeaf,
  IconBox,
  IconTag,
  IconFolderPlus,
} from '@tabler/icons-react';
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
import {
  getCategoryReferences,
  createCategory,
  deleteCategory,
} from '../../../api/referenceData';
import type { CommodityCategory } from '../../../types/referenceData';
import { LoadingState } from '../../../components/common/LoadingState';
import { safeTextFilter, sanitizeSearchInput } from '../../../utils/filterUtils';
import { ErrorState } from '../../../components/common/ErrorState';
import { EmptyState } from '../../../components/common/EmptyState';
import type { ApiError } from '../../../types/common';

const GROUP_COLORS: Record<string, string> = {
  Food: 'green',
  'Non-Food': 'blue',
};

function getCategoryColor(groupName: string | null | undefined): string {
  if (!groupName) return 'gray';
  return GROUP_COLORS[groupName] ?? 'violet';
}

export default function CommoditiesSetupPage() {
  const queryClient = useQueryClient();

  // ── Commodity state ───────────────────────────────────────────────────────
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CommodityDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommodityDefinition | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  // ── Category state ────────────────────────────────────────────────────────
  const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<CommodityCategory | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const {
    data: definitions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['commodity-definitions'],
    queryFn: getCommodityDefinitions,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['reference-data', 'categories'],
    queryFn: getCategoryReferences,
  });

  // Separate groups (top-level) from leaf categories
  const groups = categories.filter((c) => c.is_group);
  const leafCategories = categories.filter((c) => !c.is_group);

  // Build grouped select options for commodity form (Mantine v8 grouped format)
  const categorySelectOptions = useMemo(() => {
    // Group leaf categories by their parent group name
    const byGroup: Record<string, { value: string; label: string }[]> = {};
    for (const c of leafCategories) {
      const groupKey = c.parent_name ?? 'Other';
      if (!byGroup[groupKey]) byGroup[groupKey] = [];
      byGroup[groupKey].push({ value: String(c.id), label: c.name });
    }
    // If there are no groups, return flat array
    const groupKeys = Object.keys(byGroup);
    if (groupKeys.length <= 1) {
      return leafCategories.map((c) => ({ value: String(c.id), label: c.name }));
    }
    return groupKeys.map((g) => ({ group: g, items: byGroup[g] }));
  }, [leafCategories]);

  // Group select options for category creation (flat list of top-level groups)
  const groupSelectOptions = groups.map((g) => ({
    value: String(g.id),
    label: g.name,
  }));

  // ── Commodity Create ──────────────────────────────────────────────────────
  const createForm = useForm({
    initialValues: { name: '', commodity_code: '', category_id: '' },
    validate: {
      name: (v) => (!v.trim() ? 'Commodity name is required' : null),
      commodity_code: (v) => {
        if (!v.trim()) return 'Commodity code is required';
        if (!/^[A-Za-z0-9\-_]+$/.test(v.trim())) return 'Only letters, numbers, hyphens, and underscores allowed';
        if (v.trim().length > 50) return 'Code must be 50 characters or fewer';
        return null;
      },
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

  // ── Commodity Edit ────────────────────────────────────────────────────────
  const editForm = useForm({
    initialValues: { name: '', commodity_code: '', category_id: '' },
    validate: {
      name: (v) => (!v.trim() ? 'Commodity name is required' : null),
      commodity_code: (v) => {
        if (!v.trim()) return 'Commodity code is required';
        if (!/^[A-Za-z0-9\-_]+$/.test(v.trim())) return 'Only letters, numbers, hyphens, and underscores allowed';
        if (v.trim().length > 50) return 'Code must be 50 characters or fewer';
        return null;
      },
      category_id: (v) => (!v ? 'Category is required' : null),
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name: string; commodity_code: string; commodity_category_id: number } }) =>
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

  // ── Commodity Delete ──────────────────────────────────────────────────────
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

  // ── Category Create ───────────────────────────────────────────────────────
  const categoryForm = useForm({
    initialValues: { name: '', code: '', parent_id: '' },
    validate: {
      name: (v) => (!v.trim() ? 'Category name is required' : null),
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'categories'] });
      notifications.show({ title: 'Success', message: 'Category created', color: 'green' });
      categoryForm.reset();
      setCreateCategoryModalOpen(false);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create category',
        color: 'red',
      });
    },
  });

  // ── Category Delete ───────────────────────────────────────────────────────
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'categories'] });
      notifications.show({ title: 'Success', message: 'Category deleted', color: 'green' });
      setDeleteCategoryTarget(null);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to delete category',
        color: 'red',
      });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreate = createForm.onSubmit((values) => {
    createMutation.mutate({
      name: values.name.trim(),
      commodity_code: values.commodity_code.trim(),
      commodity_category_id: parseInt(values.category_id),
    });
  });

  const openEdit = (definition: CommodityDefinition) => {
    setEditTarget(definition);
    editForm.setValues({
      name: definition.name,
      commodity_code: definition.commodity_code ?? '',
      category_id: definition.category_id ? String(definition.category_id) : '',
    });
  };

  const handleUpdate = editForm.onSubmit((values) => {
    if (!editTarget) return;
    updateMutation.mutate({
      id: editTarget.id,
      payload: {
        name: values.name.trim(),
        commodity_code: values.commodity_code.trim(),
        commodity_category_id: parseInt(values.category_id),
      },
    });
  });

  const handleCreateCategory = categoryForm.onSubmit((values) => {
    createCategoryMutation.mutate({
      name: values.name.trim(),
      code: values.code.trim() || undefined,
      parent_id: values.parent_id ? parseInt(values.parent_id) : null,
    });
  });

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) return <LoadingState message="Loading commodities..." />;
  if (error) return <ErrorState message="Failed to load commodities" onRetry={() => refetch()} />;

  const foodCount = definitions.filter((d) => d.group_name === 'Food').length;
  const nonFoodCount = definitions.filter((d) => d.group_name === 'Non-Food').length;

  const uniqueGroups = Array.from(new Set(definitions.map((d) => d.group_name).filter(Boolean)));

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Commodities</Title>
          <Text c="dimmed" size="sm">
            Manage commodity definitions and categories. Officers select from this list when creating orders.
          </Text>
        </div>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconFolderPlus size={16} />}
            onClick={() => setCreateCategoryModalOpen(true)}
          >
            New Category
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
            New Commodity
          </Button>
        </Group>
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
        <Card withBorder padding="md" radius="md">
          <Group gap="sm">
            <IconTag size={28} color="var(--mantine-color-violet-6)" />
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Categories</Text>
              <Title order={3}>{leafCategories.length}</Title>
            </div>
          </Group>
        </Card>
      </Group>

      <Tabs defaultValue="commodities">
        <Tabs.List>
          <Tabs.Tab value="commodities" leftSection={<IconBox size={16} />}>
            Commodities
          </Tabs.Tab>
          <Tabs.Tab value="categories" leftSection={<IconTag size={16} />}>
            Categories
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Commodities Tab ── */}
        <Tabs.Panel value="commodities" pt="md">
          <Card withBorder padding="lg">
            <Stack gap="sm" mb="md">
              <Group gap="sm">
                <TextInput
                  placeholder="Search by name or code..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Select
                  placeholder="All groups"
                  data={[
                    ...uniqueGroups.map((g) => ({ value: g!, label: g! })),
                  ]}
                  value={groupFilter}
                  onChange={setGroupFilter}
                  clearable
                  w={180}
                />
              </Group>
            </Stack>
            {(() => {
              const filtered = definitions.filter((d) => {
                const sanitized = sanitizeSearchInput(nameFilter);
                const matchesName = safeTextFilter(d.name, sanitized) || safeTextFilter(d.commodity_code ?? '', sanitized);
                const matchesGroup = !groupFilter || d.group_name === groupFilter;
                return matchesName && matchesGroup;
              });
              return filtered.length === 0 ? (
                <EmptyState
                  title={definitions.length === 0 ? 'No commodities yet' : 'No commodities match your filters'}
                  description={
                    definitions.length === 0
                      ? 'Create your first commodity to get started.'
                      : 'Try adjusting your search or group filter.'
                  }
                  action={
                    definitions.length === 0
                      ? { label: 'New Commodity', onClick: () => setCreateModalOpen(true) }
                      : undefined
                  }
                />
              ) : (
                <Table.ScrollContainer minWidth={600}>
                  <Table striped highlightOnHover verticalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Commodity Name</Table.Th>
                        <Table.Th>Code</Table.Th>
                        <Table.Th>Group</Table.Th>
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
                            <Text size="sm" ff="monospace" c="dimmed">
                              {definition.commodity_code ?? '—'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {definition.group_name ? (
                              <Badge variant="filled" color={getCategoryColor(definition.group_name)} size="sm">
                                {definition.group_name}
                              </Badge>
                            ) : (
                              <Text size="sm" c="dimmed">—</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {definition.category_name ? (
                              <Badge variant="light" color={getCategoryColor(definition.group_name)} size="sm">
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
        </Tabs.Panel>

        {/* ── Categories Tab ── */}
        <Tabs.Panel value="categories" pt="md">
          <Card withBorder padding="lg">
            <Group justify="space-between" mb="md">
              <Text fw={600}>Commodity Categories</Text>
              <Button
                size="xs"
                leftSection={<IconFolderPlus size={14} />}
                onClick={() => setCreateCategoryModalOpen(true)}
              >
                New Category
              </Button>
            </Group>
            {categoriesLoading ? (
              <LoadingState message="Loading categories..." />
            ) : categories.length === 0 ? (
              <EmptyState
                title="No categories yet"
                description="Create commodity groups and categories to organize your commodities."
                action={{ label: 'New Category', onClick: () => setCreateCategoryModalOpen(true) }}
              />
            ) : (
              <Table.ScrollContainer minWidth={400}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Code</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Parent Group</Table.Th>
                      <Table.Th style={{ width: 80, textAlign: 'right' }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {/* Render groups first, then leaf categories */}
                    {[...groups, ...leafCategories].map((cat) => (
                      <Table.Tr key={cat.id}>
                        <Table.Td>
                          <Text fw={cat.is_group ? 600 : 400}>{cat.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed" ff="monospace">{cat.code ?? '—'}</Text>
                        </Table.Td>
                        <Table.Td>
                          {cat.is_group ? (
                            <Badge color="orange" variant="light" size="sm">Group</Badge>
                          ) : (
                            <Badge color="teal" variant="light" size="sm">Category</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {cat.parent_name ? (
                            <Text size="sm">{cat.parent_name}</Text>
                          ) : (
                            <Text size="sm" c="dimmed">—</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end">
                            <Tooltip label="Delete category" withArrow>
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() => setDeleteCategoryTarget(cat)}
                                aria-label="Delete category"
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* ── Create Commodity Modal ── */}
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
            <TextInput
              label="Commodity Code"
              placeholder="e.g. RICE-001, WF-002"
              description="Unique identifier. Letters, numbers, hyphens, and underscores only."
              required
              {...createForm.getInputProps('commodity_code')}
            />
            <Select
              label="Category"
              placeholder="Select a category"
              data={categorySelectOptions}
              required
              searchable
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

      {/* ── Edit Commodity Modal ── */}
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
            <TextInput
              label="Commodity Code"
              placeholder="e.g. RICE-001, WF-002"
              description="Unique identifier. Letters, numbers, hyphens, and underscores only."
              required
              {...editForm.getInputProps('commodity_code')}
            />
            <Select
              label="Category"
              placeholder="Select a category"
              data={categorySelectOptions}
              required
              searchable
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

      {/* ── Delete Commodity Modal ── */}
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

      {/* ── Create Category Modal ── */}
      <Modal
        opened={createCategoryModalOpen}
        onClose={() => { setCreateCategoryModalOpen(false); categoryForm.reset(); }}
        title={<Text fw={600} size="lg">New Category</Text>}
        centered
        radius="md"
      >
        <form onSubmit={handleCreateCategory}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Create a top-level <strong>Commodity Group</strong> (e.g. Food, Non-Food) by leaving the parent blank,
              or create a <strong>Category</strong> under an existing group (e.g. Cereal under Food).
            </Text>
            <TextInput
              label="Name"
              placeholder="e.g. Food, Cereal, Cleaning Supplies"
              required
              {...categoryForm.getInputProps('name')}
            />
            <TextInput
              label="Code"
              placeholder="e.g. FOOD, CRL (optional)"
              {...categoryForm.getInputProps('code')}
            />
            <Select
              label="Parent Group"
              placeholder="None — this is a top-level group"
              data={groupSelectOptions}
              clearable
              {...categoryForm.getInputProps('parent_id')}
            />
            <Divider />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => { setCreateCategoryModalOpen(false); categoryForm.reset(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={createCategoryMutation.isPending} leftSection={<IconPlus size={16} />}>
                Create
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* ── Delete Category Modal ── */}
      <Modal
        opened={!!deleteCategoryTarget}
        onClose={() => setDeleteCategoryTarget(null)}
        title={<Text fw={600} size="lg">Delete Category</Text>}
        centered
        radius="md"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete the category{' '}
            <Text span fw={600}>{deleteCategoryTarget?.name}</Text>?
          </Text>
          {deleteCategoryTarget?.is_group && (
            <Text size="sm" c="orange">
              This is a top-level group. All sub-categories must be deleted first.
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteCategoryTarget(null)}>Cancel</Button>
            <Button
              color="red"
              loading={deleteCategoryMutation.isPending}
              onClick={() => deleteCategoryTarget && deleteCategoryMutation.mutate(deleteCategoryTarget.id)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
