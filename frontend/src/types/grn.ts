export interface Grn {
  id: number;
  reference_no: string;
  warehouse_id: number;
  warehouse_name?: string;
  warehouse_code?: string;
  /** Server: whether the current user may confirm this GRN (warehouse-scoped for managers). */
  can_confirm?: boolean;
  received_on: string;
  source_type?: string;
  source_id?: number;
  source_reference?: string | number;
  status: string;
  received_by_id?: number;
  received_by_name?: string;
  approved_by_id?: number;
  approved_by_name?: string;
  grn_items?: GrnItem[];
  // Phase 3: Order linkage
  receipt_order_id?: number;
  receipt_order?: {
    id: number;
    source_type: string;
    source_name: string;
    status: string;
  };
  generated_from_inspection_id?: number;
}

export interface GrnItem {
  id?: number;
  grn_id?: number;
  commodity_id: number;
  commodity_name?: string;
  commodity_code?: string;
  quantity: number;
  unit_id: number;
  unit_name?: string;
  unit_abbreviation?: string;
  quality_status: string;
  store_id?: number;
  store_name?: string;
  store_code?: string;
  stack_id?: number;
  stack_name?: string;
  stack_code?: string;
  /** Unique per commodity line; used as inventory batch when receiving. */
  line_reference_no?: string;
  // Phase 2: Lot/UOM fields
  batch_no?: string;
  expiry_date?: string;
  entered_unit_id?: number;
  entered_unit_name?: string;
  entered_quantity?: number;
  base_unit_id?: number;
  base_unit_name?: string;
  base_quantity?: number;
  inventory_lot_id?: number;
}
