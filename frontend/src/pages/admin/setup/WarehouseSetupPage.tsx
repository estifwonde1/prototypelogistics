import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
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
import { createWarehouse } from '../../../api/warehouses';
import { getHub } from '../../../api/hubs';
import { getRegions, getZones, getWoredas } from '../../../api/locations';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';

const OWNERSHIP_OPTIONS = [
  { value: 'Addis Ababa Government', label: 'Addis Ababa Government' },
  { value: 'Subcity', label: 'Subcity' },
  { value: 'Woreda', label: 'Woreda' },
];

export default function WarehouseSetupPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const hubIdParam = searchParams.get('hub_id');
  const hubId = hubIdParam ? Number(hubIdParam) : null;

  const [regionId, setRegionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [woredaId, setWoredaId] = useState<string | null>(null);

  const { data: hub } = useQuery({
    queryKey: ['hubs', hubId],
    queryFn: () => getHub(hubId as number),
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

  useEffect(() => {
    if (regions && regions.length > 0 && !regionId) {
      setRegionId(String(regions[0].id));
    }
  }, [regions, regionId]);

  useEffect(() => {
    if (zones && zones.length > 0) {
      setZoneId((prev) => prev || String(zones[0].id));
    }
  }, [zones]);

  useEffect(() => {
    if (woredas && woredas.length > 0) {
      setWoredaId((prev) => prev || String(woredas[0].id));
    }
  }, [woredas]);

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      warehouse_type: 'main',
      status: 'active',
      ownership_type: hubId ? 'hub' : OWNERSHIP_OPTIONS[0].value,
      description: '',
    },
    validate: {
      name: (value) => (!value ? 'Name is required' : null),
      code: (value) => (!value ? 'Code is required' : null),
      ownership_type: (value) => (!value ? 'Ownership type is required' : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: createWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      notifications.show({ title: 'Success', message: 'Warehouse created', color: 'green' });
      form.reset();
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.error?.message || 'Failed to create warehouse',
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

  if (regionsLoading) return <LoadingState message="Loading regions..." />;
  if (regionsError) return <ErrorState message="Failed to load regions" />;

  const handleSubmit = (values: typeof form.values) => {
    if (!woredaId) return;
    createMutation.mutate({
      code: values.code,
      name: values.name,
      warehouse_type: values.warehouse_type,
      status: values.status,
      description: values.description || undefined,
      location_id: Number(woredaId),
      hub_id: hubId || undefined,
      ownership_type: hubId ? 'hub' : values.ownership_type,
    });
  };

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Create Warehouse</Title>
        <Text c="dimmed" size="sm">
          {hubId
            ? `Creating a warehouse under hub: ${hub?.name ?? `#${hubId}`}`
            : 'Create an independent warehouse with ownership type.'}
        </Text>
      </div>

      <Card withBorder padding="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Group grow>
              <TextInput label="Code" placeholder="WH-001" required {...form.getInputProps('code')} />
              <TextInput label="Name" placeholder="Central Warehouse" required {...form.getInputProps('name')} />
            </Group>

            <Group grow>
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

            <Group grow>
              <Select label="Region" data={regionOptions} value={regionId} onChange={setRegionId} disabled />
              <Select
                label="Subcity"
                data={zoneOptions}
                value={zoneId}
                onChange={setZoneId}
                disabled={zonesLoading}
              />
              <Select
                label="Woreda"
                data={woredaOptions}
                value={woredaId}
                onChange={setWoredaId}
                disabled={woredasLoading}
              />
            </Group>

            <Select
              label="Ownership Type"
              data={OWNERSHIP_OPTIONS}
              value={hubId ? 'hub' : form.values.ownership_type}
              onChange={(value) => form.setFieldValue('ownership_type', value || '')}
              disabled={!!hubId}
              description={hubId ? 'Ownership type is fixed to hub for hub-created warehouses.' : undefined}
            />

            <Textarea label="Description" minRows={3} {...form.getInputProps('description')} />

            <Group justify="flex-end">
              <Button type="submit" loading={createMutation.isPending} disabled={!woredaId}>
                Create Warehouse
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
