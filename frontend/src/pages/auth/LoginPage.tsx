import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { TextInput, PasswordInput, Button, Paper, Title, Container, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { login } from '../../api/auth';
import { getMyAssignments } from '../../api/me';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug, getDefaultRouteForRole, type RoleSlug } from '../../utils/constants';
import type { ApiError } from '../../types/common';

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setAssignments = useAuthStore((state) => state.setAssignments);
  const setActiveAssignment = useAuthStore((state) => state.setActiveAssignment);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDefaultRouteForRole((useAuthStore.getState().role as RoleSlug | null) ?? null), { replace: true });
    }
  }, [isAuthenticated, navigate]);

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
      const primaryRole = normalizeRoleSlug(response.role);
      const isAdmin = primaryRole === 'admin' || primaryRole === 'superadmin';
      
      setAuth(response.token, response.user_id, primaryRole);

      queryClient.clear();

      // Fetch ALL assignments to determine role/facility scope
      const assignments = await getMyAssignments();
      setAssignments(assignments);

      if (isAdmin) {
        // Admins go to the default dashboard (usually /admin/users or global dashboard)
        navigate(getDefaultRouteForRole(primaryRole));
        return;
      }

      if (assignments.length === 0) {
        throw new Error('Your account has not been assigned to a facility yet. Please contact your administrator.');
      }

      if (assignments.length === 1) {
        // Auto-select single assignment
        const assignment = assignments[0];
        const roleSlug = normalizeRoleSlug(assignment.role_name);
        if (!roleSlug) {
          throw new Error('Your account does not have a supported warehouse role. Contact an administrator.');
        }
        setAuth(response.token, response.user_id, roleSlug);
        setActiveAssignment(assignment);
        navigate(getDefaultRouteForRole(roleSlug));
      } else {
        // Multiple assignments: let user choose
        navigate('/select-role');
      }
    } catch (err: unknown) {
      const errorMessage =
        (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
        (err instanceof Error ? err.message : undefined) ||
        'Invalid credentials. Please try again.';
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
