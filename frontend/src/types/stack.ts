export interface Stack {
  id: number;
  code: string;
  length: number;
  width: number;
  height: number;
  start_x: number;
  start_y: number;
  commodity_id: number;
  commodity_name?: string;
  commodity_code?: string;
  store_id: number;
  store_name?: string;
  store_code?: string;
  warehouse_id?: number;
  commodity_status: string;
  stack_status: string;
  quantity: number;
  unit_id: number;
  unit_name?: string;
  unit_abbreviation?: string;
  reference?: string;
}
