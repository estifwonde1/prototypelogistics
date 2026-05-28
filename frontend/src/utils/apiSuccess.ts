import type { AxiosResponse } from 'axios';

/** Backend envelope: { success, data } or raw data array for some legacy endpoints */
export function unwrapData<T>(response: AxiosResponse<unknown>): T {
  const body = response.data as Record<string, unknown>;
  if (body && typeof body === 'object' && 'success' in body) {
    if (body.success === false) {
      const err = body.error as { message?: string } | undefined;
      throw new Error(err?.message || 'Request failed');
    }
    return body.data as T;
  }
  return body as T;
}

export function isJurisdictionViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { response?: { data?: { error?: { code?: string } } } };
  return e.response?.data?.error?.code === 'JURISDICTION_VIOLATION';
}
