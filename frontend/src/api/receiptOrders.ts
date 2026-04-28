import apiClient from './client';
import type {
  ReceiptOrderAssignment,
  SpaceReservation,
  WorkflowEvent,
} from '../types/assignment';

export interface ReceiptOrderLine {
  id?: number;
  commodity_id: number;
  commodity_name?: string;
  commodity_batch_no?: string;
  line_reference_no?: string;
  quantity: number;
  unit_id: number;
  unit_name?: string;
  notes?: string;
  packaging_unit_id?: number;
  packaging_unit_name?: string;
  packaging_size?: number;
  total_quantity?: number;
  source_type?: string;
  source_name?: string;
}

export interface AssignableManagerOption {
  id: number;
  name: string;
  role: 'Hub Manager' | 'Warehouse Manager' | 'Storekeeper';
  store_id?: number;
  store_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  hub_id?: number;
  hub_name?: string;
}

export interface StoreOption {
  id: number;
  name: string;
  code: string;
  warehouse_id: number;
}

export interface ReceiptOrder {
  id: number;
  reference_no?: string;
  source_type?: string;
  /** Free-text or resolved label from API */
  source_name?: string;
  source_reference?: string | number;
  source_id?: number;
  /** Frontend create payload name */
  name?: string;
  hub_id?: number;
  hub_name?: string;
  destination_warehouse_id?: number;
  destination_warehouse_name?: string;
  /** Backend serializer field */
  warehouse_id?: number;
  warehouse_name?: string;
  warehouse_code?: string;
  expected_delivery_date?: string;
  /** Backend serializer field */
  received_date?: string;
  status: 'Draft' | 'Confirmed' | 'Assigned' | 'Reserved' | 'In Progress' | 'Completed' | 'Cancelled';
  notes?: string;
  description?: string;
  lines?: ReceiptOrderLine[];
  receipt_order_lines?: ReceiptOrderLine[];
  created_at: string;
  updated_at: string;
  // Phase 3: Assignment & Reservation
  assignments?: ReceiptOrderAssignment[];
  space_reservations?: SpaceReservation[];
  workflow_events?: WorkflowEvent[];
  /** Raw API key; prefer `assignments` after normalization */
  receipt_order_assignments?: ReceiptOrderAssignment[];
  // Hierarchical order management
  location_id?: number | null;
  hierarchical_level?: string | null;
  location_name?: string | null;
}

function normalizeReceiptOrderAssignment(raw: Record<string, unknown>): ReceiptOrderAssignment {
  const statusRaw = String(raw.status ?? 'pending');
  const statusNorm = statusRaw.toLowerCase().replace(/\s+/g, '_') as ReceiptOrderAssignment['status'];
  const allowed: ReceiptOrderAssignment['status'][] = [
    'pending',
    'assigned',
    'accepted',
    'in_progress',
    'completed',
    'rejected',
  ];
  const status = allowed.includes(statusNorm) ? statusNorm : 'pending';

  const assignedAt =
    (typeof raw.assigned_at === 'string' && raw.assigned_at) ||
    (typeof raw.created_at === 'string' && raw.created_at) ||
    new Date().toISOString();

  return {
    id: Number(raw.id),
    receipt_order_id: Number(raw.receipt_order_id),
    receipt_order_line_id: raw.receipt_order_line_id != null ? Number(raw.receipt_order_line_id) : undefined,
    hub_id: raw.hub_id != null ? Number(raw.hub_id) : undefined,
    hub_name: typeof raw.hub_name === 'string' ? raw.hub_name : undefined,
    warehouse_id: raw.warehouse_id != null ? Number(raw.warehouse_id) : undefined,
    warehouse_name: typeof raw.warehouse_name === 'string' ? raw.warehouse_name : undefined,
    hub_warehouses_count:
      raw.hub_warehouses_count != null ? Number(raw.hub_warehouses_count) : undefined,
    store_id: raw.store_id != null ? Number(raw.store_id) : undefined,
    store_name: typeof raw.store_name === 'string' ? raw.store_name : undefined,
    assigned_to_id: raw.assigned_to_id != null ? Number(raw.assigned_to_id) : undefined,
    assigned_to_name: typeof raw.assigned_to_name === 'string' ? raw.assigned_to_name : undefined,
    assigned_by_id: Number(raw.assigned_by_id),
    assigned_by_name: typeof raw.assigned_by_name === 'string' ? raw.assigned_by_name : undefined,
    quantity: raw.quantity != null ? Number(raw.quantity) : undefined,
    status,
    assigned_at: assignedAt,
    accepted_at: typeof raw.accepted_at === 'string' ? raw.accepted_at : undefined,
    completed_at: typeof raw.completed_at === 'string' ? raw.completed_at : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
  };
}

/** Maps API payload (e.g. `receipt_order_assignments`) into the shape the UI expects */
export function normalizeReceiptOrder(raw: Record<string, unknown>): ReceiptOrder {
  const base = { ...raw } as unknown as ReceiptOrder;
  const fromNested = raw.receipt_order_assignments;
  const existing = base.assignments;
  const list =
    Array.isArray(existing) && existing.length > 0
      ? existing
      : Array.isArray(fromNested)
        ? fromNested
        : [];
  const assignments = list.map((a) =>
    normalizeReceiptOrderAssignment(typeof a === 'object' && a !== null ? (a as Record<string, unknown>) : {})
  );
  return { ...base, assignments };
}

export interface CreateReceiptOrderPayload {
  /** Set when destination is a specific warehouse; null/omit when destination is hub-only. */
  destination_warehouse_id?: number | null;
  /** Set when destination type is Hub (receiving into a hub, warehouse TBD) or to match a chosen warehouse. */
  hub_id?: number | null;
  /** Optional source details for traceability. */
  source_type?: string;
  source_name?: string;
  expected_delivery_date: string;
  notes?: string;
  lines: ReceiptOrderLine[];
  /** Location tagging for hierarchical order management */
  location_id?: number | null;
  hierarchical_level?: string | null;
}

export async function getReceiptOrders(params?: { warehouse_id?: number; hub_id?: number }): Promise<ReceiptOrder[]> {
  const response = await apiClient.get('/receipt_orders', { params });
  const rows = Array.isArray(response.data) ? response.data : response.data.data || [];
  return rows.map((row: unknown) =>
    normalizeReceiptOrder(typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {})
  );
}

export async function getReceiptOrder(id: number): Promise<ReceiptOrder> {
  const response = await apiClient.get(`/receipt_orders/${id}`);
  const raw = response.data.data || response.data;
  return normalizeReceiptOrder(typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {});
}

export async function createReceiptOrder(payload: CreateReceiptOrderPayload): Promise<ReceiptOrder> {
  const response = await apiClient.post('/receipt_orders', { payload });
  const raw = response.data.data || response.data;
  return normalizeReceiptOrder(typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {});
}

export async function updateReceiptOrder(id: number, payload: Partial<CreateReceiptOrderPayload>): Promise<ReceiptOrder> {
  const response = await apiClient.put(`/receipt_orders/${id}`, { payload });
  const raw = response.data.data || response.data;
  return normalizeReceiptOrder(typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {});
}

export async function deleteReceiptOrder(id: number): Promise<void> {
  await apiClient.delete(`/receipt_orders/${id}`);
}

export async function confirmReceiptOrder(id: number): Promise<ReceiptOrder> {
  const response = await apiClient.post(`/receipt_orders/${id}/confirm`);
  const raw = response.data.data || response.data;
  return normalizeReceiptOrder(typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {});
}

export type AssignableManagersScope = 'hub' | 'warehouse' | null;

export async function getReceiptOrderAssignableManagers(id: number, managerOnly = false): Promise<{
  assignable_managers: AssignableManagerOption[];
  stores: StoreOption[];
  hub_id?: number | null;
  hub_name?: string | null;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  managers_scope?: AssignableManagersScope;
}> {
  const response = await apiClient.get(`/receipt_orders/${id}/assignable_managers`, {
    params: { manager_only: managerOnly },
  });
  const data = response.data.data || response.data;
  const scope = data.managers_scope;
  const managersScope: AssignableManagersScope =
    scope === 'hub' || scope === 'warehouse' ? scope : null;
  return {
    assignable_managers: Array.isArray(data.assignable_managers) ? data.assignable_managers : [],
    stores: Array.isArray(data.stores) ? data.stores : [],
    hub_id: data.hub_id ?? null,
    hub_name: data.hub_name ?? null,
    warehouse_id: data.warehouse_id ?? null,
    warehouse_name: data.warehouse_name ?? null,
    managers_scope: managersScope,
  };
}

// Phase 3: Assignment & Reservation APIs

export async function assignReceiptOrder(
  id: number,
  payload: {
    assignments: Array<
      Partial<ReceiptOrderAssignment> & {
        receipt_order_line_id?: number;
        warehouse_id?: number;
        quantity?: number;
      }
    >;
  }
): Promise<ReceiptOrder> {
  const response = await apiClient.post(`/receipt_orders/${id}/assign`, { payload });
  const raw = response.data.data || response.data;
  return normalizeReceiptOrder(typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {});
}

export async function reserveSpace(
  id: number,
  payload: { reservations: Partial<SpaceReservation>[] }
): Promise<ReceiptOrder> {
  const response = await apiClient.post(`/receipt_orders/${id}/reserve_space`, { payload });
  const raw = response.data.data || response.data;
  return normalizeReceiptOrder(typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {});
}

function extractWorkflowEvents(responseData: unknown): WorkflowEvent[] {
  const root = (responseData as { data?: { workflow_events?: unknown }; workflow_events?: unknown }) || {};
  const inner = root.data ?? root;
  const raw = inner.workflow_events ?? (Array.isArray(inner) ? inner : []);
  return Array.isArray(raw) ? raw : [];
}

export async function getReceiptOrderWorkflow(id: number): Promise<WorkflowEvent[]> {
  const response = await apiClient.get(`/receipt_orders/${id}/workflow`);
  return extractWorkflowEvents(response.data);
}
