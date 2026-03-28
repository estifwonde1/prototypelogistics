import { getRegions, getWoredas, getZones } from '../api/locations';

export interface LocationContext {
  regionName?: string;
  subcityName?: string;
  woredaName?: string;
  zoneId?: number;
  woredaId?: number;
}

export function resolveLocationContextFromQuery(params: URLSearchParams): LocationContext {
  const zoneId = params.get('zone_id');
  const woredaId = params.get('woreda_id');
  const subcityName = params.get('subcity_name');
  const woredaName = params.get('woreda_name');

  return {
    regionName: 'Addis Ababa',
    subcityName: subcityName || undefined,
    woredaName: woredaName || undefined,
    zoneId: zoneId ? Number(zoneId) : undefined,
    woredaId: woredaId ? Number(woredaId) : undefined,
  };
}

export async function resolveLocationContextByWoredaId(woredaId?: number): Promise<LocationContext> {
  if (!woredaId) return {};

  const regions = await getRegions();
  const addis = regions.find((region) => region.name.toLowerCase().includes('addis'));
  if (!addis) return {};

  const zones = await getZones(addis.id);
  for (const zone of zones) {
    const woredas = await getWoredas(zone.id);
    const woreda = woredas.find((entry) => entry.id === woredaId);
    if (woreda) {
      return {
        regionName: addis.name,
        subcityName: zone.name,
        woredaName: woreda.name,
        zoneId: zone.id,
        woredaId: woreda.id,
      };
    }
  }

  return {};
}
