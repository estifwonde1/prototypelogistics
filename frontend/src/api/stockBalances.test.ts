import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStockBalances } from './stockBalances';
import apiClient from './client';

vi.mock('./client', () => ({
  default: { get: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getStockBalances', () => {
  it('calls /stock_balances with no params when none supplied', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getStockBalances();
    expect(mockGet).toHaveBeenCalledWith('/stock_balances', { params: undefined });
  });

  it('passes warehouse_id as a query param', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getStockBalances({ warehouse_id: 5 });
    expect(mockGet).toHaveBeenCalledWith('/stock_balances', { params: { warehouse_id: 5 } });
  });

  it('passes store_id as a query param', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getStockBalances({ store_id: 3 });
    expect(mockGet).toHaveBeenCalledWith('/stock_balances', { params: { store_id: 3 } });
  });

  it('passes multiple params together', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getStockBalances({ warehouse_id: 1, commodity_id: 2 });
    expect(mockGet).toHaveBeenCalledWith('/stock_balances', {
      params: { warehouse_id: 1, commodity_id: 2 },
    });
  });

  it('returns the data array from the response', async () => {
    const balances = [{ id: 10, quantity: 50 }];
    mockGet.mockResolvedValueOnce({ data: { data: balances } });
    const result = await getStockBalances();
    expect(result).toEqual(balances);
  });
});
