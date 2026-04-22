import apiClient from './client';
import type { ApiResponse } from '../types/common';

export interface CommodityDefinition {
  id: number;
  name: string;
  category_id: number | null;
  category_name: string | null;
}

export interface CommodityDefinitionPayload {
  name: string;
  commodity_category_id: number;
}

export const getCommodityDefinitions = async (): Promise<CommodityDefinition[]> => {
  const response = await apiClient.get<ApiResponse<{ commodity_definitions: CommodityDefinition[] }>>(
    '/commodity_definitions'
  );
  return response.data.data.commodity_definitions;
};

export const createCommodityDefinition = async (
  payload: CommodityDefinitionPayload
): Promise<CommodityDefinition> => {
  const response = await apiClient.post<ApiResponse<CommodityDefinition>>(
    '/commodity_definitions',
    { commodity_definition: payload }
  );
  return response.data.data;
};

export const updateCommodityDefinition = async (
  id: number,
  payload: CommodityDefinitionPayload
): Promise<CommodityDefinition> => {
  const response = await apiClient.patch<ApiResponse<CommodityDefinition>>(
    `/commodity_definitions/${id}`,
    { commodity_definition: payload }
  );
  return response.data.data;
};

export const deleteCommodityDefinition = async (id: number): Promise<void> => {
  await apiClient.delete(`/commodity_definitions/${id}`);
};
