import apiClient from './client';
import { unwrapData } from '../utils/apiSuccess';
import type {
  CreateDispatchOrderAuthorizationPayload,
  DispatchOrderAuthorization,
  DispatchOrderAuthorizationExecution,
  LookupOption,
  UpdateDispatchOrderAuthorizationStoreSplitsPayload,
} from '../types/dispatchV2';

export interface CreateExecutionPayload {
  dispatch_order_authorization_store_id: number;
  quantity: number;
  commodity_grade?: string;
  inventory_lot_id?: number | null;
  shortage_reason?: string;
}

export async function getDispatchOrderAuthorizations(params?: {
  dispatch_order_id?: number;
  warehouse_id?: number;
  status?: string;
  storekeeper_scope?: boolean;
}): Promise<DispatchOrderAuthorization[]> {
  const res = await apiClient.get('/dispatch_order_authorizations', { params });
  return unwrapData<DispatchOrderAuthorization[]>(res);
}

export async function getDispatchOrderAuthorization(id: number): Promise<DispatchOrderAuthorization> {
  const res = await apiClient.get(`/dispatch_order_authorizations/${id}`);
  return unwrapData<DispatchOrderAuthorization>(res);
}

export async function createDispatchOrderAuthorization(
  payload: CreateDispatchOrderAuthorizationPayload
): Promise<DispatchOrderAuthorization> {
  const res = await apiClient.post('/dispatch_order_authorizations', { payload });
  return unwrapData<DispatchOrderAuthorization>(res);
}

export async function updateDispatchOrderAuthorizationStoreSplits(
  authId: number,
  payload: UpdateDispatchOrderAuthorizationStoreSplitsPayload
): Promise<DispatchOrderAuthorization> {
  const res = await apiClient.patch(`/dispatch_order_authorizations/${authId}/store_splits`, { payload });
  return unwrapData<DispatchOrderAuthorization>(res);
}

export async function confirmDispatchOrderAuthorization(id: number): Promise<DispatchOrderAuthorization> {
  const res = await apiClient.post(`/dispatch_order_authorizations/${id}/confirm`);
  return unwrapData<DispatchOrderAuthorization>(res);
}

export async function getDispatchOrderAuthorizationExecutions(
  authId: number,
  params?: { status?: string }
): Promise<DispatchOrderAuthorizationExecution[]> {
  const res = await apiClient.get(`/dispatch_order_authorizations/${authId}/executions`, { params });
  return unwrapData<DispatchOrderAuthorizationExecution[]>(res);
}

export async function createDispatchOrderAuthorizationExecution(
  authId: number,
  payload: CreateExecutionPayload
): Promise<DispatchOrderAuthorizationExecution> {
  const res = await apiClient.post(`/dispatch_order_authorizations/${authId}/executions`, { payload });
  return unwrapData<DispatchOrderAuthorizationExecution>(res);
}

export async function confirmDispatchOrderAuthorizationExecution(
  authId: number,
  executionId: number
): Promise<DispatchOrderAuthorizationExecution> {
  const res = await apiClient.post(
    `/dispatch_order_authorizations/${authId}/executions/${executionId}/confirm`
  );
  return unwrapData<DispatchOrderAuthorizationExecution>(res);
}

export async function driverConfirmDispatchOrderAuthorization(
  authId: number,
  payload?: { driver_phone?: string }
): Promise<{ gin_id: number; dispatch_order_authorization_id: number }> {
  const res = await apiClient.post(`/dispatch_order_authorizations/${authId}/driver_confirm`, {
    payload: payload ?? {},
  });
  return unwrapData<{ gin_id: number; dispatch_order_authorization_id: number }>(res);
}

export async function getAuthorizationStoresLookup(params: {
  warehouse_id: number;
  q?: string;
}): Promise<{ items: LookupOption[] }> {
  const res = await apiClient.get('/dispatch_order_authorizations/lookups/stores', { params });
  return unwrapData<{ items: LookupOption[] }>(res);
}

export async function getAuthorizationStacksLookup(params: {
  store_id: number;
  commodity_id: number;
}): Promise<{ items: (LookupOption & { available_quantity: number; commodity_id: number })[] }> {
  const res = await apiClient.get('/dispatch_order_authorizations/lookups/stacks', { params });
  return unwrapData<{ items: (LookupOption & { available_quantity: number; commodity_id: number })[] }>(res);
}
