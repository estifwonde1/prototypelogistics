export interface Store {
  id: number;
  code: string;
  name: string;
  length: number;
  width: number;
  height: number;
  total_space?: number;
  usable_space: number;
  available_space: number;
  temporary: boolean;
  has_gangway: boolean;
  gangway_length?: number;
  gangway_width?: number;
  gangway_height?: number;
  warehouse_id: number;
  assigned_storekeepers?: AssignedStorekeeper[];
}

export interface AssignedStorekeeper {
  id: number;
  name: string;
}

export interface Storekeeper {
  id: number;
  name: string;
  email: string;
  assignment_type: 'warehouse' | 'store';
  warehouse_id: number;
  warehouse_name: string;
  assigned_store_ids: number[];
  assigned_stores: { id: number; name: string }[];
}
