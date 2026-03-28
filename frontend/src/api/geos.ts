import apiClient from './client';
import type { ApiResponse } from '../types/common';

export interface GeoPayload {
  latitude: number;
  longitude: number;
  altitude_m?: number;
  address?: string;
}

export interface GeoData {
  id: number;
  latitude: number;
  longitude: number;
  altitude_m?: number;
  address?: string;
}

/** Use after create/update Geo so parent records show fresh coords even if the parent PUT response embeds a stale `geo`. */
export function snapshotGeoForParent(
  geo: GeoData,
  existing?: { address?: string } | null
): { id: number; latitude: number; longitude: number; altitude_m?: number; address?: string } {
  return {
    id: geo.id,
    latitude: geo.latitude,
    longitude: geo.longitude,
    altitude_m: geo.altitude_m,
    address: geo.address ?? existing?.address,
  };
}

export const createGeo = async (data: GeoPayload): Promise<GeoData> => {
  const response = await apiClient.post<ApiResponse<GeoData>>('/geos', { payload: data });
  return response.data.data;
};

export const updateGeo = async (id: number, data: GeoPayload): Promise<GeoData> => {
  const response = await apiClient.put<ApiResponse<GeoData>>(`/geos/${id}`, { payload: data });
  return response.data.data;
};
