import apiClient from './client';
import type { Store, Storekeeper } from '../types/store';
import type { ApiResponse } from '../types/common';

export const getStores = async (params?: { warehouse_id?: number }): Promise<Store[]> => {
  const response = await apiClient.get<ApiResponse<Store[]>>('/stores', { params });
  return response.data.data;
};

export const getStore = async (id: number): Promise<Store> => {
  const response = await apiClient.get<ApiResponse<Store>>(`/stores/${id}`);
  return response.data.data;
};

export const createStore = async (data: Partial<Store>): Promise<Store> => {
  const response = await apiClient.post<ApiResponse<Store>>('/stores', { payload: data });
  return response.data.data;
};

export const updateStore = async (id: number, data: Partial<Store>): Promise<Store> => {
  const response = await apiClient.put<ApiResponse<Store>>(`/stores/${id}`, { payload: data });
  return response.data.data;
};

export const deleteStore = async (id: number): Promise<void> => {
  await apiClient.delete(`/stores/${id}`);
};

export const getStoreStorekeepers = async (): Promise<Storekeeper[]> => {
  const response = await apiClient.get<ApiResponse<{ storekeepers: Storekeeper[] }>>('/stores/storekeepers');
  return response.data.data.storekeepers;
};

export const assignStorekeeper = async (
  storeId: number,
  data: { user_id: number; store_ids?: number[] }
): Promise<{ assignment_type: string; store_ids: number[] }> => {
  const response = await apiClient.post<ApiResponse<{ assignment_type: string; store_ids: number[] }>>(
    `/stores/${storeId}/assign_storekeeper`,
    data
  );
  return response.data.data;
};
