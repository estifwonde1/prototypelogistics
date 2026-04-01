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
  createDispatchOrder,
  getDispatchOrder,
  updateDispatchOrder,
  deleteDispatchOrder,
} from '../../api/dispatchOrders';
import { getWarehouses } from '../../api/warehouses';
import { getHubs } from '../../api/hubs';
import { getCommodityReferences, getUnitReferences } from '../../api/referenceData';
import type { DispatchOrderLine } from '../../api/dispatchOrders';
import type { ApiError } from '../../types/common';

const createEmptyItem = (): DispatchOrderLine => ({
  commodity_id: 0,
  quantity: 0,
  unit_id: 0,
  notes: '',
});

function DispatchOrderFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [destinationType, setDestinationType] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [expectedPickupDate, setExpectedPickupDate] = useState<Date | null>(new Date());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DispatchOrderLine[]>([createEmptyItem()]);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const { data: hubs } = useQuery({
    queryKey: ['hubs'],
    queryFn: getHubs,
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
    queryKey: ['dispatch_orders', id],
    queryFn: () => getDispatchOrder(Number(id)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (isEdit && existingOrder) {
      setWarehouseId(existingOrder.source_warehouse_id.toString());
      setDestinationType(existingOrder.destination_type);
      setDestinationName(existingOrder.destination_name);
      setExpectedPickupDate(new Date(existingOrder.expected_pickup_date));
      setNotes(existingOrder.notes || '');
      setItems(existingOrder.lines || [createEmptyItem()]);
    }
  }, [isEdit, existingOrder]);

  const warehouseOptions =
    warehouses?.map((w) => ({
      value: w.id.toString(),
      label: w.name,
    })) || [];

  const destinationOptions =
    destinationType === 'Hub'
      ? hubs?.map((h) => ({
          value: h.id.toString(),
          label: h.name,
        })) || []
      : destinationType === 'Warehouse'
      ? warehouses?.map((w) => ({
          value: w.id.toString(),
          label: w.name,
        })) || []
      : [];

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

  const destinationTypeOptions = [
    { value: 'Hub', label: 'Hub' },
    { value: 'Warehouse', label: 'Warehouse' },
    { value: 'External', label: 'External' },
  ];

  const createMutation = useMutation({
    mutationFn: (payload) => createDispatchOrder(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Dispatch Order created successfully',
        color: 'green',
      });
      navigate(`/officer/dispatch-orders/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create Dispatch Order',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => updateDispatchOrder(Number(id), payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Dispatch Order updated successfully',
        color: 'green',
      });
      navigate(`/officer/dispatch-orders/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to update Dispatch Order',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDispatchOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Dispatch Order deleted successfully',
        color: 'green',
      });
      navigate('/officer/dispatch-orders');
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to delete Dispatch Order',
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

  const handleItemChange = <K extends keyof DispatchOrderLine>(
    index: number,
    field: K,
    value: DispatchOrderLine[K]
  ) => {
    setItems((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = () => {
    if (!warehouseId || !destinationType || !destinationName || !expectedPickupDate) {
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
      source_warehouse_id: Number(warehouseId),
      destination_type: destinationType,
      destination_name: destinationName,
      expected_pickup_date: expectedPickupDate.toISOString().split('T')[0],
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
        <Title order={2}>{isEdit ? 'Edit Dispatch Order' : 'Create Dispatch Order'}</Title>
        <Text c="dimmed" size="sm">
          {isEdit ? 'Update order details' : 'Create a new outbound warehouse order'}
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
                label="Source Warehouse"
                placeholder="Select warehouse"
                data={warehouseOptions}
                value={warehouseId}
                onChange={setWarehouseId}
                required
                disabled={isEdit}
              />
              <Select
                label="Destination Type"
                placeholder="Select destination type"
                data={destinationTypeOptions}
                value={destinationType}
                onChange={(val) => setDestinationType(val || '')}
                required
                disabled={isEdit}
              />
              {destinationType === 'External' ? (
                <TextInput
                  label="Destination Name"
                  placeholder="Enter destination name"
                  value={destinationName}
                  onChange={(e) => setDestinationName(e.target.value)}
                  required
                  disabled={isEdit}
                />
              ) : (
                <Select
                  label="Destination Name"
                  placeholder="Select destination"
                  data={destinationOptions}
                  value={destinationName}
                  onChange={(val) => setDestinationName(val || '')}
                  required
                  disabled={isEdit}
                />
              )}
              <DateInput
                label="Expected Pickup Date"
                placeholder="Select date"
                value={expectedPickupDate}
                onChange={setExpectedPickupDate}
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
            <Button variant="light" onClick={() => navigate('/officer/dispatch-orders')}>
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

export default DispatchOrderFormPage;
