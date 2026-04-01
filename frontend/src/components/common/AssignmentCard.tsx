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
  const statusColors: Record<string, string> = {
    pending: 'yellow',
    accepted: 'blue',
    in_progress: 'cyan',
    completed: 'green',
    rejected: 'red',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <IconClock size={16} />,
    accepted: <IconCheck size={16} />,
    in_progress: <IconClock size={16} />,
    completed: <IconCheck size={16} />,
    rejected: <IconX size={16} />,
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <Avatar name={assignment.assigned_to_name || 'User'} size="md" radius="xl" color="blue" />
            <div>
              <Text fw={600}>{assignment.assigned_to_name || 'Unassigned'}</Text>
              <Text size="sm" c="dimmed">
                {assignment.warehouse_name || 'No warehouse'}
              </Text>
            </div>
          </Group>
          <Badge
            color={statusColors[assignment.status]}
            leftSection={statusIcons[assignment.status]}
          >
            {assignment.status}
          </Badge>
        </Group>

        {assignment.notes && (
          <Text size="sm">{assignment.notes}</Text>
        )}

        <Text size="xs" c="dimmed">
          Assigned on {new Date(assignment.assigned_at).toLocaleString()}
        </Text>

        {assignment.status === 'pending' && (onAccept || onReject) && (
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
