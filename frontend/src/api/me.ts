import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { OfficerAssignment } from '../store/authStore';

export const getMyAssignments = async (): Promise<OfficerAssignment[]> => {
  const response = await apiClient.get<ApiResponse<{ assignments: OfficerAssignment[] }>>('/me/assignments');
  return response.data.data.assignments ?? [];
};

export interface StorekeeperStore {
  id: number;
  name: string;
  warehouse_id: number;
  warehouse_name: string;
}

export const getStorekeeperStores = async (): Promise<StorekeeperStore[]> => {
  const response = await apiClient.get<ApiResponse<{ stores: StorekeeperStore[] }>>('/me/storekeeper_stores');
  return response.data.data.stores ?? [];
};

export const postRoleSwitch = async (params: {
  assignment_id: number;
  from_role: string | null;
  to_role: string;
  facility_name: string;
}): Promise<void> => {
  await apiClient.post('/me/switch_role', { payload: params });
};
