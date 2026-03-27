export interface Grn {
  id: number;
  reference_no: string;
  warehouse_id: number;
  received_on: string;
  source_type?: string;
  source_id?: number;
  status: string;
  received_by_id?: number;
  approved_by_id?: number;
  grn_items?: GrnItem[];
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
}
