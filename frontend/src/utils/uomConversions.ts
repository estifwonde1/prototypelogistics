import type { UomConversion } from '../types/referenceData';

/**
 * Directed conversion factor from `fromUnitId` to `toUnitId` using the global
 * `cats_warehouse_uom_conversions` graph (same semantics as the warehouse UI
 * and compatible with backend `UomConversionResolver` forward edges).
 *
 * Each edge: 1 unit of `from_unit_id` = `multiplier` units of `to_unit_id`.
 * Commodity-specific edges (matching `commodityId`) take precedence over global (`commodity_id` null).
 */
export function findDirectedMultiplier(
  fromUnitId: number,
  toUnitId: number,
  commodityId: number,
  conversions: UomConversion[]
): number | null {
  if (fromUnitId === toUnitId) return 1;

  const visited = new Set<number>();

  function dfs(currentUnitId: number): number | null {
    if (currentUnitId === toUnitId) return 1;
    if (visited.has(currentUnitId)) return null;
    visited.add(currentUnitId);

    const outgoing = conversions.filter((conversion) => {
      if (!conversion.active) return false;
      if (conversion.from_unit_id !== currentUnitId) return false;
      return conversion.commodity_id == null || conversion.commodity_id === commodityId;
    });

    for (const edge of outgoing) {
      const tail = dfs(edge.to_unit_id);
      if (tail != null) return Number(edge.multiplier) * tail;
    }

    return null;
  }

  return dfs(fromUnitId);
}

export function convertQuantityToTargetUnit(
  quantity: number,
  fromUnitId: number,
  toUnitId: number,
  commodityId: number,
  conversions: UomConversion[]
): number | null {
  const mult = findDirectedMultiplier(fromUnitId, toUnitId, commodityId, conversions);
  if (mult == null) return null;
  return Number((quantity * mult).toFixed(6));
}
