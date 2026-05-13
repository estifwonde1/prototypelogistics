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
  Badge,
  Divider,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash, IconShield, IconAlertCircle } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { getAdminRoles, createAdminRole, deleteAdminRole } from '../../../api/adminRoles';
import type { AdminRole } from '../../../types/admin';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';
import { EmptyState } from '../../../components/common/EmptyState';
import type { ApiError } from '../../../types/common';

// Roles that are built-in and should not be deleted
const PROTECTED_ROLES = new Set([
  'Admin',
  'Superadmin',
]);

export default function RolesManagementPage() {
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const {
    data: roles = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: getAdminRoles,
  });

  // ── Create ────────────────────────────────────────────────────────────────
  const createForm = useForm({
    initialValues: { name: '' },
    validate: {
      name: (v) => {
        if (!v.trim()) return 'Role name is required';
        if (v.trim().length < 2) return 'Role name must be at least 2 characters';
        if (v.trim().length > 100) return 'Role name must be 100 characters or fewer';
        return null;
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createAdminRole(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      notifications.show({ title: 'Success', message: 'Role created successfully', color: 'green' });
      createForm.reset();
      setCreateModalOpen(false);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create role',
        color: 'red',
      });
    },
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      notifications.show({ title: 'Success', message: 'Role deleted', color: 'green' });
      setDeleteTarget(null);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to delete role',
        color: 'red',
      });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreate = createForm.onSubmit((values) => {
    createMutation.mutate(values.name.trim());
  });

  const isProtected = (role: AdminRole) => PROTECTED_ROLES.has(role.name);

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) return <LoadingState message="Loading roles..." />;
  if (error) return <ErrorState message="Failed to load roles" onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Role Management</Title>
          <Text c="dimmed" size="sm">
            Create and manage roles. Roles control what users can access in the system.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          New Role
        </Button>
      </Group>

      {/* Summary */}
      <Card withBorder padding="md" radius="md" maw={200}>
        <Group gap="sm">
          <IconShield size={28} color="var(--mantine-color-blue-6)" />
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Roles</Text>
            <Title order={3}>{roles.length}</Title>
          </div>
        </Group>
      </Card>

      {/* Roles Table */}
      <Card withBorder padding="lg">
        {roles.length === 0 ? (
          <EmptyState
            title="No roles yet"
            description="Create your first role to get started."
            action={{ label: 'New Role', onClick: () => setCreateModalOpen(true) }}
          />
        ) : (
          <Table.ScrollContainer minWidth={400}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Role Name</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ width: 80, textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {roles.map((role) => (
                  <Table.Tr key={role.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconShield size={16} color="var(--mantine-color-blue-5)" />
                        <Text fw={500}>{role.name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {isProtected(role) ? (
                        <Badge color="gray" variant="light" size="sm">System</Badge>
                      ) : (
                        <Badge color="blue" variant="light" size="sm">Custom</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteTarget(role)}
                          disabled={isProtected(role)}
                          aria-label={isProtected(role) ? 'Cannot delete system role' : 'Delete role'}
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
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => { setCreateModalOpen(false); createForm.reset(); }}
        title={<Text fw={600} size="lg">New Role</Text>}
        centered
        radius="md"
        size="sm"
      >
        <form onSubmit={handleCreate}>
          <Stack gap="md">
            <TextInput
              label="Role Name"
              placeholder="e.g. Quality Assurance, Receipt Authorizer"
              required
              {...createForm.getInputProps('name')}
            />
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Role names are case-sensitive. Once created, a role can be assigned to users via User Assignments.
            </Alert>
            <Divider />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => { setCreateModalOpen(false); createForm.reset(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending} leftSection={<IconPlus size={16} />}>
                Create Role
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={<Text fw={600} size="lg">Delete Role</Text>}
        centered
        radius="md"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete the role{' '}
            <Text span fw={600}>{deleteTarget?.name}</Text>?
          </Text>
          <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
            This will fail if any active users are currently assigned this role. Reassign or deactivate those users first.
          </Alert>
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
