import type { StockBalance } from '../../../types/stockBalance';
import type { CommodityReference } from '../../../types/referenceData';
import type { CommodityDefinition } from '../../../api/commodityDefinitions';
import type { CommodityGroup } from './types';

export interface GroupedCommodityOption {
  value: string;
  label: string;
  commodityName: string;
  batchIds: number[];
  unitId: number;
  unitLabel?: string;
}

export function buildGroupedCommodityOptions(
  definitions: CommodityDefinition[],
  commodities: CommodityReference[],
  commodityGroup: CommodityGroup | null
): GroupedCommodityOption[] {
  if (!commodityGroup) return [];

  return definitions
    .filter((definition) => definition.group_name === commodityGroup)
    .map((definition) => {
      const batches = commodities
        .filter((batch) => (batch.name || '').toLowerCase() === definition.name.toLowerCase())
        .sort((a, b) => b.id - a.id);

      const primaryBatch = batches[0];
      return {
        value: definition.name,
        label: definition.name,
        commodityName: definition.name,
        batchIds: batches.map((batch) => batch.id),
        unitId: primaryBatch?.unit_id ?? 0,
        unitLabel: primaryBatch?.unit_abbreviation || primaryBatch?.unit_name || undefined,
      };
    })
    .filter((option) => option.batchIds.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveCommodityBatchId(
  batchIds: number[],
  warehouseId: number,
  stockBalances: StockBalance[],
  quantity: number
): number | null {
  if (batchIds.length === 0) return null;

  const atWarehouse = stockBalances
    .filter(
      (balance) =>
        balance.warehouse_id === warehouseId && batchIds.includes(balance.commodity_id)
    )
    .sort((a, b) => Number(b.quantity) - Number(a.quantity));

  const sufficient = atWarehouse.find((balance) => Number(balance.quantity) >= quantity);
  if (sufficient) return sufficient.commodity_id;

  return atWarehouse[0]?.commodity_id ?? batchIds[0];
}
