export interface BinCardEntry {
  id: number;
  source_id: number | null;
  destination_id: number | null;
  unit_id: number | null;
  unit_name?: string | null;
  unit_abbreviation?: string | null;
  transaction_date: string;
  quantity: number;
  commodity_id?: number | null;
  commodity_name?: string | null;
  reference_type?: string | null;
  reference_id?: number | null;
  balance?: number | null;
  reference_no?: string | null;
  reference_status?: string | null;
  movement_type?: 'inbound' | 'outbound' | 'adjustment' | string | null;
  source_stack_code?: string | null;
  destination_stack_code?: string | null;
  source_store_name?: string | null;
  destination_store_name?: string | null;
  source_warehouse_name?: string | null;
  destination_warehouse_name?: string | null;
  // Phase 2: Lot/UOM fields
  batch_no?: string | null;
  expiry_date?: string | null;
  inventory_lot_id?: number | null;
  entered_unit_name?: string | null;
  entered_quantity?: number | null;
  base_unit_name?: string | null;
  base_quantity?: number | null;
}
