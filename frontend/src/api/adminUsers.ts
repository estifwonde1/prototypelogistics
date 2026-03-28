import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { AdminUser } from '../types/admin';

export interface AdminUserFilters {
  warehouse_id?: number;
  hub_id?: number;
  store_id?: number;
  role_name?: string;
}

export interface AdminUserPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  password?: string;
  password_confirmation?: string;
  role_name?: string;
  role_names?: string[];
  active?: boolean;
}

export const getAdminUsers = async (filters: AdminUserFilters = {}): Promise<AdminUser[]> => {
  const response = await apiClient.get<ApiResponse<{ users: AdminUser[] }>>('/admin/users', {
    params: filters,
  });
  return response.data.data.users;
};

export const createAdminUser = async (payload: AdminUserPayload): Promise<AdminUser> => {
  const response = await apiClient.post<ApiResponse<{ user: AdminUser }>>('/admin/users', { payload });
  return response.data.data.user;
};

export const updateAdminUser = async (id: number, payload: AdminUserPayload): Promise<AdminUser> => {
  const response = await apiClient.patch<ApiResponse<{ user: AdminUser }>>(`/admin/users/${id}`, { payload });
  return response.data.data.user;
};

export const deleteAdminUser = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/users/${id}`);
};
