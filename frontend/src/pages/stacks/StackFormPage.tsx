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
  NumberInput,
  Select,
  Card,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react';
import { getStack, createStack, updateStack } from '../../api/stacks';
import { getStores } from '../../api/stores';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { notifications } from '@mantine/notifications';
import type { Stack as StackType } from '../../types/stack';

function StackFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: stack, isLoading } = useQuery({
    queryKey: ['stacks', id],
    queryFn: () => getStack(Number(id)),
    enabled: isEdit,
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const form = useForm({
    initialValues: {
      code: '',
      length: 0,
      width: 0,
      height: 0,
      start_x: 0,
      start_y: 0,
      commodity_id: '',
      store_id: '',
      commodity_status: 'good',
      stack_status: 'active',
      quantity: 0,
      unit_id: '',
    },
    validate: {
      code: (value) => (!value ? 'Code is required' : null),
      length: (value) => (value <= 0 ? 'Length must be greater than 0' : null),
      width: (value) => (value <= 0 ? 'Width must be greater than 0' : null),
      height: (value) => (value <= 0 ? 'Height must be greater than 0' : null),
      start_x: (value) => (value < 0 ? 'X position cannot be negative' : null),
      start_y: (value) => (value < 0 ? 'Y position cannot be negative' : null),
      commodity_id: (value) => (!value ? 'Commodity is required' : null),
      store_id: (value) => (!value ? 'Store is required' : null),
      quantity: (value) => (value < 0 ? 'Quantity cannot be negative' : null),
      unit_id: (value) => (!value ? 'Unit is required' : null),
    },
  });

  useEffect(() => {
    if (stack) {
      form.setValues({
        code: stack.code,
        length: stack.length,
        width: stack.width,
        height: stack.height,
        start_x: stack.start_x,
        start_y: stack.start_y,
        commodity_id: stack.commodity_id.toString(),
        store_id: stack.store_id.toString(),
        commodity_status: stack.commodity_status,
        stack_status: stack.stack_status,
        quantity: stack.quantity,
        unit_id: stack.unit_id.toString(),
      });
    }
  }, [stack]);

  const createMutation = useMutation({
    mutationFn: createStack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      notifications.show({
        title: 'Success',
        message: 'Stack created successfully',
        color: 'green',
      });
      navigate('/stacks');
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to create stack',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<StackType>) => updateStack(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      queryClient.invalidateQueries({ queryKey: ['stacks', id] });
      notifications.show({
        title: 'Success',
        message: 'Stack updated successfully',
        color: 'green',
      });
      navigate('/stacks');
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to update stack',
        color: 'red',
      });
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    const payload: Partial<StackType> = {
      code: values.code,
      length: values.length,
      width: values.width,
      height: values.height,
      start_x: values.start_x,
      start_y: values.start_y,
      commodity_id: Number(values.commodity_id),
      store_id: Number(values.store_id),
      commodity_status: values.commodity_status,
      stack_status: values.stack_status,
      quantity: values.quantity,
      unit_id: Number(values.unit_id),
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const storeOptions = stores?.map((store) => ({
    value: store.id.toString(),
    label: `${store.name} (${store.code})`,
  }));

  // Placeholder options for commodity and unit - these should be fetched from API
  const commodityOptions = [
    { value: '1', label: 'Wheat' },
    { value: '2', label: 'Maize' },
    { value: '3', label: 'Rice' },
    { value: '4', label: 'Barley' },
  ];

  const unitOptions = [
    { value: '1', label: 'Quintal (qt)' },
    { value: '2', label: 'Kilogram (kg)' },
    { value: '3', label: 'Metric Ton (mt)' },
    { value: '4', label: 'Bag' },
  ];

  const commodityStatusOptions = [
    { value: 'good', label: 'Good' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'expired', label: 'Expired' },
    { value: 'quarantine', label: 'Quarantine' },
  ];

  const stackStatusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'empty', label: 'Empty' },
  ];

  if (isEdit && isLoading) {
    return <LoadingState message="Loading stack..." />;
  }

  if (isEdit && !stack) {
    return <ErrorState message="Stack not found" />;
  }

  return (
    <Stack gap="md">
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/stacks')}
        >
          Back
        </Button>
        <Title order={2}>{isEdit ? 'Edit Stack' : 'Create Stack'}</Title>
      </Group>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Basic Information</Title>

              <TextInput
                label="Code"
                placeholder="STACK-001"
                required
                {...form.getInputProps('code')}
              />

              <Group grow>
                <Select
                  label="Store"
                  placeholder="Select store"
                  required
                  searchable
                  data={storeOptions || []}
                  {...form.getInputProps('store_id')}
                />
                <Select
                  label="Commodity"
                  placeholder="Select commodity"
                  required
                  searchable
                  data={commodityOptions}
                  {...form.getInputProps('commodity_id')}
                />
              </Group>

              <Group grow>
                <Select
                  label="Commodity Status"
                  placeholder="Select status"
                  required
                  data={commodityStatusOptions}
                  {...form.getInputProps('commodity_status')}
                />
                <Select
                  label="Stack Status"
                  placeholder="Select status"
                  required
                  data={stackStatusOptions}
                  {...form.getInputProps('stack_status')}
                />
              </Group>
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Dimensions</Title>

              <Group grow>
                <NumberInput
                  label="Length (m)"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps('length')}
                />
                <NumberInput
                  label="Width (m)"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps('width')}
                />
                <NumberInput
                  label="Height (m)"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps('height')}
                />
              </Group>
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Position</Title>

              <Group grow>
                <NumberInput
                  label="Start X Position"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps('start_x')}
                />
                <NumberInput
                  label="Start Y Position"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps('start_y')}
                />
              </Group>
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Quantity</Title>

              <Group grow>
                <NumberInput
                  label="Quantity"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps('quantity')}
                />
                <Select
                  label="Unit of Measure"
                  placeholder="Select unit"
                  required
                  searchable
                  data={unitOptions}
                  {...form.getInputProps('unit_id')}
                />
              </Group>
            </Stack>
          </Card>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => navigate('/stacks')}>
              Cancel
            </Button>
            <Button
              type="submit"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? 'Update Stack' : 'Create Stack'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}

export default StackFormPage;
