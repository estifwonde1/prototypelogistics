import apiClient from './client';
import type { Gin } from '../types/gin';
import type { ApiResponse } from '../types/common';

export const getGins = async (): Promise<Gin[]> => {
  const response = await apiClient.get<ApiResponse<Gin[]>>('/gins');
  return response.data.data;
};

export const getGin = async (id: number): Promise<Gin> => {
  const response = await apiClient.get<ApiResponse<Gin>>(`/gins/${id}`);
  return response.data.data;
};

export const createGin = async (data: Partial<Gin>): Promise<Gin> => {
  const response = await apiClient.post<ApiResponse<Gin>>('/gins', { payload: data });
  return response.data.data;
};

export const confirmGin = async (id: number): Promise<Gin> => {
  const response = await apiClient.post<ApiResponse<Gin>>(`/gins/${id}/confirm`);
  return response.data.data;
};
