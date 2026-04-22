import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { LocationOption } from '../types/admin';

export const getRegions = async (): Promise<LocationOption[]> => {
  const response = await apiClient.get<ApiResponse<{ locations: LocationOption[] }>>('/locations/regions');
  return response.data.data.locations;
};

export const getZones = async (regionId?: number): Promise<LocationOption[]> => {
  const response = await apiClient.get<ApiResponse<{ locations: LocationOption[] }>>('/locations/zones', {
    params: regionId ? { region_id: regionId } : {},
  });
  return response.data.data.locations;
};

export const getWoredas = async (zoneId: number): Promise<LocationOption[]> => {
  const response = await apiClient.get<ApiResponse<{ locations: LocationOption[] }>>('/locations/woredas', {
    params: { zone_id: zoneId },
  });
  return response.data.data.locations;
};

export const getKebeles = async (woredaId: number): Promise<LocationOption[]> => {
  const response = await apiClient.get<ApiResponse<{ locations: LocationOption[] }>>('/locations/kebeles', {
    params: { woreda_id: woredaId },
  });
  return response.data.data.locations;
};

export const getHubsForAssignment = async (): Promise<LocationOption[]> => {
  const response = await apiClient.get<ApiResponse<{ locations: LocationOption[] }>>('/locations/hubs');
  return response.data.data.locations;
};

export const getWarehousesForAssignment = async (hubId?: number): Promise<LocationOption[]> => {
  const response = await apiClient.get<ApiResponse<{ locations: LocationOption[] }>>('/locations/warehouses', {
    params: hubId ? { hub_id: hubId } : {},
  });
  return response.data.data.locations;
};

export const getStoresForAssignment = async (warehouseId?: number): Promise<LocationOption[]> => {
  const response = await apiClient.get<ApiResponse<{ locations: LocationOption[] }>>('/locations/stores', {
    params: warehouseId ? { warehouse_id: warehouseId } : {},
  });
  return response.data.data.locations;
};

export interface CreateLocationPayload {
  name: string;
  code: string;
  location_type: string;
  parent_id: number | null;
}

export const createLocation = async (payload: CreateLocationPayload): Promise<LocationOption> => {
  const response = await apiClient.post<ApiResponse<{ location: LocationOption }>>('/locations', { payload });
  return response.data.data.location;
};
