/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Stack, Title, Group, TextInput, Textarea, Button, Card, Text } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { createHub, getHub, updateHub } from '../../../api/hubs';
import { getKebeles, getRegions, getZones, getWoredas } from '../../../api/locations';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';
import { dedupOptions } from '../../../utils/dedup';
import {
  KEBELE_DROPDOWN_OPTIONS,
  kebeleNumberFromName,
  kebeleValueFromNumber,
} from '../../../constants/kebeleOptions';
import {
  locationContextFromEntity,
  resolveLocationContextFromQuery,
} from '../../../utils/locationContext';

const DEFAULT_REGION_NAME = 'Addis Ababa';

export default function HubSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const editIdParam = searchParams.get('id');
  const editId = editIdParam ? Number(editIdParam) : null;
  const isEdit = !!editId;
  const inheritedContext = resolveLocationContextFromQuery(searchParams);
  const isInheritedFromLocationPage = !isEdit && !!inheritedContext.woredaId;
  const isLocationLocked = isInheritedFromLocationPage;
  const editInitialized = useRef(false);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [woredaId, setWoredaId] = useState<string | null>(null);
  const [kebeleId, setKebeleId] = useState<string | null>(null);
  const [createdHubId, setCreatedHubId] = useState<number | null>(null);

  const { data: hub, isLoading: hubLoading, error: hubError } = useQuery({
    queryKey: ['hubs', editId],
    queryFn: () => getHub(editId as number),
    enabled: isEdit,
  });

  const { data: regions, isLoading: regionsLoading, error: regionsError } = useQuery({
    queryKey: ['locations', 'regions'],
    queryFn: getRegions,
  });

  const editLocationContext = useMemo(() => locationContextFromEntity(hub), [hub]);

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

  const { data: kebeles } = useQuery({
    queryKey: ['locations', 'kebeles', woredaId],
    queryFn: () => getKebeles(Number(woredaId)),
    enabled: !!woredaId,
  });

  useEffect(() => {
    if (isEdit) return;
    if (regions && regions.length > 0 && !regionId) {
      const defaultRegion =
        regions.find((region) => region.id === inheritedContext.regionId) ||
        regions.find((region) => region.name === DEFAULT_REGION_NAME) ||
        regions[0];
      setRegionId(String(defaultRegion.id));
    }
  }, [regions, regionId, isEdit, inheritedContext.regionId]);

  useEffect(() => {
    if (isEdit) return;
    if (isInheritedFromLocationPage) {
      if (inheritedContext.zoneId) setZoneId(String(inheritedContext.zoneId));
      return;
    }
    if (!zones || zones.length === 0) {
      setZoneId(null);
      return;
    }
    if (!zoneId || !zones.some((zone) => String(zone.id) === zoneId)) {
      setZoneId(String(zones[0].id));
    }
  }, [isEdit, zones, zoneId, isInheritedFromLocationPage, inheritedContext.zoneId]);

  useEffect(() => {
    if (isEdit) return;
    if (isInheritedFromLocationPage) {
      if (inheritedContext.woredaId) setWoredaId(String(inheritedContext.woredaId));
      setKebeleId(inheritedContext.kebeleId ? String(inheritedContext.kebeleId) : null);
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
  }, [isEdit, woredas, woredaId, isInheritedFromLocationPage, inheritedContext.woredaId, inheritedContext.kebeleId]);

  useEffect(() => {
    if (isEdit) return;
    if (isInheritedFromLocationPage) {
      setKebeleId(inheritedContext.kebeleId ? String(inheritedContext.kebeleId) : null);
      return;
    }
    if (!kebeles || kebeles.length === 0) {
      setKebeleId(null);
      return;
    }
    if (kebeleId && !kebeles.some((kebele) => String(kebele.id) === kebeleId)) {
      setKebeleId(null);
    }
  }, [isEdit, kebeles, kebeleId, isInheritedFromLocationPage, inheritedContext.kebeleId]);

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      hub_type: 'regional',
      status: 'active',
      description: '',
      kebele: '',
    },
    validate: {
      name: (value) => (!value ? 'Name is required' : null),
      code: (value) => (!value ? 'Code is required' : null),
      kebele: (value) => {
        if (!value) return null;
        const num = Number(value);
        if (isNaN(num) || num < 1 || num > 40) return 'Kebele must be between 01 and 40';
        return null;
      },
    },
  });

  useEffect(() => {
    if (!isEdit || !hub || editInitialized.current) return;

    editInitialized.current = true;
    form.setValues({
      code: hub.code,
      name: hub.name,
      hub_type: hub.hub_type,
      status: hub.status,
      description: hub.description || '',
      kebele: kebeleValueFromNumber(hub.kebele),
    });

    const ctx = editLocationContext;
    if (ctx.regionId) setRegionId(String(ctx.regionId));
    if (ctx.zoneId) setZoneId(String(ctx.zoneId));
    if (ctx.woredaId) setWoredaId(String(ctx.woredaId));
    if (ctx.kebeleId) setKebeleId(String(ctx.kebeleId));
  }, [isEdit, hub, editLocationContext]);

  const createMutation = useMutation({
    mutationFn: createHub,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      notifications.show({ title: 'Success', message: 'Hub created', color: 'green' });
      setCreatedHubId(data.id);
      form.reset();
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Failed to create hub',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateHub>[1]) => updateHub(editId as number, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      queryClient.invalidateQueries({ queryKey: ['hubs', editId] });
      notifications.show({ title: 'Success', message: 'Hub updated', color: 'green' });
      navigate(`/hubs/${editId}`);
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Failed to update hub',
        color: 'red',
      });
    },
  });

  const regionOptions = useMemo(
    () => dedupOptions(regions?.map((r) => ({ value: String(r.id), label: r.name })) || []),
    [regions]
  );
  const zoneOptions = useMemo(
    () => dedupOptions(zones?.map((z) => ({ value: String(z.id), label: z.name })) || []),
    [zones]
  );
  const woredaOptions = useMemo(
    () => dedupOptions(woredas?.map((w) => ({ value: String(w.id), label: w.name })) || []),
    [woredas]
  );
  const kebeleOptions = useMemo(
    () => dedupOptions(kebeles?.map((k) => ({ value: String(k.id), label: k.name })) || []),
    [kebeles]
  );

  const displayedZoneOptions = useMemo(() => {
    const context = isEdit ? editLocationContext : inheritedContext;
    if (!context?.zoneId || !context.subcityName) return zoneOptions;
    if (zoneOptions.some((option) => option.value === String(context.zoneId))) return zoneOptions;
    return dedupOptions([{ value: String(context.zoneId), label: context.subcityName }, ...zoneOptions]);
  }, [isEdit, editLocationContext, inheritedContext, zoneOptions]);

  const displayedWoredaOptions = useMemo(() => {
    const context = isEdit ? editLocationContext : inheritedContext;
    if (!context?.woredaId || !context.woredaName) return woredaOptions;
    if (woredaOptions.some((option) => option.value === String(context.woredaId))) return woredaOptions;
    return dedupOptions([{ value: String(context.woredaId), label: context.woredaName }, ...woredaOptions]);
  }, [isEdit, editLocationContext, inheritedContext, woredaOptions]);

  const selectedKebeleName =
    kebeleOptions.find((option) => option.value === kebeleId)?.label ||
    (isEdit ? editLocationContext?.kebeleName || hub?.kebele_name : inheritedContext.kebeleName) ||
    '';

  const canSubmit = !!woredaId || (isEdit && !!hub?.location_id);

  if (regionsLoading || (isEdit && hubLoading)) {
    return <LoadingState message={isEdit ? 'Loading hub...' : 'Loading regions...'} />;
  }
  if (regionsError) return <ErrorState message="Failed to load regions" />;
  if (isEdit && (hubError || !hub)) return <ErrorState message="Failed to load hub" />;

  const isKebeleProvided = !!(inheritedContext.kebeleId || inheritedContext.kebeleName);
  const isKebeleLocked = isLocationLocked && isKebeleProvided;
  const lockedKebeleValue = isKebeleLocked
    ? kebeleValueFromNumber(kebeleNumberFromName(selectedKebeleName) ?? inheritedContext.kebeleName)
    : undefined;

  const handleSubmit = (values: typeof form.values) => {
    const targetLocationId = kebeleId || woredaId || (isEdit && hub?.location_id ? String(hub.location_id) : null);
    if (!targetLocationId) return;
    const kebeleNumber = isKebeleLocked
      ? Number(lockedKebeleValue) || kebeleNumberFromName(selectedKebeleName)
      : values.kebele !== ''
        ? Number(values.kebele)
        : kebeleNumberFromName(selectedKebeleName);
    const payload = {
      code: values.code,
      name: values.name,
      hub_type: values.hub_type,
      status: values.status,
      description: values.description || undefined,
      location_id: Number(targetLocationId),
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
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(`/hubs/${editId}`)}>
            Back
          </Button>
        )}
        <div>
          <Title order={2}>{isEdit ? 'Edit Hub' : 'Create Hub'}</Title>
          <Text c="dimmed" size="sm">
            {isEdit
              ? 'Update hub details and location information.'
              : 'Hubs are tied to a woreda or kebele location within the selected region.'}
          </Text>
        </div>
      </Group>

      <Card withBorder padding="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {isLocationLocked && (
              <Alert color="blue" variant="light">
                {isKebeleLocked
                  ? 'Region, zone/subcity, woreda, and kebele were chosen on the location page and are locked for this hub.'
                  : 'Region, zone/subcity, and woreda were chosen on the location page and are locked for this hub. Kebele is optional and can be entered below.'}
              </Alert>
            )}

            <Group grow>
              <TextInput label="Code" placeholder="HUB-001" required {...form.getInputProps('code')} />
              <TextInput label="Name" placeholder="Bole Hub" required {...form.getInputProps('name')} />
            </Group>

            <Group grow>
              <SearchableSelect
                label="Hierarchical Level"
                data={[
                  { value: 'federal', label: 'Federal' },
                  { value: 'regional', label: 'Regional' },
                  { value: 'zonal', label: 'Zonal' },
                  { value: 'woreda', label: 'Woreda' },
                  { value: 'kebele', label: 'Kebele' },
                ]}
                {...form.getInputProps('hub_type')}
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

            <Group grow>
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
                description={isLocationLocked ? inheritedContext.regionName || 'Inherited from location page' : undefined}
              />
              <SearchableSelect
                label="Zone / Subcity"
                data={displayedZoneOptions}
                value={zoneId}
                onChange={(value) => {
                  setZoneId(value);
                  setWoredaId(null);
                  setKebeleId(null);
                }}
                disabled={zonesLoading || isLocationLocked}
                description={isLocationLocked ? inheritedContext.subcityName || 'Inherited from location page' : undefined}
              />
              <SearchableSelect
                label="Woreda"
                data={displayedWoredaOptions}
                value={woredaId}
                onChange={(value) => {
                  setWoredaId(value);
                }}
                disabled={woredasLoading || isLocationLocked}
                description={isLocationLocked ? inheritedContext.woredaName || 'Inherited from location page' : undefined}
              />
              <SearchableSelect
                label="Kebele (Optional)"
                data={KEBELE_DROPDOWN_OPTIONS}
                placeholder="Select kebele"
                description={
                  isKebeleLocked
                    ? selectedKebeleName || 'Inherited from location page'
                    : 'Select 01 (minimum) through 40 (maximum)'
                }
                disabled={isKebeleLocked}
                clearable={!isKebeleLocked}
                value={isKebeleLocked ? lockedKebeleValue || null : form.values.kebele || null}
                onChange={(value) => {
                  if (!isKebeleLocked) {
                    form.setFieldValue('kebele', value || '');
                  }
                }}
                error={form.errors.kebele}
              />
            </Group>

            <Textarea label="Description" minRows={3} {...form.getInputProps('description')} />

            <Group justify="space-between">
              <Group>
                {isEdit && (
                  <Button variant="default" onClick={() => navigate('/hubs')}>
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  loading={createMutation.isPending || updateMutation.isPending}
                  disabled={!canSubmit}
                >
                  {isEdit ? 'Update Hub' : 'Create Hub'}
                </Button>
              </Group>
              {!isEdit && createdHubId && (
                <Button
                  variant="light"
                  onClick={() =>
                    navigate(
                      `/admin/setup/warehouses?hub_id=${createdHubId}&region_id=${regionId ?? ''}&region_name=${encodeURIComponent(
                          regionOptions.find((option) => option.value === regionId)?.label || inheritedContext.regionName || ''
                        )}&zone_id=${zoneId ?? ''}&woreda_id=${woredaId ?? ''}&kebele_id=${kebeleId ?? ''}&subcity_name=${encodeURIComponent(
                          zoneOptions.find((option) => option.value === zoneId)?.label || ''
                        )}&woreda_name=${encodeURIComponent(
                          woredaOptions.find((option) => option.value === woredaId)?.label || ''
                        )}&kebele_name=${encodeURIComponent(
                          kebeleOptions.find((option) => option.value === kebeleId)?.label || ''
                        )}`
                    )
                  }
                >
                  Create Warehouse Under Hub
                </Button>
              )}
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
