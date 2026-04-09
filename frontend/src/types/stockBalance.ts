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
  // Phase 2: Lot/UOM fields
  batch_no?: string | null;
  expiry_date?: string | null;
  inventory_lot_id?: number | null;
  entered_unit_id?: number | null;
  entered_unit_name?: string | null;
  entered_quantity?: number | null;
  base_unit_id?: number | null;
  base_unit_name?: string | null;
  base_quantity?: number | null;
}
