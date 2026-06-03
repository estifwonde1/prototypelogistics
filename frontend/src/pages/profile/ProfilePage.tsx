import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, Group, Title, TextInput, PasswordInput, Button, Paper, Text, Badge, Divider } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { changeMyPassword, getMyProfile, MY_PROFILE_QUERY_KEY, updateMyProfile } from '../../api/me';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

function validatePhone(value: string) {
  if (!value) return 'Phone is required';
  const digitsOnly = value.replace(/\D/g, '');
  if (!(digitsOnly.length === 10 || digitsOnly.length === 12)) {
    return 'Phone must be 10 or 12 digits';
  }
  return null;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error, refetch } = useQuery({
    queryKey: MY_PROFILE_QUERY_KEY,
    queryFn: getMyProfile,
  });

  const phoneForm = useForm({
    initialValues: {
      phone_number: '',
    },
    validate: {
      phone_number: validatePhone,
    },
  });

  useEffect(() => {
    if (profile?.phone_number) {
      phoneForm.setValues({ phone_number: profile.phone_number });
    }
  }, [profile?.phone_number]);

  const passwordForm = useForm({
    initialValues: {
      current_password: '',
      password: '',
      password_confirmation: '',
    },
    validate: {
      current_password: (v) => (!v ? 'Current password is required' : null),
      password: (v) => {
        if (!v) return 'New password is required';
        if (v.length < 6) return 'Password must be at least 6 characters';
        return null;
      },
      password_confirmation: (v, values) =>
        v !== values.password ? 'Passwords do not match' : null,
    },
  });


  const phoneMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(MY_PROFILE_QUERY_KEY, updated);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      phoneForm.setValues({ phone_number: updated.phone_number });
      notifications.show({ title: 'Success', message: 'Phone number updated', color: 'green' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message || 'Failed to update phone', color: 'red' });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: changeMyPassword,
    onSuccess: () => {
      passwordForm.reset();
      notifications.show({ title: 'Success', message: 'Password changed successfully', color: 'green' });
    },
    onError: (err: any) => {
      if (err.response?.status===422){
        passwordForm.setFieldError('current_password','Incorrect Current password ');
      } else {
        notifications.show({ title: 'Error', message: err.message || 'Failed to change password', color: 'red' });
      }
    },
  });

  if (isLoading) return <LoadingState />;
  if (error || !profile) return <ErrorState message="Failed to load profile" onRetry={() => refetch()} />;

  const fullName = `${profile.first_name} ${profile.last_name}`.trim();

  return (
    <Stack gap="lg">
      <Title order={2}>Profile</Title>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Text fw={600} size="lg">
            Account details
          </Text>
          <TextInput label="Name" value={fullName} readOnly disabled />
          <TextInput label="Email" value={profile.email} readOnly disabled />
          <div>
            <Text size="sm" fw={500} mb={4}>
              Roles
            </Text>
            <Group gap="xs">
              {profile.roles.length > 0 ? (
                profile.roles.map((role) => (
                  <Badge key={role} variant="light">
                    {role}
                  </Badge>
                ))
              ) : (
                <Text size="sm" c="dimmed">
                  No roles assigned
                </Text>
              )}
            </Group>
          </div>
          <form
            onSubmit={phoneForm.onSubmit((values) => {
              phoneMutation.mutate({ phone_number: values.phone_number });
            })}
          >
            <Stack gap="md">
              <TextInput
                label="Phone number"
                placeholder="0919000000 or 251911223344"
                {...phoneForm.getInputProps('phone_number')}
              />
              <Group justify="flex-end">
                <Button type="submit" loading={phoneMutation.isPending}>
                  Save phone
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Text fw={600} size="lg">
            Change password
          </Text>
          <form
            onSubmit={passwordForm.onSubmit((values) => {
              passwordMutation.mutate(values);
            })}
          >
            <Stack gap="md">
              <PasswordInput
                label="Current password"
                {...passwordForm.getInputProps('current_password')}
              />
              <PasswordInput label="New password" {...passwordForm.getInputProps('password')} />
              <PasswordInput
                label="Confirm new password"
                {...passwordForm.getInputProps('password_confirmation')}
              />
              <Divider />
              <Group justify="flex-end">
                <Button type="submit" loading={passwordMutation.isPending}>
                  Change password
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Stack>
  );
}
