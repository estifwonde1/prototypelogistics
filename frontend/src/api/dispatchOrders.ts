import apiClient from './client';
import { unwrapData } from '../utils/apiSuccess';
import type {
  CreateDispatchOrderV2Payload,
  DispatchOrderV2,
  DispatchOrderWorkflowPayload,
  ExchangeReceivePayload,
  TransportRecordPayload,
} from '../types/dispatchV2';
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

/** Legacy + partial v2 fields used by older pages */
export interface DispatchOrder {
  id: number;
  source_warehouse_id?: number;
  source_warehouse_name?: string;
  destination_type?: string;
  destination_name?: string;
  expected_pickup_date?: string;
  status: string;
  notes?: string;
  description?: string;
  reference_title?: string;
  lines?: DispatchOrderLine[];
  created_at: string;
  updated_at: string;
  assignments?: DispatchOrderAssignment[];
  stock_reservations?: StockReservation[];
  workflow_events?: WorkflowEvent[];
  location_id?: number | null;
  hierarchical_level?: string | null;
  location_name?: string | null;
  plan_reference?: string | null;
  dispatch_reference?: string | null;
  reference_no?: string | null;
  exchange_order?: boolean;
  can_confirm?: boolean;
  can_self_approve?: boolean;
  can_destroy?: boolean;
  dispatch_order_lines?: import('../types/dispatchV2').DispatchOrderLineV2[];
  dispatch_order_authorizations?: import('../types/dispatchV2').DispatchOrderAuthorization[];
}

export interface CreateDispatchOrderPayload {
  source_warehouse_id: number;
  destination_type: string;
  destination_name: string;
  expected_pickup_date: string;
  notes?: string;
  lines: DispatchOrderLine[];
  location_id?: number | null;
  hierarchical_level?: string | null;
}

export async function getDispatchOrders(params?: {
  warehouse_id?: number;
  status?: string;
  created_by?: string;
  officer_level?: string;
}): Promise<DispatchOrder[]> {
  const response = await apiClient.get('/dispatch_orders', { params });
  return unwrapData<DispatchOrder[]>(response);
}

export async function getDispatchOrder(id: number): Promise<DispatchOrder> {
  const response = await apiClient.get(`/dispatch_orders/${id}`);
  return unwrapData<DispatchOrder>(response);
}

export async function createDispatchOrder(payload: CreateDispatchOrderPayload): Promise<DispatchOrder> {
  const response = await apiClient.post('/dispatch_orders', { payload });
  return unwrapData<DispatchOrder>(response);
}

export async function createDispatchOrderV2(payload: CreateDispatchOrderV2Payload): Promise<DispatchOrderV2> {
  const response = await apiClient.post('/dispatch_orders', { payload });
  return unwrapData<DispatchOrderV2>(response);
}

export async function updateDispatchOrder(id: number, payload: Partial<CreateDispatchOrderPayload>): Promise<DispatchOrder> {
  const response = await apiClient.patch(`/dispatch_orders/${id}`, { payload });
  return unwrapData<DispatchOrder>(response);
}

export async function updateDispatchOrderV2(
  id: number,
  payload: { reference_title?: string; description?: string; lines: CreateDispatchOrderV2Payload['lines'] }
): Promise<DispatchOrderV2> {
  const response = await apiClient.patch(`/dispatch_orders/${id}`, { payload });
  return unwrapData<DispatchOrderV2>(response);
}

export async function deleteDispatchOrder(id: number): Promise<void> {
  await apiClient.delete(`/dispatch_orders/${id}`);
}

export async function confirmDispatchOrder(id: number): Promise<DispatchOrder> {
  const response = await apiClient.post(`/dispatch_orders/${id}/confirm`);
  return unwrapData<DispatchOrder>(response);
}

export async function selfApproveDispatchOrder(id: number): Promise<DispatchOrderV2> {
  const response = await apiClient.post(`/dispatch_orders/${id}/self_approve`);
  return unwrapData<DispatchOrderV2>(response);
}

export async function postDispatchOrderTransportRecord(
  id: number,
  payload: TransportRecordPayload,
  method: 'post' | 'patch' = 'post'
): Promise<{ transport_record_id: number }> {
  const fn = method === 'patch' ? apiClient.patch : apiClient.post;
  const response = await fn(`/dispatch_orders/${id}/transport_record`, { payload });
  return unwrapData<{ transport_record_id: number }>(response);
}

export async function postDispatchOrderReceive(
  id: number,
  payload: ExchangeReceivePayload
): Promise<{ packaging_transaction_id: number }> {
  const response = await apiClient.post(`/dispatch_orders/${id}/receive`, { payload });
  return unwrapData<{ packaging_transaction_id: number }>(response);
}

export async function assignDispatchOrder(
  id: number,
  payload: { assignments: Partial<DispatchOrderAssignment>[] }
): Promise<DispatchOrder> {
  const response = await apiClient.post(`/dispatch_orders/${id}/assign`, { payload });
  return unwrapData<DispatchOrder>(response);
}

export async function reserveStock(
  id: number,
  payload: { reservations: Partial<StockReservation>[] }
): Promise<DispatchOrder> {
  const response = await apiClient.post(`/dispatch_orders/${id}/reserve_stock`, { payload });
  return unwrapData<DispatchOrder>(response);
}

export async function getDispatchOrderWorkflowPayload(id: number): Promise<DispatchOrderWorkflowPayload> {
  const response = await apiClient.get(`/dispatch_orders/${id}/workflow`);
  return unwrapData<DispatchOrderWorkflowPayload>(response);
}

/** @deprecated Prefer getDispatchOrderWorkflowPayload — returns only events array for legacy timeline */
export async function getDispatchOrderWorkflow(id: number): Promise<WorkflowEvent[]> {
  const payload = await getDispatchOrderWorkflowPayload(id);
  return (payload.workflow_events ?? []) as WorkflowEvent[];
}
