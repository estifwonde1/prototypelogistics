import apiClient from './client';
import type {
  ReceiptOrderAssignment,
  SpaceReservation,
  WorkflowEvent,
} from '../types/assignment';

export interface ReceiptOrderLine {
  id?: number;
  commodity_id: number;
  quantity: number;
  unit_id: number;
  unit_price?: number;
  notes?: string;
}

export interface ReceiptOrder {
  id: number;
  source_type: string;
  source_name: string;
  destination_warehouse_id: number;
  destination_warehouse_name?: string;
  expected_delivery_date: string;
  status: 'Draft' | 'Confirmed' | 'Assigned' | 'Reserved' | 'In Progress' | 'Completed';
  notes?: string;
  lines?: ReceiptOrderLine[];
  created_at: string;
  updated_at: string;
  // Phase 3: Assignment & Reservation
  assignments?: ReceiptOrderAssignment[];
  space_reservations?: SpaceReservation[];
  workflow_events?: WorkflowEvent[];
}

export interface CreateReceiptOrderPayload {
  source_type: string;
  source_name: string;
  destination_warehouse_id: number;
  expected_delivery_date: string;
  notes?: string;
  lines: ReceiptOrderLine[];
}

export async function getReceiptOrders(): Promise<ReceiptOrder[]> {
  const response = await apiClient.get('/receipt_orders');
  return Array.isArray(response.data) ? response.data : response.data.data || [];
}

export async function getReceiptOrder(id: number): Promise<ReceiptOrder> {
  const response = await apiClient.get(`/receipt_orders/${id}`);
  return response.data.data || response.data;
}

export async function createReceiptOrder(payload: CreateReceiptOrderPayload): Promise<ReceiptOrder> {
  const response = await apiClient.post('/receipt_orders', { payload });
  return response.data.data || response.data;
}

export async function updateReceiptOrder(id: number, payload: Partial<CreateReceiptOrderPayload>): Promise<ReceiptOrder> {
  const response = await apiClient.put(`/receipt_orders/${id}`, { payload });
  return response.data.data || response.data;
}

export async function deleteReceiptOrder(id: number): Promise<void> {
  await apiClient.delete(`/receipt_orders/${id}`);
}

export async function confirmReceiptOrder(id: number): Promise<ReceiptOrder> {
  const response = await apiClient.post(`/receipt_orders/${id}/confirm`);
  return response.data.data || response.data;
}

// Phase 3: Assignment & Reservation APIs

export async function assignReceiptOrder(
  id: number,
  payload: { assignments: Partial<ReceiptOrderAssignment>[] }
): Promise<ReceiptOrder> {
  const response = await apiClient.post(`/receipt_orders/${id}/assign`, { payload });
  return response.data.data || response.data;
}

export async function reserveSpace(
  id: number,
  payload: { reservations: Partial<SpaceReservation>[] }
): Promise<ReceiptOrder> {
  const response = await apiClient.post(`/receipt_orders/${id}/reserve_space`, { payload });
  return response.data.data || response.data;
}

export async function getReceiptOrderWorkflow(id: number): Promise<WorkflowEvent[]> {
  const response = await apiClient.get(`/receipt_orders/${id}/workflow`);
  return response.data.workflow_events || response.data.data || [];
}
