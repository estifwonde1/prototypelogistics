/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Stack,
  Title,
  Group,
  TextInput,
  Select,
  Textarea,
  Button,
  Card,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { createHub } from '../../../api/hubs';
import { getRegions, getZones, getWoredas } from '../../../api/locations';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';
import { resolveLocationContextFromQuery } from '../../../utils/locationContext';

const DEFAULT_REGION_NAME = 'Addis Ababa';

export default function HubSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const inheritedContext = resolveLocationContextFromQuery(searchParams);
  const isInheritedFromLocationPage = !!inheritedContext.woredaId;
  const [regionId, setRegionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [woredaId, setWoredaId] = useState<string | null>(null);
  const [createdHubId, setCreatedHubId] = useState<number | null>(null);

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

  useEffect(() => {
    if (regions && regions.length > 0 && !regionId) {
      const defaultRegion =
        regions.find((region) => region.id === inheritedContext.regionId) ||
        regions.find((region) => region.name === DEFAULT_REGION_NAME) ||
        regions[0];
      setRegionId(String(defaultRegion.id));
    }
  }, [regions, regionId, inheritedContext.regionId]);

  useEffect(() => {
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
  }, [zones, zoneId, isInheritedFromLocationPage, inheritedContext.zoneId]);

  useEffect(() => {
    if (isInheritedFromLocationPage) {
      if (inheritedContext.woredaId) setWoredaId(String(inheritedContext.woredaId));
      return;
    }
    if (!woredas || woredas.length === 0) {
      setWoredaId(null);
      return;
    }
    if (!woredaId || !woredas.some((woreda) => String(woreda.id) === woredaId)) {
      setWoredaId(String(woredas[0].id));
    }
  }, [woredas, woredaId, isInheritedFromLocationPage, inheritedContext.woredaId]);

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      hub_type: 'regional',
      status: 'active',
      description: '',
    },
    validate: {
      name: (value) => (!value ? 'Name is required' : null),
      code: (value) => (!value ? 'Code is required' : null),
    },
  });

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

  const regionOptions = useMemo(
    () => regions?.map((r) => ({ value: String(r.id), label: r.name })) || [],
    [regions]
  );
  const zoneOptions = useMemo(
    () => zones?.map((z) => ({ value: String(z.id), label: z.name })) || [],
    [zones]
  );
  const woredaOptions = useMemo(
    () => woredas?.map((w) => ({ value: String(w.id), label: w.name })) || [],
    [woredas]
  );

  const displayedZoneOptions = useMemo(() => {
    if (!isInheritedFromLocationPage || !inheritedContext.zoneId || !inheritedContext.subcityName) return zoneOptions;
    if (zoneOptions.some((option) => option.value === String(inheritedContext.zoneId))) return zoneOptions;
    return [{ value: String(inheritedContext.zoneId), label: inheritedContext.subcityName }, ...zoneOptions];
  }, [isInheritedFromLocationPage, inheritedContext, zoneOptions]);

  const displayedWoredaOptions = useMemo(() => {
    if (!isInheritedFromLocationPage || !inheritedContext.woredaId || !inheritedContext.woredaName) return woredaOptions;
    if (woredaOptions.some((option) => option.value === String(inheritedContext.woredaId))) return woredaOptions;
    return [{ value: String(inheritedContext.woredaId), label: inheritedContext.woredaName }, ...woredaOptions];
  }, [isInheritedFromLocationPage, inheritedContext, woredaOptions]);

  if (regionsLoading) return <LoadingState message="Loading regions..." />;
  if (regionsError) return <ErrorState message="Failed to load regions" />;

  const handleSubmit = (values: typeof form.values) => {
    if (!woredaId) return;
    createMutation.mutate({
      code: values.code,
      name: values.name,
      hub_type: values.hub_type,
      status: values.status,
      description: values.description || undefined,
      location_id: Number(woredaId),
    });
  };

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Create Hub</Title>
        <Text c="dimmed" size="sm">
          Hubs are tied to a woreda location within the selected region.
        </Text>
      </div>

      <Card withBorder padding="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {isInheritedFromLocationPage && (
              <Alert color="blue" variant="light">
                Region, zone/subcity, and woreda were selected on the location page and are locked for this hub.
              </Alert>
            )}

            <Group grow>
              <TextInput label="Code" placeholder="HUB-001" required {...form.getInputProps('code')} />
              <TextInput label="Name" placeholder="Bole Hub" required {...form.getInputProps('name')} />
            </Group>

            <Group grow>
              <Select
                label="Hub Type"
                data={[
                  { value: 'regional', label: 'Regional' },
                  { value: 'zonal', label: 'Zonal' },
                  { value: 'woreda', label: 'Woreda' },
                ]}
                {...form.getInputProps('hub_type')}
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

            <Group grow>
              <Select
                label="Region"
                data={regionOptions}
                value={regionId}
                onChange={(value) => {
                  setRegionId(value);
                  if (!isInheritedFromLocationPage) {
                    setZoneId(null);
                    setWoredaId(null);
                  }
                }}
                disabled={isInheritedFromLocationPage}
                description={isInheritedFromLocationPage ? inheritedContext.regionName || 'Inherited from location page' : undefined}
              />
              <Select
                label="Zone / Subcity"
                data={displayedZoneOptions}
                value={zoneId}
                onChange={(value) => {
                  setZoneId(value);
                  setWoredaId(null);
                }}
                disabled={zonesLoading || isInheritedFromLocationPage}
                description={isInheritedFromLocationPage ? inheritedContext.subcityName || 'Inherited from location page' : undefined}
              />
              <Select
                label="Woreda"
                data={displayedWoredaOptions}
                value={woredaId}
                onChange={setWoredaId}
                disabled={woredasLoading || isInheritedFromLocationPage}
                description={isInheritedFromLocationPage ? inheritedContext.woredaName || 'Inherited from location page' : undefined}
              />
            </Group>

            <Textarea label="Description" minRows={3} {...form.getInputProps('description')} />

            <Group justify="space-between">
              <Button type="submit" loading={createMutation.isPending} disabled={!woredaId}>
                Create Hub
              </Button>
              {createdHubId && (
                <Button
                  variant="light"
                  onClick={() =>
                    navigate(
                      `/admin/setup/warehouses?hub_id=${createdHubId}&region_id=${regionId ?? ''}&region_name=${encodeURIComponent(
                          regionOptions.find((option) => option.value === regionId)?.label || inheritedContext.regionName || ''
                        )}&zone_id=${zoneId ?? ''}&woreda_id=${woredaId ?? ''}&subcity_name=${encodeURIComponent(
                          zoneOptions.find((option) => option.value === zoneId)?.label || ''
                        )}&woreda_name=${encodeURIComponent(
                          woredaOptions.find((option) => option.value === woredaId)?.label || ''
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
