import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Group,
  Button,
  Tabs,
  Card,
  Text,
  Grid,
  Badge,
  Modal,
} from '@mantine/core';
import { IconEdit, IconTrash, IconArrowLeft } from '@tabler/icons-react';
import { useState } from 'react';
import { getHub, deleteHub } from '../../api/hubs';
import { getWarehouses } from '../../api/warehouses';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { notifications } from '@mantine/notifications';

function HubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: hub, isLoading, error } = useQuery({
    queryKey: ['hubs', id],
    queryFn: () => getHub(Number(id)),
    enabled: !!id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
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
      navigate('/hubs');
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
    if (id) {
      deleteMutation.mutate(Number(id));
    }
  };

  const hubWarehouses = warehouses?.filter((w) => w.hub_id === Number(id));

  if (isLoading) {
    return <LoadingState message="Loading hub details..." />;
  }

  if (error || !hub) {
    return <ErrorState message="Failed to load hub details" />;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/hubs')}
          >
            Back
          </Button>
          <div>
            <Title order={2}>{hub.name}</Title>
            <Text c="dimmed" size="sm">
              {hub.code}
            </Text>
          </div>
          <StatusBadge status={hub.status} />
        </Group>
        <Group>
          <Button
            variant="light"
            leftSection={<IconEdit size={16} />}
            onClick={() => navigate(`/hubs/${id}/edit`)}
          >
            Edit
          </Button>
          <Button
            color="red"
            variant="light"
            leftSection={<IconTrash size={16} />}
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete
          </Button>
        </Group>
      </Group>

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="capacity">Capacity</Tabs.Tab>
          <Tabs.Tab value="access">Access</Tabs.Tab>
          <Tabs.Tab value="infrastructure">Infrastructure</Tabs.Tab>
          <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
          <Tabs.Tab value="warehouses">
            Warehouses
            {hubWarehouses && hubWarehouses.length > 0 && (
              <Badge size="sm" ml="xs" circle>
                {hubWarehouses.length}
              </Badge>
            )}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Card withBorder>
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Text size="sm" c="dimmed">
                  Type
                </Text>
                <Text fw={500} tt="capitalize">
                  {hub.hub_type}
                </Text>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Text size="sm" c="dimmed">
                  Status
                </Text>
                <StatusBadge status={hub.status} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Text size="sm" c="dimmed">
                  Location ID
                </Text>
                <Text fw={500}>{hub.location_id || '-'}</Text>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Text size="sm" c="dimmed">
                  Geo ID
                </Text>
                <Text fw={500}>{hub.geo_id || '-'}</Text>
              </Grid.Col>
              {hub.description && (
                <Grid.Col span={12}>
                  <Text size="sm" c="dimmed">
                    Description
                  </Text>
                  <Text fw={500}>{hub.description}</Text>
                </Grid.Col>
              )}
            </Grid>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="capacity" pt="md">
          <Card withBorder>
            {hub.capacity ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Total Area (sqm)
                  </Text>
                  <Text fw={500}>{hub.capacity.total_area_sqm || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Total Capacity (MT)
                  </Text>
                  <Text fw={500}>{hub.capacity.total_capacity_mt || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Construction Year
                  </Text>
                  <Text fw={500}>{hub.capacity.construction_year || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Ownership Type
                  </Text>
                  <Text fw={500} tt="capitalize">
                    {hub.capacity.ownership_type || '-'}
                  </Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Text c="dimmed">No capacity information available</Text>
            )}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="access" pt="md">
          <Card withBorder>
            {hub.access ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Has Loading Dock
                  </Text>
                  <Text fw={500}>{hub.access.has_loading_dock ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Number of Loading Docks
                  </Text>
                  <Text fw={500}>{hub.access.number_of_loading_docks || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Loading Dock Type
                  </Text>
                  <Text fw={500} tt="capitalize">
                    {hub.access.loading_dock_type || '-'}
                  </Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Access Road Type
                  </Text>
                  <Text fw={500} tt="capitalize">
                    {hub.access.access_road_type || '-'}
                  </Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Nearest Town
                  </Text>
                  <Text fw={500}>{hub.access.nearest_town || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Distance from Town (km)
                  </Text>
                  <Text fw={500}>{hub.access.distance_from_town_km || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Has Weighbridge
                  </Text>
                  <Text fw={500}>{hub.access.has_weighbridge ? 'Yes' : 'No'}</Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Text c="dimmed">No access information available</Text>
            )}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="infrastructure" pt="md">
          <Card withBorder>
            {hub.infra ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Floor Type
                  </Text>
                  <Text fw={500} tt="capitalize">
                    {hub.infra.floor_type || '-'}
                  </Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Roof Type
                  </Text>
                  <Text fw={500} tt="capitalize">
                    {hub.infra.roof_type || '-'}
                  </Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Has Ventilation
                  </Text>
                  <Text fw={500}>{hub.infra.has_ventilation ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Has Drainage System
                  </Text>
                  <Text fw={500}>{hub.infra.has_drainage_system ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Has Fumigation Facility
                  </Text>
                  <Text fw={500}>{hub.infra.has_fumigation_facility ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Has Pest Control
                  </Text>
                  <Text fw={500}>{hub.infra.has_pest_control ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Has Fire Extinguisher
                  </Text>
                  <Text fw={500}>{hub.infra.has_fire_extinguisher ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Has Security Guard
                  </Text>
                  <Text fw={500}>{hub.infra.has_security_guard ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Security Type
                  </Text>
                  <Text fw={500} tt="capitalize">
                    {hub.infra.security_type || '-'}
                  </Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Text c="dimmed">No infrastructure information available</Text>
            )}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="contacts" pt="md">
          <Card withBorder>
            {hub.contacts ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Manager Name
                  </Text>
                  <Text fw={500}>{hub.contacts.manager_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Contact Phone
                  </Text>
                  <Text fw={500}>{hub.contacts.contact_phone || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">
                    Contact Email
                  </Text>
                  <Text fw={500}>{hub.contacts.contact_email || '-'}</Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Text c="dimmed">No contact information available</Text>
            )}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="warehouses" pt="md">
          <Card withBorder>
            {hubWarehouses && hubWarehouses.length > 0 ? (
              <Stack gap="sm">
                {hubWarehouses.map((warehouse) => (
                  <Card
                    key={warehouse.id}
                    withBorder
                    padding="sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/warehouses/${warehouse.id}`)}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text fw={500}>{warehouse.name}</Text>
                        <Text size="sm" c="dimmed">
                          {warehouse.code}
                        </Text>
                      </div>
                      <StatusBadge status={warehouse.status} />
                    </Group>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed">No warehouses associated with this hub</Text>
            )}
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Hub">
        <Text mb="md">
          Are you sure you want to delete this hub? This action cannot be undone.
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

export default HubDetailPage;
