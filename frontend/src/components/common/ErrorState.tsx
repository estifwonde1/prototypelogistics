import { Alert, Button, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Error', message, onRetry }: ErrorStateProps) {
  return (
    <Stack gap="md" py={20}>
      <Alert icon={<IconAlertCircle size={16} />} title={title} color="red">
        {message}
      </Alert>
      {onRetry && (
        <Button onClick={onRetry} variant="light">
          Try Again
        </Button>
      )}
    </Stack>
  );
}
