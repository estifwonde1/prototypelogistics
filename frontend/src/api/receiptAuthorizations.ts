import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ReceiptAuthorization {
  id: number;
  reference_no: string;
  status: 'pending' | 'active' | 'closed' | 'cancelled';

  // Links
  receipt_order_id: number;
  receipt_order_reference_no?: string;
  receipt_order_assignment_id?: number | null;

  // Destination
  store_id: number;
  store_name?: string;
  warehouse_id: number;
  warehouse_name?: string;

  // Transport
  transporter_id: number;
  transporter_name?: string;
  driver_name: string;
  driver_id_number: string;
  truck_plate_number: string;
  waybill_number: string;

  // Quantity
  authorized_quantity: number;

  // Driver confirmation
  driver_confirmed_at?: string | null;
  driver_confirmed_by_name?: string | null;

  // Linked documents
  inspection_id?: number | null;
  grn_id?: number | null;
  grn_reference_no?: string | null;
  grn_status?: string | null;

  // Audit
  created_by_name?: string;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReceiptAuthorizationPayload {
  receipt_order_id: number;
  receipt_order_assignment_id?: number | null;
  store_id: number;
  transporter_id: number;
  authorized_quantity: number;
  driver_name: string;
  driver_id_number: string;
  truck_plate_number: string;
  waybill_number: string;
}

export interface UpdateReceiptAuthorizationPayload {
  transporter_id?: number;
  authorized_quantity?: number;
  driver_name?: string;
  driver_id_number?: string;
  truck_plate_number?: string;
  waybill_number?: string;
}

export interface ReceiptAuthorizationFilters {
  receipt_order_id?: number;
  warehouse_id?: number;
  store_id?: number;
  status?: 'pending' | 'active' | 'closed' | 'cancelled';
}

// ── API functions ─────────────────────────────────────────────────────────

export async function getReceiptAuthorizations(
  filters?: ReceiptAuthorizationFilters
): Promise<ReceiptAuthorization[]> {
  const response = await apiClient.get('/receipt_authorizations', { params: filters });
  const rows = Array.isArray(response.data) ? response.data : response.data.data || [];
  return rows as ReceiptAuthorization[];
}

export async function getReceiptAuthorization(id: number): Promise<ReceiptAuthorization> {
  const response = await apiClient.get(`/receipt_authorizations/${id}`);
  return (response.data.data || response.data) as ReceiptAuthorization;
}

export async function createReceiptAuthorization(
  payload: CreateReceiptAuthorizationPayload
): Promise<ReceiptAuthorization> {
  const response = await apiClient.post('/receipt_authorizations', { payload });
  return (response.data.data || response.data) as ReceiptAuthorization;
}

export async function updateReceiptAuthorization(
  id: number,
  payload: UpdateReceiptAuthorizationPayload
): Promise<ReceiptAuthorization> {
  const response = await apiClient.patch(`/receipt_authorizations/${id}`, { payload });
  return (response.data.data || response.data) as ReceiptAuthorization;
}

export async function cancelReceiptAuthorization(id: number): Promise<ReceiptAuthorization> {
  const response = await apiClient.post(`/receipt_authorizations/${id}/cancel`);
  return (response.data.data || response.data) as ReceiptAuthorization;
}

export async function driverConfirm(id: number): Promise<ReceiptAuthorization> {
  const response = await apiClient.post(`/receipt_authorizations/${id}/driver_confirm`);
  return (response.data.data || response.data) as ReceiptAuthorization;
}
