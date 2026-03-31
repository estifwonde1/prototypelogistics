import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type {
  CreateDispatchPlanItemPayload,
  DispatchPlanItem,
  UpdateDispatchPlanItemPayload,
} from '../types/dispatchPlan';

export const getDispatchPlanItems = async (dispatchPlanId?: number): Promise<DispatchPlanItem[]> => {
  const response = await apiClient.get<ApiResponse<DispatchPlanItem[]>>('/dispatch_plan_items', {
    params: dispatchPlanId ? { dispatch_plan_id: dispatchPlanId } : undefined,
  });
  return response.data.data;
};

export const getDispatchPlanItem = async (id: number): Promise<DispatchPlanItem> => {
  const response = await apiClient.get<ApiResponse<DispatchPlanItem>>(`/dispatch_plan_items/${id}`);
  return response.data.data;
};

export const createDispatchPlanItem = async (payload: CreateDispatchPlanItemPayload): Promise<DispatchPlanItem> => {
  const response = await apiClient.post<ApiResponse<DispatchPlanItem>>('/dispatch_plan_items', { payload });
  return response.data.data;
};

export const updateDispatchPlanItem = async (id: number, payload: UpdateDispatchPlanItemPayload): Promise<DispatchPlanItem> => {
  const response = await apiClient.patch<ApiResponse<DispatchPlanItem>>(`/dispatch_plan_items/${id}`, { payload });
  return response.data.data;
};
