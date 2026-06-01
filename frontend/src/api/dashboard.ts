import apiClient from './client';
import type { ApiResponse } from '../types/common';

export interface OfficerDashboardSummary {
  hubs_count: number;
  warehouses_count: number;
  /** Map of status string → count, e.g. { "Draft": 3, "Confirmed": 9 } */
  receipt_orders: Record<string, number>;
  dispatch_orders: Record<string, number>;
}

export const getOfficerDashboard = async (): Promise<OfficerDashboardSummary> => {
  const response = await apiClient.get<ApiResponse<OfficerDashboardSummary>>('/dashboard/officer');
  return response.data.data;
};
