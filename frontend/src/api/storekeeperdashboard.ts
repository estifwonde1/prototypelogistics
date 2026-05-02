import apiClient from './client';

export interface DeliverySearchResultLine {
  commodity_id: number;
  commodity_name: string;
  batch_no?: string;
  quantity: number;
  unit_id: number;
  unit_name?: string;
  unit_abbreviation?: string;
}

export interface DeliverySearchResult {
  type: string;
  reference_no: string;
  commodity: string;
  quantity: number;
  unit: string;
  batch_no?: string;
  commodity_id?: number;
  unit_id?: number;
  lines?: DeliverySearchResultLine[];
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

export async function searchDeliveryByReference(
  referenceNo: string,
  warehouseId?: number,
  storeId?: number
): Promise<DeliverySearchResponse> {
  const payload: Record<string, unknown> = { reference_no: referenceNo };
  if (warehouseId) {
    payload.warehouse_id = warehouseId;
  }
  if (storeId) {
    payload.store_id = storeId;
  }
  const response = await apiClient.post('/storekeeper_assignments/search_delivery', payload);
  const data = response.data.data || response.data;
  return {
    results: Array.isArray(data.results) ? data.results : [],
    message: data.message || '',
  };
}

export async function getStorekeeperDashboardData(storeId?: number): Promise<StorekeeperDashboardData> {
  const params: Record<string, unknown> = {};
  if (storeId) params.store_id = storeId;
  const response = await apiClient.get('/storekeeper_assignments/dashboard_data', { params });
  return response.data.data || response.data;
}