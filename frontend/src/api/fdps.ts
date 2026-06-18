import apiClient from './client';
import type { Fdp, FdpPayload } from '../types/fdp';
import type { ApiResponse } from '../types/common';

function extractFdps(data: unknown): Fdp[] {
  if (Array.isArray(data)) return data;
  const root = data as { data?: unknown; fdps?: Fdp[] };
  if (Array.isArray(root.fdps)) return root.fdps;
  if (Array.isArray(root.data)) return root.data as Fdp[];
  if (root.data && typeof root.data === 'object') {
    const inner = root.data as { fdps?: Fdp[] };
    if (Array.isArray(inner.fdps)) return inner.fdps;
  }
  return [];
}

export async function getFdps(params?: { location?: string; search?: string }): Promise<Fdp[]> {
  const response = await apiClient.get('/fdps', { params });
  return extractFdps(response.data);
}

export async function getFdp(id: number): Promise<Fdp> {
  const response = await apiClient.get(`/fdps/${id}`);
  const root = response.data as { data?: Fdp };
  return (root.data ?? response.data) as Fdp;
}

export async function createFdp(payload: FdpPayload): Promise<Fdp> {
  const response = await apiClient.post('/admin/fdps', { payload });
  const root = response.data as { data?: Fdp };
  return (root.data ?? response.data) as Fdp;
}

export async function updateFdp(id: number, payload: FdpPayload): Promise<Fdp> {
  const response = await apiClient.put(`/admin/fdps/${id}`, { payload });
  const root = response.data as { data?: Fdp };
  return (root.data ?? response.data) as Fdp;
}

export async function deleteFdp(id: number): Promise<void> {
  await apiClient.delete(`/admin/fdps/${id}`);
}

export type { Fdp, FdpPayload };
