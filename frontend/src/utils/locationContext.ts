import { getKebeles, getRegions, getWoredas, getZones } from '../api/locations';
import type { LocationOption } from '../types/admin';

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

export interface LocationEntityFields {
  location_id?: number;
  region_id?: number;
  region_name?: string;
  zone_id?: number;
  subcity_name?: string;
  woreda_id?: number;
  woreda_name?: string;
  kebele_id?: number;
  kebele_name?: string;
}

export function locationContextFromEntity(entity?: LocationEntityFields | null): LocationContext {
  if (!entity) return {};

  return {
    regionId: entity.region_id,
    regionName: entity.region_name,
    zoneId: entity.zone_id,
    subcityName: entity.subcity_name,
    woredaId: entity.woreda_id,
    woredaName: entity.woreda_name,
    kebeleId: entity.kebele_id,
    kebeleName: entity.kebele_name,
  };
}

const DEFAULT_REGION_NAME = 'Addis Ababa';

const namesMatch = (a?: string, b?: string): boolean =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const orderRegionsForLookup = (regions: LocationOption[], regionName?: string): LocationOption[] =>
  [...regions].sort((a, b) => {
    if (regionName && namesMatch(a.name, regionName)) return -1;
    if (regionName && namesMatch(b.name, regionName)) return 1;
    if (namesMatch(a.name, DEFAULT_REGION_NAME)) return -1;
    if (namesMatch(b.name, DEFAULT_REGION_NAME)) return 1;
    return 0;
  });

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

export async function resolveLocationContextForEntity(
  entity: LocationEntityFields,
  prefetchedRegions?: LocationOption[]
): Promise<LocationContext> {
  const { location_id, region_name, subcity_name, woreda_name, kebele_name } = entity;

  if (location_id) {
    const byId = await resolveLocationContextByLocationId(location_id);
    if (byId.woredaId) return byId;
  }

  if (!subcity_name && !woreda_name) return {};

  const regions = prefetchedRegions ?? (await getRegions());

  for (const region of orderRegionsForLookup(regions, region_name)) {
    if (region_name && !namesMatch(region.name, region_name)) continue;

    const zones = await getZones(region.id);
    const matchingZones = subcity_name ? zones.filter((zone) => namesMatch(zone.name, subcity_name)) : zones;

    for (const zone of matchingZones) {
      const woredas = await getWoredas(zone.id);
      const matchingWoredas = woreda_name ? woredas.filter((woreda) => namesMatch(woreda.name, woreda_name)) : woredas;

      for (const woreda of matchingWoredas) {
        let kebeleId: number | undefined;
        let resolvedKebeleName = kebele_name;

        if (location_id) {
          if (woreda.id === location_id) {
            return {
              regionId: region.id,
              regionName: region.name,
              zoneId: zone.id,
              subcityName: zone.name,
              woredaId: woreda.id,
              woredaName: woreda.name,
            };
          }

          const kebeles = await getKebeles(woreda.id);
          const kebele = kebeles.find((entry) => entry.id === location_id);
          if (!kebele) continue;

          kebeleId = kebele.id;
          resolvedKebeleName = kebele.name;
        } else if (kebele_name) {
          const kebeles = await getKebeles(woreda.id);
          const kebele = kebeles.find((entry) => namesMatch(entry.name, kebele_name));
          if (kebele) {
            kebeleId = kebele.id;
            resolvedKebeleName = kebele.name;
          }
        }

        return {
          regionId: region.id,
          regionName: region.name,
          zoneId: zone.id,
          subcityName: zone.name,
          woredaId: woreda.id,
          woredaName: woreda.name,
          kebeleId,
          kebeleName: resolvedKebeleName,
        };
      }
    }
  }

  return {};
}
