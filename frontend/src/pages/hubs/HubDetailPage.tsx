import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack, Title, Group, Button, Tabs, Card, Text, Grid, Badge,
  Modal, TextInput, NumberInput, Switch, Select, Divider,
} from '@mantine/core';
import {
  IconEdit, IconTrash, IconArrowLeft, IconMapPin, IconPlus,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  getHub, deleteHub, updateHubCapacity, updateHubAccess,
  updateHubInfra, updateHubContacts, updateHubGps,
} from '../../api/hubs';
import { getWarehouses, createWarehouse } from '../../api/warehouses';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { GpsMapModal } from '../../components/common/GpsMapModal';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';
import { getRegions, getZones, getWoredas } from '../../api/locations';

function HubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const canEdit = can('hubs', 'update');
  const role = useAuthStore((state) => state.role);
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isHubManager = role === 'hub_manager';

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [infraModalOpen, setInfraModalOpen] = useState(false);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [createWarehouseModalOpen, setCreateWarehouseModalOpen] = useState(false);

  const { data: hub, isLoading, error } = useQuery({
    queryKey: ['hubs', id],
    queryFn: () => getHub(Number(id)),
    enabled: !!id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const { data: ownershipContext } = useQuery({
    queryKey: ['hub-ownership-context', hub?.location_id],
    enabled: !!hub?.location_id,
    queryFn: async () => {
      const regions = await getRegions();
      const addis = regions.find((r) => r.name.toLowerCase().includes('addis'));
      if (!addis) return { subcityName: undefined, woredaName: undefined };
      const zones = await getZones(addis.id);
      const woredasByZone = await Promise.all(
        zones.map(async (zone) => {
          const woredas = await getWoredas(zone.id);
          return { zone, woredas };
        })
      );
      for (const entry of woredasByZone) {
        const match = entry.woredas.find((w) => w.id === hub?.location_id);
        if (match) return { subcityName: entry.zone.name, woredaName: match.name };
      }
      return { subcityName: undefined, woredaName: undefined };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHub,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      notifications.show({ title: 'Success', message: 'Hub deleted', color: 'green' });
      navigate('/hubs');
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to delete hub', color: 'red' });
    },
  });

  const toNumber = (value: number | '' | null | undefined) =>
    value === '' || value === null || value === undefined ? undefined : Number(value);

  // --- Forms ---
  const capacityForm = useForm({
    initialValues: {
      total_area_sqm: '' as number | '',
      total_capacity_mt: '' as number | '',
      construction_year: '' as number | '',
      ownership_type: '',
    },
    validate: {
      construction_year: (v) => {
        if (v === '' || v == null) return null;
        const y = Number(v);
        const cur = new Date().getFullYear();
        return isNaN(y) || y < 1900 || y > cur ? `Year must be 1900–${cur}` : null;
      },
    },
  });

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

  const infraForm = useForm({
    initialValues: {
      floor_type: '',
      roof_type: '',
      has_ventilation: false,
      has_drainage_system: false,
      has_fumigation_facility: false,
      has_pest_control: false,
      has_fire_extinguisher: false,
      has_security_guard: false,
      security_type: '',
    },
  });

  const contactsForm = useForm({
    initialValues: { manager_name: '', contact_phone: '', contact_email: '' },
    validate: {
      contact_email: (v) => v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Invalid email' : null,
    },
  });

  const warehouseForm = useForm({
    initialValues: {
      code: '',
      name: '',
      warehouse_type: 'main',
      status: 'active',
      description: '',
    },
    validate: {
      name: (v) => (!v ? 'Name is required' : null),
      code: (v) => (!v ? 'Code is required' : null),
    },
  });

  useEffect(() => {
    if (!hub) return;
    const existingOwnership = hub.capacity?.ownership_type || '';
    const normalizedOwnership = existingOwnership === 'Government' ? 'Addis Ababa Government' : existingOwnership;
    capacityForm.setValues({
      total_area_sqm: hub.capacity?.total_area_sqm ?? '',
      total_capacity_mt: hub.capacity?.total_capacity_mt ?? '',
      construction_year: hub.capacity?.construction_year ?? '',
      ownership_type: normalizedOwnership,
    });
    accessForm.setValues({
      has_loading_dock: !!hub.access?.has_loading_dock,
      number_of_loading_docks: hub.access?.number_of_loading_docks ?? '',
      loading_dock_type: hub.access?.loading_dock_type || '',
      access_road_type: hub.access?.access_road_type || '',
      nearest_town: hub.access?.nearest_town || '',
      distance_from_town_km: hub.access?.distance_from_town_km ?? '',
      has_weighbridge: !!hub.access?.has_weighbridge,
    });
    infraForm.setValues({
      floor_type: hub.infra?.floor_type || '',
      roof_type: hub.infra?.roof_type || '',
      has_ventilation: !!hub.infra?.has_ventilation,
      has_drainage_system: !!hub.infra?.has_drainage_system,
      has_fumigation_facility: !!hub.infra?.has_fumigation_facility,
      has_pest_control: !!hub.infra?.has_pest_control,
      has_fire_extinguisher: !!hub.infra?.has_fire_extinguisher,
      has_security_guard: !!hub.infra?.has_security_guard,
      security_type: hub.infra?.security_type || '',
    });
    contactsForm.setValues({
      manager_name: hub.contacts?.manager_name || '',
      contact_phone: hub.contacts?.contact_phone || '',
      contact_email: hub.contacts?.contact_email || '',
    });
  }, [hub]);

  // --- Mutations ---
  const updateCapacityMutation = useMutation({
    mutationFn: (payload: typeof capacityForm.values) =>
      updateHubCapacity(Number(id), {
        total_area_sqm: toNumber(payload.total_area_sqm),
        total_capacity_mt: toNumber(payload.total_capacity_mt),
        construction_year: toNumber(payload.construction_year),
        ownership_type: payload.ownership_type || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs', id] });
      notifications.show({ title: 'Success', message: 'Capacity updated', color: 'green' });
      setCapacityModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to update capacity', color: 'red' });
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
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to update access', color: 'red' });
    },
  });

  const updateInfraMutation = useMutation({
    mutationFn: (payload: typeof infraForm.values) =>
      updateHubInfra(Number(id), {
        floor_type: payload.floor_type || undefined,
        roof_type: payload.roof_type || undefined,
        has_ventilation: payload.has_ventilation,
        has_drainage_system: payload.has_drainage_system,
        has_fumigation_facility: payload.has_fumigation_facility,
        has_pest_control: payload.has_pest_control,
        has_fire_extinguisher: payload.has_fire_extinguisher,
        has_security_guard: payload.has_security_guard,
        security_type: payload.security_type || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs', id] });
      notifications.show({ title: 'Success', message: 'Infrastructure updated', color: 'green' });
      setInfraModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to update infrastructure', color: 'red' });
    },
  });

  const updateContactsMutation = useMutation({
    mutationFn: (payload: typeof contactsForm.values) =>
      updateHubContacts(Number(id), {
        manager_name: payload.manager_name || undefined,
        contact_phone: payload.contact_phone || undefined,
        contact_email: payload.contact_email || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs', id] });
      notifications.show({ title: 'Success', message: 'Contacts updated', color: 'green' });
      setContactsModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to update contacts', color: 'red' });
    },
  });

  const updateGpsMutation = useMutation({
    mutationFn: (data: { latitude: number; longitude: number; address?: string }) =>
      updateHubGps(Number(id), hub?.geo_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs', id] });
      notifications.show({ title: 'Success', message: 'GPS location saved', color: 'green' });
      setGpsModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to save GPS', color: 'red' });
    },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: (payload: typeof warehouseForm.values) =>
      createWarehouse({
        ...payload,
        hub_id: Number(id),
        ownership_type: 'hub',
        location_id: hub?.location_id,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      notifications.show({ title: 'Success', message: 'Warehouse created', color: 'green' });
      setCreateWarehouseModalOpen(false);
      warehouseForm.reset();
      navigate(`/warehouses/${data.id}`);
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to create warehouse', color: 'red' });
    },
  });

  const hubWarehouses = warehouses?.filter((w) => w.hub_id === Number(id));
  const ownershipOptions = [
    { value: 'Addis Ababa Government', label: 'Addis Ababa Government' },
    {
      value: ownershipContext?.subcityName || 'Subcity',
      label: ownershipContext?.subcityName ? `Subcity - ${ownershipContext.subcityName}` : 'Subcity',
    },
    {
      value: ownershipContext?.woredaName || 'Woreda',
      label: ownershipContext?.woredaName ? `Woreda - ${ownershipContext.woredaName}` : 'Woreda',
    },
  ];

  if (isLoading) return <LoadingState message="Loading hub details..." />;
  if (error || !hub) return <ErrorState message="Failed to load hub details" />;

  return (
    <Stack gap="md">
      {/* Header */}
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

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="capacity">Capacity</Tabs.Tab>
          <Tabs.Tab value="access">Access</Tabs.Tab>
          <Tabs.Tab value="infrastructure">Infrastructure</Tabs.Tab>
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

        {/* Overview Tab */}
        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            <Card withBorder>
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Type</Text>
                  <Text fw={500} tt="capitalize">{hub.hub_type}</Text>
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
                  <Text fw={500}>{ownershipContext?.subcityName || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Woreda</Text>
                  <Text fw={500}>{ownershipContext?.woredaName || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Location ID</Text>
                  <Text fw={500}>{hub.location_id || '-'}</Text>
                </Grid.Col>
                {hub.description && (
                  <Grid.Col span={12}>
                    <Text size="sm" c="dimmed">Description</Text>
                    <Text fw={500}>{hub.description}</Text>
                  </Grid.Col>
                )}
              </Grid>
            </Card>

            {/* GPS Section */}
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

        {/* Capacity Tab */}
        <Tabs.Panel value="capacity" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Capacity</Title>
            {canEdit && (
              <Button size="xs" variant="light" onClick={() => setCapacityModalOpen(true)}>
                Edit
              </Button>
            )}
          </Group>
          <Card withBorder>
            {hub.capacity ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Total Area (sqm)</Text>
                  <Text fw={500}>{hub.capacity.total_area_sqm ?? '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Total Capacity (MT)</Text>
                  <Text fw={500}>{hub.capacity.total_capacity_mt ?? '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Construction Year</Text>
                  <Text fw={500}>{hub.capacity.construction_year ?? '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Ownership Type</Text>
                  <Text fw={500} tt="capitalize">{hub.capacity.ownership_type || '-'}</Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Stack gap="xs" align="center" py="md">
                <Text c="dimmed">No capacity information yet</Text>
                {canEdit && (
                  <Button size="xs" variant="light" onClick={() => setCapacityModalOpen(true)}>
                    Add Capacity Info
                  </Button>
                )}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Access Tab */}
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
                      <Text fw={500} tt="capitalize">{hub.access.loading_dock_type || '-'}</Text>
                    </Grid.Col>
                  </>
                )}
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Access Road Type</Text>
                  <Text fw={500} tt="capitalize">{hub.access.access_road_type || '-'}</Text>
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
              <Stack gap="xs" align="center" py="md">
                <Text c="dimmed">No access information yet</Text>
                {canEdit && (
                  <Button size="xs" variant="light" onClick={() => setAccessModalOpen(true)}>
                    Add Access Info
                  </Button>
                )}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Infrastructure Tab */}
        <Tabs.Panel value="infrastructure" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Infrastructure</Title>
            {canEdit && (
              <Button size="xs" variant="light" onClick={() => setInfraModalOpen(true)}>
                Edit
              </Button>
            )}
          </Group>
          <Card withBorder>
            {hub.infra ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Floor Type</Text>
                  <Text fw={500} tt="capitalize">{hub.infra.floor_type || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Roof Type</Text>
                  <Text fw={500} tt="capitalize">{hub.infra.roof_type || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Ventilation</Text>
                  <Text fw={500}>{hub.infra.has_ventilation ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Drainage System</Text>
                  <Text fw={500}>{hub.infra.has_drainage_system ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Fumigation Facility</Text>
                  <Text fw={500}>{hub.infra.has_fumigation_facility ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Pest Control</Text>
                  <Text fw={500}>{hub.infra.has_pest_control ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Fire Extinguisher</Text>
                  <Text fw={500}>{hub.infra.has_fire_extinguisher ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Security Guard</Text>
                  <Text fw={500}>{hub.infra.has_security_guard ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                {hub.infra.security_type && (
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Text size="sm" c="dimmed">Security Type</Text>
                    <Text fw={500} tt="capitalize">{hub.infra.security_type}</Text>
                  </Grid.Col>
                )}
              </Grid>
            ) : (
              <Stack gap="xs" align="center" py="md">
                <Text c="dimmed">No infrastructure information yet</Text>
                {canEdit && (
                  <Button size="xs" variant="light" onClick={() => setInfraModalOpen(true)}>
                    Add Infrastructure Info
                  </Button>
                )}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Contacts Tab */}
        <Tabs.Panel value="contacts" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Contacts</Title>
            {canEdit && (
              <Button size="xs" variant="light" onClick={() => setContactsModalOpen(true)}>
                Edit
              </Button>
            )}
          </Group>
          <Card withBorder>
            {hub.contacts ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Manager Name</Text>
                  <Text fw={500}>{hub.contacts.manager_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Contact Phone</Text>
                  <Text fw={500}>{hub.contacts.contact_phone || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Contact Email</Text>
                  <Text fw={500}>{hub.contacts.contact_email || '-'}</Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Stack gap="xs" align="center" py="md">
                <Text c="dimmed">No contact information yet</Text>
                {canEdit && (
                  <Button size="xs" variant="light" onClick={() => setContactsModalOpen(true)}>
                    Add Contact Info
                  </Button>
                )}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Warehouses Tab — Hub Manager & Admin only */}
        {(isHubManager || isAdmin) && (
          <Tabs.Panel value="warehouses" pt="md">
            <Group justify="space-between" mb="sm">
              <Title order={4}>Warehouses</Title>
              {(isHubManager || isAdmin) && (
                <Button
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setCreateWarehouseModalOpen(true)}
                >
                  New Warehouse
                </Button>
              )}
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
                    {(isHubManager || isAdmin) && (
                      <Button
                        size="xs"
                        leftSection={<IconPlus size={14} />}
                        onClick={() => setCreateWarehouseModalOpen(true)}
                      >
                        Create First Warehouse
                      </Button>
                    )}
                  </Stack>
                </Card>
              )}
            </Stack>
          </Tabs.Panel>
        )}
      </Tabs>

      {/* Delete Modal */}
      <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Hub">
        <Text mb="md">Are you sure you want to delete this hub? This action cannot be undone.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
          <Button color="red" onClick={() => id && deleteMutation.mutate(Number(id))} loading={deleteMutation.isPending}>
            Delete
          </Button>
        </Group>
      </Modal>

      {/* GPS Modal */}
      <GpsMapModal
        opened={gpsModalOpen}
        onClose={() => setGpsModalOpen(false)}
        onSave={(data) => updateGpsMutation.mutate(data)}
        loading={updateGpsMutation.isPending}
        initialLat={hub.geo?.latitude}
        initialLng={hub.geo?.longitude}
        title={hub.geo ? 'Update GPS Location' : 'Add GPS Location'}
      />

      {/* Capacity Modal */}
      <Modal opened={capacityModalOpen} onClose={() => setCapacityModalOpen(false)} title="Edit Capacity" centered>
        <form onSubmit={capacityForm.onSubmit((values) => updateCapacityMutation.mutate(values))}>
          <Stack gap="md">
            <NumberInput label="Total Area (sqm)" min={0} {...capacityForm.getInputProps('total_area_sqm')} />
            <NumberInput label="Total Capacity (MT)" min={0} {...capacityForm.getInputProps('total_capacity_mt')} />
            <NumberInput label="Construction Year" min={1900} max={new Date().getFullYear()} {...capacityForm.getInputProps('construction_year')} />
            <Select label="Ownership Type" placeholder="Select ownership" data={ownershipOptions} clearable {...capacityForm.getInputProps('ownership_type')} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setCapacityModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={updateCapacityMutation.isPending}>Save</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Access Modal */}
      <Modal opened={accessModalOpen} onClose={() => setAccessModalOpen(false)} title="Edit Access" centered>
        <form onSubmit={accessForm.onSubmit((values) => updateAccessMutation.mutate(values))}>
          <Stack gap="md">
            <Switch label="Has Loading Dock" {...accessForm.getInputProps('has_loading_dock', { type: 'checkbox' })} />
            {accessForm.values.has_loading_dock && (
              <>
                <NumberInput label="Number of Loading Docks" min={0} {...accessForm.getInputProps('number_of_loading_docks')} />
                <TextInput label="Loading Dock Type" {...accessForm.getInputProps('loading_dock_type')} />
              </>
            )}
            <Divider />
            <TextInput label="Access Road Type" {...accessForm.getInputProps('access_road_type')} />
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

      {/* Infrastructure Modal */}
      <Modal opened={infraModalOpen} onClose={() => setInfraModalOpen(false)} title="Edit Infrastructure" centered>
        <form onSubmit={infraForm.onSubmit((values) => updateInfraMutation.mutate(values))}>
          <Stack gap="md">
            <TextInput label="Floor Type" {...infraForm.getInputProps('floor_type')} />
            <TextInput label="Roof Type" {...infraForm.getInputProps('roof_type')} />
            <Switch label="Has Ventilation" {...infraForm.getInputProps('has_ventilation', { type: 'checkbox' })} />
            <Switch label="Has Drainage System" {...infraForm.getInputProps('has_drainage_system', { type: 'checkbox' })} />
            <Switch label="Has Fumigation Facility" {...infraForm.getInputProps('has_fumigation_facility', { type: 'checkbox' })} />
            <Switch label="Has Pest Control" {...infraForm.getInputProps('has_pest_control', { type: 'checkbox' })} />
            <Switch label="Has Fire Extinguisher" {...infraForm.getInputProps('has_fire_extinguisher', { type: 'checkbox' })} />
            <Switch label="Has Security Guard" {...infraForm.getInputProps('has_security_guard', { type: 'checkbox' })} />
            {infraForm.values.has_security_guard && (
              <TextInput label="Security Type" {...infraForm.getInputProps('security_type')} />
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setInfraModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={updateInfraMutation.isPending}>Save</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Contacts Modal */}
      <Modal opened={contactsModalOpen} onClose={() => setContactsModalOpen(false)} title="Edit Contacts" centered>
        <form onSubmit={contactsForm.onSubmit((values) => updateContactsMutation.mutate(values))}>
          <Stack gap="md">
            <TextInput label="Manager Name" {...contactsForm.getInputProps('manager_name')} />
            <TextInput label="Contact Phone" {...contactsForm.getInputProps('contact_phone')} />
            <TextInput label="Contact Email" type="email" {...contactsForm.getInputProps('contact_email')} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setContactsModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={updateContactsMutation.isPending}>Save</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Create Warehouse Modal */}
      <Modal opened={createWarehouseModalOpen} onClose={() => setCreateWarehouseModalOpen(false)} title="Create Warehouse" centered>
        <form onSubmit={warehouseForm.onSubmit((values) => createWarehouseMutation.mutate(values))}>
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
            <TextInput label="Description" {...warehouseForm.getInputProps('description')} />
            <Text size="xs" c="dimmed">Ownership type will be set to "Hub" and linked to this hub automatically.</Text>
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
