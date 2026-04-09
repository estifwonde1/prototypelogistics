import { Badge } from '@mantine/core';

interface StatusBadgeProps {
  status?: string | null; // allow null/undefined
}

export function StatusBadge({ status }: StatusBadgeProps) {
  // Normalize status safely
  const normalized = status?.toLowerCase() ?? 'unknown';

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

  return (
    <Badge color={getColor(normalized)} variant="light">
      {status || 'Unknown'}
    </Badge>
  );
}