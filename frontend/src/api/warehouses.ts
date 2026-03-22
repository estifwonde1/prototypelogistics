import apiClient from './client';
import type {
  Warehouse,
  WarehouseUpsertPayload,
  WarehouseAccess,
  WarehouseCapacity,
  WarehouseContacts,
  WarehouseInfra,
} from '../types/warehouse';
import type { ApiResponse } from '../types/common';
import { createGeo, updateGeo, type GeoPayload } from './geos';

const normalizeWarehouse = (warehouse: any): Warehouse => ({
  ...warehouse,
  capacity: warehouse.capacity ?? warehouse.warehouse_capacity,
  access: warehouse.access ?? warehouse.warehouse_access,
  infra: warehouse.infra ?? warehouse.warehouse_infra,
  contacts: warehouse.contacts ?? warehouse.warehouse_contacts,
});

const toWarehouseRequestBody = (data: WarehouseUpsertPayload) => {
  const hasBinaryPayload = Object.values(data).some((value) => value instanceof File);

  if (!hasBinaryPayload) {
    return { payload: data };
  }

  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    formData.append(`payload[${key}]`, value);
  });

  return formData;
};

export const getWarehouses = async (): Promise<Warehouse[]> => {
  const response = await apiClient.get<ApiResponse<Warehouse[]>>('/warehouses');
  return response.data.data.map((warehouse: any) => normalizeWarehouse(warehouse));
};

export const getWarehouse = async (id: number): Promise<Warehouse> => {
  const response = await apiClient.get<ApiResponse<Warehouse>>(`/warehouses/${id}`);
  return normalizeWarehouse(response.data.data);
};

export const createWarehouse = async (data: WarehouseUpsertPayload): Promise<Warehouse> => {
  const response = await apiClient.post<ApiResponse<Warehouse>>('/warehouses', toWarehouseRequestBody(data));
  return normalizeWarehouse(response.data.data);
};

export const updateWarehouse = async (id: number, data: WarehouseUpsertPayload): Promise<Warehouse> => {
  const response = await apiClient.put<ApiResponse<Warehouse>>(`/warehouses/${id}`, toWarehouseRequestBody(data));
  return normalizeWarehouse(response.data.data);
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
