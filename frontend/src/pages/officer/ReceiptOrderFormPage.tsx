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

  const { data: existingOrder, isLoading: orderLoading, isError: orderError, refetch: refetchOrder } =
    useQuery({
      queryKey: ['receipt_orders', id],
      queryFn: () => getReceiptOrder(Number(id)),
      enabled: isEdit,
    });

  const isDraftOrder =
    existingOrder != null && String(existingOrder.status).toLowerCase() === 'draft';
  const fieldsEditable = !isEdit || (isDraftOrder && !orderLoading);

  useEffect(() => {
    if (!isEdit || !existingOrder) return;

    const warehouseNumeric =
      existingOrder.destination_warehouse_id ?? existingOrder.warehouse_id;
    setWarehouseId(warehouseNumeric != null ? String(warehouseNumeric) : null);

    setSourceType(existingOrder.source_type || '');
    setSourceName(
      existingOrder.source_name ||
        (existingOrder.name != null ? String(existingOrder.name) : '') ||
        (existingOrder.source_reference != null ? String(existingOrder.source_reference) : '')
    );

    const dateRaw = existingOrder.expected_delivery_date || existingOrder.received_date;
    setExpectedDeliveryDate(dateRaw ? new Date(dateRaw) : null);

    setNotes(existingOrder.notes ?? existingOrder.description ?? '');

    const rawLines = existingOrder.lines ?? existingOrder.receipt_order_lines ?? [];
    setItems(
      rawLines.length > 0
        ? rawLines.map((line) => ({
            commodity_id: line.commodity_id,
            quantity: line.quantity,
            unit_id: line.unit_id,
            unit_price: line.unit_price ?? 0,
            notes: line.notes ?? '',
          }))
        : [createEmptyItem()]
    );
  }, [isEdit, existingOrder]);

  const warehouseOptions =
    warehouses?.map((w) => ({
      value: String(w.id),
      label: w.name,
    })) || [];

  const commodityOptions =
    commodities?.map((c) => ({
      value: String(c.id),
      label: c.name ?? `Commodity #${c.id}`,
    })) || [];

  const unitOptions =
    units?.map((u) => ({
      value: String(u.id),
      label: u.name,
    })) || [];

  const sourceTypeOptions = [
    { value: 'Supplier', label: 'Supplier' },
    { value: 'Hub', label: 'Hub' },
    { value: 'Warehouse', label: 'Warehouse' },
  ];

  const createMutation = useMutation({
    mutationFn: createReceiptOrder,
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
    mutationFn: (payload: any) => updateReceiptOrder(Number(id), payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders'] });
      queryClient.invalidateQueries({ queryKey: ['receipt_orders', id] });
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
      
      // Auto-select unit when commodity is selected
      if (field === 'commodity_id' && value) {
        const commodity = commodities.find((c) => c.id === value);
        if (commodity && commodity.unit_id) {
          next[index].unit_id = commodity.unit_id;
        }
      }
      
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

    if (
      items.length === 0 ||
      items.some((item) => !item.commodity_id || !item.quantity || !item.unit_id)
    ) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please add at least one line with commodity, quantity, and unit',
        color: 'red',
      });
      return;
    }

    const dateStr = expectedDeliveryDate instanceof Date 
      ? expectedDeliveryDate.toISOString().split('T')[0]
      : expectedDeliveryDate;

    const payload = {
      source_type: sourceType,
      source_name: sourceName,
      destination_warehouse_id: Number(warehouseId),
      expected_delivery_date: dateStr,
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

  if (isEdit && orderError) {
    return (
      <Stack gap="md">
        <Title order={2}>Edit Receipt Order</Title>
        <Text c="red" size="sm">
          Could not load this order.
        </Text>
        <Group>
          <Button variant="light" onClick={() => refetchOrder()}>
            Retry
          </Button>
          <Button variant="subtle" onClick={() => navigate('/officer/receipt-orders')}>
            Back to list
          </Button>
        </Group>
      </Stack>
    );
  }

  if (isEdit && orderLoading) {
    return (
      <Stack gap="md">
        <Title order={2}>Edit Receipt Order</Title>
        <Text c="dimmed" size="sm">
          Loading order…
        </Text>
      </Stack>
    );
  }

  if (isEdit && existingOrder && !isDraftOrder) {
    return (
      <Stack gap="md">
        <Title order={2}>Edit Receipt Order</Title>
        <Text c="dimmed" size="sm">
          Only draft receipt orders can be edited. This order is {existingOrder.status}.
        </Text>
        <Button variant="light" onClick={() => navigate(`/officer/receipt-orders/${existingOrder.id}`)}>
          Back to order
        </Button>
      </Stack>
    );
  }

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
                disabled={!fieldsEditable}
              />
              <TextInput
                label="Source Name"
                placeholder="Enter source name"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                required
                disabled={!fieldsEditable}
              />
              <Select
                label="Destination Warehouse"
                placeholder="Select warehouse"
                data={warehouseOptions}
                value={warehouseId}
                onChange={setWarehouseId}
                required
                disabled={!fieldsEditable}
              />
              <DateInput
                label="Expected Delivery Date"
                placeholder="Select date"
                value={expectedDeliveryDate}
                onChange={(val) => setExpectedDeliveryDate(val as Date | null)}
                required
                disabled={!fieldsEditable}
              />
            </SimpleGrid>
            <Textarea
              label="Notes"
              placeholder="Add any notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              mt="md"
              rows={3}
              disabled={!fieldsEditable}
            />
          </div>

          <div>
            <Group justify="space-between" mb="md">
              <Text size="sm" fw={600}>
                Order Items
              </Text>
              {fieldsEditable && (
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
                    {fieldsEditable && <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>}
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
                          disabled={!fieldsEditable}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          placeholder="0"
                          value={item.quantity}
                          onChange={(val) => handleItemChange(index, 'quantity', Number(val) || 0)}
                          disabled={!fieldsEditable}
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
                          disabled={!fieldsEditable}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          placeholder="0"
                          value={item.unit_price}
                          onChange={(val) => handleItemChange(index, 'unit_price', Number(val) || 0)}
                          disabled={!fieldsEditable}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          placeholder="Notes"
                          value={item.notes}
                          onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                          disabled={!fieldsEditable}
                        />
                      </Table.Td>
                      {fieldsEditable && (
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
            {fieldsEditable && (
              <Button onClick={handleSave} loading={isLoading}>
                {isEdit ? 'Update draft' : 'Save as Draft'}
              </Button>
            )}
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

export default ReceiptOrderFormPage;
