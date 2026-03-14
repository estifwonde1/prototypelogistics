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
import { createGin } from '../../api/gins';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import { notifications } from '@mantine/notifications';
import type { GinItem } from '../../types/gin';

function GinCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [referenceNo, setReferenceNo] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [issuedOn, setIssuedOn] = useState<Date | null>(new Date());
  const [issuedById, setIssuedById] = useState('');
  const [destinationType, setDestinationType] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [items, setItems] = useState<GinItem[]>([
    {
      commodity_id: 0,
      quantity: 0,
      unit_id: 0,
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

  // Removed unused stacks query

  const createMutation = useMutation({
    mutationFn: createGin,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gins'] });
      notifications.show({
        title: 'Success',
        message: 'GIN created successfully',
        color: 'green',
      });
      navigate(`/gins/${data.id}`);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to create GIN',
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
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof GinItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (!referenceNo || !warehouseId || !issuedOn) {
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
      issued_on: issuedOn.toISOString().split('T')[0],
      issued_by_id: issuedById ? parseInt(issuedById) : undefined,
      destination_type: destinationType || undefined,
      destination_id: destinationId ? parseInt(destinationId) : undefined,
      gin_items: items,
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

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Create Goods Issue Note</Title>
          <Text c="dimmed" size="sm">
            Record outgoing goods and inventory issues
          </Text>
        </div>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Header Information</Title>

          <Group grow>
            <TextInput
              label="Reference Number"
              placeholder="GIN-2024-001"
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
              label="Issued On"
              placeholder="Select date"
              value={issuedOn}
              onChange={(value) => setIssuedOn(value ? new Date(value) : null)}
              required
            />
            <TextInput
              label="Issued By (User ID)"
              placeholder="Enter user ID"
              value={issuedById}
              onChange={(e) => setIssuedById(e.target.value)}
            />
          </Group>

          <Group grow>
            <TextInput
              label="Destination Type"
              placeholder="e.g., Distribution Center, Beneficiary"
              value={destinationType}
              onChange={(e) => setDestinationType(e.target.value)}
            />
            <TextInput
              label="Destination ID"
              placeholder="Enter destination ID"
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
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
        <Button variant="default" onClick={() => navigate('/gins')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={createMutation.isPending}>
          Create GIN
        </Button>
      </Group>
    </Stack>
  );
}

export default GinCreatePage;
