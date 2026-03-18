import apiClient from './client';
import type { Hub, HubAccess, HubCapacity, HubContacts, HubInfra } from '../types/hub';
import type { ApiResponse } from '../types/common';
import { createGeo, updateGeo, type GeoPayload } from './geos';

export const getHubs = async (): Promise<Hub[]> => {
  const response = await apiClient.get<ApiResponse<Hub[]>>('/hubs');
  return response.data.data;
};

export const getHub = async (id: number): Promise<Hub> => {
  const response = await apiClient.get<ApiResponse<Hub>>(`/hubs/${id}`);
  return response.data.data;
};

export const createHub = async (data: Partial<Hub>): Promise<Hub> => {
  const response = await apiClient.post<ApiResponse<Hub>>('/hubs', { payload: data });
  return response.data.data;
};

export const updateHub = async (id: number, data: Partial<Hub>): Promise<Hub> => {
  const response = await apiClient.put<ApiResponse<Hub>>(`/hubs/${id}`, { payload: data });
  return response.data.data;
};

export const deleteHub = async (id: number): Promise<void> => {
  await apiClient.delete(`/hubs/${id}`);
};

export const updateHubGps = async (
  hubId: number,
  geoId: number | undefined,
  data: GeoPayload
): Promise<Hub> => {
  let geo;
  if (geoId) {
    geo = await updateGeo(geoId, data);
  } else {
    geo = await createGeo(data);
  }
  return updateHub(hubId, { geo_id: geo.id });
};

export const updateHubCapacity = async (
  id: number,
  data: Partial<HubCapacity>
): Promise<HubCapacity> => {
  const response = await apiClient.put<ApiResponse<HubCapacity>>(`/hubs/${id}/capacity`, {
    payload: data,
  });
  return response.data.data;
};

export const updateHubAccess = async (
  id: number,
  data: Partial<HubAccess>
): Promise<HubAccess> => {
  const response = await apiClient.put<ApiResponse<HubAccess>>(`/hubs/${id}/access`, {
    payload: data,
  });
  return response.data.data;
};

export const updateHubInfra = async (
  id: number,
  data: Partial<HubInfra>
): Promise<HubInfra> => {
  const response = await apiClient.put<ApiResponse<HubInfra>>(`/hubs/${id}/infra`, {
    payload: data,
  });
  return response.data.data;
};

export const updateHubContacts = async (
  id: number,
  data: Partial<HubContacts>
): Promise<HubContacts> => {
  const response = await apiClient.put<ApiResponse<HubContacts>>(`/hubs/${id}/contacts`, {
    payload: data,
  });
  return response.data.data;
};
