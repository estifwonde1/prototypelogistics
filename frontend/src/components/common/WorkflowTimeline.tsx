import { Timeline, Text, Group, Badge, Avatar } from '@mantine/core';
import { IconCheck, IconClock, IconAlertCircle } from '@tabler/icons-react';
import type { WorkflowEvent } from '../../types/assignment';

interface WorkflowTimelineProps {
  events: WorkflowEvent[] | unknown;
}

function normalizeWorkflowEvents(raw: unknown): WorkflowEvent[] {
  if (Array.isArray(raw)) return raw as WorkflowEvent[];
  return [];
}

export function WorkflowTimeline({ events }: WorkflowTimelineProps) {
  const list = normalizeWorkflowEvents(events);

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

  if (list.length === 0) {
    return <Text c="dimmed">No workflow events yet</Text>;
  }

  const formatWhen = (event: WorkflowEvent) => {
    const ts = event.occurred_at || event.triggered_at || event.created_at;
    if (!ts) return '—';
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  };

  const statusLabel = (event: WorkflowEvent) =>
    event.status ?? event.to_status ?? event.from_status ?? '—';

  const actorLabel = (event: WorkflowEvent) =>
    event.actor_name?.trim() || event.triggered_by_name?.trim() || '';

  return (
    <Timeline active={list.length} bulletSize={24} lineWidth={2}>
      {list.map((event) => {
        const who = actorLabel(event);
        return (
        <Timeline.Item
          key={event.id}
          bullet={getIcon(event.event_type ?? '')}
          title={
            <Group justify="space-between">
              <Text fw={600}>{event.event_type}</Text>
              <Badge size="sm" color={getColor(event.event_type ?? '')}>
                {statusLabel(event)}
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
            {formatWhen(event)}
          </Text>
          {who && (
            <Group gap="xs" mt={8}>
              <Avatar name={who} size="sm" radius="xl" color="blue" />
              <Text size="sm">{who}</Text>
            </Group>
          )}
        </Timeline.Item>
        );
      })}
    </Timeline>
  );
}
