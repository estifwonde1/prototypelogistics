import { Card, Group, Stack, Text, Badge, Progress } from '@mantine/core';

interface ReservationCardProps {
  reservation: any;
  type: 'space' | 'stock';
  /** When set (e.g. line or order total qty), progress bar shows reserved / denominator. */
  progressDenominator?: number;
}

export function ReservationCard({ reservation, type, progressDenominator }: ReservationCardProps) {
  const statusKey = String(reservation.status ?? 'reserved')
    .toLowerCase()
    .replace(/\s+/g, '_');

  const statusColors: Record<string, string> = {
    pending: 'yellow',
    confirmed: 'blue',
    reserved: 'gray',
    fulfilled: 'green',
    occupied: 'cyan',
    released: 'gray',
    cancelled: 'red',
  };

  const getReservationLabel = () => {
    if (type === 'space') {
      return `${reservation.reserved_quantity || 0} units in ${reservation.store_name || 'Store'}`;
    }
    return `${reservation.reserved_quantity} ${reservation.unit_name || 'units'} of ${reservation.commodity_name || 'Commodity'}`;
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>{getReservationLabel()}</Text>
          <Badge color={statusColors[statusKey] ?? 'gray'}>
            {String(reservation.status ?? '—').replace(/_/g, ' ')}
          </Badge>
        </Group>

        {reservation.warehouse_name && (
          <Text size="sm" c="dimmed">
            Warehouse: {reservation.warehouse_name}
          </Text>
        )}

        {reservation.batch_no && (
          <Text size="sm" c="dimmed">
            Batch: {reservation.batch_no}
          </Text>
        )}

        {reservation.notes && (
          <Text size="sm" c="dimmed">
            {reservation.notes}
          </Text>
        )}

        {reservation.reserved_by_name ? (
          <Text size="xs" c="dimmed">
            Reserved by {reservation.reserved_by_name}
          </Text>
        ) : null}

        <Text size="xs" c="dimmed">
          Reserved on{' '}
          {reservation.reserved_at && !Number.isNaN(Date.parse(reservation.reserved_at))
            ? new Date(reservation.reserved_at).toLocaleString()
            : '—'}
        </Text>

        {type === 'space' && reservation.reserved_quantity ? (
          <Progress
            value={Math.min(
              progressDenominator && progressDenominator > 0
                ? (Number(reservation.reserved_quantity) / progressDenominator) * 100
                : Math.min(Number(reservation.reserved_quantity), 100),
              100
            )}
          />
        ) : null}
      </Stack>
    </Card>
  );
}
