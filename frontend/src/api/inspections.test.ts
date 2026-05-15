import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInspections } from './inspections';
import apiClient from './client';

vi.mock('./client', () => ({
  default: { get: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getInspections', () => {
  it('calls /inspections with no params when none supplied', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getInspections();
    expect(mockGet).toHaveBeenCalledWith('/inspections', { params: undefined });
  });

  it('passes warehouse_id as a query param', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getInspections({ warehouse_id: 99 });
    expect(mockGet).toHaveBeenCalledWith('/inspections', { params: { warehouse_id: 99 } });
  });

  it('returns the data array from the response', async () => {
    const inspections = [{ id: 3, reference_no: 'INSP-001' }];
    mockGet.mockResolvedValueOnce({ data: { data: inspections } });
    const result = await getInspections();
    expect(result).toEqual(inspections);
  });
});
