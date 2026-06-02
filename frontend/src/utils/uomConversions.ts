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
  if (fromUnitId === toUnitId) return Number(quantity.toFixed(6));

  const mult = findDirectedMultiplier(fromUnitId, toUnitId, commodityId, conversions);
  if (mult != null) return Number((quantity * mult).toFixed(6));

  // Mirror backend UomConversionResolver: use inverse edge when forward is missing.
  const inverse = findDirectedMultiplier(toUnitId, fromUnitId, commodityId, conversions);
  if (inverse != null && inverse !== 0) {
    return Number((quantity / inverse).toFixed(6));
  }

  return null;
}

/**
 * Resolve multiplier from an ITEM-type unit (pcs, bag) to kg using the
 * commodity's weight_per_unit_kg value.  Returns null when the unit is not
 * an ITEM type or no weight data is available.
 */
export function resolveItemToKgMultiplier(
  fromUnitId: number,
  commodityId: number,
  units: Array<{ id: number; abbreviation?: string | null; unit_type?: string | null }>,
  commodityRefs: Array<{ id: number; weight_per_unit_kg?: number; unit_id?: number }>
): number | null {
  const fromUnit = units.find((u) => u.id === fromUnitId);
  if (!fromUnit || (fromUnit.unit_type ?? '').toLowerCase() !== 'item') return null;

  const commodity = commodityRefs.find((c) => c.id === commodityId);
  if (!commodity) return null;

  const weightPerUnit = commodity.weight_per_unit_kg ?? 1.0;
  if (weightPerUnit <= 0) return 1.0;

  return weightPerUnit;
}

/** Commodity id for conversion lookups — global edges use null commodity_id in DB. */
export function conversionCommodityId(commodityId: number | null | undefined): number {
  return commodityId ?? 0;
}
