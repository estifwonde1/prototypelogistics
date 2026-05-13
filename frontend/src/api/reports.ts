import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { BinCardEntry } from '../types/reports';

export interface BinCardFilters {
  store_id?: number;
  stack_id?: number;
  /** Comma-separated or repeated param; backend accepts both */
  stack_ids?: number[] | string;
  commodity_id?: number;
  batch_no?: string;
  inventory_lot_id?: number;
  include_null_inventory_lot?: boolean;
  /** When true with include_null + stack_ids, skip inventory-lot resolution (orphan bin card) */
  omit_lot_filter?: boolean;
  from?: string;
  to?: string;
}

export const getBinCardReport = async (filters: BinCardFilters = {}): Promise<BinCardEntry[]> => {
  const { stack_ids, ...rest } = filters;
  const params: Record<string, unknown> = { ...rest };
  if (Array.isArray(stack_ids) && stack_ids.length) {
    params.stack_ids = stack_ids.join(',');
  } else if (typeof stack_ids === 'string' && stack_ids.length) {
    params.stack_ids = stack_ids;
  }
  const response = await apiClient.get<ApiResponse<BinCardEntry[]>>('/reports/bin_card', { params });
  return response.data.data;
};
