/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconEdit, IconMapPin, IconPlus, IconTrash } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { deleteHub, getHub, updateHubAccess, updateHubGps } from '../../api/hubs';
import { createWarehouse, getWarehouses } from '../../api/warehouses';
import { ErrorState } from '../../components/common/ErrorState';
import { GpsMapModal } from '../../components/common/GpsMapModal';
import { LoadingState } from '../../components/common/LoadingState';
import { RentalAgreementUpload } from '../../components/common/RentalAgreementUpload';
import { StatusBadge } from '../../components/common/StatusBadge';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';
import { getFacilityOptions } from '../../api/referenceData';

function HubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const role = useAuthStore((state) => state.role);

  const canEdit = can('hubs', 'update');
  const canCreateWarehouse = can('warehouses', 'create');
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isHubManager = role === 'hub_manager';
  const activeTab = searchParams.get('tab') || 'overview';

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [createWarehouseModalOpen, setCreateWarehouseModalOpen] = useState(false);
  const [rentalAgreementFile, setRentalAgreementFile] = useState<File | null>(null);

  const { data: hub, isLoading, error } = useQuery({
    queryKey: ['hubs', id],
    queryFn: () => getHub(Number(id)),
    enabled: !!id,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
    enabled: isHubManager || isAdmin,
  });

  const { data: facilityOptions } = useQuery({
    queryKey: ['reference-data', 'facility-options'],
    queryFn: getFacilityOptions,
  });

  const toNumber = (value: number | '' | null | undefined) =>
    value === '' || value === null || value === undefined ? undefined : Number(value);

  const accessForm = useForm({
    initialValues: {
      has_loading_dock: false,
      number_of_loading_docks: '' as number | '',
      loading_dock_type: '',
      access_road_type: '',
      nearest_town: '',
      distance_from_town_km: '' as number | '',
      has_weighbridge: false,
    },
  });

  const warehouseForm = useForm({
    initialValues: {
      code: '',
      name: '',
      warehouse_type: 'main',
      status: 'active',
      ownership_type: 'self_owned',
      description: '',
    },
    validate: {
      code: (value) => (!value ? 'Code is required' : null),
      name: (value) => (!value ? 'Name is required' : null),
      ownership_type: (value) => (!value ? 'Ownership type is required' : null),
    },
  });

  useEffect(() => {
    if (!hub) return;

    accessForm.setValues({
      has_loading_dock: !!hub.access?.has_loading_dock,
      number_of_loading_docks: hub.access?.number_of_loading_docks ?? '',
      loading_dock_type: hub.access?.loading_dock_type || '',
      access_road_type: hub.access?.access_road_type || '',
      nearest_town: hub.access?.nearest_town || '',
      distance_from_town_km: hub.access?.distance_from_town_km ?? '',
      has_weighbridge: !!hub.access?.has_weighbridge,
    });
  }, [hub]);

  const deleteMutation = useMutation({
    mutationFn: deleteHub,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      notifications.show({ title: 'Success', message: 'Hub deleted', color: 'green' });
      navigate('/hubs');
    },
    onError: (mutationError: any) => {
      notifications.show({
        title: 'Error',
        message: mutationError.response?.data?.error?.message || 'Failed to delete hub',
        color: 'red',
      });
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: (payload: typeof accessForm.values) =>
      updateHubAccess(Number(id), {
        has_loading_dock: payload.has_loading_dock,
        number_of_loading_docks: toNumber(payload.number_of_loading_docks),
        loading_dock_type: payload.loading_dock_type || undefined,
        access_road_type: payload.access_road_type || undefined,
        nearest_town: payload.nearest_town || undefined,
        distance_from_town_km: toNumber(payload.distance_from_town_km),
        has_weighbridge: payload.has_weighbridge,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs', id] });
      notifications.show({ title: 'Success', message: 'Access updated', color: 'green' });
      setAccessModalOpen(false);
    },
    onError: (mutationError: any) => {
      notifications.show({
        title: 'Error',
        message: mutationError.response?.data?.error?.message || 'Failed to update access',
        color: 'red',
      });
    },
  });

  const updateGpsMutation = useMutation({
    mutationFn: (data: { latitude: number; longitude: number; address?: string }) =>
      updateHubGps(Number(id), hub?.geo_id, data),
    onSuccess: (updatedHub) => {
      queryClient.setQueryData(['hubs', id], updatedHub);
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      notifications.show({ title: 'Success', message: 'GPS location saved', color: 'green' });
      setGpsModalOpen(false);
    },
    onError: (mutationError: any) => {
      notifications.show({
        title: 'Error',
        message: mutationError.response?.data?.error?.message || 'Failed to save GPS',
        color: 'red',
      });
    },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: (payload: typeof warehouseForm.values) =>
      createWarehouse({
        code: payload.code,
        name: payload.name,
        warehouse_type: payload.warehouse_type,
        status: payload.status,
        description: payload.description || undefined,
        hub_id: Number(id),
        managed_under: 'Hub',
        ownership_type: payload.ownership_type,
        rental_agreement_document:
          payload.ownership_type === 'rental' ? rentalAgreementFile : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      notifications.show({ title: 'Success', message: 'Warehouse created', color: 'green' });
      warehouseForm.reset();
      setRentalAgreementFile(null);
      setCreateWarehouseModalOpen(false);
      navigate(`/hubs/${id}?tab=warehouses`);
    },
    onError: (mutationError: any) => {
      notifications.show({
        title: 'Error',
        message: mutationError.response?.data?.error?.message || 'Failed to create warehouse',
        color: 'red',
      });
    },
  });

  const hubWarehouses = warehouses?.filter((warehouse) => warehouse.hub_id === Number(id));

  const formatHierarchicalLevel = (value?: string) => {
    if (!value) return '-';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  if (isLoading) return <LoadingState message="Loading hub details..." />;
  if (error || !hub) return <ErrorState message="Failed to load hub details" />;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/hubs')}>
            Back
          </Button>
          <div>
            <Title order={2}>{hub.name}</Title>
            <Text c="dimmed" size="sm">{hub.code}</Text>
          </div>
          <StatusBadge status={hub.status} />
        </Group>

        {isAdmin && (
          <Group>
            <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/hubs/${id}/edit`)}>
              Edit
            </Button>
            <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={() => setDeleteModalOpen(true)}>
              Delete
            </Button>
          </Group>
        )}
      </Group>

      <Tabs value={activeTab} onChange={(value) => setSearchParams(value ? { tab: value } : {})}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="capacity">Capacity</Tabs.Tab>
          <Tabs.Tab value="access">Access</Tabs.Tab>
          <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
          {(isHubManager || isAdmin) && (
            <Tabs.Tab value="warehouses">
              Warehouses
              {hubWarehouses && hubWarehouses.length > 0 && (
                <Badge size="sm" ml="xs" circle>{hubWarehouses.length}</Badge>
              )}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            <Card withBorder>
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Hierarchical Level</Text>
                  <Text fw={500}>{formatHierarchicalLevel(hub.hub_type)}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Status</Text>
                  <StatusBadge status={hub.status} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Region</Text>
                  <Text fw={500}>Addis Ababa</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Subcity</Text>
                  <Text fw={500}>{hub.subcity_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Woreda</Text>
                  <Text fw={500}>{hub.woreda_name || hub.location_name || '-'}</Text>
                </Grid.Col>
                {hub.kebele && (
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Text size="sm" c="dimmed">Kebele Number</Text>
                    <Text fw={500}>{hub.kebele}</Text>
                  </Grid.Col>
                )}
                {hub.description && (
                  <Grid.Col span={12}>
                    <Text size="sm" c="dimmed">Description</Text>
                    <Text fw={500}>{hub.description}</Text>
                  </Grid.Col>
                )}
              </Grid>
            </Card>

            <Card withBorder>
              <Group justify="space-between" mb="sm">
                <Text fw={600}>GPS Location</Text>
                {canEdit && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconMapPin size={14} />}
                    onClick={() => setGpsModalOpen(true)}
                  >
                    {hub.geo ? 'Update GPS Location' : 'Add GPS Location'}
                  </Button>
                )}
              </Group>

              {hub.geo ? (
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Text size="sm" c="dimmed">Latitude</Text>
                    <Text fw={500}>{hub.geo.latitude ?? '-'}</Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Text size="sm" c="dimmed">Longitude</Text>
                    <Text fw={500}>{hub.geo.longitude ?? '-'}</Text>
                  </Grid.Col>
                  {hub.geo.address && (
                    <Grid.Col span={12}>
                      <Text size="sm" c="dimmed">Address</Text>
                      <Text fw={500}>{hub.geo.address}</Text>
                    </Grid.Col>
                  )}
                </Grid>
              ) : (
                <Text c="dimmed" size="sm">No GPS location set</Text>
              )}
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="capacity" pt="md">
          <Stack gap="md">
            <Alert color="blue" variant="light">
              Hub totals are calculated from the capacities and areas of all warehouses under this hub.
            </Alert>
            <Card withBorder>
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Total Area (sqm)</Text>
                  <Text fw={500}>{hub.capacity?.total_area_sqm ?? 0}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Total Capacity (MT)</Text>
                  <Text fw={500}>{hub.capacity?.total_capacity_mt ?? 0}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Construction Year</Text>
                  <Text fw={500}>{hub.capacity?.construction_year ?? '-'}</Text>
                </Grid.Col>
              </Grid>
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="access" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Access</Title>
            {canEdit && (
              <Button size="xs" variant="light" onClick={() => setAccessModalOpen(true)}>
                Edit
              </Button>
            )}
          </Group>
          <Card withBorder>
            {hub.access ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Loading Dock</Text>
                  <Text fw={500}>{hub.access.has_loading_dock ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                {hub.access.has_loading_dock && (
                  <>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Text size="sm" c="dimmed">Number of Loading Docks</Text>
                      <Text fw={500}>{hub.access.number_of_loading_docks ?? '-'}</Text>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Text size="sm" c="dimmed">Loading Dock Type</Text>
                      <Text fw={500}>{hub.access.loading_dock_type || '-'}</Text>
                    </Grid.Col>
                  </>
                )}
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Access Road Type</Text>
                  <Text fw={500}>{hub.access.access_road_type || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Nearest Town</Text>
                  <Text fw={500}>{hub.access.nearest_town || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Distance from Town (km)</Text>
                  <Text fw={500}>{hub.access.distance_from_town_km ?? '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Weighbridge</Text>
                  <Text fw={500}>{hub.access.has_weighbridge ? 'Yes' : 'No'}</Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Text c="dimmed">No access information yet</Text>
            )}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="contacts" pt="md">
          <Card withBorder>
            {hub.contacts ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Hub Manager</Text>
                  <Text fw={500}>{hub.contacts.manager_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Phone</Text>
                  <Text fw={500}>{hub.contacts.contact_phone || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Email</Text>
                  <Text fw={500}>{hub.contacts.contact_email || '-'}</Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Text c="dimmed">Hub Manager details will appear here after assignment.</Text>
            )}
          </Card>
        </Tabs.Panel>

        {(isHubManager || isAdmin) && canCreateWarehouse && (
          <Tabs.Panel value="warehouses" pt="md">
            <Group justify="space-between" mb="sm">
              <Title order={4}>Warehouses</Title>
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setCreateWarehouseModalOpen(true)}>
                New Warehouse
              </Button>
            </Group>

            <Stack gap="sm">
              {hubWarehouses && hubWarehouses.length > 0 ? (
                hubWarehouses.map((warehouse) => (
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
                        <Text size="sm" c="dimmed">{warehouse.code}</Text>
                      </div>
                      <StatusBadge status={warehouse.status} />
                    </Group>
                  </Card>
                ))
              ) : (
                <Card withBorder>
                  <Stack gap="xs" align="center" py="md">
                    <Text c="dimmed">No warehouses under this hub yet</Text>
                    <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setCreateWarehouseModalOpen(true)}>
                      Create First Warehouse
                    </Button>
                  </Stack>
                </Card>
              )}
            </Stack>
          </Tabs.Panel>
        )}
      </Tabs>

      <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Hub">
        <Text mb="md">Are you sure you want to delete this hub? This action cannot be undone.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
          <Button color="red" onClick={() => id && deleteMutation.mutate(Number(id))} loading={deleteMutation.isPending}>
            Delete
          </Button>
        </Group>
      </Modal>

      <GpsMapModal
        opened={gpsModalOpen}
        onClose={() => setGpsModalOpen(false)}
        onSave={(data) => updateGpsMutation.mutate(data)}
        loading={updateGpsMutation.isPending}
        initialLat={hub.geo?.latitude}
        initialLng={hub.geo?.longitude}
        title={hub.geo ? 'Update GPS Location' : 'Add GPS Location'}
      />

      <Modal opened={accessModalOpen} onClose={() => setAccessModalOpen(false)} title="Edit Access" centered>
        <form onSubmit={accessForm.onSubmit((values) => updateAccessMutation.mutate(values))}>
          <Stack gap="md">
            <Switch label="Has Loading Dock" {...accessForm.getInputProps('has_loading_dock', { type: 'checkbox' })} />
            {accessForm.values.has_loading_dock && (
              <>
                <NumberInput label="Number of Loading Docks" min={0} {...accessForm.getInputProps('number_of_loading_docks')} />
                <Select label="Loading Dock Type" data={facilityOptions?.loading_dock_type || []} {...accessForm.getInputProps('loading_dock_type')} />
              </>
            )}
            <Select label="Access Road Type" data={facilityOptions?.access_road_type || []} {...accessForm.getInputProps('access_road_type')} />
            <TextInput label="Nearest Town" {...accessForm.getInputProps('nearest_town')} />
            <NumberInput label="Distance from Town (km)" min={0} {...accessForm.getInputProps('distance_from_town_km')} />
            <Switch label="Has Weighbridge" {...accessForm.getInputProps('has_weighbridge', { type: 'checkbox' })} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setAccessModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={updateAccessMutation.isPending}>Save</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={createWarehouseModalOpen} onClose={() => setCreateWarehouseModalOpen(false)} title="Create Warehouse" centered>
        <form
          onSubmit={warehouseForm.onSubmit((values) => {
            if (values.ownership_type === 'rental' && !rentalAgreementFile) {
              notifications.show({
                title: 'Missing file',
                message: 'Rental Agreement is required when Ownership Type is Rental.',
                color: 'red',
              });
              return;
            }

            createWarehouseMutation.mutate(values);
          })}
        >
          <Stack gap="md">
            <TextInput label="Code" placeholder="WH-001" required {...warehouseForm.getInputProps('code')} />
            <TextInput label="Name" placeholder="Warehouse name" required {...warehouseForm.getInputProps('name')} />
            <Select
              label="Type"
              data={[
                { value: 'main', label: 'Main' },
                { value: 'satellite', label: 'Satellite' },
                { value: 'temporary', label: 'Temporary' },
              ]}
              {...warehouseForm.getInputProps('warehouse_type')}
            />
            <Select
              label="Status"
              data={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'maintenance', label: 'Maintenance' },
              ]}
              {...warehouseForm.getInputProps('status')}
            />
            <Select
              label="Ownership Type"
              data={[
                { value: 'self_owned', label: 'Self Owned' },
                { value: 'rental', label: 'Rental' },
              ]}
              required
              {...warehouseForm.getInputProps('ownership_type')}
            />
            {warehouseForm.values.ownership_type === 'rental' && (
              <RentalAgreementUpload
                value={rentalAgreementFile}
                onChange={setRentalAgreementFile}
                required
              />
            )}
            <TextInput label="Description" {...warehouseForm.getInputProps('description')} />
            <Alert color="blue" variant="light">
              Managed Under is fixed to Hub. Subcity and woreda are inherited automatically from this hub.
            </Alert>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setCreateWarehouseModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={createWarehouseMutation.isPending}>Create</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

export default HubDetailPage;

