import apiClient from './client';
import type { ApiResponse } from '../types/common';

export interface TransferRequest {
  id: number;
  source_store: {
    id: number;
    name: string;
    code: string;
  };
  destination_store: {
    id: number;
    name: string;
    code: string;
  };
  source_stack: {
    id: number;
    code: string;
    quantity: number;
  };
  destination_stack?: {
    id: number;
    code: string;
    quantity: number;
  };
  commodity: {
    id: number;
    name: string;
    code: string;
  };
  unit: {
    id: number;
    name: string;
    abbreviation: string;
  };
  quantity: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected';
  requested_by: {
    id: number;
    name: string;
    email: string;
  };
  reviewed_by?: {
    id: number;
    name: string;
    email: string;
  };
  reviewed_at?: string;
  review_notes?: string;
  warehouse_id: number;
  created_at: string;
  updated_at: string;
}

export const getTransferRequests = async (status?: string): Promise<TransferRequest[]> => {
  const params = status ? { status } : {};
  const response = await apiClient.get<ApiResponse<TransferRequest[]>>('/transfer_requests', {
    params,
  });
  return response.data.data;
};

export const createTransferRequest = async (data: {
  source_stack_id: number;
  destination_store_id: number;
  quantity: number;
  reason: string;
}): Promise<TransferRequest> => {
  const response = await apiClient.post<ApiResponse<TransferRequest>>(
    '/transfer_requests',
    data
  );
  return response.data.data;
};

export const approveTransferRequest = async (
  id: number,
  data: { destination_stack_id?: number; notes?: string }
): Promise<TransferRequest> => {
  const response = await apiClient.post<ApiResponse<TransferRequest>>(
    `/transfer_requests/${id}/approve`,
    data
  );
  return response.data.data;
};

export const rejectTransferRequest = async (
  id: number,
  notes: string
): Promise<TransferRequest> => {
  const response = await apiClient.post<ApiResponse<TransferRequest>>(
    `/transfer_requests/${id}/reject`,
    { notes }
  );
  return response.data.data;
};
