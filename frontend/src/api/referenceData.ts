import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type {
  CommodityReference,
  CommodityCategory,
  FacilityOptions,
  TransporterReference,
  UnitReference,
  InventoryLot,
  UomConversion,
} from '../types/referenceData';

export interface CreateCommodityPayload {
  name: string;
  batch_no?: string;
  quantity?: number;
  unit_id?: number;
  commodity_category_id?: number;
  best_use_before?: string;
  package_unit_id?: number;
  package_size?: number;
  source_type?: string;
  source_name?: string;
}

export const getFacilityOptions = async (): Promise<FacilityOptions> => {
  const response = await apiClient.get<ApiResponse<FacilityOptions>>('/reference_data/facility_options');
  return response.data.data;
};

export const getCommodityReferences = async (): Promise<CommodityReference[]> => {
  const response = await apiClient.get<ApiResponse<{ commodities: CommodityReference[] }>>(
    '/reference_data/commodities'
  );
  return response.data.data.commodities;
};

export const getUnitReferences = async (): Promise<UnitReference[]> => {
  const response = await apiClient.get<ApiResponse<{ units: UnitReference[] }>>(
    '/reference_data/units'
  );
  return response.data.data.units;
};

export const getCategoryReferences = async (): Promise<CommodityCategory[]> => {
  const response = await apiClient.get<ApiResponse<{ categories: CommodityCategory[] }>>(
    '/reference_data/categories'
  );
  return response.data.data.categories;
};

export interface CreateCategoryPayload {
  name: string;
  code?: string;
  parent_id?: number | null;
}

export const createCategory = async (payload: CreateCategoryPayload): Promise<CommodityCategory> => {
  const response = await apiClient.post<ApiResponse<{ category: CommodityCategory }>>(
    '/reference_data/categories',
    { category: payload }
  );
  return response.data.data.category;
};

export const deleteCategory = async (id: number): Promise<void> => {
  await apiClient.delete(`/reference_data/categories/${id}`);
};

export const getTransporterReferences = async (): Promise<TransporterReference[]> => {
  const response = await apiClient.get<ApiResponse<{ transporters: TransporterReference[] }>>(
    '/reference_data/transporters'
  );
  return response.data.data.transporters;
};

export const getInventoryLots = async (): Promise<InventoryLot[]> => {
  const response = await apiClient.get<ApiResponse<{ inventory_lots: InventoryLot[] }>>(
    '/reference_data/inventory_lots'
  );
  return response.data.data.inventory_lots;
};

export const getUomConversions = async (): Promise<UomConversion[]> => {
  const response = await apiClient.get<ApiResponse<{ uom_conversions: UomConversion[] }>>(
    '/reference_data/uom_conversions'
  );
  return response.data.data.uom_conversions;
};

export const createCommodity = async (payload: CreateCommodityPayload): Promise<CommodityReference> => {
  const response = await apiClient.post<ApiResponse<CommodityReference>>(
    '/reference_data/commodities',
    { commodity: payload }
  );
  return response.data.data;
};

export interface AdminCommodityPayload {
  name: string;
  commodity_category_id: number;
}

export const adminCreateCommodity = async (payload: AdminCommodityPayload): Promise<CommodityReference> => {
  const response = await apiClient.post<ApiResponse<CommodityReference>>(
    '/reference_data/commodities',
    { commodity: { name: payload.name, commodity_category_id: payload.commodity_category_id, quantity: 0 } }
  );
  return response.data.data;
};

export const adminUpdateCommodity = async (id: number, payload: AdminCommodityPayload): Promise<CommodityReference> => {
  const response = await apiClient.patch<ApiResponse<CommodityReference>>(
    `/reference_data/commodities/${id}`,
    { commodity: payload }
  );
  return response.data.data;
};

export const adminDeleteCommodity = async (id: number): Promise<void> => {
  await apiClient.delete(`/reference_data/commodities/${id}`);
};
