import { Select, SelectProps } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { getInventoryLots } from '../../api/referenceData';

interface LotSelectorProps extends Omit<SelectProps, 'data'> {
  warehouseId?: number;
  commodityId?: number;
}

export function LotSelector({ warehouseId, commodityId, ...props }: LotSelectorProps) {
  const { data: lots = [] } = useQuery({
    queryKey: ['reference-data', 'inventory_lots'],
    queryFn: getInventoryLots,
  });

  // Filter lots by warehouse and commodity if provided
  const filteredLots = lots.filter((lot) => {
    if (warehouseId && lot.warehouse_id !== warehouseId) return false;
    if (commodityId && lot.commodity_id !== commodityId) return false;
    return true;
  });

  const lotOptions = filteredLots.map((lot) => ({
    value: lot.id.toString(),
    label: lot.display_name || `${lot.batch_no} (Exp: ${new Date(lot.expiry_date).toLocaleDateString()})`,
  }));

  return <Select {...props} data={lotOptions} />;
}
