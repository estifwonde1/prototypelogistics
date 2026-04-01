import { Badge, BadgeProps } from '@mantine/core';

interface ExpiryBadgeProps extends Omit<BadgeProps, 'children'> {
  expiryDate: string;
  warningDays?: number;
}

export function ExpiryBadge({ expiryDate, warningDays = 30, ...props }: ExpiryBadgeProps) {
  const expiry = new Date(expiryDate);
  const today = new Date();
  const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let color = 'green';
  let label = `Expires in ${daysUntilExpiry} days`;

  if (daysUntilExpiry < 0) {
    color = 'red';
    label = 'Expired';
  } else if (daysUntilExpiry < warningDays) {
    color = 'orange';
    label = `Expires soon (${daysUntilExpiry} days)`;
  }

  return (
    <Badge color={color} {...props}>
      {label}
    </Badge>
  );
}
