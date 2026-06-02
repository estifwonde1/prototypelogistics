/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, Title, Group, Button, Tabs, Card, Text, Grid, Badge, Modal, Anchor, Table, TextInput, NumberInput, Switch, Divider, ActionIcon, Checkbox, Alert, Tooltip } from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { IconEdit, IconArrowLeft, IconMapPin, IconPlus, IconTrash } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { previewWarehouseCapacity, storeFullyOccupiesWarehouse, formatFullWarehouseCapacityLabel } from '../../utils/capacityCalculator';
import {
  getWarehouse, updateWarehouse, updateWarehouseCapacity,
  updateWarehouseAccess, updateWarehouseInfra, updateWarehouseContacts,
  updateWarehouseGps,
} from '../../api/warehouses';
import { getHubs } from '../../api/hubs';
import { getStores, createStore, deleteStore } from '../../api/stores';
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
import { getFacilityOptions } from '../../api/referenceData';

function formatStoreCount(count: number): string {
  return count > 0 ? String(count) : '-';
}

function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const warehouseIdNum = id ? Number(id) : undefined;
  const activeTab = searchParams.get('tab') || 'overview';
  const { can } = usePermission();
  const canEdit = can('warehouses', 'update');
  const canReadHubs = can('hubs', 'read');
  const canCreateStores = can('stores', 'create');
  const canUpdateStores = can('stores', 'update');
  const canDeleteStores = can('stores', 'delete');

  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [singleStoreModalOpen, setSingleStoreModalOpen] = useState(false);
  const [createSingleStore, setCreateSingleStore] = useState(false);
  const [pendingCapacityDimensions, setPendingCapacityDimensions] = useState<{
    length_m: number;
    width_m: number;
    height_m: number;
  } | null>(null);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [infraModalOpen, setInfraModalOpen] = useState(false);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [deleteStoreModalOpen, setDeleteStoreModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<{ id: number; name: string } | null>(null);

  const { data: warehouse, isLoading, error } = useQuery({
    queryKey: ['warehouses', id],
    queryFn: () => getWarehouse(Number(id)),
    enabled: !!id,
  });

  const { data: hubs } = useQuery({ queryKey: ['hubs'], queryFn: () => getHubs(), enabled: canReadHubs });
  
  const { data: warehouseStores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['stores', { warehouse_id: warehouseIdNum }],
    queryFn: () => getStores({ warehouse_id: warehouseIdNum! }),
    enabled: !!warehouseIdNum,
  });
  const storeCount = warehouseStores.length;
  const { data: stockBalances = [] } = useQuery({
    queryKey: ['stockBalances', { warehouse_id: Number(id) }],
    queryFn: () => getStockBalances({ warehouse_id: Number(id) }),
    enabled: !!id && activeTab === 'stock',
  });
  const { data: grns } = useQuery({
    queryKey: ['grns', { warehouse_id: Number(id) }],
    queryFn: () => getGrns({ warehouse_id: Number(id) }),
    enabled: !!id && activeTab === 'operations',
  });
  const { data: gins } = useQuery({
    queryKey: ['gins', { warehouse_id: Number(id) }],
    queryFn: () => getGins({ warehouse_id: Number(id) }),
    enabled: !!id && activeTab === 'operations',
  });
  const { data: inspections } = useQuery({
    queryKey: ['inspections', { warehouse_id: Number(id) }],
    queryFn: () => getInspections({ warehouse_id: Number(id) }),
    enabled: !!id && activeTab === 'operations',
  });
  const { data: facilityOptions } = useQuery({
    queryKey: ['reference-data', 'facility-options'],
    queryFn: () => getFacilityOptions(),
  });

  const toNumber = (value: number | '' | null | undefined) =>
    value === '' || value === null || value === undefined ? undefined : Number(value);

  const capacityForm = useForm({
    initialValues: {
      length_m: '' as number | '',
      width_m: '' as number | '',
      height_m: '' as number | '',
      construction_year: '' as number | '',
      ownership_type: '',
      usable_space_percentage: 75 as number,
    },
  });

  const capacityPreview = useMemo(() => {
    const l = capacityForm.values.length_m;
    const w = capacityForm.values.width_m;
    const h = capacityForm.values.height_m;
    if (l === '' || w === '' || h === '') return null;
    return previewWarehouseCapacity(
      Number(l),
      Number(w),
      Number(h),
      capacityForm.values.usable_space_percentage
    );
  }, [
    capacityForm.values.length_m,
    capacityForm.values.width_m,
    capacityForm.values.height_m,
    capacityForm.values.usable_space_percentage,
  ]);

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

  const singleStoreForm = useForm({
    initialValues: { name: '', code: '' },
    validate: {
      name: (v) => (!v ? 'Store name is required' : null),
      code: (v) => (!v ? 'Store code is required' : null),
    },
  });

  useEffect(() => {
    if (!warehouse) return;
    capacityForm.setValues({
      length_m: warehouse.capacity?.length_m ?? '',
      width_m: warehouse.capacity?.width_m ?? '',
      height_m: warehouse.capacity?.height_m ?? '',
      construction_year: warehouse.capacity?.construction_year ?? '',
      ownership_type: warehouse.ownership_type || '',
      usable_space_percentage: warehouse.capacity?.usable_space_percentage ?? 75,
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
    mutationFn: async (payload: typeof capacityForm.values & { createSingleStore?: boolean }) => {
      // WarehouseCapacity fields — sent to PUT /warehouses/:id/capacity
      await updateWarehouseCapacity(Number(id), {
        length_m: toNumber(payload.length_m),
        width_m: toNumber(payload.width_m),
        height_m: toNumber(payload.height_m),
        construction_year: toNumber(payload.construction_year),
        usable_space_percentage: payload.usable_space_percentage,
      });

      // ownership_type lives on the Warehouse record itself, not on WarehouseCapacity.
      // Only send the PATCH when the value has actually changed to avoid a redundant write.
      if (payload.ownership_type && payload.ownership_type !== warehouse?.ownership_type) {
        await updateWarehouse(Number(id), { ownership_type: payload.ownership_type });
      }

      return {
        createSingleStore: payload.createSingleStore,
        length_m: toNumber(payload.length_m),
        width_m: toNumber(payload.width_m),
        height_m: toNumber(payload.height_m),
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', id] });
      notifications.show({ title: 'Success', message: 'Capacity updated', color: 'green' });
      setCapacityModalOpen(false);
      setCreateSingleStore(false);

      if (
        result?.createSingleStore &&
        result.length_m &&
        result.width_m &&
        result.height_m &&
        canCreateStores
      ) {
        setPendingCapacityDimensions({
          length_m: result.length_m,
          width_m: result.width_m,
          height_m: result.height_m,
        });
        singleStoreForm.setValues({
          name: '',
          code: warehouse ? `${warehouse.code}-STORE-001` : 'STORE-001',
        });
        setSingleStoreModalOpen(true);
      }
    },
    onError: (error: any) => {
      notifications.show({ title: 'Error', message: error.response?.data?.error?.message || 'Failed to update capacity', color: 'red' });
    },
  });

  const createSingleStoreMutation = useMutation({
    mutationFn: async (values: { name: string; code: string }) => {
      if (!pendingCapacityDimensions || !warehouse) {
        throw new Error('Missing warehouse capacity dimensions');
      }
      return createStore({
        name: values.name,
        code: values.code,
        warehouse_id: warehouse.id,
        length: pendingCapacityDimensions.length_m,
        width: pendingCapacityDimensions.width_m,
        height: pendingCapacityDimensions.height_m,
        temporary: false,
        has_gangway: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses', id] });
      notifications.show({ title: 'Success', message: 'Single store created for this warehouse', color: 'green' });
      setSingleStoreModalOpen(false);
      setPendingCapacityDimensions(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to create store',
        color: 'red',
      });
    },
  });

  const deleteStoreMutation = useMutation({
    mutationFn: (storeId: number) => deleteStore(storeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses', id] });
      notifications.show({ title: 'Success', message: 'Store deleted successfully', color: 'green' });
      setDeleteStoreModalOpen(false);
      setStoreToDelete(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to delete store',
        color: 'red',
      });
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
  const storeContextQuery = `warehouse_id=${warehouse?.id}&return_to=warehouse`;
  const warehouseFullyAllocated = useMemo(
    () =>
      !!warehouse?.capacity &&
      (warehouseStores ?? []).some((s) => storeFullyOccupiesWarehouse(s, warehouse.capacity)),
    [warehouse, warehouseStores]
  );
  const fullOccupancyStore = warehouseFullyAllocated
    ? warehouseStores?.find((s) => storeFullyOccupiesWarehouse(s, warehouse?.capacity))
    : undefined;
  const isSingleStoreWarehouse =
    warehouseFullyAllocated && (warehouseStores?.length ?? 0) === 1 && !!fullOccupancyStore;
  const warehouseUsableMt = Number(warehouse?.capacity?.usable_storage_capacity_mt ?? 0);
  const warehouseUsablePct = warehouse?.capacity?.usable_space_percentage ?? 75;
  const fullWarehouseCapacityLabel = formatFullWarehouseCapacityLabel(
    warehouseUsableMt,
    warehouseUsablePct
  );
  const warehouseStock = stockBalances;
  const warehouseGrns = grns?.slice(0, 5);
  const warehouseGins = gins?.slice(0, 5);
  const warehouseInspections = inspections?.slice(0, 5);

  const formatHierarchicalLevel = (value?: string) => {
    if (!value) return '-';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

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
      </Group>

      <Tabs
        value={activeTab}
        onChange={(value) => {
          if (value) {
            setSearchParams(value === 'overview' ? {} : { tab: value }, { replace: true });
          }
        }}
      >
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
                  <Text size="sm" c="dimmed">Hierarchical Level</Text>
                  <Text fw={500}>{formatHierarchicalLevel(warehouse.managed_under)}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Region</Text>
                  <Text fw={500}>{warehouse.region_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Subcity</Text>
                  <Text fw={500}>{warehouse.subcity_name || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Woreda</Text>
                  <Text fw={500}>{warehouse.woreda_name || warehouse.location_name || '-'}</Text>
                </Grid.Col>
                {warehouse.kebele && (
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Text size="sm" c="dimmed">Kebele Number</Text>
                    <Text fw={500}>{warehouse.kebele}</Text>
                  </Grid.Col>
                )}
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
                    size="sm"
                    variant="light"
                    leftSection={<IconMapPin size={16} />}
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
              <Button size="sm" variant="light" leftSection={<IconEdit size={16} />} onClick={() => setCapacityModalOpen(true)}>Edit</Button>
            )}
          </Group>
          {warehouse.capacity?.capacity_established && !storesLoading && storeCount === 0 && (
            <Alert color="blue" variant="light" mb="sm" title="No stores yet">
              This warehouse has no stores yet. Edit capacity to set up a single-store warehouse using the full usable
              capacity.
            </Alert>
          )}
          <Card withBorder>
            {warehouse.capacity ? (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Dimensions (L × W × H m)</Text>
                  <Text fw={500}>
                    {warehouse.capacity.length_m != null
                      ? `${warehouse.capacity.length_m} × ${warehouse.capacity.width_m} × ${warehouse.capacity.height_m}`
                      : '—'}
                  </Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Floor footprint (m²)</Text>
                  <Text fw={500}>{warehouse.capacity.total_area_sqm ?? '—'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Usable volume (m³)</Text>
                  <Text fw={500}>{warehouse.capacity.usable_volume_m3 ?? '—'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Storage capacity (MT)</Text>
                  <Text fw={500}>{warehouse.capacity.usable_storage_capacity_mt ?? '—'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">MT in use</Text>
                  <Text fw={500} c="blue">{warehouse.capacity.used_capacity_mt ?? 0}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">MT remaining</Text>
                  <Text fw={500} c="green">{warehouse.capacity.remaining_capacity_mt ?? '—'}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Utilization</Text>
                  <Text fw={500}>
                    {warehouse.capacity.utilization_pct != null
                      ? `${warehouse.capacity.utilization_pct}%`
                      : '—'}
                  </Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" c="dimmed">Number of Stores</Text>
                  <Text fw={500}>{formatStoreCount(storeCount)}</Text>
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
                {canEdit && <Button size="sm" variant="light" leftSection={<IconEdit size={16} />} onClick={() => setCapacityModalOpen(true)}>Add Capacity Info</Button>}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Access Tab */}
        <Tabs.Panel value="access" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Access</Title>
            {canEdit && (
              <Button size="sm" variant="light" leftSection={<IconEdit size={16} />} onClick={() => setAccessModalOpen(true)}>Edit</Button>
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
                {canEdit && <Button size="sm" variant="light" leftSection={<IconEdit size={16} />} onClick={() => setAccessModalOpen(true)}>Add Access Info</Button>}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Infrastructure Tab */}
        <Tabs.Panel value="infrastructure" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Infrastructure</Title>
            {canEdit && (
              <Button size="sm" variant="light" leftSection={<IconEdit size={16} />} onClick={() => setInfraModalOpen(true)}>Edit</Button>
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
                {canEdit && <Button size="sm" variant="light" leftSection={<IconEdit size={16} />} onClick={() => setInfraModalOpen(true)}>Add Infrastructure Info</Button>}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Contacts Tab */}
        <Tabs.Panel value="contacts" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Contacts</Title>
            {canEdit && (
              <Button size="sm" variant="light" leftSection={<IconEdit size={16} />} onClick={() => setContactsModalOpen(true)}>Edit</Button>
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
                {canEdit && <Button size="sm" variant="light" leftSection={<IconEdit size={16} />} onClick={() => setContactsModalOpen(true)}>Add Contact Info</Button>}
              </Stack>
            )}
          </Card>
        </Tabs.Panel>

        {/* Stores Tab */}
        <Tabs.Panel value="stores" pt="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Stores</Title>
            {canCreateStores && !warehouseFullyAllocated && (
              <Button size="sm" variant="light" leftSection={<IconPlus size={16} />} onClick={() => navigate(`/stores/new?${storeContextQuery}`)}>
                Create Store
              </Button>
            )}
          </Group>
          {warehouseFullyAllocated && fullOccupancyStore && (
            <Alert
              color="teal"
              variant="light"
              mb="sm"
              title={isSingleStoreWarehouse ? "Single-store warehouse" : "Warehouse fully occupied"}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Text size="sm">
                  {isSingleStoreWarehouse ? (
                    <>
                      {fullOccupancyStore.name} uses the entire warehouse capacity ({fullWarehouseCapacityLabel}).
                      This warehouse operates as a single store — you cannot create more stores until you reduce this
                      store&apos;s dimensions.
                    </>
                  ) : (
                    <>
                      This warehouse is fully occupied by {fullOccupancyStore.name}. Edit that store and reduce its
                      dimensions to add more stores.
                    </>
                  )}
                </Text>
                {canUpdateStores && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconEdit size={14} />}
                    onClick={() => navigate(`/stores/${fullOccupancyStore.id}/edit?${storeContextQuery}`)}
                  >
                    Edit store
                  </Button>
                )}
              </Group>
            </Alert>
          )}
          <Card withBorder>
            {warehouseStores && warehouseStores.length > 0 ? (
              <Stack gap="sm">
                {warehouseStores.map((store) => {
                  const storeHasStock = (store.used_capacity_mt ?? 0) > 0;
                  const storeUsesFullWarehouse = storeFullyOccupiesWarehouse(store, warehouse.capacity);

                  return (
                    <Card
                      key={store.id}
                      withBorder
                      padding="sm"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/stores/${store.id}`)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <div>
                          <Text fw={500}>{store.name}</Text>
                          <Text size="sm" c="dimmed">
                            {store.code} — {store.length}×{store.width}×{store.height}m
                          </Text>
                        </div>
                        <Group gap="xs" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                          {storeUsesFullWarehouse && (
                            <Badge color="teal" variant="light">
                              Full warehouse capacity
                            </Badge>
                          )}
                          <Badge color={store.temporary ? 'yellow' : 'blue'}>
                            {store.temporary ? 'Temporary' : 'Permanent'}
                          </Badge>
                          {canUpdateStores && (
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label={`Edit ${store.name}`}
                              onClick={() => navigate(`/stores/${store.id}/edit?${storeContextQuery}`)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          )}
                          {canDeleteStores && (
                            storeHasStock ? (
                              <Tooltip label="Cannot delete a store that has stock. Move or remove stock first.">
                                <span>
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    aria-label={`Delete ${store.name}`}
                                    disabled
                                  >
                                    <IconTrash size={16} />
                                  </ActionIcon>
                                </span>
                              </Tooltip>
                            ) : (
                              <Tooltip label="Delete store">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  aria-label={`Delete ${store.name}`}
                                  onClick={() => {
                                    setStoreToDelete({ id: store.id, name: store.name });
                                    setDeleteStoreModalOpen(true);
                                  }}
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )
                          )}
                        </Group>
                      </Group>
                    </Card>
                  );
                })}
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
      <Modal opened={capacityModalOpen} onClose={() => { setCapacityModalOpen(false); setCreateSingleStore(false); }} title="Edit Capacity" centered>
        <form onSubmit={capacityForm.onSubmit((values) => updateCapacityMutation.mutate({ ...values, createSingleStore }))}>
          <Stack gap="md">
            <Group grow>
              <NumberInput label="Length (m)" min={0} decimalScale={2} {...capacityForm.getInputProps('length_m')} />
              <NumberInput label="Width (m)" min={0} decimalScale={2} {...capacityForm.getInputProps('width_m')} />
              <NumberInput label="Height (m)" min={0} decimalScale={2} {...capacityForm.getInputProps('height_m')} />
            </Group>
            <div>
              <Text size="sm" fw={500} mb={4}>Usable floor area %</Text>
              <Group gap="xs" align="center">
                <ActionIcon
                  variant="default"
                  size="lg"
                  onClick={() => {
                    const current = capacityForm.values.usable_space_percentage ?? 75;
                    if (current > 70) capacityForm.setFieldValue('usable_space_percentage', current - 1);
                  }}
                  disabled={capacityForm.values.usable_space_percentage <= 70}
                >
                  −
                </ActionIcon>
                <Text fw={700} size="sm" w={40} ta="center">
                  {capacityForm.values.usable_space_percentage}%
                </Text>
                <ActionIcon
                  variant="default"
                  size="lg"
                  onClick={() => {
                    const current = capacityForm.values.usable_space_percentage ?? 75;
                    if (current < 80) capacityForm.setFieldValue('usable_space_percentage', current + 1);
                  }}
                  disabled={capacityForm.values.usable_space_percentage >= 80}
                >
                  +
                </ActionIcon>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>Range: 70% – 80% of floor footprint</Text>
            </div>
            {capacityPreview && (
              <Card withBorder padding="sm" bg="gray.0">
                <Text size="sm" fw={500} mb={4}>Calculated capacity (preview)</Text>
                <Text size="sm">Footprint: {capacityPreview.footprintSqm.toLocaleString()} m²</Text>
                <Text size="sm">Usable volume: {capacityPreview.usableVolumeM3.toLocaleString()} m³</Text>
                <Text size="sm" fw={600} c="blue">
                  Storage capacity: {capacityPreview.capacityMt.toLocaleString(undefined, { maximumFractionDigits: 2 })} MT
                </Text>
              </Card>
            )}
            <TextInput
              label="Number of Stores"
              value={formatStoreCount(storeCount)}
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
            {(!warehouseStores || warehouseStores.length === 0) && canCreateStores && (
              <Checkbox
                label="Use entire warehouse as a single store"
                description="After saving capacity, create one store using the full warehouse dimensions and usable MT capacity. Only the store name is required."
                checked={createSingleStore}
                onChange={(event) => setCreateSingleStore(event.currentTarget.checked)}
              />
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setCapacityModalOpen(false)}>Cancel</Button>
              <Button type="submit" loading={updateCapacityMutation.isPending}>Save</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={singleStoreModalOpen}
        onClose={() => { setSingleStoreModalOpen(false); setPendingCapacityDimensions(null); }}
        title="Create Single Store"
        centered
      >
        <form onSubmit={singleStoreForm.onSubmit((values) => createSingleStoreMutation.mutate(values))}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              This store will use the full warehouse dimensions and usable capacity you just saved.
            </Text>
            <TextInput label="Store Name" placeholder="Main Storage Area" required {...singleStoreForm.getInputProps('name')} />
            <TextInput label="Store Code" placeholder="STORE-001" required {...singleStoreForm.getInputProps('code')} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => { setSingleStoreModalOpen(false); setPendingCapacityDimensions(null); }}>
                Cancel
              </Button>
              <Button type="submit" loading={createSingleStoreMutation.isPending}>
                Create Store
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={deleteStoreModalOpen}
        onClose={() => {
          setDeleteStoreModalOpen(false);
          setStoreToDelete(null);
        }}
        title="Delete Store"
        centered
      >
        <Text mb="md">
          Are you sure you want to delete {storeToDelete?.name ?? 'this store'}? This action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={() => {
              setDeleteStoreModalOpen(false);
              setStoreToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            color="red"
            loading={deleteStoreMutation.isPending}
            onClick={() => storeToDelete && deleteStoreMutation.mutate(storeToDelete.id)}
          >
            Delete
          </Button>
        </Group>
      </Modal>

      {/* Access Modal */}
      <Modal opened={accessModalOpen} onClose={() => setAccessModalOpen(false)} title="Edit Access" centered>
        <form onSubmit={accessForm.onSubmit((values) => updateAccessMutation.mutate(values))}>
          <Stack gap="md">
            <Switch label="Has Loading Dock" {...accessForm.getInputProps('has_loading_dock', { type: 'checkbox' })} />
            {accessForm.values.has_loading_dock && (
              <>
                <NumberInput label="Number of Loading Docks" min={0} {...accessForm.getInputProps('number_of_loading_docks')} />
                <SearchableSelect label="Loading Dock Type" data={facilityOptions?.loading_dock_type || []} {...accessForm.getInputProps('loading_dock_type')} />
              </>
            )}
            <Divider />
            <SearchableSelect label="Access Road Type" data={facilityOptions?.access_road_type || []} {...accessForm.getInputProps('access_road_type')} />
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
            <SearchableSelect label="Floor Type" data={facilityOptions?.floor_type || []} {...infraForm.getInputProps('floor_type')} />
            <SearchableSelect label="Roof Type" data={facilityOptions?.roof_type || []} {...infraForm.getInputProps('roof_type')} />
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
