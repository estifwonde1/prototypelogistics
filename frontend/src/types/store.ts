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
  // Warehouse capacity fields — denormalised onto the store for convenience
  warehouse_usable_space_percentage?: number;
  warehouse_total_area_sqm?: number;
  warehouse_usable_storage_capacity_mt?: number;
  warehouse_capacity_established?: boolean;
  usable_volume_m3?: number;
  occupied_volume_m3?: number;
  available_volume_m3?: number;
  allocated_capacity_mt?: number;
  used_capacity_mt?: number;
  remaining_capacity_mt?: number;
  utilization_pct?: number;
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
