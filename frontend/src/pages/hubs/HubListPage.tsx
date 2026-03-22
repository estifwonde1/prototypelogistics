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
} from '@mantine/core';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import { getHubs, deleteHub } from '../../api/hubs';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { notifications } from '@mantine/notifications';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';

function HubListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [hubToDelete, setHubToDelete] = useState<number | null>(null);
  const { can } = usePermission();
  const role = useAuthStore((state) => state.role);
  const isHubManager = role === 'hub_manager';
  const canCreate = can('hubs', 'create');
  const canUpdate = can('hubs', 'update');
  const canDelete = can('hubs', 'delete');

  const { data: hubs, isLoading, error, refetch } = useQuery({
    queryKey: ['hubs'],
    queryFn: getHubs,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHub,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      notifications.show({
        title: 'Success',
        message: 'Hub deleted successfully',
        color: 'green',
      });
      setDeleteModalOpen(false);
      setHubToDelete(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to delete hub',
        color: 'red',
      });
    },
  });

  const handleDelete = () => {
    if (hubToDelete) {
      deleteMutation.mutate(hubToDelete);
    }
  };

  const filteredHubs = hubs?.filter(
    (hub) =>
      hub.name.toLowerCase().includes(search.toLowerCase()) ||
      hub.code.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <LoadingState message="Loading hubs..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load hubs. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Hubs</Title>
          <Text c="dimmed" size="sm">
            Manage regional, zonal, and woreda hubs
          </Text>
        </div>
        {canCreate && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/hubs/new')}>
            Create Hub
          </Button>
        )}
      </Group>

      <TextInput
        placeholder="Search by name or code..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 400 }}
      />

      {filteredHubs && filteredHubs.length === 0 ? (
        <EmptyState
          title="No hubs found"
          description={search ? 'Try adjusting your search' : 'Get started by creating your first hub'}
          action={
            !search && canCreate
              ? {
                  label: 'Create Hub',
                  onClick: () => navigate('/hubs/new'),
                }
              : undefined
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={800}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredHubs?.map((hub) => (
                <Table.Tr
                  key={hub.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/hubs/${hub.id}`)}
                >
                  <Table.Td>{hub.code}</Table.Td>
                  <Table.Td>{hub.name}</Table.Td>
                  <Table.Td style={{ textTransform: 'capitalize' }}>{hub.hub_type}</Table.Td>
                  <Table.Td>
                    <StatusBadge status={hub.status} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
                      <Button size="xs" variant="light" onClick={() => navigate(`/hubs/${hub.id}`)}>
                        Details
                      </Button>
                      {canUpdate && !isHubManager && (
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={() => navigate(`/hubs/${hub.id}/edit`)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      )}
                      {canDelete && !isHubManager && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => {
                            setHubToDelete(hub.id);
                            setDeleteModalOpen(true);
                          }}
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
        </Table.ScrollContainer>
      )}

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Hub"
      >
        <Text mb="md">Are you sure you want to delete this hub? This action cannot be undone.</Text>
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

export default HubListPage;
