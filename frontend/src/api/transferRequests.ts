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
    unit_id?: number;
    unit_name?: string;
    unit_abbreviation?: string;
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
  entered_unit?: {
    id: number;
    name: string;
    abbreviation: string;
  };
  entered_quantity?: number;
  package_count?: number;
  packaging_spec_label?: string;
  quantity: number;
  fulfilled_quantity?: number;
  rejected_quantity?: number;
  remaining_quantity?: number;
  reserved_quantity?: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected';
  allocations?: TransferRequestAllocation[];
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

export const getTransferRequest = async (id: number): Promise<TransferRequest> => {
  const response = await apiClient.get<ApiResponse<TransferRequest>>(`/transfer_requests/${id}`);
  return response.data.data;
};

export const createTransferRequest = async (data: {
  source_stack_id: number;
  destination_store_id: number;
  quantity: number;
  reason: string;
  entered_unit_id?: number;
  entered_quantity?: number;
  package_count?: number;
}): Promise<TransferRequest> => {
  const response = await apiClient.post<ApiResponse<TransferRequest>>(
    '/transfer_requests',
    data
  );
  return response.data.data;
};

export const approveTransferRequest = async (
  id: number,
  data: {
    destination_stack_id?: number;
    notes?: string;
    quantity?: number;
    entered_unit_id?: number;
    entered_quantity?: number;
    package_count?: number;
  }
): Promise<TransferRequest> => {
  const response = await apiClient.post<ApiResponse<TransferRequest>>(
    `/transfer_requests/${id}/approve`,
    data
  );
  return response.data.data;
};

export interface TransferRequestAllocation {
  id: number;
  action: 'fulfillment' | 'rejection';
  quantity: number;
  entered_quantity?: number;
  package_count?: number;
  notes?: string;
  created_at: string;
  stack_transaction_id?: number;
  released_to_source_stack?: boolean;
  source_stack?: {
    id: number;
    code: string;
  };
  destination_store?: {
    id: number;
    name: string;
    code?: string;
  };
  entered_unit?: {
    id: number;
    name: string;
    abbreviation: string;
  };
  destination_stack?: {
    id: number;
    code: string;
    store_name?: string;
    store_id?: number;
  };
  reviewed_by?: {
    id: number;
    name: string;
    email: string;
  };
}

export const rejectTransferRequest = async (
  id: number,
  data: {
    notes: string;
    quantity?: number;
    entered_unit_id?: number;
    entered_quantity?: number;
  }
): Promise<TransferRequest> => {
  const response = await apiClient.post<ApiResponse<TransferRequest>>(
    `/transfer_requests/${id}/reject`,
    data
  );
  return response.data.data;
};
