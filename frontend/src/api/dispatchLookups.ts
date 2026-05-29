import apiClient from './client';
import { unwrapData } from '../utils/apiSuccess';
import type { DispatchLookupPaginated } from '../types/dispatchV2';

export async function getSourceWarehousesLookup(params?: {
  q?: string;
  page?: number;
  per_page?: number;
}): Promise<DispatchLookupPaginated> {
  const res = await apiClient.get('/dispatch_orders/lookups/source_warehouses', {
    params,
    skipGlobalErrorHandler: true,
  });
  return unwrapData<DispatchLookupPaginated>(res);
}

export async function getWarehousesForCommodityLookup(params: {
  commodity_definition_id: number;
  unit_id?: number;
  commodity_id?: number;
}): Promise<DispatchLookupPaginated> {
  const res = await apiClient.get('/dispatch_orders/lookups/warehouses_for_commodity', {
    params,
    skipGlobalErrorHandler: true,
  });
  return unwrapData<DispatchLookupPaginated>(res);
}

export async function getDestinationsLookup(params?: {
  q?: string;
  page?: number;
  per_page?: number;
  exchange_only?: boolean;
  hub_id?: number;
  destination_kind?: 'all' | 'warehouse' | 'fdp';
}): Promise<DispatchLookupPaginated> {
  const res = await apiClient.get('/dispatch_orders/lookups/destinations', {
    params,
    skipGlobalErrorHandler: true,
  });
  return unwrapData<DispatchLookupPaginated>(res);
}
