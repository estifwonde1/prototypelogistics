import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  Select,
  Card,
  Table,
  ActionIcon,
  Text,
  NumberInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { createGrn } from '../../api/grns';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { notifications } from '@mantine/notifications';
import { QualityStatus } from '../../utils/constants';
import type { GrnItem } from '../../types/grn';

function GrnCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [referenceNo, setReferenceNo] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [receivedOn, setReceivedOn] = useState<Date | null>(new Date());
  const [receivedById, setReceivedById] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [items, setItems] = useState<GrnItem[]>([
    {
      commodity_id: 0,
      quantity: 0,
      unit_id: 0,
      quality_status: QualityStatus.GOOD,
    },
  ]);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const { data: stacks } = useQuery({
    queryKey: ['stacks'],
    queryFn: getStacks,
  });

  const createMutation = useMutation({
    mutationFn: createGrn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      notifications.show({
        title: 'Success',
        message: 'GRN created successfully',
        color: 'green',
      });
      navigate(`/grns/${data.id}`);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to create GRN',
        color: 'red',
      });
    },
  });

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        commodity_id: 0,
        quantity: 0,
        unit_id: 0,
        quality_status: QualityStatus.GOOD,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof GrnItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (!referenceNo || !warehouseId || !receivedOn) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }

    if (items.length === 0 || items.some((item) => !item.commodity_id || !item.quantity)) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please add at least one valid item',
        color: 'red',
      });
      return;
    }

    createMutation.mutate({
      reference_no: referenceNo,
      warehouse_id: parseInt(warehouseId),
      received_on: receivedOn.toISOString().split('T')[0],
      received_by_id: receivedById ? parseInt(receivedById) : undefined,
      source_type: sourceType || undefined,
      source_id: sourceId ? parseInt(sourceId) : undefined,
      grn_items: items,
    });
  };

  const warehouseOptions = warehouses?.map((w) => ({
    value: w.id.toString(),
    label: `${w.name} (${w.code})`,
  }));

  const storeOptions = stores
    ?.filter((s) => !warehouseId || s.warehouse_id.toString() === warehouseId)
    .map((s) => ({
      value: s.id.toString(),
      label: `${s.name} (${s.code})`,
    }));

  const qualityOptions = Object.entries(QualityStatus).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Create Goods Received Note</Title>
          <Text c="dimmed" size="sm">
            Record incoming goods and inventory
          </Text>
        </div>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Header Information</Title>

          <Group grow>
            <TextInput
              label="Reference Number"
              placeholder="GRN-2024-001"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              required
            />
            <Select
              label="Warehouse"
              placeholder="Select warehouse"
              data={warehouseOptions || []}
              value={warehouseId}
              onChange={setWarehouseId}
              searchable
              required
            />
          </Group>

          <Group grow>
            <DateInput
              label="Received On"
              placeholder="Select date"
              value={receivedOn}
              onChange={setReceivedOn}
              required
            />
            <TextInput
              label="Received By (User ID)"
              placeholder="Enter user ID"
              value={receivedById}
              onChange={(e) => setReceivedById(e.target.value)}
            />
          </Group>

          <Group grow>
            <TextInput
              label="Source Type"
              placeholder="e.g., Purchase Order, Transfer"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            />
            <TextInput
              label="Source ID"
              placeholder="Enter source ID"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            />
          </Group>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Line Items</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={handleAddItem}
            >
              Add Item
            </Button>
          </Group>

          <Table.ScrollContainer minWidth={800}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Commodity ID</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Unit ID</Table.Th>
                  <Table.Th>Quality Status</Table.Th>
                  <Table.Th>Store</Table.Th>
                  <Table.Th>Stack ID</Table.Th>
                  <Table.Th style={{ width: 50 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <NumberInput
                        placeholder="Commodity ID"
                        value={item.commodity_id || ''}
                        onChange={(val) =>
                          handleItemChange(index, 'commodity_id', Number(val))
                        }
                        min={1}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Quantity"
                        value={item.quantity || ''}
                        onChange={(val) => handleItemChange(index, 'quantity', Number(val))}
                        min={0}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Unit ID"
                        value={item.unit_id || ''}
                        onChange={(val) => handleItemChange(index, 'unit_id', Number(val))}
                        min={1}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        placeholder="Quality"
                        data={qualityOptions}
                        value={item.quality_status}
                        onChange={(val) =>
                          handleItemChange(index, 'quality_status', val || QualityStatus.GOOD)
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        placeholder="Store"
                        data={storeOptions || []}
                        value={item.store_id?.toString() || null}
                        onChange={(val) =>
                          handleItemChange(index, 'store_id', val ? parseInt(val) : undefined)
                        }
                        searchable
                        clearable
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Stack ID"
                        value={item.stack_id || ''}
                        onChange={(val) =>
                          handleItemChange(index, 'stack_id', val ? Number(val) : undefined)
                        }
                        min={1}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => handleRemoveItem(index)}
                        disabled={items.length === 1}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button variant="default" onClick={() => navigate('/grns')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={createMutation.isPending}>
          Create GRN
        </Button>
      </Group>
    </Stack>
  );
}

export default GrnCreatePage;
