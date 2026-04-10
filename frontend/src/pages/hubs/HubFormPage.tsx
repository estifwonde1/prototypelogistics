/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Card,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react';
import { getHub, createHub, updateHub } from '../../api/hubs';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { notifications } from '@mantine/notifications';
import type { Hub } from '../../types/hub';

function HubFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: hub, isLoading } = useQuery({
    queryKey: ['hubs', id],
    queryFn: () => getHub(Number(id)),
    enabled: isEdit,
  });

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      hub_type: 'regional',
      status: 'active',
      description: '',
      location_id: '',
      geo_id: '',
      kebele: '' as number | '',
    },
    validate: {
      name: (value) => (!value ? 'Name is required' : null),
      code: (value) => (!value ? 'Code is required' : null),
      hub_type: (value) => (!value ? 'Hierarchical level is required' : null),
      kebele: (value) => {
        if (value === '' || value === null || value === undefined) return null;
        const num = Number(value);
        if (isNaN(num)) return 'Kebele must be a number';
        if (num < 1 || num > 40) return 'Kebele must be between 1 and 40';
        return null;
      },
    },
  });

  useEffect(() => {
    if (hub) {
      form.setValues({
        code: hub.code,
        name: hub.name,
        hub_type: hub.hub_type,
        status: hub.status,
        description: hub.description || '',
        location_id: hub.location_id?.toString() || '',
        geo_id: hub.geo_id?.toString() || '',
        kebele: hub.kebele ?? '',
      });
    }
  }, [hub]);

  const createMutation = useMutation({
    mutationFn: createHub,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      notifications.show({
        title: 'Success',
        message: 'Hub created successfully',
        color: 'green',
      });
      navigate(`/hubs/${data.id}`);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to create hub',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Hub>) => updateHub(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubs'] });
      queryClient.invalidateQueries({ queryKey: ['hubs', id] });
      notifications.show({
        title: 'Success',
        message: 'Hub updated successfully',
        color: 'green',
      });
      navigate(`/hubs/${id}`);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to update hub',
        color: 'red',
      });
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    const payload: Partial<Hub> = {
      code: values.code,
      name: values.name,
      hub_type: values.hub_type,
      status: values.status,
      description: values.description || undefined,
      location_id: values.location_id ? Number(values.location_id) : undefined,
      geo_id: values.geo_id ? Number(values.geo_id) : undefined,
      kebele: values.kebele !== '' ? Number(values.kebele) : undefined,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEdit && isLoading) {
    return <LoadingState message="Loading hub..." />;
  }

  if (isEdit && !hub) {
    return <ErrorState message="Hub not found" />;
  }

  return (
    <Stack gap="md">
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(isEdit ? `/hubs/${id}` : '/hubs')}
        >
          Back
        </Button>
        <Title order={2}>{isEdit ? 'Edit Hub' : 'Create Hub'}</Title>
      </Group>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Basic Information</Title>

              <Group grow>
                <TextInput
                  label="Code"
                  placeholder="HUB-001"
                  required
                  {...form.getInputProps('code')}
                />
                <TextInput
                  label="Name"
                  placeholder="Central Hub"
                  required
                  {...form.getInputProps('name')}
                />
              </Group>

              <Group grow>
                <Select
                  label="Hierarchical Level"
                  placeholder="Select level"
                  required
                  data={[
                    { value: 'federal', label: 'Federal' },
                    { value: 'regional', label: 'Regional' },
                    { value: 'zonal', label: 'Zonal' },
                    { value: 'woreda', label: 'Woreda' },
                    { value: 'kebele', label: 'Kebele' },
                  ]}
                  {...form.getInputProps('hub_type')}
                />
                <Select
                  label="Status"
                  placeholder="Select status"
                  required
                  data={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'maintenance', label: 'Maintenance' },
                  ]}
                  {...form.getInputProps('status')}
                />
              </Group>

              <Group grow align="flex-start">
                <NumberInput
                  label="Location ID"
                  placeholder="Enter location ID"
                  min={1}
                  {...form.getInputProps('location_id')}
                />
                <NumberInput
                  label="Geo ID"
                  placeholder="Enter geo ID"
                  min={1}
                  {...form.getInputProps('geo_id')}
                />
                <NumberInput
                  label="Kebele (Optional)"
                  placeholder="1-40"
                  min={1}
                  max={40}
                  {...form.getInputProps('kebele')}
                />
              </Group>

              <Textarea
                label="Description"
                placeholder="Enter hub description..."
                minRows={3}
                {...form.getInputProps('description')}
              />
            </Stack>
          </Card>

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => navigate(isEdit ? `/hubs/${id}` : '/hubs')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? 'Update Hub' : 'Create Hub'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}

export default HubFormPage;
