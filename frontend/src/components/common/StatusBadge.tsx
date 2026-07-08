import { Badge } from '@mantine/core';

interface StatusBadgeProps {
  status?: string | null; // allow null/undefined
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  warehouse_assigned: 'Warehouse assigned',
  assigned: 'Assigned',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
  confirmed: 'Confirmed',
  draft: 'Draft',
  reserved: 'Reserved',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  // Normalize status safely
  const normalized = status?.toLowerCase().replace(/\s+/g, '_') ?? 'unknown';

  const getColor = (normalizedStatus: string) => {
    switch (normalizedStatus) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'gray';
      case 'maintenance':
        return 'yellow';
      case 'draft':
        return 'blue';
      case 'confirmed':
        return 'green';
      case 'pending':
        return 'yellow';
      case 'warehouse_assigned':
        return 'blue';
      case 'assigned':
        return 'violet';
      case 'reserved':
        return 'indigo';
      case 'in_progress':
        return 'cyan';
      case 'completed':
        return 'teal';
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
  };

  const label = STATUS_LABELS[normalized] ?? status?.replace(/_/g, ' ') ?? 'Unknown';

  return (
    <Badge color={getColor(normalized)} variant="light">
      {label}
    </Badge>
  );
}