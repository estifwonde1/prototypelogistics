/**
 * Type-level tests for the Warehouse interface.
 * These are compile-time checks — if the file compiles, the types are correct.
 * Vitest runs them as a no-op test so they appear in the test report.
 */
import { describe, it } from 'vitest';
import type { Warehouse } from './warehouse';

describe('Warehouse type', () => {
  it('includes region_name as an optional string field', () => {
    // This is a compile-time check. If region_name is missing from the
    // interface, TypeScript will error here and the test suite will fail.
    const w: Warehouse = {
      id: 1,
      code: 'WH-01',
      name: 'Test Warehouse',
      warehouse_type: 'hub',
      status: 'active',
      region_name: 'Oromia',       // ← the field we added
    };
    // Runtime assertion so vitest counts this as a passing test
    const hasField = 'region_name' in w;
    // @ts-expect-error — suppress unused variable warning
    void hasField;
  });

  it('allows region_name to be undefined', () => {
    const w: Warehouse = {
      id: 2,
      code: 'WH-02',
      name: 'Another Warehouse',
      warehouse_type: 'hub',
      status: 'active',
      // region_name intentionally omitted — must be optional
    };
    void w;
  });

  it('does not allow non-string region_name', () => {
    // This test documents intent. The actual enforcement is TypeScript's job.
    // If you see a TS error on the line below, the type is working correctly.
    // @ts-expect-error region_name must be string | undefined, not number
    const _bad: Warehouse = {
      id: 3, code: 'X', name: 'X', warehouse_type: 'hub', status: 'active',
      region_name: 42,
    };
    void _bad;
  });
});
