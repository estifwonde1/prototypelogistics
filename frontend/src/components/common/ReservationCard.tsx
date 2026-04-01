import { Card, Group, Stack, Text, Badge, Progress } from '@mantine/core';

interface ReservationCardProps {
  reservation: any;
  type: 'space' | 'stock';
}

export function ReservationCard({ reservation, type }: ReservationCardProps) {
  const statusColors: Record<string, string> = {
    pending: 'yellow',
    confirmed: 'blue',
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
          <Badge color={statusColors[reservation.status]}>
            {reservation.status}
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

        <Text size="xs" c="dimmed">
          Reserved on {new Date(reservation.reserved_at).toLocaleString()}
        </Text>

        {type === 'space' && reservation.reserved_quantity && (
          <Progress
            value={Math.min((reservation.reserved_quantity / 100) * 100, 100)}
            label={`${reservation.reserved_quantity} units`}
          />
        )}
      </Stack>
    </Card>
  );
}
