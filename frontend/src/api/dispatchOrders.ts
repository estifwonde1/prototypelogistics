import apiClient from './client';
import type {
  DispatchOrderAssignment,
  StockReservation,
  WorkflowEvent,
} from '../types/assignment';

export interface DispatchOrderLine {
  id?: number;
  commodity_id: number;
  commodity_name?: string;
  quantity: number;
  unit_id: number;
  unit_name?: string;
  notes?: string;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  hub_id?: number | null;
  hub_name?: string | null;
  source_name?: string | null;
  fdp_id?: number | null;
  fdp_name?: string | null;
  expected_receive_at?: string | null;
}

export interface DispatchOrder {
  id: number;
  source_warehouse_id?: number;
  source_warehouse_name?: string;
  hub_id?: number | null;
  hub_name?: string | null;
  destination_type?: string;
  destination_name?: string;
  expected_pickup_date?: string;
  status: 'Draft' | 'Confirmed' | 'Assigned' | 'Reserved' | 'In Progress' | 'Completed';
  notes?: string;
  description?: string;
  lines?: DispatchOrderLine[];
  created_at: string;
  updated_at: string;
  // Phase 3: Assignment & Reservation
  assignments?: DispatchOrderAssignment[];
  stock_reservations?: StockReservation[];
  workflow_events?: WorkflowEvent[];
  // Hierarchical order management
  location_id?: number | null;
  hierarchical_level?: string | null;
  location_name?: string | null;
  // Dispatch plan fields
  response_plan_ref?: string | null;
  approval_date?: string | null;
  response_type?: string | null;
  fdp_id?: number | null;
  fdp_name?: string | null;
  reference_no?: string | null;
  // Quantity tracking for DA filtering
  total_ordered_quantity?: number | null;
  total_authorized_quantity?: number | null;
  remaining_quantity?: number | null;
}

export interface CreateDispatchOrderPayload {
  source_warehouse_id?: number;
  destination_type?: string;
  destination_name?: string;
  expected_pickup_date?: string;
  notes?: string;
  description?: string;
  lines: DispatchOrderLine[];
  location_id?: number | null;
  hierarchical_level?: string | null;
  hub_id?: number | null;
  response_plan_ref?: string | null;
  approval_date?: string | null;
  response_type?: string | null;
  fdp_id?: number | null;
}

export async function getDispatchOrders(params?: {
  warehouse_id?: number;
  hub_id?: number;
}): Promise<DispatchOrder[]> {
  const response = await apiClient.get('/dispatch_orders', { params });
  return Array.isArray(response.data) ? response.data : response.data.data || [];
}

export async function getDispatchOrder(id: number, params?: { warehouse_id?: number; hub_id?: number }): Promise<DispatchOrder> {
  const response = await apiClient.get(`/dispatch_orders/${id}`, { params });
  return response.data.data || response.data;
}

export async function createDispatchOrder(payload: CreateDispatchOrderPayload): Promise<DispatchOrder> {
  const response = await apiClient.post('/dispatch_orders', { payload });
  return response.data.data || response.data;
}

export async function updateDispatchOrder(id: number, payload: Partial<CreateDispatchOrderPayload>): Promise<DispatchOrder> {
  const response = await apiClient.put(`/dispatch_orders/${id}`, { payload });
  return response.data.data || response.data;
}

export async function deleteDispatchOrder(id: number): Promise<void> {
  await apiClient.delete(`/dispatch_orders/${id}`);
}

export async function confirmDispatchOrder(id: number): Promise<DispatchOrder> {
  const response = await apiClient.post(`/dispatch_orders/${id}/confirm`);
  return response.data.data || response.data;
}

// Phase 3: Assignment & Reservation APIs

export async function assignDispatchOrder(
  id: number,
  payload: { assignments: Partial<DispatchOrderAssignment>[] }
): Promise<DispatchOrder> {
  const response = await apiClient.post(`/dispatch_orders/${id}/assign`, { payload });
  return response.data.data || response.data;
}

export async function reserveStock(
  id: number,
  payload: { reservations: Partial<StockReservation>[] }
): Promise<DispatchOrder> {
  const response = await apiClient.post(`/dispatch_orders/${id}/reserve_stock`, { payload });
  return response.data.data || response.data;
}

function extractWorkflowEvents(responseData: unknown): WorkflowEvent[] {
  const root = (responseData as { data?: { workflow_events?: unknown }; workflow_events?: unknown }) || {};
  const inner = root.data ?? root;
  const raw = inner.workflow_events ?? (Array.isArray(inner) ? inner : []);
  return Array.isArray(raw) ? raw : [];
}

export async function getDispatchOrderWorkflow(id: number): Promise<WorkflowEvent[]> {
  const response = await apiClient.get(`/dispatch_orders/${id}/workflow`);
  return extractWorkflowEvents(response.data);
}
