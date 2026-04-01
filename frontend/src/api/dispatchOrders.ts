import apiClient from './client';
import type {
  DispatchOrderAssignment,
  StockReservation,
  WorkflowEvent,
} from '../types/assignment';

export interface DispatchOrderLine {
  id?: number;
  commodity_id: number;
  quantity: number;
  unit_id: number;
  notes?: string;
}

export interface DispatchOrder {
  id: number;
  source_warehouse_id: number;
  source_warehouse_name?: string;
  destination_type: string;
  destination_name: string;
  expected_pickup_date: string;
  status: 'Draft' | 'Confirmed' | 'Assigned' | 'Reserved' | 'In Progress' | 'Completed';
  notes?: string;
  lines?: DispatchOrderLine[];
  created_at: string;
  updated_at: string;
  // Phase 3: Assignment & Reservation
  assignments?: DispatchOrderAssignment[];
  stock_reservations?: StockReservation[];
  workflow_events?: WorkflowEvent[];
}

export interface CreateDispatchOrderPayload {
  source_warehouse_id: number;
  destination_type: string;
  destination_name: string;
  expected_pickup_date: string;
  notes?: string;
  lines: DispatchOrderLine[];
}

export async function getDispatchOrders(): Promise<DispatchOrder[]> {
  const response = await apiClient.get('/dispatch_orders');
  return Array.isArray(response.data) ? response.data : response.data.data || [];
}

export async function getDispatchOrder(id: number): Promise<DispatchOrder> {
  const response = await apiClient.get(`/dispatch_orders/${id}`);
  return response.data.data || response.data;
}

export async function createDispatchOrder(payload: CreateDispatchOrderPayload): Promise<DispatchOrder> {
  const response = await apiClient.post('/dispatch_orders', payload);
  return response.data;
}

export async function updateDispatchOrder(id: number, payload: Partial<CreateDispatchOrderPayload>): Promise<DispatchOrder> {
  const response = await apiClient.put(`/dispatch_orders/${id}`, payload);
  return response.data;
}

export async function deleteDispatchOrder(id: number): Promise<void> {
  await apiClient.delete(`/dispatch_orders/${id}`);
}

export async function confirmDispatchOrder(id: number): Promise<DispatchOrder> {
  const response = await apiClient.post(`/dispatch_orders/${id}/confirm`);
  return response.data;
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

export async function getDispatchOrderWorkflow(id: number): Promise<WorkflowEvent[]> {
  const response = await apiClient.get(`/dispatch_orders/${id}/workflow`);
  return response.data.workflow_events || response.data.data || [];
}
