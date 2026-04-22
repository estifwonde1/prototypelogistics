import { getKebeles, getRegions, getWoredas, getZones } from '../api/locations';

export interface LocationContext {
  regionId?: number;
  regionName?: string;
  subcityName?: string;
  woredaName?: string;
  kebeleId?: number;
  kebeleName?: string;
  zoneId?: number;
  woredaId?: number;
}

export function resolveLocationContextFromQuery(params: URLSearchParams): LocationContext {
  const regionId = params.get('region_id');
  const regionName = params.get('region_name');
  const zoneId = params.get('zone_id');
  const woredaId = params.get('woreda_id');
  const kebeleId = params.get('kebele_id');
  const subcityName = params.get('subcity_name');
  const woredaName = params.get('woreda_name');
  const kebeleName = params.get('kebele_name');

  return {
    regionId: regionId ? Number(regionId) : undefined,
    regionName: regionName || undefined,
    subcityName: subcityName || undefined,
    woredaName: woredaName || undefined,
    kebeleId: kebeleId ? Number(kebeleId) : undefined,
    kebeleName: kebeleName || undefined,
    zoneId: zoneId ? Number(zoneId) : undefined,
    woredaId: woredaId ? Number(woredaId) : undefined,
  };
}

export async function resolveLocationContextByLocationId(locationId?: number): Promise<LocationContext> {
  if (!locationId) return {};

  const regions = await getRegions();
  for (const region of regions) {
    const zones = await getZones(region.id);
    for (const zone of zones) {
      const woredas = await getWoredas(zone.id);
      for (const woreda of woredas) {
        if (woreda.id === locationId) {
          return {
            regionId: region.id,
            regionName: region.name,
            subcityName: zone.name,
            woredaName: woreda.name,
            zoneId: zone.id,
            woredaId: woreda.id,
          };
        }

        const kebeles = await getKebeles(woreda.id);
        const kebele = kebeles.find((entry) => entry.id === locationId);
        if (kebele) {
          return {
            regionId: region.id,
            regionName: region.name,
            subcityName: zone.name,
            woredaName: woreda.name,
            kebeleId: kebele.id,
            kebeleName: kebele.name,
            zoneId: zone.id,
            woredaId: woreda.id,
          };
        }
      }
    }
  }

  return {};
}
