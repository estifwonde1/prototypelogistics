import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { AdminRole } from '../types/admin';

export const getAdminRoles = async (): Promise<AdminRole[]> => {
  const response = await apiClient.get<ApiResponse<{ roles: AdminRole[] }>>('/admin/roles');
  return response.data.data.roles;
};

export const createAdminRole = async (name: string): Promise<AdminRole> => {
  const response = await apiClient.post<ApiResponse<{ role: AdminRole }>>('/admin/roles', {
    role: { name },
  });
  return response.data.data.role;
};

export const deleteAdminRole = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/roles/${id}`);
};
