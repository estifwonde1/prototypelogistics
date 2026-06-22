import apiClient from './client';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuthorizationStore {
  id?: number;
  store_id: number;
  store_name?: string;
  commodity_id: number;
  commodity_name?: string;
  authorized_quantity: number;
  base_quantity?: number | null;
  dispatched_quantity?: number;
  remaining_quantity?: number | null;
}

export interface DispatchOrderAuthorization {
  id: number;
  reference_no: string;
  status: 'draft' | 'confirmed' | 'cancelled';

  dispatch_order_id: number;
  dispatch_order_reference_no?: string;

  warehouse_id: number;
  warehouse_name?: string;

  commodity_id?: number | null;
  commodity_name?: string | null;

  transporter_id?: number | null;
  transporter_name?: string | null;

  authorized_quantity: number;
  authorized_quantity_input?: number | null;
  authorized_quantity_input_unit_id?: number | null;
  authorized_quantity_input_unit_name?: string | null;
  authorized_quantity_input_unit_abbreviation?: string | null;

  driver_name: string;
  driver_id_number: string;
  driver_phone?: string | null;
  truck_plate_number: string;

  driver_confirmed_at?: string | null;
  driver_confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  assigned_storekeeper_name?: string | null;
  assigned_storekeeper_at?: string | null;
  awaiting_storekeeper_assignment?: boolean;
  my_gin?: any | null; // We can use the Gin type if imported, or any

  confirmed_by_name?: string | null;
  cancelled_at?: string | null;
  created_by_name?: string | null;

  authorization_stores?: AuthorizationStore[];

  created_at: string;
  updated_at: string;
}

export interface CreateDispatchOrderAuthorizationPayload {
  dispatch_order_id: number;
  warehouse_id: number;
  commodity_id?: number | null;
  transporter_id?: number | null;
  transporter_name?: string;
  authorized_quantity: number;
  authorized_quantity_input_unit_id?: number | null;
  driver_name: string;
  driver_id_number: string;
  driver_phone?: string;
  truck_plate_number: string;
  authorization_stores?: Omit<AuthorizationStore, 'id' | 'store_name' | 'commodity_name' | 'dispatched_quantity'>[];
}

export interface UpdateDispatchOrderAuthorizationPayload
  extends Partial<Omit<CreateDispatchOrderAuthorizationPayload, 'dispatch_order_id' | 'warehouse_id'>> {}

export interface DispatchOrderAuthorizationFilters {
  dispatch_order_id?: number;
  warehouse_id?: number;
  hub_id?: number;
  status?: 'draft' | 'confirmed' | 'cancelled';
}

// ── API functions ─────────────────────────────────────────────────────────

export async function getDispatchOrderAuthorizations(
  filters?: DispatchOrderAuthorizationFilters
): Promise<DispatchOrderAuthorization[]> {
  const response = await apiClient.get('/dispatch_order_authorizations', { params: filters });
  const rows = Array.isArray(response.data) ? response.data : response.data.data || [];
  return rows as DispatchOrderAuthorization[];
}

export async function getDispatchOrderAuthorization(id: number): Promise<DispatchOrderAuthorization> {
  const response = await apiClient.get(`/dispatch_order_authorizations/${id}`);
  return (response.data.data || response.data) as DispatchOrderAuthorization;
}

export async function createDispatchOrderAuthorization(
  payload: CreateDispatchOrderAuthorizationPayload
): Promise<DispatchOrderAuthorization> {
  const response = await apiClient.post('/dispatch_order_authorizations', { payload });
  return (response.data.data || response.data) as DispatchOrderAuthorization;
}

export async function updateDispatchOrderAuthorization(
  id: number,
  payload: UpdateDispatchOrderAuthorizationPayload
): Promise<DispatchOrderAuthorization> {
  const response = await apiClient.patch(`/dispatch_order_authorizations/${id}`, { payload });
  return (response.data.data || response.data) as DispatchOrderAuthorization;
}

export async function confirmDispatchOrderAuthorization(id: number): Promise<DispatchOrderAuthorization> {
  const response = await apiClient.post(`/dispatch_order_authorizations/${id}/confirm`);
  return (response.data.data || response.data) as DispatchOrderAuthorization;
}

export async function cancelDispatchOrderAuthorization(id: number): Promise<DispatchOrderAuthorization> {
  const response = await apiClient.post(`/dispatch_order_authorizations/${id}/cancel`);
  return (response.data.data || response.data) as DispatchOrderAuthorization;
}

export async function getAssignableStorekeepers(warehouseId: number): Promise<any[]> {
  const response = await apiClient.get('/dispatch_order_authorizations/assignable_storekeepers', {
    params: { warehouse_id: warehouseId },
  });
  return response.data.data?.storekeepers || response.data.storekeepers || [];
}

export async function assignStorekeeperToDa(
  id: number,
  payload: { storekeeper_user_id: number; store_id?: number }
): Promise<DispatchOrderAuthorization> {
  const response = await apiClient.post(`/dispatch_order_authorizations/${id}/assign_storekeeper`, { payload });
  return (response.data.data || response.data) as DispatchOrderAuthorization;
}
