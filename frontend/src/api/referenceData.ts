import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type {
  CommodityReference,
  FacilityOptions,
  TransporterReference,
  UnitReference,
  InventoryLot,
  UomConversion,
} from '../types/referenceData';

export interface CreateCommodityPayload {
  name: string;
  code?: string;
  batch_no?: string;
  unit_id?: number;
  commodity_category_id?: number;
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
