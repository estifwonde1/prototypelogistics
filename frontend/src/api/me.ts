import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { OfficerAssignment } from '../store/authStore';

export interface UserProfile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  roles: string[];
}

export const MY_PROFILE_QUERY_KEY = ['my-profile'];

export const getMyAssignments = async (): Promise<OfficerAssignment[]> => {
  const response = await apiClient.get<ApiResponse<{ assignments: OfficerAssignment[] }>>('/me/assignments');
  return response.data.data.assignments ?? [];
};

export const getMyProfile = async (): Promise<UserProfile> => {
  const response = await apiClient.get<ApiResponse<{ profile: UserProfile }>>('/me/profile');
  return response.data.data.profile;
};

export const updateMyProfile = async (payload: { phone_number: string }): Promise<UserProfile> => {
  const response = await apiClient.patch<ApiResponse<{ profile: UserProfile }>>('/me/profile', { payload });
  return response.data.data.profile;
};

export const changeMyPassword = async (payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<void> => {
  await apiClient.patch('/me/password', { payload });
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
