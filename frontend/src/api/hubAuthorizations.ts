import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { CreateHubAuthorizationPayload, HubAuthorization } from '../types/dispatchPlan';

export const getHubAuthorizations = async (dispatchPlanItemId?: number): Promise<HubAuthorization[]> => {
  const response = await apiClient.get<ApiResponse<HubAuthorization[]>>('/hub_authorizations', {
    params: dispatchPlanItemId ? { dispatch_plan_item_id: dispatchPlanItemId } : undefined,
  });
  return response.data.data;
};

export const getHubAuthorization = async (id: number): Promise<HubAuthorization> => {
  const response = await apiClient.get<ApiResponse<HubAuthorization>>(`/hub_authorizations/${id}`);
  return response.data.data;
};

export const createHubAuthorization = async (payload: CreateHubAuthorizationPayload): Promise<HubAuthorization> => {
  const response = await apiClient.post<ApiResponse<HubAuthorization>>('/hub_authorizations', { payload });
  return response.data.data;
};
