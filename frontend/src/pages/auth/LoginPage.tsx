import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextInput, PasswordInput, Button, Paper, Title, Container, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { login } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug, getDefaultRouteForRole } from '../../utils/constants';

function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => {
        if (!value) return 'Email is required';
        if (!/^\S+@\S+$/.test(value)) return 'Invalid email format';
        return null;
      },
      password: (value) => (!value ? 'Password is required' : null),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError(null);

    try {
      const response = await login(values);
      const roleSlug = normalizeRoleSlug(response.role ?? undefined);
      const safeRole = roleSlug ?? 'admin';
      setAuth(response.token, response.user_id, safeRole);
      navigate(getDefaultRouteForRole(safeRole));
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Invalid credentials. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={100}>
      <Title ta="center" mb="md">
        CATS Warehouse Management
      </Title>
      <Title order={3} ta="center" mb="xl" c="dimmed">
        Sign in to your account
      </Title>

      <Paper withBorder shadow="md" p={30} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
              {error}
            </Alert>
          )}

          <TextInput
            label="Email"
            placeholder="your@email.com"
            required
            mb="md"
            {...form.getInputProps('email')}
          />

          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            mb="xl"
            {...form.getInputProps('password')}
          />

          <Button type="submit" fullWidth loading={loading}>
            Sign in
          </Button>
        </form>
      </Paper>
    </Container>
  );
}

export default LoginPage;
