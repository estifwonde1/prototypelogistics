import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Group, Select, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { createDispatchPlan, getDispatchPlan, updateDispatchPlan } from '../../api/dispatchPlans';
import { useAuthStore } from '../../store/authStore';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import type { ApiError } from '../../types/common';

interface FormValues {
  reference_no: string;
  description: string;
  status: string;
  upstream: boolean;
}

const STATUS_OPTIONS = ['Draft', 'Approved', 'Confirmed'].map((s) => ({ value: s, label: s }));

export default function DispatchPlanFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);

  const { data: plan, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch-plan', id],
    queryFn: () => getDispatchPlan(Number(id)),
    enabled: isEdit,
  });

  const form = useForm<FormValues>({
    initialValues: {
      reference_no: '',
      description: '',
      status: 'Draft',
      upstream: false,
    },
    validate: {
      reference_no: (v) => (!v.trim() ? 'Reference number is required' : null),
      status: (v) => (!v ? 'Status is required' : null),
    },
  });

  useEffect(() => {
    if (!plan) return;

    form.setValues({
      reference_no: plan.reference_no || '',
      description: plan.description || '',
      status: plan.status || 'Draft',
      upstream: Boolean(plan.upstream),
    });
    // Avoid depending on the form object itself to prevent update loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!userId) {
        throw new Error('Session user is missing. Please re-login.');
      }

      const payload = {
        reference_no: values.reference_no.trim(),
        description: values.description.trim() || undefined,
        status: values.status,
        upstream: values.upstream,
        prepared_by_id: plan?.prepared_by_id || userId,
      };

      return isEdit ? updateDispatchPlan(Number(id), payload) : createDispatchPlan(payload);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-plans'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-plan', String(saved.id)] });
      notifications.show({
        title: 'Success',
        message: `Dispatch plan ${isEdit ? 'updated' : 'created'} successfully`,
        color: 'green',
      });
      navigate(`/dispatch-plans/${saved.id}`);
    },
    onError: (err: unknown) => {
      const message =
        (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
        (err instanceof Error ? err.message : undefined) ||
        `Failed to ${isEdit ? 'update' : 'create'} dispatch plan`;
      notifications.show({ title: 'Error', message, color: 'red' });
    },
  });

  if (isEdit && isLoading) return <LoadingState message="Loading dispatch plan..." />;
  if (isEdit && error) return <ErrorState message="Failed to load dispatch plan" onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>{isEdit ? 'Edit Dispatch Plan' : 'Create Dispatch Plan'}</Title>
        <Text c="dimmed" size="sm">
          Define a planner-owned movement plan before authorization and dispatch
        </Text>
      </div>

      <Card withBorder>
        <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
          <Stack gap="md">
            <Group grow>
              <TextInput
                label="Reference No"
                placeholder="DP-BOLE-YEKA-001"
                required
                {...form.getInputProps('reference_no')}
              />
              <Select
                label="Status"
                data={STATUS_OPTIONS}
                required
                {...form.getInputProps('status')}
              />
            </Group>

            <TextInput
              label="Description"
              placeholder="Rice transfer Bole to Yeka - 500kg"
              {...form.getInputProps('description')}
            />

            <Switch
              label="Upstream planning source"
              description="Enable if this plan is created from an upstream process"
              checked={form.values.upstream}
              onChange={(event) => form.setFieldValue('upstream', event.currentTarget.checked)}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => navigate(isEdit ? `/dispatch-plans/${id}` : '/dispatch-plans')}>
                Cancel
              </Button>
              <Button type="submit" loading={mutation.isPending}>
                {isEdit ? 'Update Plan' : 'Create Plan'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
