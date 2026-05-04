// Phase 3: Assignment & Reservation Types

export interface ReceiptOrderAssignment {
  id: number;
  receipt_order_id: number;
  receipt_order_line_id?: number;
  hub_id?: number;
  hub_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  /** Hub-scoped assignments: number of warehouses under that hub */
  hub_warehouses_count?: number;
  store_id?: number;
  store_name?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  assigned_by_id: number;
  assigned_by_name?: string;
  quantity?: number;
  quantity_unit_id?: number;
  quantity_unit_abbreviation?: string;
  status: 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  assigned_at: string;
  accepted_at?: string;
  completed_at?: string;
  notes?: string;
}

export interface DispatchOrderAssignment {
  id: number;
  dispatch_order_id: number;
  dispatch_order_line_id?: number;
  hub_id?: number;
  hub_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  store_id?: number;
  store_name?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  assigned_by_id: number;
  assigned_by_name?: string;
  quantity?: number;
  status: 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  assigned_at: string;
  accepted_at?: string;
  completed_at?: string;
  notes?: string;
}

export interface SpaceReservation {
  id: number;
  receipt_order_id: number;
  receipt_order_line_id?: number;
  receipt_order_assignment_id?: number;
  warehouse_id: number;
  warehouse_name?: string;
  store_id: number;
  store_name?: string;
  reserved_quantity?: number;
  reserved_volume?: number;
  reserved_by_id: number;
  reserved_by_name?: string;
  status: 'pending' | 'confirmed' | 'occupied' | 'released' | 'cancelled';
  reserved_at: string;
  occupied_at?: string;
  released_at?: string;
  notes?: string;
}

export interface StockReservation {
  id: number;
  dispatch_order_id: number;
  dispatch_order_line_id?: number;
  warehouse_id: number;
  warehouse_name?: string;
  store_id?: number;
  store_name?: string;
  stack_id?: number;
  stack_code?: string;
  commodity_id: number;
  commodity_name?: string;
  unit_id: number;
  unit_name?: string;
  inventory_lot_id?: number;
  batch_no?: string;
  reserved_quantity: number;
  issued_quantity?: number;
  reserved_by_id: number;
  reserved_by_name?: string;
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';
  reserved_at: string;
  fulfilled_at?: string;
  notes?: string;
}

export interface WorkflowEvent {
  id: number;
  entity_type?: 'receipt_order' | 'dispatch_order' | 'grn' | 'gin' | 'inspection' | 'waybill' | string;
  entity_id?: number;
  event_type: string;
  /** API uses occurred_at */
  occurred_at?: string;
  from_status?: string | null;
  to_status?: string | null;
  actor_id?: number | null;
  actor_name?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  /** Legacy / alternate names */
  status?: string;
  triggered_by_id?: number;
  triggered_by_name?: string;
  triggered_at?: string;
  metadata?: Record<string, unknown>;
  description?: string;
}
