import apiClient from './client';
import type { Hub, HubAccess, HubCapacity, HubContacts, HubInfra } from '../types/hub';
import type { ApiResponse } from '../types/common';
import { createGeo, updateGeo, type GeoPayload } from './geos';

type HubApiRecord = Hub & {
  hub_capacity?: Hub['capacity'];
  hub_access?: Hub['access'];
  hub_infra?: Hub['infra'];
  hub_contacts?: Hub['contacts'];
};

const normalizeHub = (hub: HubApiRecord): Hub => ({
  ...hub,
  capacity: hub.capacity ?? hub.hub_capacity,
  access: hub.access ?? hub.hub_access,
  infra: hub.infra ?? hub.hub_infra,
  contacts: hub.contacts ?? hub.hub_contacts,
});

export const getHubs = async (): Promise<Hub[]> => {
  const response = await apiClient.get<ApiResponse<Hub[]>>('/hubs');
  return response.data.data.map((hub) => normalizeHub(hub));
};

export const getHub = async (id: number): Promise<Hub> => {
  const response = await apiClient.get<ApiResponse<Hub>>(`/hubs/${id}`);
  return normalizeHub(response.data.data);
};

export const createHub = async (data: Partial<Hub>): Promise<Hub> => {
  const response = await apiClient.post<ApiResponse<Hub>>('/hubs', { payload: data });
  return normalizeHub(response.data.data);
};

export const updateHub = async (id: number, data: Partial<Hub>): Promise<Hub> => {
  const response = await apiClient.put<ApiResponse<Hub>>(`/hubs/${id}`, { payload: data });
  return normalizeHub(response.data.data);
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
  id: number
): Promise<HubCapacity> => {
  const response = await apiClient.get<ApiResponse<HubCapacity>>(`/hubs/${id}/capacity`);
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
  id: number
): Promise<HubContacts> => {
  const response = await apiClient.get<ApiResponse<{ hub_contacts: HubContacts }>>(`/hubs/${id}/contacts`);
  return response.data.data.hub_contacts;
};
