import type {
  DispatchOrderLineV2,
  DispatchLineDestinationAllocation,
  DispatchLineSourceAllocation,
} from '../types/dispatchV2';

function sourceLabel(s: DispatchLineSourceAllocation): string {
  return (
    s.warehouse_label ||
    s.warehouse?.label ||
    s.warehouse?.name ||
    (s.warehouse_id ? `Warehouse #${s.warehouse_id}` : 'Source')
  );
}

function destLabel(d: DispatchLineDestinationAllocation): string {
  return (
    d.destination_label ||
    d.destination_location?.label ||
    d.destination_location?.name ||
    (d.destination_location_id ? `Location #${d.destination_location_id}` : 'Destination')
  );
}

export function formatSourceAllocations(line: DispatchOrderLineV2): string {
  const rows = line.source_allocations || [];
  if (rows.length === 0) return '—';
  return rows
    .map((s) => {
      const unit = s.unit_name ? ` ${s.unit_name}` : '';
      return `${sourceLabel(s)}: ${s.quantity}${unit}`;
    })
    .join('; ');
}

export function formatDestinationAllocations(line: DispatchOrderLineV2): string {
  const rows = line.destination_allocations || [];
  if (rows.length === 0) return '—';
  return rows
    .map((d) => {
      const unit = d.unit_name ? ` ${d.unit_name}` : '';
      return `${destLabel(d)}: ${d.quantity}${unit}`;
    })
    .join('; ');
}

export function formatLineAllocationsSummary(line: DispatchOrderLineV2): string {
  const commodity = line.commodity_name || `Commodity #${line.commodity_id}`;
  return `${commodity} — src: ${formatSourceAllocations(line)} → dest: ${formatDestinationAllocations(line)}`;
}
