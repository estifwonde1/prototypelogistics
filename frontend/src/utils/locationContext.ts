import { getRegions, getWoredas, getZones } from '../api/locations';

export interface LocationContext {
  regionId?: number;
  regionName?: string;
  subcityName?: string;
  woredaName?: string;
  zoneId?: number;
  woredaId?: number;
}

export function resolveLocationContextFromQuery(params: URLSearchParams): LocationContext {
  const regionId = params.get('region_id');
  const regionName = params.get('region_name');
  const zoneId = params.get('zone_id');
  const woredaId = params.get('woreda_id');
  const subcityName = params.get('subcity_name');
  const woredaName = params.get('woreda_name');

  return {
    regionId: regionId ? Number(regionId) : undefined,
    regionName: regionName || undefined,
    subcityName: subcityName || undefined,
    woredaName: woredaName || undefined,
    zoneId: zoneId ? Number(zoneId) : undefined,
    woredaId: woredaId ? Number(woredaId) : undefined,
  };
}

export async function resolveLocationContextByWoredaId(woredaId?: number): Promise<LocationContext> {
  if (!woredaId) return {};

  const regions = await getRegions();
  for (const region of regions) {
    const zones = await getZones(region.id);
    for (const zone of zones) {
      const woredas = await getWoredas(zone.id);
      const woreda = woredas.find((entry) => entry.id === woredaId);
      if (woreda) {
        return {
          regionId: region.id,
          regionName: region.name,
          subcityName: zone.name,
          woredaName: woreda.name,
          zoneId: zone.id,
          woredaId: woreda.id,
        };
      }
    }
  }

  return {};
}
