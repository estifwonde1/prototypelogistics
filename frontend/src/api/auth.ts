import apiClient from './client';
import type { LoginRequest, LoginResponse } from '../types/auth';
import type { ApiResponse } from '../types/common';

export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', {
    payload: credentials,
  });
  return response.data.data;
};
