import apiClient from './client';
import type { Store } from '../types/store';
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
