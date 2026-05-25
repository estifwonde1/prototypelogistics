/**
 * Pick the first store id that exists in the user's accessible store list.
 * Used by stack layout and driver-arrival stacking so we never request stacks
 * for a deleted or out-of-scope store (e.g. stale assignment store_id=7).
 */
export function pickAccessibleStoreId(
  candidates: Array<number | string | null | undefined>,
  accessibleStoreIds: readonly number[]
): number | null {
  if (accessibleStoreIds.length === 0) return null;

  const allowed = new Set(accessibleStoreIds.map((id) => Number(id)));

  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;
    const n = Number(candidate);
    if (Number.isFinite(n) && n > 0 && allowed.has(n)) return n;
  }

  return accessibleStoreIds[0] ?? null;
}
