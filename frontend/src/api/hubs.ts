import apiClient from './client';
import type { Hub } from '../types/hub';
import type { ApiResponse } from '../types/common';

export const getHubs = async (): Promise<Hub[]> => {
  const response = await apiClient.get<ApiResponse<Hub[]>>('/hubs');
  return response.data.data;
};

export const getHub = async (id: number): Promise<Hub> => {
  const response = await apiClient.get<ApiResponse<Hub>>(`/hubs/${id}`);
  return response.data.data;
};

export const createHub = async (data: Partial<Hub>): Promise<Hub> => {
  const response = await apiClient.post<ApiResponse<Hub>>('/hubs', { payload: data });
  return response.data.data;
};

export const updateHub = async (id: number, data: Partial<Hub>): Promise<Hub> => {
  const response = await apiClient.put<ApiResponse<Hub>>(`/hubs/${id}`, { payload: data });
  return response.data.data;
};

export const deleteHub = async (id: number): Promise<void> => {
  await apiClient.delete(`/hubs/${id}`);
};
