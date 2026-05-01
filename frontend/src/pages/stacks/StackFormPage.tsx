import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArrowLeft, IconBox, IconDeviceFloppy, IconRuler3, IconSearch, IconStack2 } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { AxiosError } from 'axios';
import { createStack, getStack, updateStack } from '../../api/stacks';
import { getStores } from '../../api/stores';
import { getCommodityReferences, getUnitReferences, getInventoryLots } from '../../api/referenceData';
import { searchDeliveryByReference } from '../../api/storekeeperdashboard';
import type { DeliverySearchResult } from '../../api/storekeeperdashboard';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import type { Stack as StackType } from '../../types/stack';

type ApiError = {
  error?: {
    message?: string;
  };
};



const commodityStatusOptions = [
  { value: 'good', label: 'Good' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'expired', label: 'Expired' },
  { value: 'quarantine', label: 'Quarantine' },
];

const stackStatusOptions = [
  { value: 'active', label: 'Active / Allocated' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'empty', label: 'Empty' },
];

const inputStyles = {
  label: {
    fontSize: '0.74rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: '#42506a',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#eaf0ff',
    borderColor: '#d5def2',
    color: '#1f2a44',
    fontWeight: 700,
  },
};

function StackFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const { data: stack, isLoading } = useQuery({
    queryKey: ['stacks', id],
    queryFn: () => getStack(Number(id)),
    enabled: isEdit,
  });

  // Get active assignment context for filtering
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userHubId = activeAssignment?.hub?.id;
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const isHubManager = roleSlug === 'hub_manager';

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', { 
      warehouse_id: isWarehouseManager ? userWarehouseId : undefined,
      hub_id: isHubManager ? userHubId : undefined 
    }],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) {
        return getStores({ warehouse_id: userWarehouseId });
      } else if (isHubManager && userHubId) {
        // For hub managers, get stores from warehouses in their hub
        return getStores(); // Backend should handle hub-level filtering
      }
      return getStores();
    },
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ['commodities'],
    queryFn: () => getCommodityReferences(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => getUnitReferences(),
  });

  const { data: inventoryLots = [] } = useQuery({
    queryKey: ['inventory-lots'],
    queryFn: () => getInventoryLots(),
  });

  // ── Reference search state for auto-fill ──
  const [refSearchValue, setRefSearchValue] = useState('');
  const [refSearchResults, setRefSearchResults] = useState<DeliverySearchResult[]>([]);
  const [refSearchLoading, setRefSearchLoading] = useState(false);
  const refSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      reference: '',
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
        reference: stack.reference || '',
      });
      form.setFieldValue('commodity_id', stack.commodity_name || '');
    }
  }, [stack]); // eslint-disable-line react-hooks/exhaustive-deps

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
    onError: (mutationError: AxiosError<ApiError>) => {
      notifications.show({
        title: 'Error',
        message: mutationError.response?.data?.error?.message || 'Failed to create stack',
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
    onError: (mutationError: AxiosError<ApiError>) => {
      notifications.show({
        title: 'Error',
        message: mutationError.response?.data?.error?.message || 'Failed to update stack',
        color: 'red',
      });
    },
  });

  const storeOptions =
    stores?.map((store) => ({
      value: store.id.toString(),
      label: `${store.name} (${store.code})`,
    })) || [];

  const commodityOptions = useMemo(() => {
    const seen = new Set<string>();
    return (
      commodities
        ?.filter((c) => {
          if (seen.has(c.name)) return false;
          seen.add(c.name);
          return true;
        })
        .map((c) => ({
          value: c.name,
          label: c.name,
        })) || []
    );
  }, [commodities]);

  const unitOptions = useMemo(() => {
    const options = units.map((unit) => ({
      value: unit.id.toString(),
      label: unit.abbreviation || unit.name,
    }));
    
    if (form.values.unit_id && !options.some(o => o.value === form.values.unit_id.toString())) {
      options.unshift({ value: form.values.unit_id.toString(), label: `Unit #${form.values.unit_id}` });
    }
    
    return options;
  }, [units, form.values.unit_id]);

  const referenceOptions = useMemo(() => {
    const selectedCommId = Number(form.values.commodity_id);
    if (!selectedCommId) return [];

    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];

    inventoryLots.forEach((lot) => {
      if (lot.commodity_id === selectedCommId && lot.batch_no && !seen.has(lot.batch_no)) {
        seen.add(lot.batch_no);
        options.push({
          value: lot.batch_no,
          label: lot.batch_no,
        });
      }
    });

    // Ensure the auto-filled reference is available in the options
    if (form.values.reference && !seen.has(form.values.reference)) {
      options.unshift({
        value: form.values.reference,
        label: form.values.reference,
      });
    }

    return options;
  }, [inventoryLots, form.values.commodity_id, form.values.reference]);

  // ── Reference Search Options (from search_delivery API) ──
  const refSearchOptions = useMemo(() => {
    return refSearchResults.map((r) => {
      if (r.lines && r.lines.length > 1) {
        return r.lines.map((line, idx) => ({
          value: `${r.type}::${r.id}::${idx}::${r.reference_no}`,
          label: `${r.reference_no} — ${line.commodity_name} (${line.quantity} ${line.unit_abbreviation || line.unit_name || ''})`,
        }));
      }
      return [{
        value: `${r.type}::${r.id}::0::${r.reference_no}`,
        label: `${r.reference_no} — ${r.commodity} (${r.quantity} ${r.unit || ''})`,
      }];
    }).flat();
  }, [refSearchResults]);

  // ── Debounced reference search ──
  const handleRefSearch = useCallback((query: string) => {
    setRefSearchValue(query);
    if (refSearchTimer.current) clearTimeout(refSearchTimer.current);

    setRefSearchLoading(true);
    refSearchTimer.current = setTimeout(async () => {
      try {
        // Query can be empty string now to fetch default assignments
        const response = await searchDeliveryByReference(query);
        setRefSearchResults(response.results);
      } catch {
        setRefSearchResults((prev) => prev.length === 0 ? prev : []);
      } finally {
        setRefSearchLoading(false);
      }
    }, 400);
  }, []);

  // Fetch default assignments on mount
  useEffect(() => {
    handleRefSearch('');
  }, [handleRefSearch]);

  // ── Auto-fill handler when a reference is selected ──
  const handleRefAutoFill = useCallback((value: string | null) => {
    if (!value) return;

    const parts = value.split('::');
    if (parts.length < 4) return;

    const [type, idStr, lineIdxStr] = parts;
    const lineIdx = Number(lineIdxStr);
    const result = refSearchResults.find(
      (r) => r.type === type && r.id === Number(idStr)
    );

    if (!result) return;

    const line = result.lines?.[lineIdx] || result.lines?.[0];

    const newCommodity = line?.commodity_name || result.commodity || '';
    const newBatch = line?.batch_no || result.batch_no || result.reference_no;
    const newQuantity = line?.quantity || result.quantity || 0;
    const newUnitId = line?.unit_id ? String(line.unit_id) : (result.unit_id ? String(result.unit_id) : '');

    form.setValues((prev) => ({
      ...prev,
      commodity_id: newCommodity,
      reference: newBatch || '',
      quantity: newQuantity,
      unit_id: newUnitId,
    }));

    notifications.show({
      title: 'Auto-filled from ' + result.reference_no,
      message: `Commodity: ${newCommodity}, Quantity: ${newQuantity}, Batch: ${newBatch || 'N/A'}`,
      color: 'blue',
      autoClose: 3000,
    });
  }, [refSearchResults]);

  const handleSubmit = (values: typeof form.values) => {
    const selectedLot = inventoryLots.find((l) => l.batch_no === values.reference);
    const resolvedCommId = selectedLot
      ? selectedLot.commodity_id
      : commodities.find((c) => c.name === values.commodity_id)?.id || 0;

    const payload: Partial<StackType> = {
      code: values.code,
      length: values.length,
      width: values.width,
      height: values.height,
      start_x: values.start_x,
      start_y: values.start_y,
      commodity_id: resolvedCommId,
      store_id: Number(values.store_id),
      commodity_status: values.commodity_status,
      stack_status: values.stack_status,
      quantity: values.quantity,
      unit_id: Number(values.unit_id),
      reference: values.reference,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
      return;
    }

    createMutation.mutate(payload);
  };

  if (!isEdit) {
    return <Navigate to="/stacks/layout?mode=create" replace />;
  }

  if (isEdit && isLoading) {
    return <LoadingState message="Loading stack..." />;
  }

  if (isEdit && !stack) {
    return <ErrorState message="Stack not found" />;
  }

  return (
    <Stack gap="xl" style={{ padding: '0.25rem' }}>
      <Stack
        gap="lg"
        style={{
          padding: '1.25rem',
          borderRadius: 24,
          background: 'linear-gradient(180deg, #edf4ff 0%, #e7f0ff 100%)',
          boxShadow: '0 18px 44px rgba(76, 106, 158, 0.12)',
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Badge
              variant="light"
              radius="xl"
              size="lg"
              style={{ backgroundColor: '#dce8ff', color: '#1b4f9c', marginBottom: 12 }}
            >
              Stack Configuration
            </Badge>
            <Title order={2} c="#1d3354">
              {isEdit ? 'Edit Stack' : 'Create Stack'}
            </Title>
            <Text c="#64748b" mt={6}>
              Use the same clean operational styling from the stacking layout to configure stack
              details, capacity, and placement.
            </Text>
          </div>

          <Button
            variant="light"
            radius="md"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/stacks')}
          >
            Back to Stacks
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
            <Group align="center" gap="md">
              <ThemeIcon size={42} radius="md" variant="light" color="blue">
                <IconStack2 size={22} />
              </ThemeIcon>
              <div>
                <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                  Workflow Mode
                </Text>
                <Title order={4} c="#1d3354">
                  {isEdit ? 'Update Existing Stack' : 'Create New Stack'}
                </Title>
              </div>
            </Group>
          </Card>

          <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
            <Group align="center" gap="md">
              <ThemeIcon size={42} radius="md" variant="light" color="blue">
                <IconRuler3 size={22} />
              </ThemeIcon>
              <div>
                <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                  Position Controls
                </Text>
                <Title order={4} c="#1d57a8">
                  Length, Width, Height
                </Title>
              </div>
            </Group>
          </Card>

          <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
            <Group align="center" gap="md">
              <ThemeIcon size={42} radius="md" variant="light" color="gray">
                <IconBox size={22} />
              </ThemeIcon>
              <div>
                <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                  Stock Profile
                </Text>
                <Title order={4} c="#44526b">
                  Commodity, Status, Quantity
                </Title>
              </div>
            </Group>
          </Card>
        </SimpleGrid>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            <Card
              radius="xl"
              padding="xl"
              style={{
                background: '#ffffff',
                border: '1px solid #dce5f5',
                boxShadow: '0 12px 28px rgba(56, 84, 128, 0.08)',
              }}
            >
              <Stack gap="lg">
                <Divider
                  label="Basic Information"
                  labelPosition="left"
                  styles={{
                    label: {
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: '#1955a5',
                    },
                  }}
                />

                {/* ── Reference Search (auto-fill from receipt order) ── */}
                <Select
                  label="Search Receipt Order"
                  placeholder="Type RO-21 or select assigned order..."
                  data={refSearchOptions}
                  searchable
                  clearable
                  searchValue={refSearchValue}
                  onSearchChange={handleRefSearch}
                  nothingFoundMessage={refSearchLoading ? 'Searching...' : 'No deliveries found'}
                  onChange={handleRefAutoFill}
                  leftSection={refSearchLoading ? <Loader size={16} /> : <IconSearch size={16} />}
                  styles={{
                    ...inputStyles,
                    label: {
                      ...inputStyles.label,
                      color: '#0d6e3f',
                    },
                    input: {
                      ...inputStyles.input,
                      backgroundColor: '#e8f5e9',
                      borderColor: '#c8e6c9',
                    },
                  }}
                />

                <Group grow align="flex-start">
                  <TextInput
                    label="Stack Code"
                    placeholder="STK-015"
                    styles={inputStyles}
                    {...form.getInputProps('code')}
                  />
                  <Select
                    key={`ref-select-${form.values.commodity_id}`}
                    label="Batch / Reference"
                    placeholder="Choose batch"
                    data={referenceOptions}
                    searchable
                    nothingFoundMessage="No batches found for this commodity"
                    styles={inputStyles}
                    {...form.getInputProps('reference')}
                  />
                </Group>

                <Group grow align="flex-start">
                  <Select
                    label="Store"
                    placeholder="Select store"
                    searchable
                    data={storeOptions}
                    styles={inputStyles}
                    {...form.getInputProps('store_id')}
                  />
                  <Select
                    label="Commodity"
                    placeholder="Select commodity"
                    searchable
                    data={commodityOptions}
                    styles={inputStyles}
                    {...form.getInputProps('commodity_id')}
                    onChange={(value) => {
                      form.setValues({
                        ...form.values,
                        commodity_id: value || '',
                        reference: '',
                      });
                    }}
                  />
                </Group>

                <Group grow align="flex-start">
                  <Select
                    label="Commodity Status"
                    placeholder="Select status"
                    data={commodityStatusOptions}
                    styles={inputStyles}
                    {...form.getInputProps('commodity_status')}
                  />
                  <Select
                    label="Stack Status"
                    placeholder="Select status"
                    data={stackStatusOptions}
                    styles={inputStyles}
                    {...form.getInputProps('stack_status')}
                  />
                </Group>
              </Stack>
            </Card>

            <Card
              radius="xl"
              padding="xl"
              style={{
                background: '#ffffff',
                border: '1px solid #dce5f5',
                boxShadow: '0 12px 28px rgba(56, 84, 128, 0.08)',
              }}
            >
              <Stack gap="lg">
                <Divider
                  label="Dimensions"
                  labelPosition="left"
                  styles={{
                    label: {
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: '#1955a5',
                    },
                  }}
                />

                <Group grow align="flex-start">
                  <NumberInput
                    label="Length (m)"
                    placeholder="0"
                    min={0}
                    decimalScale={2}
                    styles={inputStyles}
                    {...form.getInputProps('length')}
                  />
                  <NumberInput
                    label="Width (m)"
                    placeholder="0"
                    min={0}
                    decimalScale={2}
                    styles={inputStyles}
                    {...form.getInputProps('width')}
                  />
                  <NumberInput
                    label="Height (m)"
                    placeholder="0"
                    min={0}
                    decimalScale={2}
                    styles={inputStyles}
                    {...form.getInputProps('height')}
                  />
                </Group>
              </Stack>
            </Card>

            <Card
              radius="xl"
              padding="xl"
              style={{
                background: '#ffffff',
                border: '1px solid #dce5f5',
                boxShadow: '0 12px 28px rgba(56, 84, 128, 0.08)',
              }}
            >
              <Stack gap="lg">
                <Divider
                  label="Position And Quantity"
                  labelPosition="left"
                  styles={{
                    label: {
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: '#1955a5',
                    },
                  }}
                />

                <Group grow align="flex-start">
                  <NumberInput
                    label="Start X Position"
                    placeholder="0"
                    min={0}
                    decimalScale={2}
                    styles={inputStyles}
                    {...form.getInputProps('start_x')}
                  />
                  <NumberInput
                    label="Start Y Position"
                    placeholder="0"
                    min={0}
                    decimalScale={2}
                    styles={inputStyles}
                    {...form.getInputProps('start_y')}
                  />
                </Group>

                <Group grow align="flex-start">
                  <NumberInput
                    label="Quantity"
                    placeholder="0"
                    min={0}
                    decimalScale={2}
                    styles={inputStyles}
                    {...form.getInputProps('quantity')}
                  />
                  <Select
                    label="Unit Of Measure"
                    placeholder="Select unit"
                    searchable
                    data={unitOptions}
                    styles={inputStyles}
                    {...form.getInputProps('unit_id')}
                  />
                </Group>
              </Stack>
            </Card>

            <Group justify="flex-end">
              <Button variant="light" radius="md" onClick={() => navigate('/stacks')}>
                Cancel
              </Button>
              <Button
                type="submit"
                radius="md"
                leftSection={<IconDeviceFloppy size={16} />}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {isEdit ? 'Update Stack' : 'Save Stack'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Stack>
  );
}

export default StackFormPage;
