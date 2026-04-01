import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
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
  Textarea,
  SimpleGrid,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  createReceiptOrder,
  getReceiptOrder,
  updateReceiptOrder,
  deleteReceiptOrder,
} from '../../api/receiptOrders';
import { getWarehouses } from '../../api/warehouses';
import { getCommodityReferences, getUnitReferences } from '../../api/referenceData';
import type { ReceiptOrderLine } from '../../api/receiptOrders';
import type { ApiError } from '../../types/common';

const createEmptyItem = (): ReceiptOrderLine => ({
  commodity_id: 0,
  quantity: 0,
  unit_id: 0,
  unit_price: 0,
  notes: '',
});

function ReceiptOrderFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sourceType, setSourceType] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | null>(new Date());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ReceiptOrderLine[]>([createEmptyItem()]);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: getUnitReferences,
  });

  const { data: existingOrder } = useQuery({
    queryKey: ['receipt_orders', id],
    queryFn: () => getReceiptOrder(Number(id)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (isEdit && existingOrder) {
      setSourceType(existingOrder.source_type);
      setSourceName(existingOrder.source_name);
      setWarehouseId(existingOrder.destination_warehouse_id.toString());
      setExpectedDeliveryDate(new Date(existingOrder.expected_delivery_date));
      setNotes(existingOrder.notes || '');
      setItems(existingOrder.lines || [createEmptyItem()]);
    }
  }, [isEdit, existingOrder]);

  const warehouseOptions =
    warehouses?.map((w) => ({
      value: w.id.toString(),
      label: w.name,
    })) || [];

  const commodityOptions =
    commodities?.map((c) => ({
      value: c.id.toString(),
      label: c.name,
    })) || [];

  const unitOptions =
    units?.map((u) => ({
      value: u.id.toString(),
      label: u.name,
    })) || [];

  const sourceTypeOptions = [
    { value: 'Supplier', label: 'Supplier' },
    { value: 'Hub', label: 'Hub' },
    { value: 'Warehouse', label: 'Warehouse' },
  ];

  const createMutation = useMutation({
    mutationFn: (payload) => createReceiptOrder(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Receipt Order created successfully',
        color: 'green',
      });
      navigate(`/officer/receipt-orders/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create Receipt Order',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => updateReceiptOrder(Number(id), payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Receipt Order updated successfully',
        color: 'green',
      });
      navigate(`/officer/receipt-orders/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to update Receipt Order',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReceiptOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Receipt Order deleted successfully',
        color: 'green',
      });
      navigate('/officer/receipt-orders');
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to delete Receipt Order',
        color: 'red',
      });
    },
  });

  const handleAddItem = () => {
    setItems((current) => [...current, createEmptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof ReceiptOrderLine>(
    index: number,
    field: K,
    value: ReceiptOrderLine[K]
  ) => {
    setItems((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = () => {
    if (!sourceType || !sourceName || !warehouseId || !expectedDeliveryDate) {
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

    const payload = {
      source_type: sourceType,
      source_name: sourceName,
      destination_warehouse_id: Number(warehouseId),
      expected_delivery_date: expectedDeliveryDate.toISOString().split('T')[0],
      notes,
      lines: items,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>{isEdit ? 'Edit Receipt Order' : 'Create Receipt Order'}</Title>
        <Text c="dimmed" size="sm">
          {isEdit ? 'Update order details' : 'Create a new inbound warehouse order'}
        </Text>
      </div>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <div>
            <Text size="sm" fw={600} mb="md">
              Order Details
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Source Type"
                placeholder="Select source type"
                data={sourceTypeOptions}
                value={sourceType}
                onChange={(val) => setSourceType(val || '')}
                required
                disabled={isEdit}
              />
              <TextInput
                label="Source Name"
                placeholder="Enter source name"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                required
                disabled={isEdit}
              />
              <Select
                label="Destination Warehouse"
                placeholder="Select warehouse"
                data={warehouseOptions}
                value={warehouseId}
                onChange={setWarehouseId}
                required
                disabled={isEdit}
              />
              <DateInput
                label="Expected Delivery Date"
                placeholder="Select date"
                value={expectedDeliveryDate}
                onChange={setExpectedDeliveryDate}
                required
                disabled={isEdit}
              />
            </SimpleGrid>
            <Textarea
              label="Notes"
              placeholder="Add any notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              mt="md"
              rows={3}
              disabled={isEdit}
            />
          </div>

          <div>
            <Group justify="space-between" mb="md">
              <Text size="sm" fw={600}>
                Order Items
              </Text>
              {!isEdit && (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={handleAddItem}
                >
                  Add Item
                </Button>
              )}
            </Group>

            <Table.ScrollContainer minWidth={600}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Unit</Table.Th>
                    <Table.Th>Unit Price</Table.Th>
                    <Table.Th>Notes</Table.Th>
                    {!isEdit && <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((item, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Select
                          placeholder="Select commodity"
                          data={commodityOptions}
                          value={item.commodity_id?.toString()}
                          onChange={(val) =>
                            handleItemChange(index, 'commodity_id', parseInt(val || '0'))
                          }
                          searchable
                          disabled={isEdit}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          placeholder="0"
                          value={item.quantity}
                          onChange={(val) => handleItemChange(index, 'quantity', val || 0)}
                          disabled={isEdit}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Select
                          placeholder="Select unit"
                          data={unitOptions}
                          value={item.unit_id?.toString()}
                          onChange={(val) =>
                            handleItemChange(index, 'unit_id', parseInt(val || '0'))
                          }
                          disabled={isEdit}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          placeholder="0"
                          value={item.unit_price}
                          onChange={(val) => handleItemChange(index, 'unit_price', val || 0)}
                          disabled={isEdit}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          placeholder="Notes"
                          value={item.notes}
                          onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                          disabled={isEdit}
                        />
                      </Table.Td>
                      {!isEdit && (
                        <Table.Td>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </div>

          <Group justify="flex-end" mt="xl">
            <Button variant="light" onClick={() => navigate('/officer/receipt-orders')}>
              Cancel
            </Button>
            {isEdit && (
              <Button
                color="red"
                variant="light"
                onClick={() => deleteMutation.mutate()}
                loading={isLoading}
              >
                Delete
              </Button>
            )}
            {!isEdit && (
              <Button onClick={handleSave} loading={isLoading}>
                Save as Draft
              </Button>
            )}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

export default ReceiptOrderFormPage;
