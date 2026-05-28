/** Types aligned with dispatcharchitecture.md serializers (snake_case from API). */

export interface LookupOption {
  id: number;
  name: string;
  code?: string | null;
  label: string;
  location_type?: string | null;
  meta?: {
    commodity_id?: number;
    available_quantity?: number;
    unit_id?: number;
  };
}

export interface DispatchLookupPaginated {
  items: LookupOption[];
  meta: {
    page?: number;
    per_page?: number;
    total_count: number;
    commodity_definition_id?: number;
    commodity_name?: string;
    commodity_ids?: number[];
    unit_id?: number;
    unit_abbreviation?: string;
    total_available_quantity?: number;
    has_inventory_lots?: boolean;
  };
}

export interface DispatchLineSourceAllocation {
  id?: number;
  warehouse_id: number;
  quantity: number;
  unit_id: number;
  base_quantity?: number;
  base_unit_id?: number;
  warehouse_ownership_type?: string;
  unit_name?: string;
  base_unit_name?: string;
  warehouse_label?: string;
  warehouse?: LookupOption;
}

export interface DispatchLineDestinationAllocation {
  id?: number;
  destination_location_id: number;
  destination_location_type: string;
  quantity: number;
  unit_id: number;
  base_quantity?: number;
  base_unit_id?: number;
  unit_name?: string;
  base_unit_name?: string;
  destination_label?: string;
  destination_warehouse_id?: number | null;
  destination_warehouse_name?: string | null;
  destination_location?: LookupOption;
}

export interface DispatchOrderLineV2 {
  id?: number;
  commodity_id: number;
  commodity_name?: string;
  quantity: number;
  unit_id: number;
  unit_name?: string;
  base_quantity?: number;
  base_unit_id?: number;
  base_unit_name?: string;
  packaging_unit_id?: number | null;
  packaging_size?: number | null;
  package_count?: number | null;
  remarks?: string | null;
  source_allocations: DispatchLineSourceAllocation[];
  destination_allocations: DispatchLineDestinationAllocation[];
}

export interface DispatchOrderAuthorizationStore {
  id: number;
  store_id: number;
  commodity_id: number;
  authorized_quantity: number;
  base_quantity: number;
  dispatched_quantity?: number;
  remaining_quantity: number;
  store_name?: string;
  commodity_name?: string;
}

export interface DispatchOrderAuthorizationExecution {
  id: number;
  quantity: number;
  base_quantity: number;
  authorized_quantity: number;
  shortage_quantity?: number;
  shortage_reason?: string | null;
  commodity_grade?: string | null;
  inventory_lot_id?: number | null;
  status: string;
  storekeeper_id?: number | null;
  commodity_id: number;
  dispatch_order_authorization_id: number;
  dispatch_order_authorization_store_id: number;
}

export interface DispatchOrderAuthorization {
  id: number;
  dispatch_order_id: number;
  warehouse_id: number;
  reference_no?: string | null;
  status: string;
  status_label?: string;
  authorized_quantity: number;
  authorized_base_quantity?: number;
  remaining_quantity?: number;
  driver_name?: string | null;
  driver_id_number?: string | null;
  truck_plate_number?: string | null;
  driver_phone?: string | null;
  transporter_id?: number | null;
  transporter_name?: string | null;
  created_by_id?: number;
  confirmed_at?: string | null;
  driver_confirmed_at?: string | null;
  warehouse?: LookupOption;
  dispatch_order_authorization_stores?: DispatchOrderAuthorizationStore[];
  dispatch_order_authorization_executions?: DispatchOrderAuthorizationExecution[];
}

/** Dispatch order as returned for v2 (extends legacy fields where both exist). */
export interface DispatchOrderV2 {
  id: number;
  reference_no?: string | null;
  plan_reference?: string | null;
  dispatch_reference?: string | null;
  name?: string | null;
  status: string;
  status_label?: string;
  description?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  exchange_order?: boolean;
  dispatch_plan_id?: number | null;
  dispatch_plan_item_id?: number | null;
  officer_level?: string | null;
  officer_location_id?: number | null;
  location_id?: number | null;
  location_name?: string | null;
  hierarchical_level?: string | null;
  hub_id?: number | null;
  hub_name?: string | null;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  created_by_id?: number;
  created_by_name?: string | null;
  confirmed_by_id?: number | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  approved_by_id?: number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  dispatched_date?: string | null;
  destination_type?: string | null;
  destination_id?: number | null;
  destination_reference?: string | null;
  /** Merged in by API layer for dispatch order payloads */
  can_confirm?: boolean;
  can_self_approve?: boolean;
  dispatch_order_lines?: DispatchOrderLineV2[];
  dispatch_order_authorizations?: DispatchOrderAuthorization[];
  /** Legacy */
  source_warehouse_id?: number;
  source_warehouse_name?: string;
  destination_name?: string;
  expected_pickup_date?: string;
  lines?: { commodity_id: number; quantity: number; unit_id: number; notes?: string }[];
}

export interface DispatchOrderWorkflowPayload {
  id: number;
  reference_no?: string | null;
  plan_reference?: string | null;
  dispatch_reference?: string | null;
  status: string;
  officer_level?: string | null;
  workflow_events: WorkflowEventRow[];
}

export interface WorkflowEventRow {
  id: number;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  actor_name?: string | null;
  occurred_at: string;
  payload?: Record<string, unknown>;
}

export interface CreateDispatchOrderV2LinePayload {
  commodity_id?: number;
  commodity_definition_id?: number;
  quantity: number;
  unit_id: number;
  packaging_unit_id?: number | null;
  packaging_size?: number | null;
  remarks?: string;
  source_allocations: { warehouse_id: number; quantity: number; unit_id: number }[];
  destination_allocations: { destination_location_id: number; quantity: number; unit_id: number }[];
}

export interface CreateDispatchOrderV2Payload {
  /** Optional legacy field — server assigns DO-{id} automatically. */
  dispatch_reference?: string;
  plan_reference?: string;
  description?: string;
  dispatch_plan_id?: number | null;
  dispatch_plan_item_id?: number | null;
  lines: CreateDispatchOrderV2LinePayload[];
}

export interface TransportRecordPayload {
  warehouse_id: number;
  driver_name: string;
  license_number: string;
  vehicle_plate: string;
  phone?: string;
}

export interface ExchangeReceivePayload {
  warehouse_id: number;
  commodity_id: number;
  quantity: number;
  unit_id: number;
  packaging_unit_id: number;
  packaging_size: number;
}

export interface CreateDispatchOrderAuthorizationPayload {
  dispatch_order_id: number;
  warehouse_id: number;
  authorized_quantity: number;
  authorized_quantity_input_unit_id: number;
  transporter_id: number;
  driver_name: string;
  driver_id_number: string;
  truck_plate_number: string;
  driver_phone: string;
  store_splits?: {
    store_id: number;
    commodity_id: number;
    authorized_quantity: number;
    base_quantity: number;
  }[];
}

export interface UpdateDispatchOrderAuthorizationStoreSplitsPayload {
  store_splits: {
    store_id: number;
    commodity_id: number;
    authorized_quantity: number;
    base_quantity: number;
  }[];
}

export interface CommodityGradeRow {
  id: number;
  name: string;
  code: string;
  label: string;
  commodity_id?: string | null;
}
