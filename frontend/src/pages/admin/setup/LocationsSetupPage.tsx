/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Stack, Title, Group, Button, Text, Card, Autocomplete } from '@mantine/core';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { createLocation, getKebeles, getRegions, getZones, getWoredas } from '../../../api/locations';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';
import { dedupBy, dedupOptions } from '../../../utils/dedup';

const DEFAULT_REGION_NAME = 'Addis Ababa';

type SetupFlow = 'hub' | 'warehouse';

export default function LocationsSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flow = searchParams.get('flow') as SetupFlow | null;
  const queryClient = useQueryClient();
  const [regionId, setRegionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [woredaId, setWoredaId] = useState<string | null>(null);
  const [kebeleId, setKebeleId] = useState<string | null>(null);
  const [kebeleInputValue, setKebeleInputValue] = useState('');

  const { data: regions, isLoading: regionsLoading, error: regionsError } = useQuery({
    queryKey: ['locations', 'regions'],
    queryFn: getRegions,
  });

  const { data: zones, isLoading: zonesLoading } = useQuery({
    queryKey: ['locations', 'zones', regionId],
    queryFn: () => getZones(regionId ? Number(regionId) : undefined),
    enabled: !!regionId,
  });

  const { data: woredas, isLoading: woredasLoading, error: woredasError, refetch: refetchWoredas } = useQuery({
    queryKey: ['locations', 'woredas', zoneId],
    queryFn: () => getWoredas(Number(zoneId)),
    enabled: !!zoneId,
  });

  const { data: kebeles, isLoading: kebelesLoading } = useQuery({
    queryKey: ['locations', 'kebeles', woredaId],
    queryFn: () => getKebeles(Number(woredaId)),
    enabled: !!woredaId,
  });

  useEffect(() => {
    if (regions && regions.length > 0 && !regionId) {
      const defaultRegion = regions.find((region) => region.name === DEFAULT_REGION_NAME) || regions[0];
      setRegionId(String(defaultRegion.id));
    }
  }, [regions, regionId]);

  useEffect(() => {
    if (!zones || zones.length === 0) {
      if (zoneId !== null) setZoneId(null);
      return;
    }

    const nextZoneId =
      !zoneId || !zones.some((zone) => String(zone.id) === zoneId)
        ? String(zones[0].id)
        : zoneId;
    if (nextZoneId !== zoneId) setZoneId(nextZoneId);
  }, [zones, zoneId]);

  useEffect(() => {
    if (!woredas || woredas.length === 0) {
      if (woredaId !== null) setWoredaId(null);
      if (kebeleId !== null) setKebeleId(null);
      if (kebeleInputValue !== '') setKebeleInputValue('');
      return;
    }

    const nextWoredaId =
      !woredaId || !woredas.some((woreda) => String(woreda.id) === woredaId)
        ? String(woredas[0].id)
        : woredaId;
    if (nextWoredaId !== woredaId) setWoredaId(nextWoredaId);
  }, [woredas, woredaId]);

  useEffect(() => {
    if (!kebeles || kebeles.length === 0) {
      setKebeleId(null);
      if (!kebeleInputValue) return;
      return;
    }

    if (kebeleId && !kebeles.some((kebele) => String(kebele.id) === kebeleId)) {
      setKebeleId(null);
    }
  }, [kebeles, kebeleId, kebeleInputValue]);

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

  // Since Autocomplete uses the string labels directly as options, we must guarantee
  // unique labels to avoid duplicate option errors.
  const kebeleOptions = useMemo(
    () => dedupBy(kebeles?.map((kebele) => ({ value: String(kebele.id), label: kebele.name })) || [], (o) => o.label),
    [kebeles]
  );

  const createKebeleMutation = useMutation({
    mutationFn: createLocation,
    onSuccess: (createdKebele) => {
      queryClient.invalidateQueries({ queryKey: ['locations', 'kebeles', woredaId] });
      setKebeleId(String(createdKebele.id));
      setKebeleInputValue(createdKebele.name);
      notifications.show({
        title: 'Success',
        message: 'Kebele created successfully',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to create kebele',
        color: 'red',
      });
    },
  });

  if (regionsLoading) return <LoadingState message="Loading regions..." />;
  if (regionsError) return <ErrorState message="Failed to load regions" />;

  const selectedRegionName = regionOptions.find((option) => option.value === regionId)?.label || '';
  const selectedZoneName = zoneOptions.find((option) => option.value === zoneId)?.label || '';
  const selectedWoredaName =
    woredas?.find((woreda) => String(woreda.id) === woredaId)?.name || '';
  const commitKebeleInput = async (): Promise<{ kebeleId: string | null; kebeleName: string }> => {
    const trimmedValue = kebeleInputValue.trim();
    if (!woredaId || !trimmedValue) return { kebeleId, kebeleName: kebeleInputValue.trim() };

    const existingKebele = kebeleOptions.find((option) => option.label.toLowerCase() === trimmedValue.toLowerCase());
    if (existingKebele) {
      setKebeleId(existingKebele.value);
      setKebeleInputValue(existingKebele.label);
      return { kebeleId: existingKebele.value, kebeleName: existingKebele.label };
    }

    const normalizedLabel = /^\d+$/.test(trimmedValue) ? `Kebele ${trimmedValue}` : trimmedValue;
    const existingNormalizedKebele = kebeleOptions.find(
      (option) => option.label.toLowerCase() === normalizedLabel.toLowerCase()
    );
    if (existingNormalizedKebele) {
      setKebeleId(existingNormalizedKebele.value);
      setKebeleInputValue(existingNormalizedKebele.label);
      return { kebeleId: existingNormalizedKebele.value, kebeleName: existingNormalizedKebele.label };
    }

    const normalizedCode = trimmedValue.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
    const createdKebele = await createKebeleMutation.mutateAsync({
      name: normalizedLabel,
      code: `KEB-${woredaId}-${normalizedCode || Date.now()}`,
      location_type: 'Kebele',
      parent_id: Number(woredaId),
    });
    setKebeleId(String(createdKebele.id));
    setKebeleInputValue(createdKebele.name);
    return { kebeleId: String(createdKebele.id), kebeleName: createdKebele.name };
  };

  const handleNavigateWithLocation = async (path: string) => {
    const committedKebele = await commitKebeleInput();
    const resolvedKebeleId = committedKebele.kebeleId ?? kebeleId ?? '';
    const resolvedKebeleName = committedKebele.kebeleName || kebeleOptions.find((option) => option.value === kebeleId)?.label || '';
    const inheritedQuery = `region_id=${regionId ?? ''}&region_name=${encodeURIComponent(
      selectedRegionName
    )}&zone_id=${zoneId ?? ''}&woreda_id=${woredaId ?? ''}&subcity_name=${encodeURIComponent(
      selectedZoneName
    )}&woreda_name=${encodeURIComponent(selectedWoredaName)}&kebele_id=${resolvedKebeleId}&kebele_name=${encodeURIComponent(
      resolvedKebeleName
    )}`;
    navigate(`${path}?${inheritedQuery}`);
  };

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Location Setup</Title>
        <Text c="dimmed" size="sm">
          Choose a region, then select a zone or subcity and woreda from the available location data.
        </Text>
      </div>

      <Card withBorder padding="lg">
        <Group align="end">
          <SearchableSelect
            label="Region"
            data={regionOptions}
            value={regionId}
            onChange={(value) => {
              setRegionId(value);
              setZoneId(null);
              setWoredaId(null);
              setKebeleId(null);
              setKebeleInputValue('');
            }}
            w={260}
          />
          <SearchableSelect
            label="Zone / Subcity"
            data={zoneOptions}
            value={zoneId}
            onChange={(value) => {
              setZoneId(value);
              setWoredaId(null);
              setKebeleId(null);
              setKebeleInputValue('');
            }}
            w={300}
            disabled={!regionId || zonesLoading}
          />
          <SearchableSelect
            label="Woreda"
            data={woredaOptions}
            value={woredaId}
            onChange={(value) => {
              setWoredaId(value);
              setKebeleId(null);
              setKebeleInputValue('');
            }}
            w={300}
            disabled={woredasLoading}
          />
          <Autocomplete
            label="Kebele"
            data={kebeleOptions.map((option) => option.label)}
            value={kebeleInputValue}
            onChange={(value) => {
              setKebeleInputValue(value);
              const existingKebele = kebeleOptions.find((option) => option.label === value);
              setKebeleId(existingKebele?.value || null);
            }}
            onBlur={() => {
              void commitKebeleInput();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void commitKebeleInput();
              }
            }}
            w={300}
            disabled={!woredaId || kebelesLoading}
            clearable
            description="Optional. Type a kebele number directly if it does not exist yet."
            placeholder="Select or type kebele number"
          />
        </Group>

        <Group mt="md" justify="flex-end">
          {(flow === 'hub' || !flow) && (
            <Button
              onClick={() => void handleNavigateWithLocation('/admin/setup/hubs')}
              disabled={!woredaId || createKebeleMutation.isPending}
              variant={flow === 'hub' ? 'filled' : 'light'}
            >
              {flow === 'hub' ? 'Next' : 'Next: Hub'}
            </Button>
          )}
          {(flow === 'warehouse' || !flow) && (
            <Button
              onClick={() => void handleNavigateWithLocation('/admin/setup/warehouses')}
              disabled={!woredaId || createKebeleMutation.isPending}
              variant={flow === 'warehouse' ? 'filled' : 'light'}
            >
              {flow === 'warehouse' ? 'Next' : 'Next: Warehouse'}
            </Button>
          )}
        </Group>
      </Card>

      {woredasLoading && <LoadingState message="Loading woredas..." />}
      {woredasError && <ErrorState message="Failed to load woredas" onRetry={() => refetchWoredas()} />}
    </Stack>
  );
}
