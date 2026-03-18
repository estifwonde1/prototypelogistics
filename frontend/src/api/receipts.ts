import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { Receipt } from '../types/receipts';

export const getReceipts = async (): Promise<Receipt[]> => {
  const response = await apiClient.get<ApiResponse<Receipt[]>>('/receipts');
  return response.data.data;
};

export const getReceipt = async (id: number): Promise<Receipt> => {
  const response = await apiClient.get<ApiResponse<Receipt>>(`/receipts/${id}`);
  return response.data.data;
};
