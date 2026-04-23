import apiClient from './client';
import type { LoginRequest, LoginResponse } from '../types/auth';
import type { ApiResponse } from '../types/common';

export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', {
    payload: credentials,
  });
  const payload = response.data.data;

  if (!payload.token || !payload.user_id) {
    throw new Error('The backend returned an invalid login contract.');
  }

  return payload;
};
