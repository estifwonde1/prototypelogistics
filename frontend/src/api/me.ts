import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { OfficerAssignment } from '../store/authStore';

export const getMyAssignments = async (): Promise<OfficerAssignment[]> => {
  const response = await apiClient.get<ApiResponse<{ assignments: OfficerAssignment[] }>>('/me/assignments');
  return response.data.data.assignments ?? [];
};
