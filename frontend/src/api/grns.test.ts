import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGrns } from './grns';
import apiClient from './client';

vi.mock('./client', () => ({
  default: { get: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getGrns', () => {
  it('calls /grns with no params when none supplied', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getGrns();
    expect(mockGet).toHaveBeenCalledWith('/grns', { params: undefined });
  });

  it('passes warehouse_id as a query param', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getGrns({ warehouse_id: 42 });
    expect(mockGet).toHaveBeenCalledWith('/grns', { params: { warehouse_id: 42 } });
  });

  it('returns the data array from the response', async () => {
    const grns = [{ id: 1, reference_no: 'GRN-001' }];
    mockGet.mockResolvedValueOnce({ data: { data: grns } });
    const result = await getGrns();
    expect(result).toEqual(grns);
  });
});
