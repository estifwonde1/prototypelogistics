/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Stack, Title, Group, Button, Text, Card } from '@mantine/core';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import { useQuery } from '@tanstack/react-query';
import { getKebeles, getRegions, getZones, getWoredas } from '../../../api/locations';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';
import { dedupOptions } from '../../../utils/dedup';
import {
  KEBELE_DROPDOWN_OPTIONS,
  resolveKebeleIdForNumber,
} from '../../../constants/kebeleOptions';

const DEFAULT_REGION_NAME = 'Addis Ababa';

type SetupFlow = 'hub' | 'warehouse';

export default function LocationsSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flow = searchParams.get('flow') as SetupFlow | null;
  const [regionId, setRegionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [woredaId, setWoredaId] = useState<string | null>(null);
  const [selectedKebele, setSelectedKebele] = useState<string | null>(null);

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

  const { data: kebeles } = useQuery({
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
      if (selectedKebele !== null) setSelectedKebele(null);
      return;
    }

    const nextWoredaId =
      !woredaId || !woredas.some((woreda) => String(woreda.id) === woredaId)
        ? String(woredas[0].id)
        : woredaId;
    if (nextWoredaId !== woredaId) {
      setWoredaId(nextWoredaId);
      setSelectedKebele(null);
    }
  }, [woredas, woredaId]);

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

  if (regionsLoading) return <LoadingState message="Loading regions..." />;
  if (regionsError) return <ErrorState message="Failed to load regions" />;

  const selectedRegionName = regionOptions.find((option) => option.value === regionId)?.label || '';
  const selectedZoneName = zoneOptions.find((option) => option.value === zoneId)?.label || '';
  const selectedWoredaName =
    woredas?.find((woreda) => String(woreda.id) === woredaId)?.name || '';

  const handleNavigateWithLocation = (path: string) => {
    const kebeleNumber = selectedKebele ? Number(selectedKebele) : undefined;
    const resolvedKebeleId =
      kebeleNumber !== undefined ? resolveKebeleIdForNumber(kebeles, kebeleNumber) : undefined;
    const resolvedKebeleName = selectedKebele ?? '';

    const inheritedQuery = `region_id=${regionId ?? ''}&region_name=${encodeURIComponent(
      selectedRegionName
    )}&zone_id=${zoneId ?? ''}&woreda_id=${woredaId ?? ''}&subcity_name=${encodeURIComponent(
      selectedZoneName
    )}&woreda_name=${encodeURIComponent(selectedWoredaName)}&kebele_id=${resolvedKebeleId ?? ''}&kebele_name=${encodeURIComponent(
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
              setSelectedKebele(null);
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
              setSelectedKebele(null);
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
              setSelectedKebele(null);
            }}
            w={300}
            disabled={woredasLoading}
          />
          <SearchableSelect
            label="Kebele"
            data={KEBELE_DROPDOWN_OPTIONS}
            value={selectedKebele}
            onChange={setSelectedKebele}
            w={300}
            disabled={!woredaId}
            clearable
            description="Optional. Select kebele 01 (minimum) through 40 (maximum)."
            placeholder="Select kebele"
          />
        </Group>

        <Group mt="md" justify="flex-end">
          {(flow === 'hub' || !flow) && (
            <Button
              onClick={() => handleNavigateWithLocation('/admin/setup/hubs')}
              disabled={!woredaId}
              variant={flow === 'hub' ? 'filled' : 'light'}
            >
              {flow === 'hub' ? 'Next' : 'Next: Hub'}
            </Button>
          )}
          {(flow === 'warehouse' || !flow) && (
            <Button
              onClick={() => handleNavigateWithLocation('/admin/setup/warehouses')}
              disabled={!woredaId}
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
