import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { AdminUserAssignment } from '../types/admin';

export interface AssignmentFilters {
  role_name?: string;
  user_id?: number;
  hub_id?: number;
  warehouse_id?: number;
  store_id?: number;
  location_id?: number;
}

export interface AssignmentPayload {
  user_id: number;
  role_name: string;
  hub_ids?: number[];
  warehouse_ids?: number[];
  store_ids?: number[];
  location_ids?: number[];
}

export const getAssignments = async (filters: AssignmentFilters = {}): Promise<AdminUserAssignment[]> => {
  const response = await apiClient.get<ApiResponse<{ assignments: AdminUserAssignment[] }>>('/admin/user_assignments', {
    params: filters,
  });
  return response.data.data.assignments;
};

export const createAssignments = async (payload: AssignmentPayload): Promise<AdminUserAssignment[]> => {
  const response = await apiClient.post<ApiResponse<{ assignments: AdminUserAssignment[] }>>(
    '/admin/user_assignments',
    { payload }
  );
  return response.data.data.assignments;
};

export const bulkUpdateAssignments = async (payload: AssignmentPayload): Promise<AdminUserAssignment[]> => {
  const response = await apiClient.patch<ApiResponse<{ assignments: AdminUserAssignment[] }>>(
    '/admin/user_assignments/bulk',
    { payload }
  );
  return response.data.data.assignments;
};

export const deleteAssignment = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/user_assignments/${id}`);
};
