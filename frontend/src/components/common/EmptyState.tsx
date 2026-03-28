import { Stack, Text, Button } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Stack align="center" justify="center" py={60}>
      <IconInbox size={64} stroke={1.5} color="var(--mantine-color-gray-4)" />
      <div style={{ textAlign: 'center' }}>
        <Text size="lg" fw={600} mb="xs">
          {title}
        </Text>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
      </div>
      {action && (
        <Button onClick={action.onClick} mt="md">
          {action.label}
        </Button>
      )}
    </Stack>
  );
}
