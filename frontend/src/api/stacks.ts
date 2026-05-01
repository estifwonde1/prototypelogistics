import apiClient from './client';
import type { Stack } from '../types/stack';
import type { ApiResponse } from '../types/common';

export const getStacks = async (params?: { store_id?: number; warehouse_id?: number }): Promise<Stack[]> => {
  const response = await apiClient.get<ApiResponse<Stack[]>>('/stacks', { params });
  return response.data.data;
};

export const getStack = async (id: number): Promise<Stack> => {
  const response = await apiClient.get<ApiResponse<Stack>>(`/stacks/${id}`);
  return response.data.data;
};

export const createStack = async (data: Partial<Stack>): Promise<Stack> => {
  const response = await apiClient.post<ApiResponse<Stack>>('/stacks', { payload: data });
  return response.data.data;
};

export const updateStack = async (id: number, data: Partial<Stack>): Promise<Stack> => {
  const response = await apiClient.put<ApiResponse<Stack>>(`/stacks/${id}`, { payload: data });
  return response.data.data;
};

export const deleteStack = async (id: number): Promise<void> => {
  await apiClient.delete(`/stacks/${id}`);
};

export const transferStack = async (
  sourceId: number,
  data: { destination_id: number; quantity: number }
): Promise<Stack> => {
  const response = await apiClient.post<ApiResponse<Stack>>(
    `/stacks/${sourceId}/transfer`,
    data
  );
  return response.data.data;
};
