/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Grid,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArrowLeft, IconDeviceFloppy, IconInfoCircle } from '@tabler/icons-react';
import { getStore, createStore, updateStore } from '../../api/stores';
import { getWarehouse, getWarehouses } from '../../api/warehouses';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { AccessDenied } from '../../components/common/AccessDenied';
import { notifications } from '@mantine/notifications';
import type { Store } from '../../types/store';
import type { Warehouse } from '../../types/warehouse';
import { usePermission } from '../../hooks/usePermission';

function StoreFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const { can } = usePermission();
  const canCreateStores = can('stores', 'create');
  const canUpdateStores = can('stores', 'update');
  const preselectedWarehouseId = searchParams.get('warehouse_id');
  const [hasGangway, setHasGangway] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(
    preselectedWarehouseId ? Number(preselectedWarehouseId) : null
  );

  const { data: store, isLoading } = useQuery({
    queryKey: ['stores', id],
    queryFn: () => getStore(Number(id)),
    enabled: isEdit,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const { data: selectedWarehouse } = useQuery({
    queryKey: ['warehouses', selectedWarehouseId],
    queryFn: () => getWarehouse(selectedWarehouseId as number),
    enabled: selectedWarehouseId !== null,
  });

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      length: 2,
      width: 2,
      height: 1,
      temporary: false,
      has_gangway: false,
      gangway_length: 0,
      gangway_width: 0,
      warehouse_id: preselectedWarehouseId || '',
    },
    validateInputOnChange: ['length', 'width', 'height', 'warehouse_id'],
    validate: {
      name: (value) => (!value ? 'Name is required' : null),
      code: (value) => (!value ? 'Code is required' : null),
      length: (value) => {
        if (value < 2) return 'Length must be at least 2 meters';
        return validateWarehouseLength(value, selectedWarehouse);
      },
      width: (value) => {
        if (value < 2) return 'Width must be at least 2 meters';
        return validateWarehouseWidth(value, selectedWarehouse);
      },
      height: (value) => {
        if (value <= 0) return 'Height must be greater than 0';
        return validateWarehouseHeight(value, selectedWarehouse);
      },
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
        temporary: store.temporary,
        has_gangway: store.has_gangway,
        gangway_length: store.gangway_length || 0,
        gangway_width: store.gangway_width || 0,
        warehouse_id: store.warehouse_id.toString(),
      });
      setHasGangway(store.has_gangway);
      setSelectedWarehouseId(store.warehouse_id);
    }
  }, [store]);

  useEffect(() => {
    if (!selectedWarehouse) return;
    form.validateField('length');
    form.validateField('width');
    form.validateField('height');
  }, [selectedWarehouse]);

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
      temporary: values.temporary,
      has_gangway: values.has_gangway,
      warehouse_id: Number(values.warehouse_id),
    };

    if (values.has_gangway) {
      payload.gangway_length = values.gangway_length;
      payload.gangway_width = values.gangway_width;
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

  const maximumLength = selectedWarehouse?.capacity?.length_m
    ? selectedWarehouse.capacity.length_m
    : undefined;
  const maximumWidth = selectedWarehouse?.capacity?.width_m
    ? selectedWarehouse.capacity.width_m
    : undefined;
  const maximumHeight =
    selectedWarehouse?.capacity?.height_m !== null &&
    selectedWarehouse?.capacity?.height_m !== undefined
      ? selectedWarehouse.capacity.height_m
      : undefined;
  const availableSpace = computeAvailableSpace(form.values.length, form.values.width);
  const usableSpace = computeUsableSpace(form.values.length, form.values.width);
  const hasWarehouseDimensionLimits =
    maximumLength !== undefined || maximumWidth !== undefined || maximumHeight !== undefined;

  if (!isEdit && !canCreateStores) {
    return <AccessDenied />;
  }

  if (isEdit && !canUpdateStores) {
    return <AccessDenied />;
  }

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
                disabled={!!preselectedWarehouseId && !isEdit}
                value={form.values.warehouse_id}
                onChange={(value) => {
                  form.setFieldValue('warehouse_id', value || '');
                  setSelectedWarehouseId(value ? Number(value) : null);
                }}
                error={form.errors.warehouse_id}
              />

              {selectedWarehouse && (
                <Card withBorder padding="sm" bg="gray.0">
                  <Stack gap={4}>
                    <Text fw={600} size="sm">
                      Warehouse Reference
                    </Text>
                    <Grid>
                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <Text size="sm">Total Area: {selectedWarehouse.capacity?.total_area_sqm ?? '-'} m²</Text>
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <Text size="sm">
                          Capacity: {selectedWarehouse.capacity?.total_storage_capacity_mt ?? '-'} m³
                        </Text>
                      </Grid.Col>
                    </Grid>
                  </Stack>
                </Card>
              )}

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

              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                {hasWarehouseDimensionLimits ? (
                  <Text size="sm">
                    Maximum Length = {maximumLength ?? '-'} m, Maximum Width = {maximumWidth ?? '-'} m,
                    Maximum Height = {maximumHeight ?? '-'} m
                  </Text>
                ) : (
                  <Text size="sm">
                    Total Area and Usable Area are calculated automatically from the store length and width.
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  Total Area = length x width. Usable Area = (length - 2) x (width - 2).
                </Text>
              </Alert>

              <Group grow>
                <NumberInput
                  label="Length (m)"
                  placeholder="0"
                  required
                  min={2}
                  decimalScale={2}
                  description={hasWarehouseDimensionLimits && maximumLength !== undefined ? `Maximum allowed: ${maximumLength} m` : undefined}
                  {...form.getInputProps('length')}
                />
                <NumberInput
                  label="Width (m)"
                  placeholder="0"
                  required
                  min={2}
                  decimalScale={2}
                  description={hasWarehouseDimensionLimits && maximumWidth !== undefined ? `Maximum allowed: ${maximumWidth} m` : undefined}
                  {...form.getInputProps('width')}
                />
                <NumberInput
                  label="Height (m)"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  description={hasWarehouseDimensionLimits && maximumHeight !== undefined ? `Maximum allowed: ${maximumHeight} m` : undefined}
                  {...form.getInputProps('height')}
                />
              </Group>

              <Group grow>
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed">Usable Area (m²)</Text>
                  <Text fw={600}>{usableSpace.toFixed(2)}</Text>
                </Card>
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed">Total Area (m²)</Text>
                  <Text fw={600}>{availableSpace.toFixed(2)}</Text>
                </Card>
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

function computeAvailableSpace(length: number, width: number) {
  return Math.max(length, 0) * Math.max(width, 0);
}

function computeUsableSpace(length: number, width: number) {
  if (length < 2 || width < 2) return 0;
  return (length - 2) * (width - 2);
}

function validateWarehouseLength(value: number, warehouse: Warehouse | undefined) {
  const maxLength = warehouse?.capacity?.length_m;
  if (typeof maxLength === 'number' && value > maxLength) {
    return `Length must not exceed ${maxLength} meters`;
  }
  return null;
}

function validateWarehouseWidth(value: number, warehouse: Warehouse | undefined) {
  const maxWidth = warehouse?.capacity?.width_m;
  if (typeof maxWidth === 'number' && value > maxWidth) {
    return `Width must not exceed ${maxWidth} meters`;
  }
  return null;
}

function validateWarehouseHeight(value: number, warehouse: Warehouse | undefined) {
  const maxHeight = warehouse?.capacity?.height_m;
  if (typeof maxHeight === 'number' && value > maxHeight) {
    return `Height must not exceed ${maxHeight} meters`;
  }
  return null;
}

export default StoreFormPage;
