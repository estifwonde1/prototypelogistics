/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  NumberInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createWarehouse } from '../../../api/warehouses';
import { getHub } from '../../../api/hubs';
import { getKebeles, getRegions, getWoredas, getZones } from '../../../api/locations';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingState } from '../../../components/common/LoadingState';
import { RentalAgreementUpload } from '../../../components/common/RentalAgreementUpload';
import {
  resolveLocationContextByLocationId,
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

export default function WarehouseSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const hubIdParam = searchParams.get('hub_id');
  const hubId = hubIdParam ? Number(hubIdParam) : null;
  const inheritedContextFromQuery = resolveLocationContextFromQuery(searchParams);
  const isInheritedFromLocationPage = !hubId && !!inheritedContextFromQuery.woredaId;

  const [regionId, setRegionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [woredaId, setWoredaId] = useState<string | null>(null);
  const [kebeleId, setKebeleId] = useState<string | null>(null);
  const [rentalAgreementFile, setRentalAgreementFile] = useState<File | null>(null);

  const { data: hub } = useQuery({
    queryKey: ['hubs', hubId],
    queryFn: () => getHub(hubId as number),
    enabled: !!hubId,
  });

  const { data: inheritedContext } = useQuery({
    queryKey: ['warehouse-setup-location-context', hubId, inheritedContextFromQuery.woredaId, inheritedContextFromQuery.kebeleId],
    queryFn: async () => {
      if (inheritedContextFromQuery.woredaId || inheritedContextFromQuery.kebeleId) return inheritedContextFromQuery;
      return resolveLocationContextByLocationId(hub?.location_id);
    },
    enabled: !!hubId,
  });

  const { data: regions, isLoading: regionsLoading, error: regionsError } = useQuery({
    queryKey: ['locations', 'regions'],
    queryFn: getRegions,
  });

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

  const activeWoredaId = hubId ? inheritedContext?.woredaId : woredaId ? Number(woredaId) : undefined;
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
      managed_under: hubId ? 'Hub' : MANAGED_UNDER_OPTIONS[0].value,
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
    if (regions && regions.length > 0 && !regionId) {
      const inheritedRegionId = hubId ? inheritedContext?.regionId : inheritedContextFromQuery.regionId;
      const defaultRegion =
        regions.find((region) => region.id === inheritedRegionId) ||
        regions.find((region) => region.name === DEFAULT_REGION_NAME) ||
        regions[0];
      setRegionId(String(defaultRegion.id));
    }
  }, [regions, regionId, hubId, inheritedContext?.regionId, inheritedContextFromQuery.regionId]);

  useEffect(() => {
    if (hubId && inheritedContext) {
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
  }, [hubId, inheritedContext, isInheritedFromLocationPage, inheritedContextFromQuery.zoneId, zoneId, zones]);

  useEffect(() => {
    if (hubId) return;
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
  }, [hubId, isInheritedFromLocationPage, inheritedContextFromQuery.woredaId, woredaId, woredas]);

  useEffect(() => {
    if (hubId) {
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
  }, [hubId, inheritedContext?.kebeleId, isInheritedFromLocationPage, inheritedContextFromQuery.kebeleId, kebeles, kebeleId]);

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

  const regionOptions = useMemo(
    () => regions?.map((region) => ({ value: String(region.id), label: region.name })) || [],
    [regions]
  );

  const zoneOptions = useMemo(
    () => zones?.map((zone) => ({ value: String(zone.id), label: zone.name })) || [],
    [zones]
  );

  const woredaOptions = useMemo(
    () => woredas?.map((woreda) => ({ value: String(woreda.id), label: woreda.name })) || [],
    [woredas]
  );

  const displayedZoneOptions = useMemo(() => {
    const context = hubId ? inheritedContext : inheritedContextFromQuery;
    if (!context?.zoneId || !context.subcityName) return zoneOptions;
    if (zoneOptions.some((option) => option.value === String(context.zoneId))) return zoneOptions;
    return [{ value: String(context.zoneId), label: context.subcityName }, ...zoneOptions];
  }, [hubId, inheritedContext, inheritedContextFromQuery, zoneOptions]);

  const displayedWoredaOptions = useMemo(() => {
    const context = hubId ? inheritedContext : inheritedContextFromQuery;
    if (!context?.woredaId || !context.woredaName) return woredaOptions;
    if (woredaOptions.some((option) => option.value === String(context.woredaId))) return woredaOptions;
    return [{ value: String(context.woredaId), label: context.woredaName }, ...woredaOptions];
  }, [hubId, inheritedContext, inheritedContextFromQuery, woredaOptions]);

  if (regionsLoading) return <LoadingState message="Loading regions..." />;
  if (regionsError) return <ErrorState message="Failed to load regions" />;

  const effectiveZoneId = hubId
    ? inheritedContext?.zoneId
    : isInheritedFromLocationPage
      ? inheritedContextFromQuery.zoneId
      : zoneId ? Number(zoneId) : undefined;
  const effectiveWoredaId = hubId
    ? inheritedContext?.woredaId
    : isInheritedFromLocationPage
      ? inheritedContextFromQuery.woredaId
      : woredaId ? Number(woredaId) : undefined;
  const effectiveKebeleId = hubId
    ? inheritedContext?.kebeleId
    : isInheritedFromLocationPage
      ? inheritedContextFromQuery.kebeleId
      : kebeleId ? Number(kebeleId) : undefined;

  const handleSubmit = (values: typeof form.values) => {
    const targetLocationId = effectiveKebeleId || effectiveWoredaId;
    if (!targetLocationId) return;

    if (values.ownership_type === 'rental' && !rentalAgreementFile) {
      notifications.show({
        title: 'Missing file',
        message: 'Rental Agreement is required when Ownership Type is Rental.',
        color: 'red',
      });
      return;
    }

    createMutation.mutate({
      code: values.code,
      name: values.name,
      warehouse_type: values.warehouse_type,
      status: values.status,
      description: values.description || undefined,
      hub_id: hubId || undefined,
      location_id: targetLocationId,
      managed_under: hubId ? 'Hub' : values.managed_under,
      ownership_type: values.ownership_type,
      rental_agreement_document: values.ownership_type === 'rental' ? rentalAgreementFile : null,
      kebele: values.kebele !== '' ? Number(values.kebele) : undefined,
    });
  };

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Create Warehouse</Title>
        <Text c="dimmed" size="sm">
          {hubId
            ? `Creating a warehouse under hub: ${hub?.name ?? `#${hubId}`}`
            : 'Create a warehouse with clear management, ownership, and location details.'}
        </Text>
      </div>

      <Card withBorder padding="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {(hubId || isInheritedFromLocationPage) && (
              <Alert color="blue" variant="light">
                {hubId
                  ? 'This warehouse inherits region, zone/subcity, woreda, and any selected kebele from its parent hub. Those fields are locked here.'
                  : 'Region, zone/subcity, woreda, and any selected kebele were chosen on the location page and are locked for this warehouse.'}
              </Alert>
            )}

            <Group grow>
              <TextInput label="Code" placeholder="WH-001" required {...form.getInputProps('code')} />
              <TextInput label="Name" placeholder="Central Warehouse" required {...form.getInputProps('name')} />
            </Group>

            <Group grow align="flex-start">
              <Select
                label="Warehouse Type"
                data={[
                  { value: 'main', label: 'Main' },
                  { value: 'satellite', label: 'Satellite' },
                  { value: 'temporary', label: 'Temporary' },
                ]}
                {...form.getInputProps('warehouse_type')}
              />
              <Select
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
              <Select
                label="Region"
                data={regionOptions}
                value={regionId}
                onChange={(value) => {
                  setRegionId(value);
                  if (!hubId && !isInheritedFromLocationPage) {
                    setZoneId(null);
                    setWoredaId(null);
                    setKebeleId(null);
                  }
                }}
                disabled={!!hubId || isInheritedFromLocationPage}
                description={
                  hubId
                    ? inheritedContext?.regionName || 'Inherited from selected hub'
                    : isInheritedFromLocationPage
                      ? inheritedContextFromQuery.regionName || 'Inherited from location page'
                      : undefined
                }
              />
              <Select
                label="Zone / Subcity"
                data={displayedZoneOptions}
                value={effectiveZoneId ? String(effectiveZoneId) : null}
                onChange={(value) => {
                  setZoneId(value);
                  setWoredaId(null);
                  setKebeleId(null);
                }}
                disabled={zonesLoading || !!hubId || isInheritedFromLocationPage}
                description={
                  hubId
                    ? inheritedContext?.subcityName || 'Inherited from selected hub'
                    : isInheritedFromLocationPage
                      ? inheritedContextFromQuery.subcityName || 'Inherited from location page'
                      : undefined
                }
              />
              <Select
                label="Woreda"
                data={displayedWoredaOptions}
                value={effectiveWoredaId ? String(effectiveWoredaId) : null}
                onChange={(value) => {
                  setWoredaId(value);
                }}
                disabled={woredasLoading || !!hubId || isInheritedFromLocationPage}
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
                description="Optional"
                {...form.getInputProps('kebele')}
              />
            </Group>

            <Group grow align="flex-start">
              <Select
                label="Hierarchical Level"
                data={hubId ? [{ value: 'Hub', label: 'Hub' }] : MANAGED_UNDER_OPTIONS}
                value={form.values.managed_under}
                onChange={(value) => form.setFieldValue('managed_under', value || '')}
                disabled={!!hubId}
                description={hubId ? 'Inherited from the parent hub' : 'Administrative ownership context'}
              />
              <Select
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
                required
              />
            )}

            <Textarea
              label="Description"
              minRows={3}
              placeholder="Add any context the team should know about this warehouse"
              {...form.getInputProps('description')}
            />

            <Group justify="flex-end">
              <Button
                type="submit"
                loading={createMutation.isPending}
                disabled={!effectiveWoredaId}
              >
                Create Warehouse
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
