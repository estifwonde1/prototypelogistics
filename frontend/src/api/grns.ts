import apiClient from './client';
import type { Grn } from '../types/grn';
import type { ApiResponse } from '../types/common';

export const getGrns = async (): Promise<Grn[]> => {
  const response = await apiClient.get<ApiResponse<Grn[]>>('/grns');
  return response.data.data;
};

export const getGrn = async (id: number): Promise<Grn> => {
  const response = await apiClient.get<ApiResponse<Grn>>(`/grns/${id}`);
  return response.data.data;
};

export const createGrn = async (data: Partial<Grn>): Promise<Grn> => {
  const response = await apiClient.post<ApiResponse<Grn>>('/grns', { payload: data });
  return response.data.data;
};

export const confirmGrn = async (id: number): Promise<Grn> => {
  const response = await apiClient.post<ApiResponse<Grn>>(`/grns/${id}/confirm`);
  return response.data.data;
};
