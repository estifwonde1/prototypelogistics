import apiClient from './client';
import type { ApiResponse } from '../types/common';

export interface OfficerDashboardSummary {
  hubs_count: number;
  warehouses_count: number;
  /** Map of status string → count, e.g. { "Draft": 3, "Confirmed": 9 } */
  receipt_orders: Record<string, number>;
  dispatch_orders: Record<string, number>;
}

export interface WarehouseManagerDashboardSummary {
  receipt_orders: Record<string, number>;
  dispatch_orders: Record<string, number>;
  pending_receipt_orders: Array<{
    id: number;
    reference_no: string;
    source_name: string;
    created_at: string;
  }>;
  pending_dispatch_orders: Array<{
    id: number;
    destination_name: string;
    expected_pickup_date: string | null;
  }>;
  stock_preview: Array<{
    id: number;
    commodity_name: string | null;
    quantity: number;
    unit_name: string | null;
  }>;
  lost_commodity_records: Array<{
    receipt_order_id: number | null;
    commodity_name: string | null;
    quantity_lost: number;
    remarks: string | null;
    inspected_on: string | null;
  }>;
}

export const getOfficerDashboard = async (): Promise<OfficerDashboardSummary> => {
  const response = await apiClient.get<ApiResponse<OfficerDashboardSummary>>('/dashboard/officer');
  return response.data.data;
};

export const getWarehouseManagerDashboard = async (
  warehouseId: number
): Promise<WarehouseManagerDashboardSummary> => {
  const response = await apiClient.get<ApiResponse<WarehouseManagerDashboardSummary>>(
    '/dashboard/warehouse_manager',
    { params: { warehouse_id: warehouseId } }
  );
  return response.data.data;
};

export const warehouseManagerDashboardQueryKey = (warehouseId: number | null | undefined) =>
  ['dashboard', 'warehouse_manager', warehouseId] as const;

export const officerDashboardQueryKey = (assignmentId: number | null | undefined) =>
  ['dashboard', 'officer', assignmentId] as const;
