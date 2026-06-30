export interface Stack {
  id: number;
  code: string;
  length: number;
  width: number;
  height: number;
  start_x: number;
  start_y: number;
  commodity_id: number | null;
  commodity_name?: string;
  commodity_code?: string;
  store_id: number;
  store_name?: string;
  store_code?: string;
  warehouse_id?: number;
  commodity_status: string;
  stack_status: string;
  quantity: number;
  base_quantity?: number | null;
  unit_id: number;
  unit_name?: string;
  unit_abbreviation?: string;
  reference?: string;
  max_capacity_mt?: number;
  used_capacity_mt?: number;
  remaining_capacity_mt?: number;
  utilization_pct?: number;
}
