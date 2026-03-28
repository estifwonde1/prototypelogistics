export interface Store {
  id: number;
  code: string;
  name: string;
  length: number;
  width: number;
  height: number;
  usable_space: number;
  available_space: number;
  temporary: boolean;
  has_gangway: boolean;
  gangway_length?: number;
  gangway_width?: number;
  gangway_height?: number;
  warehouse_id: number;
}
