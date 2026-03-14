import apiClient from './client';
import type { StockBalance } from '../types/stockBalance';
import type { ApiResponse } from '../types/common';

export const getStockBalances = async (): Promise<StockBalance[]> => {
  const response = await apiClient.get<ApiResponse<StockBalance[]>>('/stock_balances');
  return response.data.data;
};

export const getStockBalance = async (id: number): Promise<StockBalance> => {
  const response = await apiClient.get<ApiResponse<StockBalance>>(`/stock_balances/${id}`);
  return response.data.data;
};
