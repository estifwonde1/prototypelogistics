import { Timeline, Text, Group, Badge, Avatar } from '@mantine/core';
import { IconCheck, IconClock, IconAlertCircle } from '@tabler/icons-react';

interface WorkflowTimelineProps {
  events: any[];
}

export function WorkflowTimeline({ events }: WorkflowTimelineProps) {
  const getIcon = (eventType: string) => {
    if (eventType.includes('completed') || eventType.includes('confirmed')) {
      return <IconCheck size={16} />;
    }
    if (eventType.includes('error') || eventType.includes('failed')) {
      return <IconAlertCircle size={16} />;
    }
    return <IconClock size={16} />;
  };

  const getColor = (eventType: string) => {
    if (eventType.includes('completed') || eventType.includes('confirmed')) {
      return 'green';
    }
    if (eventType.includes('error') || eventType.includes('failed')) {
      return 'red';
    }
    return 'blue';
  };

  if (events.length === 0) {
    return <Text c="dimmed">No workflow events yet</Text>;
  }

  return (
    <Timeline active={events.length} bulletSize={24} lineWidth={2}>
      {events.map((event) => (
        <Timeline.Item
          key={event.id}
          bullet={getIcon(event.event_type)}
          title={
            <Group justify="space-between">
              <Text fw={600}>{event.event_type}</Text>
              <Badge size="sm" color={getColor(event.event_type)}>
                {event.status}
              </Badge>
            </Group>
          }
        >
          {event.description && (
            <Text size="sm" mt={4}>
              {event.description}
            </Text>
          )}
          <Text size="sm" c="dimmed" mt={4}>
            {new Date(event.triggered_at).toLocaleString()}
          </Text>
          {event.triggered_by_name && (
            <Group gap="xs" mt={8}>
              <Avatar name={event.triggered_by_name} size="sm" radius="xl" color="blue" />
              <Text size="sm">{event.triggered_by_name}</Text>
            </Group>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
