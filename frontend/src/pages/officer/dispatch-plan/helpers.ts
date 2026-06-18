import type { CreateDispatchOrderPayload } from '../../../api/dispatchOrders';
import type { DispatchPlanLineDraft, DispatchPlanReferenceDraft } from './types';

export function combineDateAndTime(date: Date | null, time: string): Date | null {
  if (!date) return null;
  const [hours, minutes] = time.split(':').map((part) => Number(part) || 0);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

export function buildDispatchPlanPayload(
  reference: DispatchPlanReferenceDraft,
  lines: DispatchPlanLineDraft[],
  location?: { id?: number; location_type?: string } | null
): CreateDispatchOrderPayload {
  const firstLine = lines[0];
  const approvalDate =
    reference.approvalDate instanceof Date
      ? reference.approvalDate.toISOString().split('T')[0]
      : reference.approvalDate;

  return {
    response_plan_ref: reference.responsePlanRef.trim() || null,
    approval_date: approvalDate ?? null,
    response_type: reference.responseType,
    description: reference.description,
    notes: reference.description,
    destination_type: 'Beneficiary',
    destination_name: firstLine?.fdpName ?? '',
    source_warehouse_id: firstLine?.warehouseId,
    hub_id: firstLine?.hubId ?? null,
    fdp_id: firstLine?.fdpId ?? null,
    expected_pickup_date: firstLine?.expectedReceiveAt.toISOString().split('T')[0],
    location_id: location?.id ?? null,
    hierarchical_level: location?.location_type ?? 'Federal',
    lines: lines.map((line) => ({
      commodity_id: line.commodityId,
      quantity: line.quantity,
      unit_id: line.unitId,
      warehouse_id: line.warehouseId,
      hub_id: line.hubId ?? null,
      fdp_id: line.fdpId,
      expected_receive_at: line.expectedReceiveAt.toISOString(),
    })),
  };
}
