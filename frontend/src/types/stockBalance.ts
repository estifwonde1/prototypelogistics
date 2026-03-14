export interface StockBalance {
  id: number;
  warehouse_id: number;
  store_id?: number;
  stack_id?: number;
  commodity_id: number;
  quantity: number;
  unit_id: number;
}
