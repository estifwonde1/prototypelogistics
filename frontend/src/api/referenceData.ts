import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type {
  CommodityReference,
  FacilityOptions,
  TransporterReference,
  UnitReference,
} from '../types/referenceData';

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
