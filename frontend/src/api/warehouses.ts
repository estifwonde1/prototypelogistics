import apiClient from './client';
import type {
  Warehouse,
  WarehouseAccess,
  WarehouseCapacity,
  WarehouseContacts,
  WarehouseInfra,
} from '../types/warehouse';
import type { ApiResponse } from '../types/common';
import { createGeo, updateGeo, type GeoPayload } from './geos';

export const getWarehouses = async (): Promise<Warehouse[]> => {
  const response = await apiClient.get<ApiResponse<Warehouse[]>>('/warehouses');
  return response.data.data;
};

export const getWarehouse = async (id: number): Promise<Warehouse> => {
  const response = await apiClient.get<ApiResponse<Warehouse>>(`/warehouses/${id}`);
  return response.data.data;
};

export const createWarehouse = async (data: Partial<Warehouse>): Promise<Warehouse> => {
  const response = await apiClient.post<ApiResponse<Warehouse>>('/warehouses', { payload: data });
  return response.data.data;
};

export const updateWarehouse = async (id: number, data: Partial<Warehouse>): Promise<Warehouse> => {
  const response = await apiClient.put<ApiResponse<Warehouse>>(`/warehouses/${id}`, { payload: data });
  return response.data.data;
};

export const deleteWarehouse = async (id: number): Promise<void> => {
  await apiClient.delete(`/warehouses/${id}`);
};

export const updateWarehouseGps = async (
  warehouseId: number,
  geoId: number | undefined,
  data: GeoPayload
): Promise<Warehouse> => {
  let geo;
  if (geoId) {
    geo = await updateGeo(geoId, data);
  } else {
    geo = await createGeo(data);
  }
  return updateWarehouse(warehouseId, { geo_id: geo.id });
};

export const updateWarehouseCapacity = async (
  id: number,
  data: Partial<WarehouseCapacity>
): Promise<WarehouseCapacity> => {
  const response = await apiClient.put<ApiResponse<WarehouseCapacity>>(
    `/warehouses/${id}/capacity`,
    { payload: data }
  );
  return response.data.data;
};

export const updateWarehouseAccess = async (
  id: number,
  data: Partial<WarehouseAccess>
): Promise<WarehouseAccess> => {
  const response = await apiClient.put<ApiResponse<WarehouseAccess>>(
    `/warehouses/${id}/access`,
    { payload: data }
  );
  return response.data.data;
};

export const updateWarehouseInfra = async (
  id: number,
  data: Partial<WarehouseInfra>
): Promise<WarehouseInfra> => {
  const response = await apiClient.put<ApiResponse<WarehouseInfra>>(
    `/warehouses/${id}/infra`,
    { payload: data }
  );
  return response.data.data;
};

export const updateWarehouseContacts = async (
  id: number,
  data: Partial<WarehouseContacts>
): Promise<WarehouseContacts> => {
  const response = await apiClient.put<ApiResponse<WarehouseContacts>>(
    `/warehouses/${id}/contacts`,
    { payload: data }
  );
  return response.data.data;
};
