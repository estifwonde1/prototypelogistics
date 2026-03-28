import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { BinCardEntry } from '../types/reports';

export interface BinCardFilters {
  store_id?: number;
  stack_id?: number;
  from?: string;
  to?: string;
}

export const getBinCardReport = async (filters: BinCardFilters = {}): Promise<BinCardEntry[]> => {
  const response = await apiClient.get<ApiResponse<BinCardEntry[]>>('/reports/bin_card', { params: filters });
  return response.data.data;
};
