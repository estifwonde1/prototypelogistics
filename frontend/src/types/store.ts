export interface Store {
  id: number;
  code: string;
  name: string;
  length: number;
  width: number;
  height: number;
  usable_space: number;
  available_space: number;
  usable_area_m2?: number;
  total_area_m2?: number;
  temporary: boolean;
  has_gangway: boolean;
  gangway_length?: number;
  gangway_width?: number;
  warehouse_id: number;
  warehouse_name?: string;
  warehouse_code?: string;
}
