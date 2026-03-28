/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack, Title, Group, Button, Tabs, Card, Text, Grid, Badge,
  Modal, Anchor, Table, TextInput, NumberInput, Switch, Select, Divider,
} from '@mantine/core';
import { IconEdit, IconTrash, IconArrowLeft, IconMapPin } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  getWarehouse, deleteWarehouse, updateWarehouseCapacity,
  updateWarehouseAccess, updateWarehouseInfra, updateWarehouseContacts,
  updateWarehouseGps,
} from '../../api/warehouses';
import { getHubs } from '../../api/hubs';
import { getStores } from '../../api/stores';
import { getStockBalances } from '../../api/stockBalances';
import { getGrns } from '../../api/grns';
import { getGins } from '../../api/gins';
import { getInspections } from '../../api/inspections';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { GpsMapModal } from '../../components/common/GpsMapModal';
import { notifications } from '@mantine/notifications';
import { formatDate } from '../../utils/formatters';
import { useForm } from '@mantine/form';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';
import { getFacilityOptions } from '../../api/referenceData';

function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const canEdit = can('warehouses', 'update');
  const canReadHubs = can('hubs', 'read');
  const canCreateStores = can('stores', 'create');
  const role = useAuthStore((state) => state.role);
  const isAdmin = role === 'admin' || role === 'superadmin';

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [infraModalOpen, setInfraModalOpen] = useState(false);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);

  const { data: warehouse, isLoading, error } = useQuery({
    queryKey: ['warehouses', id],
    queryFn: () => getWarehouse(Number(id)),
    enabled: !!id,
  });

  const { data: hubs } = useQuery({ queryKey: ['hubs'], queryFn: getHubs, enabled: canReadHubs });
  const { data: stores } = useQuery({ queryKey: ['stores'], queryFn: getStores });
  const { data: stockBalances } = useQuery({ queryKey: ['stockBalances'], queryFn: getStockBalances });
  const { data: grns } = useQuery({ queryKey: ['grns'], queryFn: getGrns });
  const { data: gins } = useQuery({ queryKey: ['gins'], queryFn: getGins });
  const { data: inspections } = useQuery({ queryKey: ['inspections'], queryFn: getInspections });
  const { data: facilityOptions } = useQuery({
    queryKey: ['reference-data', 'facility-options'],
    queryFn: getFacilityOptions,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      notifications.show({ title: 'Success', message: 'Warehouse deleted', color: 'green' });
      navigate('/warehouses');
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to delete warehouse', color: 'red' });
    },
  });

  const toNumber = (value: number | '' | null | undefined) =>
    value === '' || value === null || value === undefined ? undefined : Number(value);

  const capacityForm = useForm({
    initialValues: {
      total_area_sqm: '' as number | '',
      total_storage_capacity_mt: '' as number | '',
      construction_year: '' as number | '',
      ownership_type: '',
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
    },
  });

  const infraForm = useForm({
    initialValues: {
      floor_type: '',
      roof_type: '',
      has_fumigation_facility: false,
      has_fire_extinguisher: false,
      has_security_guard: false,
    },
  });

  const contactsForm = useForm({
    initialValues: { manager_name: '', contact_phone: '', contact_email: '' },
    validate: {
      contact_email: (v) => v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Invalid email' : null,
    },
  });

  useEffect(() => {
    if (!warehouse) return;
    capacityForm.setValues({
      total_area_sqm: warehouse.capacity?.total_area_sqm ?? '',
      total_storage_capacity_mt: warehouse.capacity?.total_storage_capacity_mt ?? '',
      construction_year: warehouse.capacity?.construction_year ?? '',
      ownership_type: warehouse.ownership_type || '',
    });
    accessForm.setValues({
      has_loading_dock: !!warehouse.access?.has_loading_dock,
      number_of_loading_docks: warehouse.access?.number_of_loading_docks ?? '',
      loading_dock_type: warehouse.access?.loading_dock_type || '',
      access_road_type: warehouse.access?.access_road_type || '',
      nearest_town: warehouse.access?.nearest_town || '',
      distance_from_town_km: warehouse.access?.distance_from_town_km ?? '',
    });
    infraForm.setValues({
      floor_type: warehouse.infra?.floor_type || '',
      roof_type: warehouse.infra?.roof_type || '',
      has_fumigation_facility: !!warehouse.infra?.has_fumigation_facility,
      has_fire_extinguisher: !!warehouse.infra?.has_fire_extinguisher,
      has_security_guard: !!warehouse.infra?.has_security_guard,
    });
    contactsForm.setValues({
      manager_name: warehouse.contacts?.manager_name || '',
      contact_phone: warehouse.contacts?.contact_phone || '',
      contact_email: warehouse.contacts?.contact_email || '',
    });
  }, [warehouse]);

  const updateCapacityMutation = useMutation({
    mutationFn: (payload: typeof capacityForm.values) =>
      updateWarehouseCapacity(Number(id), {
        total_area_sqm: toNumber(payload.total_area_sqm),
        total_storage_capacity_mt: toNumber(payload.total_storage_capacity_mt),
        construction_year: toNumber(payload.construction_year),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', id] });
      notifications.show({ title: 'Success', message: 'Capacity updated', color: 'green' });
      setCapacityModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to update capacity', color: 'red' });
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: (payload: typeof accessForm.values) =>
      updateWarehouseAccess(Number(id), {
        has_loading_dock: payload.has_loading_dock,
        number_of_loading_docks: toNumber(payload.number_of_loading_docks),
        loading_dock_type: payload.loading_dock_type || undefined,
        access_road_type: payload.access_road_type || undefined,
        nearest_town: payload.nearest_town || undefined,
        distance_from_town_km: toNumber(payload.distance_from_town_km),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', id] });
      notifications.show({ title: 'Success', message: 'Access updated', color: 'green' });
      setAccessModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to update access', color: 'red' });
    },
  });

  const updateInfraMutation = useMutation({
    mutationFn: (payload: typeof infraForm.values) =>
      updateWarehouseInfra(Number(id), {
        floor_type: payload.floor_type || undefined,
        roof_type: payload.roof_type || undefined,
        has_fumigation_facility: payload.has_fumigation_facility,
        has_fire_extinguisher: payload.has_fire_extinguisher,
        has_security_guard: payload.has_security_guard,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', id] });
      notifications.show({ title: 'Success', message: 'Infrastructure updated', color: 'green' });
      setInfraModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to update infrastructure', color: 'red' });
    },
  });

  const updateContactsMutation = useMutation({
    mutationFn: (payload: typeof contactsForm.values) =>
      updateWarehouseContacts(Number(id), {
        manager_name: payload.manager_name || undefined,
        contact_phone: payload.contact_phone || undefined,
        contact_email: payload.contact_email || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', id] });
      notifications.show({ title: 'Success', message: 'Contacts updated', color: 'green' });
      setContactsModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to update contacts', color: 'red' });
    },
  });

  const updateGpsMutation = useMutation({
    mutationFn: (data: { latitude: number; longitude: number; address?: string }) =>
      updateWarehouseGps(Number(id), warehouse?.geo_id, data),
    onSuccess: (updatedWarehouse) => {
      queryClient.setQueryData(['warehouses', id], updatedWarehouse);
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      notifications.show({ title: 'Success', message: 'GPS location saved', color: 'green' });
      setGpsModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to save GPS', color: 'red' });
    },
  });

  const hub = hubs?.find((h) => h.id === warehouse?.hub_id);
  const warehouseStores = stores?.filter((s) => s.warehouse_id === Number(id));
  const warehouseStock = stockBalances?.filter((sb) => sb.warehouse_id === Number(id));
  const warehouseGrns = grns?.filter((g) => g.warehouse_id === Number(id))?.slice(0, 5);
  const warehouseGins = gins?.filter((g) => g.warehouse_id === Number(id))?.slice(0, 5);
  const warehouseInspections = inspections?.filter((i) => i.warehouse_id === Number(id))?.slice(0, 5);

  if (isLoading) return <LoadingState message="Loading warehouse details..." />;
  if (error || !warehouse) return <ErrorState message="Failed to load warehouse details" />;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/warehouses')}>
            Back
          </Button>
          <div>
            <Title order={2}>{warehouse.name}</Title>
            <Text c="dimmed" size="sm">{warehouse.code}</Text>
          </div>
          <StatusBadge status={warehouse.status} />
        </Group>
        {isAdmin && (
          <Group>
            <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/warehouses/${id}/edit`)}>
              Edit
            </Button>
            <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={() => setDeleteModalOpen(true)}>
              Delete
            </Button>
          </Group>
        )}
      </Group>

      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="capacity">Capacity</Tabs.Tab>
          <Tabs.Tab value="access">Access</Tabs.Tab>
          <Tabs.Tab value="infrastructure">Infrastructure</Tabs.Tab>
          <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
          <Tabs.Tab value="stores">
            Stores
            {warehouseStores && warehouseStores.length > 0 && (
              <Badge size="sm" ml="xs" circle>{warehouseStores.length}</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="stock">Stock Balances</Tabs.Tab>
          <Tabs.Tab value="operations">Operations</Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            <Card withBorder>
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Type</Text>
                  <Text fw={500} tt="capitalize">{warehouse.warehouse_type}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Status</Text>
                  <StatusBadge status={warehouse.status} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Hub</Text>
                  {canReadHubs && hub ? (
                    <Anchor onClick={() => navigate(`/hubs/${hub.id}`)} fw={500}>{hub.name}</Anchor>
                  ) : (
                    <Text fw={500}>{warehouse.hub_name || warehouse.hub_id || '-'}</Text>
                  )}
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Ownership Type</Text>
                  <Text fw={500} tt="capitalize">{warehouse.ownership_type || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Subcity</Text>
                  <Text fw={500}>{warehouse.subcity_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Woreda</Text>
                  <Text fw={500}>{warehouse.woreda_name || warehouse.location_name || '-'}</Text>
                </Grid.Col>
                {warehouse.description && (
                  <Grid.Col span={12}>
                    <Text size="sm" c="dimmed">Description</Text>
                    <Text fw={500}>{warehouse.description}</Text>
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
                    {warehouse.geo ? 'Update GPS Location' : 'Add GPS Location'}
                  </Button>
                )}
              </Group>
              {warehouse.geo ? (
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Text size="sm" c="dimmed">Latitude</Text>
                    <Text fw={500}>{warehouse.geo.latitude ?? '-'}</Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Text size="sm" c="dimmed">Longitude</Text>
                    <Text fw={500}>{warehouse.geo.longitude ?? '-'}</Text>
                  </Grid.Col>
                  {warehouse.geo.address && (
                    <Grid.Col span={12}>
                      <Text size="sm" c="dimmed">Address</Text>
                      <Text fw={500}>{warehouse.geo.address}</Text>
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
              <Button size="xs" variant="light" onClick={() => setCapacityModalOpen(true)}>Edit</Button>
            )}
          </Group>
          <Card withBorder>
            {warehouse.capacity ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Total Area (sqm)</Text>
                  <Text fw={500}>{warehouse.capacity.total_area_sqm ?? '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Total Storage Capacity (MT)</Text>
                  <Text fw={500}>{warehouse.capacity.total_storage_capacity_mt ?? '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Usable Capacity (MT)</Text>
                  <Text fw={500}>{warehouse.capacity.usable_storage_capacity_mt ?? '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Number of Stores</Text>
                  <Text fw={500}>{warehouse.capacity.no_of_stores ?? '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Construction Year</Text>
                  <Text fw={500}>{warehouse.capacity.construction_year ?? '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Ownership Type</Text>
                  <Text fw={500} tt="capitalize">{warehouse.ownership_type || '-'}</Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Stack gap="xs" align="center" py="md">
                <Text c="dimmed">No capacity information yet</Text>
                {canEdit && <Button size="xs" variant="light" onClick={() => setCapacityModalOpen(true)}>Add Capacity Info</Button>}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Access Tab */}
        <Tabs.Panel value="access" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Access</Title>
            {canEdit && (
              <Button size="xs" variant="light" onClick={() => setAccessModalOpen(true)}>Edit</Button>
            )}
          </Group>
          <Card withBorder>
            {warehouse.access ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Loading Dock</Text>
                  <Text fw={500}>{warehouse.access.has_loading_dock ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                {warehouse.access.has_loading_dock && (
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Text size="sm" c="dimmed">Number of Loading Docks</Text>
                    <Text fw={500}>{warehouse.access.number_of_loading_docks ?? '-'}</Text>
                  </Grid.Col>
                )}
                {warehouse.access.has_loading_dock && (
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Text size="sm" c="dimmed">Loading Dock Type</Text>
                    <Text fw={500}>{warehouse.access.loading_dock_type || '-'}</Text>
                  </Grid.Col>
                )}
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Access Road Type</Text>
                  <Text fw={500} tt="capitalize">{warehouse.access.access_road_type || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Nearest Town</Text>
                  <Text fw={500}>{warehouse.access.nearest_town || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Distance from Town (km)</Text>
                  <Text fw={500}>{warehouse.access.distance_from_town_km ?? '-'}</Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Stack gap="xs" align="center" py="md">
                <Text c="dimmed">No access information yet</Text>
                {canEdit && <Button size="xs" variant="light" onClick={() => setAccessModalOpen(true)}>Add Access Info</Button>}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Infrastructure Tab */}
        <Tabs.Panel value="infrastructure" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Infrastructure</Title>
            {canEdit && (
              <Button size="xs" variant="light" onClick={() => setInfraModalOpen(true)}>Edit</Button>
            )}
          </Group>
          <Card withBorder>
            {warehouse.infra ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Floor Type</Text>
                  <Text fw={500} tt="capitalize">{warehouse.infra.floor_type || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Roof Type</Text>
                  <Text fw={500} tt="capitalize">{warehouse.infra.roof_type || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Fumigation Facility</Text>
                  <Text fw={500}>{warehouse.infra.has_fumigation_facility ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Fire Extinguisher</Text>
                  <Text fw={500}>{warehouse.infra.has_fire_extinguisher ? 'Yes' : 'No'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Has Security Guard</Text>
                  <Text fw={500}>{warehouse.infra.has_security_guard ? 'Yes' : 'No'}</Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Stack gap="xs" align="center" py="md">
                <Text c="dimmed">No infrastructure information yet</Text>
                {canEdit && <Button size="xs" variant="light" onClick={() => setInfraModalOpen(true)}>Add Infrastructure Info</Button>}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Contacts Tab */}
        <Tabs.Panel value="contacts" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Contacts</Title>
            {canEdit && (
              <Button size="xs" variant="light" onClick={() => setContactsModalOpen(true)}>Edit</Button>
            )}
          </Group>
          <Card withBorder>
            {warehouse.contacts ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Manager Name</Text>
                  <Text fw={500}>{warehouse.contacts.manager_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Contact Phone</Text>
                  <Text fw={500}>{warehouse.contacts.contact_phone || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Contact Email</Text>
                  <Text fw={500}>{warehouse.contacts.contact_email || '-'}</Text>
                </Grid.Col>
              </Grid>
            ) : (
              <Stack gap="xs" align="center" py="md">
                <Text c="dimmed">No contact information yet</Text>
                {canEdit && <Button size="xs" variant="light" onClick={() => setContactsModalOpen(true)}>Add Contact Info</Button>}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Stores Tab */}
        <Tabs.Panel value="stores" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Stores</Title>
            {canCreateStores && (
              <Button size="xs" onClick={() => navigate(`/stores/new?warehouse_id=${warehouse.id}`)}>
                Create Store
              </Button>
            )}
          </Group>
          <Card withBorder>
            {warehouseStores && warehouseStores.length > 0 ? (
              <Stack gap="sm">
                {warehouseStores.map((store) => (
                  <Card key={store.id} withBorder padding="sm" style={{ cursor: 'pointer' }} onClick={() => navigate(`/stores/${store.id}/edit`)}>
                    <Group justify="space-between">
                      <div>
                        <Text fw={500}>{store.name}</Text>
                        <Text size="sm" c="dimmed">{store.code} — {store.length}×{store.width}×{store.height}m</Text>
                      </div>
                      <Badge color={store.temporary ? 'yellow' : 'blue'}>
                        {store.temporary ? 'Temporary' : 'Permanent'}
                      </Badge>
                    </Group>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed">No stores in this warehouse</Text>
            )}
          </Card>
        </Tabs.Panel>

        {/* Stock Tab */}
        <Tabs.Panel value="stock" pt="md">
          <Card withBorder>
            {warehouseStock && warehouseStock.length > 0 ? (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Store</Table.Th>
                    <Table.Th>Stack</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Unit</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {warehouseStock.map((stock) => (
                    <Table.Tr key={stock.id}>
                      <Table.Td>{stock.commodity_name || stock.commodity_batch_no || stock.commodity_id}</Table.Td>
                      <Table.Td>{stock.store_name || stock.store_code || stock.store_id || '-'}</Table.Td>
                      <Table.Td>{stock.stack_code || stock.stack_id || '-'}</Table.Td>
                      <Table.Td>{stock.quantity}</Table.Td>
                      <Table.Td>{stock.unit_abbreviation || stock.unit_name || stock.unit_id}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed">No stock in this warehouse</Text>
            )}
          </Card>
        </Tabs.Panel>

        {/* Operations Tab */}
        <Tabs.Panel value="operations" pt="md">
          <Stack gap="md">
            <Card withBorder>
              <Text fw={600} mb="sm">Recent GRNs</Text>
              {warehouseGrns && warehouseGrns.length > 0 ? (
                <Stack gap="xs">
                  {warehouseGrns.map((grn) => (
                    <Card key={grn.id} withBorder padding="xs" style={{ cursor: 'pointer' }} onClick={() => navigate(`/grns/${grn.id}`)}>
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500}>{grn.reference_no}</Text>
                          <Text size="xs" c="dimmed">{formatDate(grn.received_on)}</Text>
                        </div>
                        <StatusBadge status={grn.status} />
                      </Group>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">No recent GRNs</Text>
              )}
            </Card>
            <Card withBorder>
              <Text fw={600} mb="sm">Recent GINs</Text>
              {warehouseGins && warehouseGins.length > 0 ? (
                <Stack gap="xs">
                  {warehouseGins.map((gin) => (
                    <Card key={gin.id} withBorder padding="xs" style={{ cursor: 'pointer' }} onClick={() => navigate(`/gins/${gin.id}`)}>
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500}>{gin.reference_no}</Text>
                          <Text size="xs" c="dimmed">{formatDate(gin.issued_on)}</Text>
                        </div>
                        <StatusBadge status={gin.status} />
                      </Group>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">No recent GINs</Text>
              )}
            </Card>
            <Card withBorder>
              <Text fw={600} mb="sm">Recent Inspections</Text>
              {warehouseInspections && warehouseInspections.length > 0 ? (
                <Stack gap="xs">
                  {warehouseInspections.map((inspection) => (
                    <Card key={inspection.id} withBorder padding="xs" style={{ cursor: 'pointer' }} onClick={() => navigate(`/inspections/${inspection.id}`)}>
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500}>{inspection.reference_no}</Text>
                          <Text size="xs" c="dimmed">{formatDate(inspection.inspected_on)}</Text>
                        </div>
                        <StatusBadge status={inspection.status} />
                      </Group>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">No recent inspections</Text>
              )}
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Delete Modal */}
      <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Warehouse">
        <Text mb="md">Are you sure you want to delete this warehouse? This action cannot be undone.</Text>
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
        initialLat={warehouse.geo?.latitude}
        initialLng={warehouse.geo?.longitude}
        title={warehouse.geo ? 'Update GPS Location' : 'Add GPS Location'}
      />

      {/* Capacity Modal */}
      <Modal opened={capacityModalOpen} onClose={() => setCapacityModalOpen(false)} title="Edit Capacity" centered>
        <form onSubmit={capacityForm.onSubmit((values) => updateCapacityMutation.mutate(values))}>
          <Stack gap="md">
            <NumberInput label="Total Area (sqm)" min={0} {...capacityForm.getInputProps('total_area_sqm')} />
            <NumberInput label="Total Storage Capacity (MT)" min={0} {...capacityForm.getInputProps('total_storage_capacity_mt')} />
            <TextInput
              label="Usable Capacity (calculated)"
              value={
                warehouse.capacity?.usable_storage_capacity_mt !== undefined
                  ? String(warehouse.capacity.usable_storage_capacity_mt)
                  : ''
              }
              readOnly
            />
            <TextInput
              label="Number of Stores"
              value={warehouseStores?.length?.toString() || '0'}
              readOnly
              styles={{
                input: {
                  backgroundColor: '#fff',
                  color: '#000',
                  cursor: 'default',
                },
              }}
            />
            <NumberInput label="Construction Year" min={1900} max={new Date().getFullYear()} {...capacityForm.getInputProps('construction_year')} />
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
                <Select label="Loading Dock Type" data={facilityOptions?.loading_dock_type || []} {...accessForm.getInputProps('loading_dock_type')} />
              </>
            )}
            <Divider />
            <Select label="Access Road Type" data={facilityOptions?.access_road_type || []} {...accessForm.getInputProps('access_road_type')} />
            <TextInput label="Nearest Town" {...accessForm.getInputProps('nearest_town')} />
            <NumberInput label="Distance from Town (km)" min={0} {...accessForm.getInputProps('distance_from_town_km')} />
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
            <Select label="Floor Type" data={facilityOptions?.floor_type || []} {...infraForm.getInputProps('floor_type')} />
            <Select label="Roof Type" data={facilityOptions?.roof_type || []} {...infraForm.getInputProps('roof_type')} />
            <Switch label="Has Fumigation Facility" {...infraForm.getInputProps('has_fumigation_facility', { type: 'checkbox' })} />
            <Switch label="Has Fire Extinguisher" {...infraForm.getInputProps('has_fire_extinguisher', { type: 'checkbox' })} />
            <Switch label="Has Security Guard" {...infraForm.getInputProps('has_security_guard', { type: 'checkbox' })} />
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
    </Stack>
  );
}

export default WarehouseDetailPage;
