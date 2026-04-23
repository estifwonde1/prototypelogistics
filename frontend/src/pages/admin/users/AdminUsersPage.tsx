/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import {
  Stack,
  Group,
  Title,
  Button,
  Select,
  MultiSelect,
  Table,
  ActionIcon,
  Modal,
  TextInput,
  PasswordInput,
  Text,
  Badge,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../../api/adminUsers';
import { getAdminRoles } from '../../../api/adminRoles';
import { getWarehouses } from '../../../api/warehouses';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';
import { EmptyState } from '../../../components/common/EmptyState';
import type { AdminUser } from '../../../types/admin';

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

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
  });

  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: getAdminRoles,
  });

  const usersQueryKey = useMemo(() => ['admin-users', warehouseFilter, roleFilter], [warehouseFilter, roleFilter]);
  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: usersQueryKey,
    queryFn: () =>
      getAdminUsers({
        warehouse_id: warehouseFilter ? Number(warehouseFilter) : undefined,
        role_name: roleFilter || undefined,
      }),
  });

  const form = useForm({
    initialValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone_number: '',
      password: '',
      password_confirmation: '',
      role_names: [] as string[],
    },
    validate: {
      first_name: (v) => (!v ? 'First name is required' : null),
      last_name: (v) => (!v ? 'Last name is required' : null),
      email: (v) => (!/^\S+@\S+$/.test(v) ? 'Valid email is required' : null),
      phone_number: (v) => {
        if (!v) return 'Phone is required';
        const digitsOnly = v.replace(/\D/g, '');
        if (!(digitsOnly.length === 10 || digitsOnly.length === 12)) {
          return 'Phone must be 10 or 12 digits';
        }
        return null;
      },
      role_names: (v) => {
        if (v.length === 0) return 'At least one role is required';
        const hasOfficer = v.some((r) => r.toLowerCase().includes('officer'));
        if (hasOfficer && v.length > 1) {
          return 'Officer roles cannot be combined with other roles.';
        }
        return null;
      },
      password_confirmation: (v, values) =>
        values.password && v !== values.password ? 'Passwords do not match' : null,
    },
  });

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      notifications.show({ title: 'Success', message: 'User created', color: 'green' });
      setModalOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Failed to create user',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => updateAdminUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      notifications.show({ title: 'Success', message: 'User updated', color: 'green' });
      setModalOpen(false);
      setEditUser(null);
      form.reset();
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Failed to update user',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      notifications.show({ title: 'Success', message: 'User deleted', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Failed to delete user',
        color: 'red',
      });
    },
  });

  const openCreateModal = () => {
    setEditUser(null);
    form.reset();
    setModalOpen(true);
  };

  const openEditModal = (user: AdminUser) => {
    setEditUser(user);
    form.setValues({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number || '',
      password: '',
      password_confirmation: '',
      role_names: user.roles || [],
    });
    setModalOpen(true);
  };

  const handleSubmit = (values: typeof form.values) => {
    const payload = {
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      phone_number: values.phone_number,
      role_names: values.role_names,
      ...(values.password ? { password: values.password, password_confirmation: values.password_confirmation } : {}),
    };

    if (editUser) {
      updateMutation.mutate({ id: editUser.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoading) return <LoadingState message="Loading users..." />;
  if (error) return <ErrorState message="Failed to load users" onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Users</Title>
          <Text c="dimmed" size="sm">
            Create and manage users with roles and warehouse filters
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Create User
        </Button>
      </Group>

      <Group>
        <Select
          label="Filter by Warehouse"
          placeholder="All warehouses"
          data={warehouses?.map((w) => ({ value: String(w.id), label: w.name })) || []}
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          clearable
          w={320}
        />
        <Select
          label="Filter by Role"
          placeholder="All roles"
          data={(roles?.map((r) => r.name) || ROLE_OPTIONS).map((name) => ({ value: name, label: name }))}
          value={roleFilter}
          onChange={setRoleFilter}
          clearable
          w={260}
        />
      </Group>

      {users && users.length === 0 ? (
        <EmptyState title="No users found" description="Create your first user to get started" />
      ) : (
        <Table.ScrollContainer minWidth={800}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th>Roles</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users?.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>{`${user.first_name} ${user.last_name}`}</Table.Td>
                  <Table.Td>{user.email}</Table.Td>
                  <Table.Td>{user.phone_number || '-'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {user.roles?.map((role) => (
                        <Badge key={role} variant="light">
                          {role}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end">
                      <ActionIcon variant="subtle" color="gray" onClick={() => openEditModal(user)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => deleteMutation.mutate(user.id)}
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

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? 'Edit User' : 'Create User'}>
        <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
          <Stack gap="sm">
            <Group grow>
              <TextInput label="First name" {...form.getInputProps('first_name')} required />
              <TextInput label="Last name" {...form.getInputProps('last_name')} required />
            </Group>
            <TextInput label="Email" {...form.getInputProps('email')} required />
            <TextInput
              label="Phone"
              description="Enter 10 or 12 digits (numbers only)"
              inputMode="numeric"
              value={form.values.phone_number}
              onChange={(event) => {
                const digits = event.currentTarget.value.replace(/\D/g, '').slice(0, 12);
                form.setFieldValue('phone_number', digits);
              }}
              error={form.errors.phone_number}
              required
            />
            <MultiSelect
              label="Roles"
              placeholder="Select one or more roles"
              data={(roles?.map((r) => r.name) || ROLE_OPTIONS).map((name) => ({ value: name, label: name }))}
              {...form.getInputProps('role_names')}
              required
            />
            <Divider my="sm" />
            <PasswordInput label="Password" {...form.getInputProps('password')} />
            <PasswordInput label="Confirm password" {...form.getInputProps('password_confirmation')} />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {editUser ? 'Update' : 'Create'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

