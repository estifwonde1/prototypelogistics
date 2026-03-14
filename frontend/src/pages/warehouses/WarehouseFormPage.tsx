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
import { getWarehouse, createWarehouse, updateWarehouse } from '../../api/warehouses';
import { getHubs } from '../../api/hubs';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { notifications } from '@mantine/notifications';
import type { Warehouse } from '../../types/warehouse';

function WarehouseFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: warehouse, isLoading } = useQuery({
    queryKey: ['warehouses', id],
    queryFn: () => getWarehouse(Number(id)),
    enabled: isEdit,
  });

  const { data: hubs } = useQuery({
    queryKey: ['hubs'],
    queryFn: getHubs,
  });

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      warehouse_type: 'main',
      status: 'active',
      description: '',
      hub_id: '',
      location_id: '',
      geo_id: '',
    },
    validate: {
      name: (value) => (!value ? 'Name is required' : null),
      code: (value) => (!value ? 'Code is required' : null),
    },
  });

  useEffect(() => {
    if (warehouse) {
      form.setValues({
        code: warehouse.code,
        name: warehouse.name,
        warehouse_type: warehouse.warehouse_type,
        status: warehouse.status,
        description: warehouse.description || '',
        hub_id: warehouse.hub_id?.toString() || '',
        location_id: warehouse.location_id?.toString() || '',
        geo_id: warehouse.geo_id?.toString() || '',
      });
    }
  }, [warehouse]);

  const createMutation = useMutation({
    mutationFn: createWarehouse,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      notifications.show({
        title: 'Success',
        message: 'Warehouse created successfully',
        color: 'green',
      });
      navigate(`/warehouses/${data.id}`);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to create warehouse',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Warehouse>) => updateWarehouse(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses', id] });
      notifications.show({
        title: 'Success',
        message: 'Warehouse updated successfully',
        color: 'green',
      });
      navigate(`/warehouses/${id}`);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to update warehouse',
        color: 'red',
      });
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    const payload: Partial<Warehouse> = {
      code: values.code,
      name: values.name,
      warehouse_type: values.warehouse_type,
      status: values.status,
      description: values.description || undefined,
      hub_id: values.hub_id ? Number(values.hub_id) : undefined,
      location_id: values.location_id ? Number(values.location_id) : undefined,
      geo_id: values.geo_id ? Number(values.geo_id) : undefined,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const hubOptions = hubs?.map((hub) => ({
    value: hub.id.toString(),
    label: `${hub.name} (${hub.code})`,
  }));

  if (isEdit && isLoading) {
    return <LoadingState message="Loading warehouse..." />;
  }

  if (isEdit && !warehouse) {
    return <ErrorState message="Warehouse not found" />;
  }

  return (
    <Stack gap="md">
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(isEdit ? `/warehouses/${id}` : '/warehouses')}
        >
          Back
        </Button>
        <Title order={2}>{isEdit ? 'Edit Warehouse' : 'Create Warehouse'}</Title>
      </Group>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Basic Information</Title>

              <Group grow>
                <TextInput
                  label="Code"
                  placeholder="WH-001"
                  required
                  {...form.getInputProps('code')}
                />
                <TextInput
                  label="Name"
                  placeholder="Central Warehouse"
                  required
                  {...form.getInputProps('name')}
                />
              </Group>

              <Group grow>
                <Select
                  label="Warehouse Type"
                  placeholder="Select type"
                  required
                  data={[
                    { value: 'main', label: 'Main' },
                    { value: 'satellite', label: 'Satellite' },
                    { value: 'temporary', label: 'Temporary' },
                  ]}
                  {...form.getInputProps('warehouse_type')}
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

              <Select
                label="Hub"
                placeholder="Select hub"
                data={hubOptions || []}
                searchable
                clearable
                {...form.getInputProps('hub_id')}
              />

              <Textarea
                label="Description"
                placeholder="Enter warehouse description..."
                minRows={3}
                {...form.getInputProps('description')}
              />

              <Group grow>
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
              </Group>
            </Stack>
          </Card>

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => navigate(isEdit ? `/warehouses/${id}` : '/warehouses')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? 'Update Warehouse' : 'Create Warehouse'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}

export default WarehouseFormPage;
