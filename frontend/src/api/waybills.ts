import apiClient from './client';
import type { Waybill, WaybillItem, WaybillTransport } from '../types/waybill';
import type { ApiResponse } from '../types/common';
import { toCreateWaybillRequest, type CreateWaybillRequest } from '../contracts/documents';

export const getWaybills = async (): Promise<Waybill[]> => {
  const response = await apiClient.get<ApiResponse<Waybill[]>>('/waybills');
  return response.data.data;
};

export const getWaybill = async (id: number): Promise<Waybill> => {
  const response = await apiClient.get<ApiResponse<Waybill>>(`/waybills/${id}`);
  return response.data.data;
};

export const createWaybill = async (
  data: CreateWaybillRequest | (Partial<Waybill> & { items?: WaybillItem[]; transport?: WaybillTransport })
): Promise<Waybill> => {
  const response = await apiClient.post<ApiResponse<Waybill>>('/waybills', {
    payload: toCreateWaybillRequest(data),
  });
  return response.data.data;
};

export const confirmWaybill = async (id: number): Promise<Waybill> => {
  const response = await apiClient.post<ApiResponse<Waybill>>(`/waybills/${id}/confirm`);
  return response.data.data;
};
