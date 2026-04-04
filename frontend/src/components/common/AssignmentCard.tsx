import { Card, Group, Stack, Text, Badge, Button, Avatar } from '@mantine/core';
import { IconCheck, IconClock, IconX } from '@tabler/icons-react';

interface AssignmentCardProps {
  assignment: any;
  onAccept?: () => void;
  onReject?: () => void;
  isLoading?: boolean;
}

export function AssignmentCard({
  assignment,
  onAccept,
  onReject,
  isLoading,
}: AssignmentCardProps) {
  const statusKey = String(assignment.status ?? 'pending')
    .toLowerCase()
    .replace(/\s+/g, '_');

  const statusColors: Record<string, string> = {
    pending: 'yellow',
    assigned: 'gray',
    accepted: 'blue',
    in_progress: 'cyan',
    completed: 'green',
    rejected: 'red',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <IconClock size={16} />,
    assigned: <IconClock size={16} />,
    accepted: <IconCheck size={16} />,
    in_progress: <IconClock size={16} />,
    completed: <IconCheck size={16} />,
    rejected: <IconX size={16} />,
  };

  const badgeColor = statusColors[statusKey] ?? 'gray';
  const badgeIcon = statusIcons[statusKey] ?? statusIcons.pending;
  const assignedAtRaw = assignment.assigned_at || (assignment as { created_at?: string }).created_at;
  const assignedAtLabel =
    assignedAtRaw && !Number.isNaN(Date.parse(assignedAtRaw))
      ? new Date(assignedAtRaw).toLocaleString()
      : '—';

  const locationSubtitle = (() => {
    if (assignment.warehouse_name) {
      return assignment.warehouse_name;
    }
    if (assignment.hub_name) {
      const n = assignment.hub_warehouses_count;
      if (typeof n === 'number' && !Number.isNaN(n)) {
        return `${n} warehouse${n === 1 ? '' : 's'} under ${assignment.hub_name}`;
      }
      return `Hub: ${assignment.hub_name}`;
    }
    return 'No location';
  })();

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <Avatar name={assignment.assigned_to_name || 'User'} size="md" radius="xl" color="blue" />
            <div>
              <Text fw={600}>{assignment.assigned_to_name || 'Unassigned'}</Text>
              <Text size="sm" c="dimmed">
                {locationSubtitle}
              </Text>
            </div>
          </Group>
          <Badge color={badgeColor} leftSection={badgeIcon}>
            {String(assignment.status ?? '—').replace(/_/g, ' ')}
          </Badge>
        </Group>

        {assignment.assigned_by_name ? (
          <Text size="sm" c="dimmed">
            Assigned by {assignment.assigned_by_name}
          </Text>
        ) : null}

        {assignment.notes && (
          <Text size="sm">{assignment.notes}</Text>
        )}

        {assignment.quantity != null ? (
          <Text size="sm" fw={500}>
            Quantity: {Number(assignment.quantity).toLocaleString()}
          </Text>
        ) : null}

        <Text size="xs" c="dimmed">
          Assigned on {assignedAtLabel}
        </Text>

        {statusKey === 'pending' && (onAccept || onReject) && (
          <Group gap="sm">
            {onAccept && (
              <Button
                size="sm"
                variant="light"
                onClick={onAccept}
                loading={isLoading}
              >
                Accept
              </Button>
            )}
            {onReject && (
              <Button
                size="sm"
                variant="light"
                color="red"
                onClick={onReject}
                loading={isLoading}
              >
                Reject
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  );
}
