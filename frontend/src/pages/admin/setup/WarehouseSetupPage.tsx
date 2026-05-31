/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Group, Stack, Text, TextInput, Textarea, Title, NumberInput } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createWarehouse, getWarehouse, updateWarehouse } from '../../../api/warehouses';
import { getHub } from '../../../api/hubs';
import { getKebeles, getRegions, getWoredas, getZones } from '../../../api/locations';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingState } from '../../../components/common/LoadingState';
import { dedupOptions } from '../../../utils/dedup';
import { RentalAgreementUpload } from '../../../components/common/RentalAgreementUpload';
import {
  locationContextFromEntity,
  resolveLocationContextFromQuery,
} from '../../../utils/locationContext';

const MANAGED_UNDER_OPTIONS = [
  { value: 'federal', label: 'Federal' },
  { value: 'regional', label: 'Regional' },
  { value: 'zonal', label: 'Zonal' },
  { value: 'woreda', label: 'Woreda' },
  { value: 'kebele', label: 'Kebele' },
];

const OWNERSHIP_TYPE_OPTIONS = [
  { value: 'self_owned', label: 'Self Owned' },
  { value: 'rental', label: 'Rental' },
];

const DEFAULT_REGION_NAME = 'Addis Ababa';

const kebeleNumberFromName = (name?: string): number | undefined => {
  if (!name) return undefined;

  const match = name.match(/\d+/);
  if (!match) return undefined;

  const value = Number(match[0]);
  return value >= 1 && value <= 40 ? value : undefined;
};

export default function WarehouseSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editIdParam = searchParams.get('id');
  const editId = editIdParam ? Number(editIdParam) : null;
  const isEdit = !!editId;
  const hubIdParam = searchParams.get('hub_id');
  const hubId = !isEdit && hubIdParam ? Number(hubIdParam) : null;
  const inheritedContextFromQuery = resolveLocationContextFromQuery(searchParams);
  const isInheritedFromLocationPage = !isEdit && !hubId && !!inheritedContextFromQuery.woredaId;
  const isLocationLocked = !isEdit && (!!hubId || isInheritedFromLocationPage);
  const editInitialized = useRef(false);

  const [regionId, setRegionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [woredaId, setWoredaId] = useState<string | null>(null);
  const [kebeleId, setKebeleId] = useState<string | null>(null);
  const [rentalAgreementFile, setRentalAgreementFile] = useState<File | null>(null);

  const { data: warehouse, isLoading: warehouseLoading, error: warehouseError } = useQuery({
    queryKey: ['warehouses', editId],
    queryFn: () => getWarehouse(editId as number),
    enabled: isEdit,
  });

  const editParentHubId = isEdit ? warehouse?.hub_id : hubId;

  const { data: hub } = useQuery({
    queryKey: ['hubs', editParentHubId],
    queryFn: () => getHub(editParentHubId as number),
    enabled: !!editParentHubId,
  });

  const { data: regions, isLoading: regionsLoading, error: regionsError } = useQuery({
    queryKey: ['locations', 'regions'],
    queryFn: getRegions,
  });

  const editLocationContext = useMemo(() => locationContextFromEntity(warehouse), [warehouse]);

  const inheritedContext = useMemo(() => {
    if (!editParentHubId) return undefined;
    if (inheritedContextFromQuery.woredaId || inheritedContextFromQuery.kebeleId) {
      return inheritedContextFromQuery;
    }
    return locationContextFromEntity(hub);
  }, [editParentHubId, inheritedContextFromQuery, hub]);

  const { data: zones, isLoading: zonesLoading } = useQuery({
    queryKey: ['locations', 'zones', regionId],
    queryFn: () => getZones(regionId ? Number(regionId) : undefined),
    enabled: !!regionId,
  });

  const { data: woredas, isLoading: woredasLoading } = useQuery({
    queryKey: ['locations', 'woredas', zoneId],
    queryFn: () => getWoredas(Number(zoneId)),
    enabled: !!zoneId,
  });

  const activeWoredaId = isEdit
    ? woredaId
      ? Number(woredaId)
      : editLocationContext?.woredaId
    : editParentHubId
      ? inheritedContext?.woredaId
      : woredaId
        ? Number(woredaId)
        : undefined;
  const { data: kebeles } = useQuery({
    queryKey: ['locations', 'kebeles', activeWoredaId],
    queryFn: () => getKebeles(Number(activeWoredaId)),
    enabled: !!activeWoredaId,
  });

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      warehouse_type: 'main',
      status: 'active',
      managed_under: editParentHubId ? 'Hub' : MANAGED_UNDER_OPTIONS[0].value,
      ownership_type: 'self_owned',
      description: '',
      kebele: '' as number | '',
    },
    validate: {
      code: (value) => (!value ? 'Code is required' : null),
      name: (value) => (!value ? 'Name is required' : null),
      managed_under: (value) => (!value ? 'Hierarchical level is required' : null),
      ownership_type: (value) => (!value ? 'Ownership type is required' : null),
      kebele: (value) => {
        if (value === '' || value === null || value === undefined) return null;
        const num = Number(value);
        if (isNaN(num)) return 'Kebele must be a number';
        if (num < 1 || num > 40) return 'Kebele must be between 1 and 40';
        return null;
      },
    },
  });

  useEffect(() => {
    if (isEdit) return;
    if (regions && regions.length > 0 && !regionId) {
      const inheritedRegionId = editParentHubId ? inheritedContext?.regionId : inheritedContextFromQuery.regionId;
      const defaultRegion =
        regions.find((region) => region.id === inheritedRegionId) ||
        regions.find((region) => region.name === DEFAULT_REGION_NAME) ||
        regions[0];
      setRegionId(String(defaultRegion.id));
    }
  }, [regions, regionId, isEdit, editParentHubId, inheritedContext?.regionId, inheritedContextFromQuery.regionId]);

  useEffect(() => {
    if (isEdit) return;
    if (editParentHubId && inheritedContext) {
      if (inheritedContext.zoneId) setZoneId(String(inheritedContext.zoneId));
      if (inheritedContext.woredaId) setWoredaId(String(inheritedContext.woredaId));
      setKebeleId(inheritedContext.kebeleId ? String(inheritedContext.kebeleId) : null);
      return;
    }

    if (isInheritedFromLocationPage) {
      if (inheritedContextFromQuery.zoneId) setZoneId(String(inheritedContextFromQuery.zoneId));
      return;
    }

    if (!zones || zones.length === 0) {
      setZoneId(null);
      setKebeleId(null);
      return;
    }

    if (!zoneId || !zones.some((zone) => String(zone.id) === zoneId)) {
      setZoneId(String(zones[0].id));
    }
  }, [isEdit, editParentHubId, inheritedContext, isInheritedFromLocationPage, inheritedContextFromQuery.zoneId, zoneId, zones]);

  useEffect(() => {
    if (isEdit) return;
    if (editParentHubId) return;
    if (isInheritedFromLocationPage) {
      if (inheritedContextFromQuery.woredaId) setWoredaId(String(inheritedContextFromQuery.woredaId));
      setKebeleId(inheritedContextFromQuery.kebeleId ? String(inheritedContextFromQuery.kebeleId) : null);
      return;
    }
    if (!woredas || woredas.length === 0) {
      setWoredaId(null);
      setKebeleId(null);
      return;
    }
    if (!woredaId || !woredas.some((woreda) => String(woreda.id) === woredaId)) {
      setWoredaId(String(woredas[0].id));
    }
  }, [isEdit, editParentHubId, isInheritedFromLocationPage, inheritedContextFromQuery.woredaId, woredaId, woredas]);

  useEffect(() => {
    if (isEdit) return;
    if (editParentHubId) {
      setKebeleId(inheritedContext?.kebeleId ? String(inheritedContext.kebeleId) : null);
      return;
    }
    if (isInheritedFromLocationPage) {
      setKebeleId(inheritedContextFromQuery.kebeleId ? String(inheritedContextFromQuery.kebeleId) : null);
      return;
    }
    if (!kebeles || kebeles.length === 0) {
      setKebeleId(null);
      return;
    }
    if (kebeleId && !kebeles.some((kebele) => String(kebele.id) === kebeleId)) {
      setKebeleId(null);
    }
  }, [isEdit, editParentHubId, inheritedContext?.kebeleId, isInheritedFromLocationPage, inheritedContextFromQuery.kebeleId, kebeles, kebeleId]);

  useEffect(() => {
    if (!isEdit || !warehouse || editInitialized.current) return;

    editInitialized.current = true;
    form.setValues({
      code: warehouse.code,
      name: warehouse.name,
      warehouse_type: warehouse.warehouse_type,
      status: warehouse.status,
      managed_under: warehouse.managed_under || (warehouse.hub_id ? 'Hub' : MANAGED_UNDER_OPTIONS[0].value),
      ownership_type: warehouse.ownership_type || 'self_owned',
      description: warehouse.description || '',
      kebele: warehouse.kebele ?? '',
    });

    const ctx = editLocationContext;
    if (ctx.regionId) setRegionId(String(ctx.regionId));
    if (ctx.zoneId) setZoneId(String(ctx.zoneId));
    if (ctx.woredaId) setWoredaId(String(ctx.woredaId));
    if (ctx.kebeleId) setKebeleId(String(ctx.kebeleId));
  }, [isEdit, warehouse, editLocationContext]);

  const createMutation = useMutation({
    mutationFn: createWarehouse,
    onSuccess: (createdWarehouse) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      notifications.show({ title: 'Success', message: 'Warehouse created', color: 'green' });
      form.reset();
      setRentalAgreementFile(null);
      if (hubId) {
        navigate(`/hubs/${hubId}?tab=warehouses`);
        return;
      }

      navigate(`/warehouses/${createdWarehouse.id}`);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to create warehouse',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateWarehouse>[1]) => updateWarehouse(editId as number, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses', editId] });
      notifications.show({ title: 'Success', message: 'Warehouse updated', color: 'green' });
      navigate(`/warehouses/${editId}`);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to update warehouse',
        color: 'red',
      });
    },
  });

  const regionOptions = useMemo(
    () => dedupOptions(regions?.map((region) => ({ value: String(region.id), label: region.name })) || []),
    [regions]
  );

  const zoneOptions = useMemo(
    () => dedupOptions(zones?.map((zone) => ({ value: String(zone.id), label: zone.name })) || []),
    [zones]
  );

  const woredaOptions = useMemo(
    () => dedupOptions(woredas?.map((woreda) => ({ value: String(woreda.id), label: woreda.name })) || []),
    [woredas]
  );

  const displayedZoneOptions = useMemo(() => {
    const context = isEdit ? editLocationContext : editParentHubId ? inheritedContext : inheritedContextFromQuery;
    if (!context?.zoneId || !context.subcityName) return zoneOptions;
    if (zoneOptions.some((option) => option.value === String(context.zoneId))) return zoneOptions;
    return dedupOptions([{ value: String(context.zoneId), label: context.subcityName }, ...zoneOptions]);
  }, [isEdit, editLocationContext, editParentHubId, inheritedContext, inheritedContextFromQuery, zoneOptions]);

  const displayedWoredaOptions = useMemo(() => {
    const context = isEdit ? editLocationContext : editParentHubId ? inheritedContext : inheritedContextFromQuery;
    if (!context?.woredaId || !context.woredaName) return woredaOptions;
    if (woredaOptions.some((option) => option.value === String(context.woredaId))) return woredaOptions;
    return dedupOptions([{ value: String(context.woredaId), label: context.woredaName }, ...woredaOptions]);
  }, [isEdit, editLocationContext, editParentHubId, inheritedContext, inheritedContextFromQuery, woredaOptions]);

  const kebeleOptions = useMemo(
    () => dedupOptions(kebeles?.map((kebele) => ({ value: String(kebele.id), label: kebele.name })) || []),
    [kebeles]
  );

  const effectiveZoneId = isEdit
    ? zoneId ? Number(zoneId) : editLocationContext?.zoneId
    : editParentHubId
      ? inheritedContext?.zoneId
      : isInheritedFromLocationPage
        ? inheritedContextFromQuery.zoneId
        : zoneId ? Number(zoneId) : undefined;
  const effectiveWoredaId = isEdit
    ? woredaId ? Number(woredaId) : editLocationContext?.woredaId
    : editParentHubId
      ? inheritedContext?.woredaId
      : isInheritedFromLocationPage
        ? inheritedContextFromQuery.woredaId
        : woredaId ? Number(woredaId) : undefined;
  const effectiveKebeleId = isEdit
    ? kebeleId ? Number(kebeleId) : editLocationContext?.kebeleId
    : editParentHubId
      ? inheritedContext?.kebeleId
      : isInheritedFromLocationPage
        ? inheritedContextFromQuery.kebeleId
        : kebeleId ? Number(kebeleId) : undefined;
  const selectedKebeleName =
    kebeleOptions.find((option) => option.value === String(effectiveKebeleId))?.label ||
    (isEdit ? warehouse?.kebele_name : editParentHubId ? inheritedContext?.kebeleName : inheritedContextFromQuery.kebeleName) ||
    '';

  const isKebeleProvided = isEdit
    ? !!(warehouse?.kebele || editLocationContext?.kebeleId || editLocationContext?.kebeleName)
    : editParentHubId
      ? !!(inheritedContext?.kebeleId || inheritedContext?.kebeleName || hub?.kebele)
      : !!(inheritedContextFromQuery.kebeleId || inheritedContextFromQuery.kebeleName);
  const isKebeleLocked = isLocationLocked && isKebeleProvided;
  const lockedKebeleValue = isKebeleLocked
    ? (hub?.kebele ?? kebeleNumberFromName(selectedKebeleName))
    : undefined;

  const canSubmit = !!effectiveWoredaId || (isEdit && !!warehouse?.location_id);

  if (regionsLoading || (isEdit && warehouseLoading)) {
    return <LoadingState message={isEdit ? 'Loading warehouse...' : 'Loading regions...'} />;
  }
  if (regionsError) return <ErrorState message="Failed to load regions" />;
  if (isEdit && (warehouseError || !warehouse)) return <ErrorState message="Failed to load warehouse" />;

  const handleSubmit = (values: typeof form.values) => {
    const targetLocationId =
      effectiveKebeleId ||
      effectiveWoredaId ||
      (isEdit && warehouse?.location_id ? warehouse.location_id : undefined);
    if (!targetLocationId) return;

    const hasExistingRentalDoc = isEdit && !!warehouse?.rental_agreement_document;
    if (values.ownership_type === 'rental' && !rentalAgreementFile && !hasExistingRentalDoc) {
      notifications.show({
        title: 'Missing file',
        message: 'Rental Agreement is required when Ownership Type is Rental.',
        color: 'red',
      });
      return;
    }

    const kebeleNumber = isKebeleLocked
      ? lockedKebeleValue ?? kebeleNumberFromName(selectedKebeleName)
      : values.kebele !== ''
        ? Number(values.kebele)
        : kebeleNumberFromName(selectedKebeleName);

    const payload = {
      code: values.code,
      name: values.name,
      warehouse_type: values.warehouse_type,
      status: values.status,
      description: values.description || undefined,
      hub_id: isEdit ? warehouse?.hub_id : hubId || undefined,
      location_id: targetLocationId,
      managed_under: editParentHubId && !isEdit ? 'Hub' : values.managed_under,
      ownership_type: values.ownership_type,
      rental_agreement_document: values.ownership_type === 'rental' ? rentalAgreementFile : null,
      kebele: kebeleNumber,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
      return;
    }

    createMutation.mutate(payload);
  };

  return (
    <Stack gap="md">
      <Group>
        {isEdit && (
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(`/warehouses/${editId}`)}>
            Back
          </Button>
        )}
        <div>
          <Title order={2}>{isEdit ? 'Edit Warehouse' : 'Create Warehouse'}</Title>
          <Text c="dimmed" size="sm">
            {isEdit
              ? 'Update warehouse details and location information.'
              : hubId
                ? `Creating a warehouse under hub: ${hub?.name ?? `#${hubId}`}`
                : 'Create a warehouse with clear management, ownership, and location details.'}
          </Text>
        </div>
      </Group>

      <Card withBorder padding="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {isLocationLocked && (
              <Alert color="blue" variant="light">
                {hubId
                  ? isKebeleLocked
                    ? 'This warehouse inherits region, zone/subcity, woreda, and kebele from its parent hub. Those fields are locked here.'
                    : 'This warehouse inherits region, zone/subcity, and woreda from its parent hub. Kebele is optional and can be entered below.'
                  : isKebeleLocked
                    ? 'Region, zone/subcity, woreda, and kebele were chosen on the location page and are locked for this warehouse.'
                    : 'Region, zone/subcity, and woreda were chosen on the location page and are locked for this warehouse. Kebele is optional and can be entered below.'}
              </Alert>
            )}

            <Group grow>
              <TextInput label="Code" placeholder="WH-001" required {...form.getInputProps('code')} />
              <TextInput label="Name" placeholder="Central Warehouse" required {...form.getInputProps('name')} />
            </Group>

            <Group grow align="flex-start">
              <SearchableSelect
                label="Warehouse Type"
                data={[
                  { value: 'main', label: 'Main' },
                  { value: 'satellite', label: 'Satellite' },
                  { value: 'temporary', label: 'Temporary' },
                ]}
                {...form.getInputProps('warehouse_type')}
              />
              <SearchableSelect
                label="Status"
                data={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'maintenance', label: 'Maintenance' },
                ]}
                {...form.getInputProps('status')}
              />
            </Group>

            <Group grow align="flex-start">
              <SearchableSelect
                label="Region"
                data={regionOptions}
                value={regionId}
                onChange={(value) => {
                  setRegionId(value);
                  if (!isLocationLocked) {
                    setZoneId(null);
                    setWoredaId(null);
                    setKebeleId(null);
                  }
                }}
                disabled={isLocationLocked}
                description={
                  hubId
                    ? inheritedContext?.regionName || 'Inherited from selected hub'
                    : isInheritedFromLocationPage
                      ? inheritedContextFromQuery.regionName || 'Inherited from location page'
                      : undefined
                }
              />
              <SearchableSelect
                label="Zone / Subcity"
                data={displayedZoneOptions}
                value={effectiveZoneId ? String(effectiveZoneId) : null}
                onChange={(value) => {
                  setZoneId(value);
                  setWoredaId(null);
                  setKebeleId(null);
                }}
                disabled={zonesLoading || isLocationLocked}
                description={
                  hubId
                    ? inheritedContext?.subcityName || 'Inherited from selected hub'
                    : isInheritedFromLocationPage
                      ? inheritedContextFromQuery.subcityName || 'Inherited from location page'
                      : undefined
                }
              />
              <SearchableSelect
                label="Woreda"
                data={displayedWoredaOptions}
                value={effectiveWoredaId ? String(effectiveWoredaId) : null}
                onChange={(value) => {
                  setWoredaId(value);
                }}
                disabled={woredasLoading || isLocationLocked}
                description={
                  hubId
                    ? inheritedContext?.woredaName || 'Inherited from selected hub'
                    : isInheritedFromLocationPage
                      ? inheritedContextFromQuery.woredaName || 'Inherited from location page'
                      : undefined
                }
              />
              <NumberInput
                label="Kebele (Optional)"
                placeholder="1-40"
                min={1}
                max={40}
                description={
                  isKebeleLocked
                    ? selectedKebeleName || 'Inherited from location or hub'
                    : selectedKebeleName || 'Optional'
                }
                disabled={isKebeleLocked}
                value={isKebeleLocked ? (lockedKebeleValue ?? '') : form.values.kebele}
                onChange={(value) => {
                  if (!isKebeleLocked) {
                    form.setFieldValue('kebele', value);
                  }
                }}
                error={form.errors.kebele}
              />
            </Group>

            <Group grow align="flex-start">
              <SearchableSelect
                label="Hierarchical Level"
                data={hubId ? [{ value: 'Hub', label: 'Hub' }] : MANAGED_UNDER_OPTIONS}
                value={form.values.managed_under}
                onChange={(value) => form.setFieldValue('managed_under', value || '')}
                disabled={!!hubId && !isEdit}
                description={hubId ? 'Inherited from the parent hub' : 'Administrative ownership context'}
              />
              <SearchableSelect
                label="Ownership Type"
                data={OWNERSHIP_TYPE_OPTIONS}
                value={form.values.ownership_type}
                onChange={(value) => form.setFieldValue('ownership_type', value || '')}
                required
              />
            </Group>

            {form.values.ownership_type === 'rental' && (
              <RentalAgreementUpload
                value={rentalAgreementFile}
                onChange={setRentalAgreementFile}
                required={!isEdit || !warehouse?.rental_agreement_document}
                existingDocument={isEdit ? warehouse?.rental_agreement_document : undefined}
              />
            )}

            <Textarea
              label="Description"
              minRows={3}
              placeholder="Add any context the team should know about this warehouse"
              {...form.getInputProps('description')}
            />

            <Group justify="flex-end">
              {isEdit && (
                <Button variant="default" onClick={() => navigate('/warehouses')}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
                disabled={!canSubmit}
              >
                {isEdit ? 'Update Warehouse' : 'Create Warehouse'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
