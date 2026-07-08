import type { DispatchOrder, DispatchOrderLine } from '../api/dispatchOrders';
import type { UomConversion } from '../types/referenceData';
import { convertQuantityToTargetUnit } from './uomConversions';

const QTY_EPS = 1e-4;

export function coerceQuantity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : 0;
}

export interface DispatchQuantityLineInput {
  quantity: number;
  unit_id: string | null;
  commodity_id: string | null;
}

export function dispatchOrderRemainingQuantity(order: Pick<DispatchOrder, 'remaining_quantity'> | null | undefined): number | null {
  if (!order || order.remaining_quantity == null) return null;
  const n = Number(order.remaining_quantity);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

export function findDispatchOrderLine(
  order: Pick<DispatchOrder, 'lines'> | null | undefined,
  commodityId: string | null
): DispatchOrderLine | undefined {
  if (!order?.lines || !commodityId) return undefined;
  return order.lines.find((l) => String(l.commodity_id) === String(commodityId));
}

/** Convert an entered line quantity to the dispatch order line's canonical unit. */
export function quantityInDispatchCanonicalUnit(
  line: DispatchQuantityLineInput,
  orderLine: Pick<DispatchOrderLine, 'unit_id' | 'commodity_id'> | undefined,
  uomConversions: UomConversion[]
): number | null {
  const qty = coerceQuantity(line.quantity);
  if (qty <= 0) return 0;
  if (!line.unit_id || !orderLine?.unit_id) return qty;

  const fromUnitId = Number(line.unit_id);
  const toUnitId = Number(orderLine.unit_id);
  const commodityId = Number(line.commodity_id ?? orderLine.commodity_id);

  if (!Number.isFinite(fromUnitId) || !Number.isFinite(toUnitId) || !Number.isFinite(commodityId)) {
    return qty;
  }

  return convertQuantityToTargetUnit(qty, fromUnitId, toUnitId, commodityId, uomConversions);
}

export function exceedsDispatchRemaining(canonicalQty: number, remaining: number | null): boolean {
  if (remaining == null) return false;
  const cq = coerceQuantity(canonicalQty);
  const rem = coerceQuantity(remaining);
  if (rem <= 0) return cq > QTY_EPS;
  return cq > rem + QTY_EPS;
}

export function formatDispatchRemainingExceededMessage(
  remaining: number,
  unitLabel?: string
): string {
  const qty = remaining.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const limit = unitLabel ? `${qty} ${unitLabel}` : qty;
  return `Above the dispatch limit (${limit}).`;
}

/** Validate a line's entered quantity against remaining dispatch (canonical units). */
export function checkDispatchQuantityLimit(
  line: DispatchQuantityLineInput,
  order: Pick<DispatchOrder, 'lines' | 'remaining_quantity'> | null | undefined,
  uomConversions: UomConversion[],
  options?: { remainingOverride?: number | null; unitLabel?: string }
): string | null {
  const qty = coerceQuantity(line.quantity);
  if (!order || qty <= 0) return null;

  const doLine = findDispatchOrderLine(order, line.commodity_id);
  const canonical = quantityInDispatchCanonicalUnit({ ...line, quantity: qty }, doLine, uomConversions);
  if (canonical == null) {
    return 'Cannot convert this quantity to the dispatch order unit.';
  }

  const remaining =
    options?.remainingOverride != null
      ? coerceQuantity(options.remainingOverride)
      : dispatchOrderRemainingQuantity(order);
  if (remaining == null) return null;

  if (!exceedsDispatchRemaining(canonical, remaining)) return null;

  return formatDispatchRemainingExceededMessage(remaining, options?.unitLabel);
}

export function checkStockQuantityLimit(
  line: DispatchQuantityLineInput,
  availableQty: number | null,
  stockUnitId: number | null | undefined,
  order: Pick<DispatchOrder, 'lines'> | null | undefined,
  uomConversions: UomConversion[]
): string | null {
  const qty = coerceQuantity(line.quantity);
  if (qty <= 0 || availableQty == null) return null;

  const doLine = findDispatchOrderLine(order, line.commodity_id);
  const enteredCanonical = quantityInDispatchCanonicalUnit({ ...line, quantity: qty }, doLine, uomConversions);
  if (enteredCanonical == null) return null;

  let availCanonical = coerceQuantity(availableQty);
  if (stockUnitId != null && doLine?.unit_id != null && Number(stockUnitId) !== Number(doLine.unit_id)) {
    const converted = convertQuantityToTargetUnit(
      availCanonical,
      Number(stockUnitId),
      Number(doLine.unit_id),
      Number(line.commodity_id ?? doLine.commodity_id),
      uomConversions
    );
    if (converted != null) availCanonical = converted;
  }

  if (enteredCanonical > availCanonical + QTY_EPS) {
    return `Exceeds available stock (${availCanonical.toLocaleString(undefined, { maximumFractionDigits: 4 })})`;
  }

  return null;
}

export function sumCanonicalQuantities(
  lines: DispatchQuantityLineInput[],
  order: Pick<DispatchOrder, 'lines'> | null | undefined,
  uomConversions: UomConversion[]
): number {
  return lines.reduce((sum, line) => {
    const orderLine = findDispatchOrderLine(order, line.commodity_id);
    const canonical = quantityInDispatchCanonicalUnit(line, orderLine, uomConversions);
    if (canonical == null) return sum;
    return sum + canonical;
  }, 0);
}
