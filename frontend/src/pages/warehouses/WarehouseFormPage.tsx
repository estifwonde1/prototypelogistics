/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
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
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react';
import { getWarehouse, createWarehouse, updateWarehouse } from '../../api/warehouses';
import { getHubs } from '../../api/hubs';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { RentalAgreementUpload } from '../../components/common/RentalAgreementUpload';
import { notifications } from '@mantine/notifications';
import type { WarehouseUpsertPayload } from '../../types/warehouse';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';

const HUB_MANAGER_OWNERSHIP_OPTIONS = [
  { value: 'self_owned', label: 'Self Owned' },
  { value: 'rental', label: 'Rental' },
];

const LEGACY_OWNERSHIP_SELECT_OPTIONS = [
  { value: 'Regional Government', label: 'Regional Government' },
  { value: 'Zone/Subcity', label: 'Zone/Subcity' },
  { value: 'Woreda', label: 'Woreda' },
  { value: 'hub', label: 'Hub' },
];

function WarehouseFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const { can } = usePermission();
  const canReadHubs = can('hubs', 'read');
  const role = useAuthStore((state) => state.role);
  const isHubManager = role === 'hub_manager';
  const [rentalAgreementFile, setRentalAgreementFile] = useState<File | null>(null);

  const { data: warehouse, isLoading } = useQuery({
    queryKey: ['warehouses', id],
    queryFn: () => getWarehouse(Number(id)),
    enabled: isEdit,
  });

  const { data: hubs } = useQuery({
    queryKey: ['hubs'],
    queryFn: getHubs,
    enabled: canReadHubs,
  });

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      warehouse_type: 'main',
      status: 'active',
      ownership_type: isHubManager ? 'self_owned' : '',
      description: '',
      hub_id: '',
      location_id: '',
      geo_id: '',
    },
    validate: {
      name: (value) => (!value ? 'Name is required' : null),
      code: (value) => (!value ? 'Code is required' : null),
      ownership_type: (value) =>
        isHubManager && !value ? 'Ownership type is required' : null,
    },
  });

  useEffect(() => {
    if (warehouse) {
      form.setValues({
        code: warehouse.code,
        name: warehouse.name,
        warehouse_type: warehouse.warehouse_type,
        status: warehouse.status,
        ownership_type: warehouse.ownership_type || (isHubManager ? 'self_owned' : ''),
        description: warehouse.description || '',
        hub_id: warehouse.hub_id?.toString() || '',
        location_id: warehouse.location_id?.toString() || '',
        geo_id: warehouse.geo_id?.toString() || '',
      });
      setRentalAgreementFile(null);
    }
  }, [warehouse, isHubManager]);

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
    mutationFn: (data: WarehouseUpsertPayload) => updateWarehouse(Number(id), data),
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
    if (isHubManager) {
      if (values.ownership_type === 'rental') {
        const hasExistingDoc = isEdit && !!warehouse?.rental_agreement_document;
        if (!rentalAgreementFile && !hasExistingDoc) {
          notifications.show({
            title: 'Missing file',
            message: 'Rental Agreement is required when Ownership Type is Rental.',
            color: 'red',
          });
          return;
        }
      }
    }

    const payload: WarehouseUpsertPayload = {
      code: values.code,
      name: values.name,
      warehouse_type: values.warehouse_type,
      status: values.status,
      ownership_type: values.ownership_type || undefined,
      description: values.description || undefined,
      hub_id: values.hub_id ? Number(values.hub_id) : undefined,
      ...(isHubManager
        ? {}
        : {
            location_id: values.location_id ? Number(values.location_id) : undefined,
            geo_id: values.geo_id ? Number(values.geo_id) : undefined,
          }),
    };

    if (isHubManager) {
      if (values.ownership_type === 'rental' && rentalAgreementFile) {
        payload.rental_agreement_document = rentalAgreementFile;
      }
      if (values.hub_id) {
        payload.managed_under = 'Hub';
      }
    }

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

              {isHubManager ? (
                <Select
                  label="Ownership Type"
                  placeholder="Select ownership"
                  required
                  data={HUB_MANAGER_OWNERSHIP_OPTIONS}
                  {...form.getInputProps('ownership_type')}
                  onChange={(value) => {
                    form.setFieldValue('ownership_type', value || '');
                    if (value !== 'rental') setRentalAgreementFile(null);
                  }}
                />
              ) : (
                <Select
                  label="Ownership Type"
                  placeholder="Select ownership"
                  data={LEGACY_OWNERSHIP_SELECT_OPTIONS}
                  {...form.getInputProps('ownership_type')}
                />
              )}

              {isHubManager && form.values.ownership_type === 'rental' && (
                <RentalAgreementUpload
                  value={rentalAgreementFile}
                  onChange={setRentalAgreementFile}
                  required
                  existingDocument={isEdit ? warehouse?.rental_agreement_document : undefined}
                />
              )}

              {canReadHubs && (
                <Select
                  label="Hub"
                  placeholder="Select hub"
                  data={hubOptions || []}
                  searchable
                  clearable
                  {...form.getInputProps('hub_id')}
                />
              )}

              {isHubManager && canReadHubs && (
                <Alert color="blue" variant="light">
                  Subcity and woreda are inherited from the selected hub. You do not need to enter location or geo IDs.
                </Alert>
              )}

              <Textarea
                label="Description"
                placeholder="Enter warehouse description..."
                minRows={3}
                {...form.getInputProps('description')}
              />

              {!isHubManager && (
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
              )}
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
