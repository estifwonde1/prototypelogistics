import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Alert,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { createGin } from '../../api/gins';
import { getDispatches } from '../../api/dispatches';
import { getWaybills } from '../../api/waybills';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { getStockBalances } from '../../api/stockBalances';
import { notifications } from '@mantine/notifications';
import type { GinItem } from '../../types/gin';
import type { ApiError } from '../../types/common';

function GinCreatePage() {
  const destinationTypeOptions = [
    { value: 'Dispatch', label: 'Dispatch' },
    { value: 'Waybill', label: 'Waybill' },
  ];

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

  const { data: stacks = [] } = useQuery({
    queryKey: ['stacks'],
    queryFn: getStacks,
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: getDispatches,
  });

  const { data: waybills = [] } = useQuery({
    queryKey: ['waybills'],
    queryFn: getWaybills,
  });

  const { data: stockBalances = [] } = useQuery({
    queryKey: ['stockBalances'],
    queryFn: getStockBalances,
  });

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
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create GIN',
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

  const handleItemChange = <K extends keyof GinItem>(
    index: number,
    field: K,
    value: GinItem[K]
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = () => {
    const effectiveWarehouseId =
      warehouseId ?? (warehouseOptions.length === 1 ? warehouseOptions[0].value : null);

    if (!referenceNo || !effectiveWarehouseId || !issuedOn) {
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

    const oversizedItemIndex = items.findIndex((item) => {
      const selectedBalance = selectedBalanceForItem(item);
      return selectedBalance ? item.quantity > selectedBalance.quantity : false;
    });

    if (oversizedItemIndex >= 0) {
      const selectedBalance = selectedBalanceForItem(items[oversizedItemIndex]);
      notifications.show({
        title: 'Validation Error',
        message: `Item ${oversizedItemIndex + 1} exceeds available stock (${selectedBalance?.quantity.toLocaleString()} ${selectedBalance?.unit_abbreviation || selectedBalance?.unit_name || ''})`,
        color: 'red',
      });
      return;
    }

    if ((destinationType && !destinationId) || (!destinationType && destinationId)) {
      notifications.show({
        title: 'Validation Error',
        message: 'Destination type and destination ID must be provided together.',
        color: 'red',
      });
      return;
    }

    createMutation.mutate({
      reference_no: referenceNo,
      warehouse_id: parseInt(effectiveWarehouseId),
      issued_on: issuedOn.toISOString().split('T')[0],
      issued_by_id: issuedById ? parseInt(issuedById) : undefined,
      destination_type: destinationType || undefined,
      destination_id: destinationId ? parseInt(destinationId) : undefined,
      items,
    });
  };

  const warehouseOptions =
    warehouses && warehouses.length > 0
      ? warehouses.map((w) => ({
          value: w.id.toString(),
          label: `${w.name} (${w.code})`,
        }))
      : Array.from(new Set((stores ?? []).map((store) => store.warehouse_id))).map((id) => ({
          value: id.toString(),
          label: `Warehouse #${id}`,
        }));

  const storeOptions = stores
    ?.filter((s) => !warehouseId || s.warehouse_id.toString() === warehouseId)
    .map((s) => ({
      value: s.id.toString(),
      label: `${s.name} (${s.code})`,
    }));

  const availableStoreIds = new Set(
    (stores ?? [])
      .filter((store) => !warehouseId || store.warehouse_id.toString() === warehouseId)
      .map((store) => store.id)
  );

  const destinationOptions =
    destinationType === 'Dispatch'
      ? dispatches.map((dispatch) => ({
          value: dispatch.id.toString(),
          label: `${dispatch.reference_no || 'Dispatch'} (#${dispatch.id})`,
        }))
      : destinationType === 'Waybill'
        ? waybills.map((waybill) => ({
            value: waybill.id.toString(),
            label: `${waybill.reference_no || 'Waybill'} (#${waybill.id})`,
        }))
      : [];

  const stackOptionsForItem = (storeId?: number) =>
    stacks
      .filter((stack) => availableStoreIds.has(stack.store_id))
      .filter((stack) => !storeId || stack.store_id === storeId)
      .map((stack) => ({
        value: stack.id.toString(),
        label: `${stack.code} (#${stack.id})`,
      }));

  const availableBalancesForItem = (item: GinItem) => {
    const effectiveWarehouseId =
      warehouseId ?? (warehouseOptions.length === 1 ? warehouseOptions[0].value : null);

    return stockBalances.filter((balance) => {
      if (!effectiveWarehouseId || balance.warehouse_id !== Number(effectiveWarehouseId)) return false;
      if (item.store_id && balance.store_id !== item.store_id) return false;
      if (item.stack_id && balance.stack_id !== item.stack_id) return false;
      return balance.quantity > 0;
    });
  };

  const commodityOptionsForItem = (item: GinItem) =>
    availableBalancesForItem(item).map((balance) => ({
      value: `${balance.commodity_id}:${balance.unit_id}:${balance.store_id ?? ''}:${balance.stack_id ?? ''}`,
      label: `${balance.commodity_name || `Commodity #${balance.commodity_id}`} | ${balance.quantity.toLocaleString()} ${balance.unit_abbreviation || balance.unit_name || ''}`.trim(),
    }));

  const selectedBalanceForItem = (item: GinItem) =>
    availableBalancesForItem(item).find(
      (balance) =>
        balance.commodity_id === item.commodity_id &&
        balance.unit_id === item.unit_id &&
        (item.store_id ? balance.store_id === item.store_id : true) &&
        (item.stack_id ? balance.stack_id === item.stack_id : true)
    );

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
              value={warehouseId ?? (warehouseOptions.length === 1 ? warehouseOptions[0].value : null)}
              onChange={(value) => {
                setWarehouseId(value);
                setItems((currentItems) =>
                  currentItems.map((item) => ({
                    ...item,
                    store_id: undefined,
                    stack_id: undefined,
                  }))
                );
              }}
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
            <Select
              label="Destination Type"
              placeholder="Select destination type"
              data={destinationTypeOptions}
              value={destinationType}
              onChange={(value) => {
                setDestinationType(value || '');
                setDestinationId('');
              }}
              clearable
            />
            <Select
              label="Destination Reference"
              placeholder={destinationType ? 'Select destination reference' : 'Select destination type first'}
              data={destinationOptions}
              value={destinationId || null}
              onChange={(value) => setDestinationId(value || '')}
              searchable
              clearable
              disabled={!destinationType}
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

          <Alert color="blue" variant="light">
            Select a warehouse, then narrow by store or stack. Commodity choices only show stock that is currently available, and quantities above available stock are blocked before submit.
          </Alert>

          <Table.ScrollContainer minWidth={800}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Available</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th>Store</Table.Th>
                  <Table.Th>Stack</Table.Th>
                  <Table.Th style={{ width: 50 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => (
                  <Table.Tr key={index}>
                    {(() => {
                      const selectedBalance = selectedBalanceForItem(item);

                      return (
                        <>
                    <Table.Td>
                      <Select
                        placeholder="Select available stock"
                        data={commodityOptionsForItem(item)}
                        value={
                          item.commodity_id && item.unit_id
                            ? `${item.commodity_id}:${item.unit_id}:${item.store_id ?? ''}:${item.stack_id ?? ''}`
                            : null
                        }
                        onChange={(value) => {
                          if (!value) {
                            handleItemChange(index, 'commodity_id', 0);
                            handleItemChange(index, 'unit_id', 0);
                            return;
                          }

                          const [commodityId, unitId] = value.split(':');
                          handleItemChange(index, 'commodity_id', Number(commodityId));
                          handleItemChange(index, 'unit_id', Number(unitId));
                        }}
                        searchable
                        clearable
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={selectedBalance ? 'dimmed' : 'red'}>
                        {selectedBalance
                          ? `${selectedBalance.quantity.toLocaleString()} ${selectedBalance.unit_abbreviation || selectedBalance.unit_name || ''}`.trim()
                          : 'Select stock source'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Quantity"
                        value={item.quantity || ''}
                        onChange={(val) => handleItemChange(index, 'quantity', Number(val))}
                        min={0}
                        max={selectedBalance?.quantity}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {selectedBalance?.unit_abbreviation ||
                          selectedBalance?.unit_name ||
                          (item.unit_id ? `Unit #${item.unit_id}` : '-')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Select
                        placeholder="Store"
                        data={storeOptions || []}
                        value={item.store_id?.toString() || null}
                        onChange={(val) => {
                          const nextStoreId = val ? parseInt(val) : undefined;
                          handleItemChange(index, 'store_id', nextStoreId);
                          handleItemChange(index, 'stack_id', undefined);
                          handleItemChange(index, 'commodity_id', 0);
                          handleItemChange(index, 'unit_id', 0);
                        }}
                        searchable
                        clearable
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        placeholder="Stack"
                        data={stackOptionsForItem(item.store_id)}
                        value={item.stack_id?.toString() || null}
                        onChange={(val) =>
                          {
                            handleItemChange(index, 'stack_id', val ? parseInt(val) : undefined);
                            handleItemChange(index, 'commodity_id', 0);
                            handleItemChange(index, 'unit_id', 0);
                          }
                        }
                        searchable
                        clearable
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
                        </>
                      );
                    })()}
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
