import { Stack, Title, Text, Button } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export function AccessDenied() {
  const navigate = useNavigate();

  return (
    <Stack gap="sm" align="center" justify="center" h="70vh">
      <Title order={2}>Access denied</Title>
      <Text c="dimmed">You do not have permission to view this page.</Text>
      <Button variant="light" onClick={() => navigate('/')}>
        Back to dashboard
      </Button>
    </Stack>
  );
}
