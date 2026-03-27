import apiClient from './client';
import type { ApiResponse } from '../types/common';
import type { FacilityOptions } from '../types/referenceData';

export const getFacilityOptions = async (): Promise<FacilityOptions> => {
  const response = await apiClient.get<ApiResponse<FacilityOptions>>('/reference_data/facility_options');
  return response.data.data;
};
