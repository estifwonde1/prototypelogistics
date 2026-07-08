import { Badge } from '@mantine/core';

interface ScopeBadgeProps {
  locationName?: string | null;
  hierarchicalLevel?: string | null;
}

export function ScopeBadge({ locationName, hierarchicalLevel }: ScopeBadgeProps) {
  const isFederal = !locationName || !hierarchicalLevel || hierarchicalLevel === 'Federal';
  
  if (isFederal) {
    return (
      <Badge color="gray" variant="light">
        Federal / System-wide
      </Badge>
    );
  }
  
  return (
    <Badge color="blue" variant="light">
      {locationName} — {hierarchicalLevel}
    </Badge>
  );
}
