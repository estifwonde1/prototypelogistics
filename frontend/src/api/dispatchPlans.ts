import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type {
  ApproveDispatchPlanPayload,
  CreateDispatchPlanPayload,
  DispatchPlan,
  UpdateDispatchPlanPayload,
} from '../types/dispatchPlan';

export const getDispatchPlans = async (): Promise<DispatchPlan[]> => {
  const response = await apiClient.get<ApiResponse<DispatchPlan[]>>('/dispatch_plans');
  return response.data.data;
};

export const getDispatchPlan = async (id: number): Promise<DispatchPlan> => {
  const response = await apiClient.get<ApiResponse<DispatchPlan>>(`/dispatch_plans/${id}`);
  return response.data.data;
};

export const createDispatchPlan = async (payload: CreateDispatchPlanPayload): Promise<DispatchPlan> => {
  const response = await apiClient.post<ApiResponse<DispatchPlan>>('/dispatch_plans', { payload });
  return response.data.data;
};

export const updateDispatchPlan = async (id: number, payload: UpdateDispatchPlanPayload): Promise<DispatchPlan> => {
  const response = await apiClient.patch<ApiResponse<DispatchPlan>>(`/dispatch_plans/${id}`, { payload });
  return response.data.data;
};

export const approveDispatchPlan = async (id: number, payload: ApproveDispatchPlanPayload): Promise<DispatchPlan> => {
  const response = await apiClient.post<ApiResponse<DispatchPlan>>(`/dispatch_plans/${id}/approve`, { payload });
  return response.data.data;
};
