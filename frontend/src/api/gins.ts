import apiClient from './client';
import type { Gin, GinItem } from '../types/gin';
import type { ApiResponse } from '../types/common';
import { toCreateGinRequest, type CreateGinRequest } from '../contracts/documents';
import { unwrapData } from '../utils/apiSuccess';

export interface StackAllocationPayload {
  stack_id: number;
  quantity: number;
  commodity_id: number;
  commodity_grade?: string;
}

export const getGins = async (params?: {
  warehouse_id?: number;
  dispatch_order_id?: number;
  dispatch_order_authorization_id?: number;
}): Promise<Gin[]> => {
  const response = await apiClient.get('/gins', { params });
  return unwrapData<Gin[]>(response);
};

export const getGin = async (id: number): Promise<Gin> => {
  const response = await apiClient.get(`/gins/${id}`);
  return unwrapData<Gin>(response);
};

export const createGin = async (
  data: CreateGinRequest | (Partial<Gin> & { items?: GinItem[] })
): Promise<Gin> => {
  const response = await apiClient.post<ApiResponse<Gin>>('/gins', { payload: toCreateGinRequest(data) });
  return response.data.data;
};

export const confirmGin = async (id: number, idempotencyKey?: string): Promise<Gin> => {
  const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
  const response = await apiClient.post(`/gins/${id}/confirm`, {}, { headers });
  return unwrapData<Gin>(response);
};

export async function postGinStackAllocations(
  ginId: number,
  allocations: StackAllocationPayload[]
): Promise<unknown[]> {
  const res = await apiClient.post(`/gins/${ginId}/stack_allocations`, {
    payload: { allocations },
  });
  return unwrapData<unknown[]>(res);
}
