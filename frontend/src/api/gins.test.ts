import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGins } from './gins';
import apiClient from './client';

vi.mock('./client', () => ({
  default: { get: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getGins', () => {
  it('calls /gins with no params when none supplied', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getGins();
    expect(mockGet).toHaveBeenCalledWith('/gins', { params: undefined });
  });

  it('passes warehouse_id as a query param', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getGins({ warehouse_id: 7 });
    expect(mockGet).toHaveBeenCalledWith('/gins', { params: { warehouse_id: 7 } });
  });

  it('returns the data array from the response', async () => {
    const gins = [{ id: 2, reference_no: 'GIN-001' }];
    mockGet.mockResolvedValueOnce({ data: { data: gins } });
    const result = await getGins();
    expect(result).toEqual(gins);
  });
});
