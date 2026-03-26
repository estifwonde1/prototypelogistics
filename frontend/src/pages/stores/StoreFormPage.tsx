/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
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
  Switch,
  Card,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react';
import { getStore, createStore, updateStore } from '../../api/stores';
import { getWarehouses } from '../../api/warehouses';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { notifications } from '@mantine/notifications';
import type { Store } from '../../types/store';

function StoreFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [hasGangway, setHasGangway] = useState(false);

  const { data: store, isLoading } = useQuery({
    queryKey: ['stores', id],
    queryFn: () => getStore(Number(id)),
    enabled: isEdit,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      length: 0,
      width: 0,
      height: 0,
      usable_space: 0,
      available_space: 0,
      temporary: false,
      has_gangway: false,
      gangway_length: 0,
      gangway_width: 0,
      gangway_height: 0,
      warehouse_id: '',
    },
    validate: {
      name: (value) => (!value ? 'Name is required' : null),
      code: (value) => (!value ? 'Code is required' : null),
      length: (value) => (value <= 0 ? 'Length must be greater than 0' : null),
      width: (value) => (value <= 0 ? 'Width must be greater than 0' : null),
      height: (value) => (value <= 0 ? 'Height must be greater than 0' : null),
      usable_space: (value) => (value <= 0 ? 'Usable space must be greater than 0' : null),
      available_space: (value) => (value < 0 ? 'Available space cannot be negative' : null),
      warehouse_id: (value) => (!value ? 'Warehouse is required' : null),
    },
  });

  useEffect(() => {
    if (store) {
      form.setValues({
        code: store.code,
        name: store.name,
        length: store.length,
        width: store.width,
        height: store.height,
        usable_space: store.usable_space,
        available_space: store.available_space,
        temporary: store.temporary,
        has_gangway: store.has_gangway,
        gangway_length: store.gangway_length || 0,
        gangway_width: store.gangway_width || 0,
        gangway_height: store.gangway_height || 0,
        warehouse_id: store.warehouse_id.toString(),
      });
      setHasGangway(store.has_gangway);
    }
  }, [store]);

  const createMutation = useMutation({
    mutationFn: createStore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      notifications.show({
        title: 'Success',
        message: 'Store created successfully',
        color: 'green',
      });
      navigate('/stores');
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to create store',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Store>) => updateStore(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores', id] });
      notifications.show({
        title: 'Success',
        message: 'Store updated successfully',
        color: 'green',
      });
      navigate('/stores');
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to update store',
        color: 'red',
      });
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    const payload: Partial<Store> = {
      code: values.code,
      name: values.name,
      length: values.length,
      width: values.width,
      height: values.height,
      usable_space: values.usable_space,
      available_space: values.available_space,
      temporary: values.temporary,
      has_gangway: values.has_gangway,
      warehouse_id: Number(values.warehouse_id),
    };

    if (values.has_gangway) {
      payload.gangway_length = values.gangway_length;
      payload.gangway_width = values.gangway_width;
      payload.gangway_height = values.gangway_height;
    }

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const warehouseOptions = warehouses?.map((warehouse) => ({
    value: warehouse.id.toString(),
    label: `${warehouse.name} (${warehouse.code})`,
  }));

  if (isEdit && isLoading) {
    return <LoadingState message="Loading store..." />;
  }

  if (isEdit && !store) {
    return <ErrorState message="Store not found" />;
  }

  return (
    <Stack gap="md">
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/stores')}
        >
          Back
        </Button>
        <Title order={2}>{isEdit ? 'Edit Store' : 'Create Store'}</Title>
      </Group>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Basic Information</Title>

              <Group grow>
                <TextInput
                  label="Code"
                  placeholder="STORE-001"
                  required
                  {...form.getInputProps('code')}
                />
                <TextInput
                  label="Name"
                  placeholder="Main Storage Area"
                  required
                  {...form.getInputProps('name')}
                />
              </Group>

              <Select
                label="Warehouse"
                placeholder="Select warehouse"
                required
                searchable
                data={warehouseOptions || []}
                {...form.getInputProps('warehouse_id')}
              />

              <Group grow>
                <Switch
                  label="Temporary Storage"
                  description="Is this a temporary storage space?"
                  {...form.getInputProps('temporary', { type: 'checkbox' })}
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

              <Group grow>
                <NumberInput
                  label="Usable Space (m³)"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps('usable_space')}
                />
                <NumberInput
                  label="Available Space (m³)"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps('available_space')}
                />
              </Group>
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Stack gap="md">
              <Group>
                <Title order={4}>Gangway</Title>
                <Switch
                  label="Has Gangway"
                  {...form.getInputProps('has_gangway', { type: 'checkbox' })}
                  onChange={(event) => {
                    form.setFieldValue('has_gangway', event.currentTarget.checked);
                    setHasGangway(event.currentTarget.checked);
                  }}
                />
              </Group>

              {hasGangway && (
                <>
                  <Text size="sm" c="dimmed">
                    Gangway dimensions (optional)
                  </Text>
                  <Group grow>
                    <NumberInput
                      label="Gangway Length (m)"
                      placeholder="0"
                      min={0}
                      decimalScale={2}
                      {...form.getInputProps('gangway_length')}
                    />
                    <NumberInput
                      label="Gangway Width (m)"
                      placeholder="0"
                      min={0}
                      decimalScale={2}
                      {...form.getInputProps('gangway_width')}
                    />
                    <NumberInput
                      label="Gangway Height (m)"
                      placeholder="0"
                      min={0}
                      decimalScale={2}
                      {...form.getInputProps('gangway_height')}
                    />
                  </Group>
                </>
              )}
            </Stack>
          </Card>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => navigate('/stores')}>
              Cancel
            </Button>
            <Button
              type="submit"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? 'Update Store' : 'Create Store'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}

export default StoreFormPage;
