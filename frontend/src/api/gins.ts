import apiClient from './client';
import type { Gin, GinItem } from '../types/gin';
import type { ApiResponse } from '../types/common';
import { toCreateGinRequest, type CreateGinRequest } from '../contracts/documents';

export const getGins = async (params?: { warehouse_id?: number }): Promise<Gin[]> => {
  const response = await apiClient.get<ApiResponse<Gin[]>>('/gins', { params });
  return response.data.data;
};

export const getGin = async (id: number): Promise<Gin> => {
  const response = await apiClient.get<ApiResponse<Gin>>(`/gins/${id}`);
  return response.data.data;
};

export const createGin = async (
  data: CreateGinRequest | (Partial<Gin> & { items?: GinItem[] })
): Promise<Gin> => {
  const response = await apiClient.post<ApiResponse<Gin>>('/gins', { payload: toCreateGinRequest(data) });
  return response.data.data;
};

export const confirmGin = async (id: number): Promise<Gin> => {
  const response = await apiClient.post<ApiResponse<Gin>>(`/gins/${id}/confirm`);
  return response.data.data;
};
