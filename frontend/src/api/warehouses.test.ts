import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateWarehouseCapacity } from './warehouses';
import apiClient from './client';

vi.mock('./client', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

// Also mock geos since updateWarehouseGps depends on it
vi.mock('./geos', () => ({
  createGeo: vi.fn(),
  updateGeo: vi.fn(),
  snapshotGeoForParent: vi.fn((geo) => geo),
}));

const mockPut = vi.mocked(apiClient.put);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateWarehouseCapacity', () => {
  it('sends usable_space_percentage in the payload', async () => {
    mockPut.mockResolvedValueOnce({ data: { data: {} } });

    await updateWarehouseCapacity(1, {
      total_area_sqm: 500,
      total_storage_capacity_mt: 200,
      construction_year: 2010,
      usable_space_percentage: 78,
    } as any);

    expect(mockPut).toHaveBeenCalledWith(
      '/warehouses/1/capacity',
      expect.objectContaining({
        payload: expect.objectContaining({ usable_space_percentage: 78 }),
      })
    );
  });

  it('sends total_area_sqm, total_storage_capacity_mt, construction_year', async () => {
    mockPut.mockResolvedValueOnce({ data: { data: {} } });

    await updateWarehouseCapacity(2, {
      total_area_sqm: 1000,
      total_storage_capacity_mt: 500,
      construction_year: 2015,
    } as any);

    const sentPayload = mockPut.mock.calls[0][1] as any;
    expect(sentPayload.payload.total_area_sqm).toBe(1000);
    expect(sentPayload.payload.total_storage_capacity_mt).toBe(500);
    expect(sentPayload.payload.construction_year).toBe(2015);
  });

  it('does NOT silently drop usable_space_percentage when it is 70', async () => {
    mockPut.mockResolvedValueOnce({ data: { data: {} } });

    await updateWarehouseCapacity(3, { usable_space_percentage: 70 } as any);

    const sentPayload = mockPut.mock.calls[0][1] as any;
    expect(sentPayload.payload.usable_space_percentage).toBe(70);
  });
});
