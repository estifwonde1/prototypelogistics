/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Title, Group, Select, Button, Text, Card } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { getRegions, getZones, getWoredas } from '../../../api/locations';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';

const DEFAULT_REGION_NAME = 'Addis Ababa';

export default function LocationsSetupPage() {
  const navigate = useNavigate();
  const [regionId, setRegionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [woredaId, setWoredaId] = useState<string | null>(null);

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

  useEffect(() => {
    if (regions && regions.length > 0 && !regionId) {
      const defaultRegion = regions.find((region) => region.name === DEFAULT_REGION_NAME) || regions[0];
      setRegionId(String(defaultRegion.id));
    }
  }, [regions, regionId]);

  useEffect(() => {
    if (!zones || zones.length === 0) {
      setZoneId(null);
      return;
    }

    if (!zoneId || !zones.some((zone) => String(zone.id) === zoneId)) {
      setZoneId(String(zones[0].id));
    }
  }, [zones, zoneId]);

  useEffect(() => {
    if (!woredas || woredas.length === 0) {
      setWoredaId(null);
      return;
    }

    if (!woredaId || !woredas.some((woreda) => String(woreda.id) === woredaId)) {
      setWoredaId(String(woredas[0].id));
    }
  }, [woredas, woredaId]);

  const regionOptions = useMemo(
    () => regions?.map((r) => ({ value: String(r.id), label: r.name })) || [],
    [regions]
  );

  const zoneOptions = useMemo(
    () => zones?.map((z) => ({ value: String(z.id), label: z.name })) || [],
    [zones]
  );

  if (regionsLoading) return <LoadingState message="Loading regions..." />;
  if (regionsError) return <ErrorState message="Failed to load regions" />;

  const selectedRegionName = regionOptions.find((option) => option.value === regionId)?.label || '';
  const selectedZoneName = zoneOptions.find((option) => option.value === zoneId)?.label || '';
  const selectedWoredaName =
    woredas?.find((woreda) => String(woreda.id) === woredaId)?.name || '';
  const inheritedQuery = `region_id=${regionId ?? ''}&region_name=${encodeURIComponent(
    selectedRegionName
  )}&zone_id=${zoneId ?? ''}&woreda_id=${woredaId ?? ''}&subcity_name=${encodeURIComponent(
    selectedZoneName
  )}&woreda_name=${encodeURIComponent(selectedWoredaName)}`;

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
          <Select
            label="Region"
            data={regionOptions}
            value={regionId}
            onChange={(value) => {
              setRegionId(value);
              setZoneId(null);
              setWoredaId(null);
            }}
            w={260}
          />
          <Select
            label="Zone / Subcity"
            data={zoneOptions}
            value={zoneId}
            onChange={(value) => {
              setZoneId(value);
              setWoredaId(null);
            }}
            w={300}
            disabled={!regionId || zonesLoading}
          />
          <Select
            label="Woreda"
            data={woredas?.map((w) => ({ value: String(w.id), label: w.name })) || []}
            value={woredaId}
            onChange={setWoredaId}
            w={300}
            disabled={woredasLoading}
          />
        </Group>

        <Group mt="md" justify="flex-end">
          <Button onClick={() => navigate(`/admin/setup/hubs?${inheritedQuery}`)} disabled={!woredaId}>
            Create Hub
          </Button>
          <Button
            onClick={() => navigate(`/admin/setup/warehouses?${inheritedQuery}`)}
            disabled={!woredaId}
            variant="light"
          >
            Create Warehouse
          </Button>
        </Group>
      </Card>

      {woredasLoading && <LoadingState message="Loading woredas..." />}
      {woredasError && <ErrorState message="Failed to load woredas" onRetry={() => refetchWoredas()} />}
    </Stack>
  );
}
