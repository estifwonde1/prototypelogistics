import apiClient from './client';
import type { Inspection } from '../types/inspection';
import type { ApiResponse } from '../types/common';

export const getInspections = async (): Promise<Inspection[]> => {
  const response = await apiClient.get<ApiResponse<Inspection[]>>('/inspections');
  return response.data.data;
};

export const getInspection = async (id: number): Promise<Inspection> => {
  const response = await apiClient.get<ApiResponse<Inspection>>(`/inspections/${id}`);
  return response.data.data;
};

export const createInspection = async (data: Partial<Inspection>): Promise<Inspection> => {
  const response = await apiClient.post<ApiResponse<Inspection>>('/inspections', { payload: data });
  return response.data.data;
};

export const confirmInspection = async (id: number): Promise<Inspection> => {
  const response = await apiClient.post<ApiResponse<Inspection>>(`/inspections/${id}/confirm`);
  return response.data.data;
};
