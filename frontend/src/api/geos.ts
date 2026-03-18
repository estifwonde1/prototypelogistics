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

export const createGeo = async (data: GeoPayload): Promise<GeoData> => {
  const response = await apiClient.post<ApiResponse<GeoData>>('/geos', { payload: data });
  return response.data.data;
};

export const updateGeo = async (id: number, data: GeoPayload): Promise<GeoData> => {
  const response = await apiClient.put<ApiResponse<GeoData>>(`/geos/${id}`, { payload: data });
  return response.data.data;
};
