import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { AdminRole } from '../types/admin';

export const getAdminRoles = async (): Promise<AdminRole[]> => {
  const response = await apiClient.get<ApiResponse<{ roles: AdminRole[] }>>('/admin/roles');
  return response.data.data.roles;
};
