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
  receipt_order_line_id?: number | null;

  // Destination (store may be unset until downstream assignment)
  store_id: number | null;
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

  // Quantity (canonical, in receipt-order line unit — used for allocation math)
  authorized_quantity: number;

  /**
   * Quantity exactly as typed by whoever last set it on the RA (e.g. 30 when the
   * user picked Kuntal). Display this everywhere the RA appears so downstream
   * users see the same unit the hub manager (or last editor) actually entered.
   * Falls back to `authorized_quantity` for legacy rows where the API didn't
   * record an explicit input.
   */
  authorized_quantity_input?: number | null;
  authorized_quantity_input_unit_id?: number | null;
  authorized_quantity_input_unit_name?: string | null;
  authorized_quantity_input_unit_abbreviation?: string | null;

  // Commodity info (from receipt order lines)
  commodity_id?: number | null;
  commodity_name?: string | null;
  unit_id?: number | null;
  /** Human-readable UOM name (e.g. Kuntal); preferred for display over abbreviation. */
  unit_label?: string | null;
  /** Unit abbreviation from hub line (legacy field name `unit_name` mirrors this). */
  unit_name?: string | null;
  unit_abbreviation?: string | null;

  packaging_unit_id?: number | null;
  packaging_unit_name?: string | null;
  packaging_unit_abbreviation?: string | null;
  packaging_size?: number | string | null;
  /** Package count after UOM conversion (see API); null when not computable. */
  expected_packaging_units?: number | null;
  /** e.g. "50 kg per BAG" — packaging_size is in this per-container unit. */
  packaging_spec_label?: string | null;

  // Driver confirmation
  driver_confirmed_at?: string | null;
  driver_confirmed_by_name?: string | null;

  // Linked documents
  inspection_id?: number | null;
  total_received?: number;
  inspections_count?: number;
  my_inspection?: { id: number; total_received: number; quality_status?: string; created_at: string } | null;
  my_grn?: { id: number; reference_no?: string; status: string } | null;
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
  /** Required for multi-line orders when not using a warehouse assignment row */
  receipt_order_line_id?: number | null;
  /** Hub direct routing when bypassing planned allocation (no assignment id) */
  warehouse_id?: number | null;
  /** Omit at creation when authorizing inbound to a warehouse allocation only */
  store_id?: number | null;
  /** Prefer with hub UI free-text entry; alternatively send transporter_id for master-list clients */
  transporter_id?: number;
  transporter_name?: string;
  /** Canonical quantity in receipt-order line unit (drives allocation math). */
  authorized_quantity: number;
  /** Quantity as typed by the user — preserved for downstream display. */
  authorized_quantity_input?: number;
  /** UOM id the user picked when entering the quantity. */
  authorized_quantity_input_unit_id?: number;
  driver_name: string;
  driver_id_number: string;
  truck_plate_number: string;
  /** Optional: backend auto-generates when omitted/blank */
  waybill_number?: string;
  /** When routing via warehouse_id: notify staff on planned warehouse rows (advisory) */
  notify_planned_facilities?: boolean;
}

export interface UpdateReceiptAuthorizationPayload {
  transporter_id?: number;
  transporter_name?: string;
  authorized_quantity?: number;
  authorized_quantity_input?: number;
  authorized_quantity_input_unit_id?: number;
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

export async function driverConfirm(id: number, inspectionId?: number): Promise<ReceiptAuthorization> {
  const body = inspectionId ? { inspection_id: inspectionId } : {};
  const response = await apiClient.post(`/receipt_authorizations/${id}/driver_confirm`, body);
  return (response.data.data || response.data) as ReceiptAuthorization;
}
