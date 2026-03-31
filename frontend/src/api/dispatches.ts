import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { Dispatch } from '../types/dispatches';

export interface CreateDispatchPayload {
  reference_no: string;
  dispatch_plan_item_id: number;
  transporter_id: number;
  plate_no: string;
  driver_name: string;
  driver_phone: string;
  quantity: number;
  unit_id: number;
  commodity_status?: string;
  remark?: string;
  prepared_by_id: number;
  dispatch_status?: string;
}

export const getDispatches = async (): Promise<Dispatch[]> => {
  const response = await apiClient.get<ApiResponse<Dispatch[]>>('/dispatches');
  return response.data.data;
};

export const getDispatch = async (id: number): Promise<Dispatch> => {
  const response = await apiClient.get<ApiResponse<Dispatch>>(`/dispatches/${id}`);
  return response.data.data;
};

export const createDispatch = async (payload: CreateDispatchPayload): Promise<Dispatch> => {
  const response = await apiClient.post<ApiResponse<Dispatch>>('/dispatches', { payload });
  return response.data.data;
};
