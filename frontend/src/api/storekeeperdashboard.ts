import apiClient from './client';

export interface DeliverySearchResult {
  type: string;
  reference_no: string;
  commodity: string;
  quantity: number;
  unit: string;
  source_location: string;
  expected_date: string;
  created_by: string;
  status: string;
  id: number;
  can_start_receipt: boolean;
}

export interface DeliverySearchResponse {
  results: DeliverySearchResult[];
  message: string;
}

export interface CompletedTransaction {
  type: string;
  reference_no: string;
  order_reference: string;
  completed_at: string;
  completed_by: string;
  status: string;
}

export interface StorekeeperDashboardData {
  receipt_assignments: any[];
  dispatch_assignments: any[];
  completed_transactions: CompletedTransaction[];
  activity: any[];
}

export async function searchDeliveryByReference(referenceNo: string): Promise<DeliverySearchResponse> {
  const response = await apiClient.post('/storekeeper_assignments/search_delivery', {
    reference_no: referenceNo
  });
  const data = response.data.data || response.data;
  return {
    results: Array.isArray(data.results) ? data.results : [],
    message: data.message || '',
  };
}

export async function getStorekeeperDashboardData(): Promise<StorekeeperDashboardData> {
  const response = await apiClient.get('/storekeeper_assignments/dashboard_data');
  return response.data.data || response.data;
}