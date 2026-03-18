import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { Dispatch } from '../types/dispatches';

export const getDispatches = async (): Promise<Dispatch[]> => {
  const response = await apiClient.get<ApiResponse<Dispatch[]>>('/dispatches');
  return response.data.data;
};

export const getDispatch = async (id: number): Promise<Dispatch> => {
  const response = await apiClient.get<ApiResponse<Dispatch>>(`/dispatches/${id}`);
  return response.data.data;
};
