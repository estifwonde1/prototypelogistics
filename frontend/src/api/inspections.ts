import apiClient from './client';
import type { Inspection, InspectionItem } from '../types/inspection';
import type { ApiResponse } from '../types/common';
import { toCreateInspectionRequest, type CreateInspectionRequest } from '../contracts/documents';

export const getInspections = async (): Promise<Inspection[]> => {
  const response = await apiClient.get<ApiResponse<Inspection[]>>('/inspections');
  return response.data.data;
};

export const getInspection = async (id: number): Promise<Inspection> => {
  const response = await apiClient.get<ApiResponse<Inspection>>(`/inspections/${id}`);
  return response.data.data;
};

export const createInspection = async (
  data: CreateInspectionRequest | (Partial<Inspection> & { items?: InspectionItem[] })
): Promise<Inspection> => {
  const response = await apiClient.post<ApiResponse<Inspection>>('/inspections', {
    payload: toCreateInspectionRequest(data),
  });
  return response.data.data;
};

export const confirmInspection = async (id: number): Promise<Inspection> => {
  const response = await apiClient.post<ApiResponse<Inspection>>(`/inspections/${id}/confirm`);
  return response.data.data;
};
