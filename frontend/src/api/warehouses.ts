import apiClient from './client';
import type { Warehouse } from '../types/warehouse';
import type { ApiResponse } from '../types/common';

export const getWarehouses = async (): Promise<Warehouse[]> => {
  const response = await apiClient.get<ApiResponse<Warehouse[]>>('/warehouses');
  return response.data.data;
};

export const getWarehouse = async (id: number): Promise<Warehouse> => {
  const response = await apiClient.get<ApiResponse<Warehouse>>(`/warehouses/${id}`);
  return response.data.data;
};

export const createWarehouse = async (data: Partial<Warehouse>): Promise<Warehouse> => {
  const response = await apiClient.post<ApiResponse<Warehouse>>('/warehouses', { payload: data });
  return response.data.data;
};

export const updateWarehouse = async (id: number, data: Partial<Warehouse>): Promise<Warehouse> => {
  const response = await apiClient.put<ApiResponse<Warehouse>>(`/warehouses/${id}`, { payload: data });
  return response.data.data;
};

export const deleteWarehouse = async (id: number): Promise<void> => {
  await apiClient.delete(`/warehouses/${id}`);
};
