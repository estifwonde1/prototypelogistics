export interface StockBalance {
  id: number;
  warehouse_id: number;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  store_id?: number;
  store_name?: string | null;
  store_code?: string | null;
  stack_id?: number;
  stack_code?: string | null;
  commodity_id: number;
  commodity_name?: string | null;
  commodity_batch_no?: string | null;
  quantity: number;
  unit_id: number;
  unit_name?: string | null;
  unit_abbreviation?: string | null;
}
