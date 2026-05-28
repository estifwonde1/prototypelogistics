import apiClient from './client';
import { unwrapData } from '../utils/apiSuccess';

/** Flat DTO from POST /printables/waybill */
export type WaybillPrintableDto = Record<string, unknown>;

/** Flat DTO from POST /printables/gin */
export type GinPrintableDto = Record<string, unknown>;

export async function postPrintableWaybill(body: { waybill_id?: number; id?: number }): Promise<WaybillPrintableDto> {
  const res = await apiClient.post('/printables/waybill', body);
  return unwrapData<WaybillPrintableDto>(res);
}

export async function postPrintableGin(body: { gin_id?: number; id?: number }): Promise<GinPrintableDto> {
  const res = await apiClient.post('/printables/gin', body);
  return unwrapData<GinPrintableDto>(res);
}
