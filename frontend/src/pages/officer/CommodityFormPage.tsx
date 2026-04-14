import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  NumberInput,
  Select,
  Card,
  Text,
  Table,
  Switch,
  Badge,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconArrowLeft, IconPlus, IconRefresh } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { getCommodityReferences, getUnitReferences, getCategoryReferences, createCommodity } from '../../api/referenceData';
import type { ApiError } from '../../types/common';
import type { CreateCommodityPayload } from '../../api/referenceData';

function CommodityFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [batchNo, setBatchNo] = useState('');
  const [autoGenBatch, setAutoGenBatch] = useState(true);
  const [quantity, setQuantity] = useState<number | string>(1);

  const generateBatchNo = () =>
    `BATCH-${dayjs().format('YYYYMMDD')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  const [previewBatch, setPreviewBatch] = useState(() => generateBatchNo());

  const { data: commodities = [], isLoading } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: getUnitReferences,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['reference-data', 'categories'],
    queryFn: getCategoryReferences,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateCommodityPayload) => {
      return createCommodity({
        name: payload.name,
        batch_no: payload.batch_no,
        quantity: payload.quantity,
        unit_id: payload.unit_id || undefined,
        commodity_category_id: payload.commodity_category_id || undefined,
        best_use_before: payload.best_use_before,
      });
    },
    onSuccess: (newCommodity) => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'commodities'] });
      setName('');
      setBatchNo('');
      setAutoGenBatch(true);
      setPreviewBatch(generateBatchNo());
      setQuantity(1);
      setUnitId(null);
      setCategory(null);
      setExpiryDate(null);
      notifications.show({
        title: 'Success',
        message: `Commodity "${newCommodity.name}" created successfully`,
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create commodity',
        color: 'red',
      });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Commodity name is required',
        color: 'red',
      });
      return;
    }
    const qty = typeof quantity === 'number' ? quantity : parseFloat(quantity as string) || 0;
    if (qty <= 0) {
      notifications.show({
        title: 'Error',
        message: 'Quantity must be greater than 0',
        color: 'red',
      });
      return;
    }
    if (!autoGenBatch && !batchNo.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Please enter a Batch No. or switch to auto-generate',
        color: 'red',
      });
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      batch_no: autoGenBatch ? undefined : batchNo.trim(),
      quantity: qty,
      unit_id: unitId ? parseInt(unitId) : undefined,
      commodity_category_id: category ? parseInt(category) : undefined,
      best_use_before: expiryDate ? dayjs(expiryDate).toISOString() : undefined,
    });
  };

  const unitOptions = units.map((u) => ({
    value: String(u.id),
    label: u.name,
  }));

  const categoryOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  return (
    <Stack gap="md">
      <Group>
        <Button
          variant="default"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/officer/receipt-orders/new')}
        >
          Back to Receipt Order
        </Button>
      </Group>

      <Card padding="lg">
        <Stack gap="md">
          <Title order={3}>Create New Commodity</Title>

          <TextInput
            label="Commodity Name"
            placeholder="e.g. Sugar, Rice, Blankets"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />


          <Switch
            label="Auto-generate Batch No."
            checked={autoGenBatch}
            onChange={(e) => setAutoGenBatch(e.currentTarget.checked)}
          />

          {autoGenBatch ? (
            <Group gap="xs" align="center">
              <Text size="sm" c="dimmed">Preview:</Text>
              <Badge
                variant="outline"
                color="blue"
                size="lg"
                style={{ fontFamily: 'monospace', letterSpacing: 1 }}
              >
                {previewBatch}
              </Badge>
              <Tooltip label="Refresh preview">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => setPreviewBatch(generateBatchNo())}
                >
                  <IconRefresh size={14} />
                </ActionIcon>
              </Tooltip>
              <Text size="xs" c="dimmed">(final value set by server)</Text>
            </Group>
          ) : (
            <TextInput
              label="Batch No."
              placeholder="e.g. BATCH-20260415-XYZ"
              required
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              description="Unique identifier for this commodity batch"
            />
          )}

          <NumberInput
            label="Quantity"
            placeholder="e.g. 1000"
            min={1}
            value={quantity}
            onChange={setQuantity}
            description="Must be greater than 0"
            required
          />

          <Select
            label="Default Unit (optional)"
            placeholder="Select unit"
            data={unitOptions}
            value={unitId}
            onChange={setUnitId}
            clearable
          />

          <Select
            label="Category (optional)"
            placeholder="Select category"
            data={categoryOptions}
            value={category}
            onChange={setCategory}
            clearable
          />

          <DateInput
            label="Expiry Date (optional)"
            placeholder="Select expiry date"
            value={expiryDate}
            onChange={(val) => setExpiryDate(val as Date | null)}
            clearable
          />

          <Group>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              leftSection={<IconPlus size={16} />}
            >
              Create Commodity
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card padding="lg">
        <Title order={3} mb="md">Existing Commodities</Title>
        {isLoading ? (
          <Text>Loading...</Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Default Unit</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {commodities.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.id}</Table.Td>
                  <Table.Td>{c.name}</Table.Td>
                  <Table.Td>{c.unit_name || '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}

export default CommodityFormPage;