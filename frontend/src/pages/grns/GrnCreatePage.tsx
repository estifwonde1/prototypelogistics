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
import { notifications } from '@mantine/notifications';
import { createGrn, getGrns } from '../../api/grns';
import { getReceipts } from '../../api/receipts';
import { getWaybills } from '../../api/waybills';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { getCommodityReferences, getUnitReferences } from '../../api/referenceData';
import { useAuthStore } from '../../store/authStore';
import { QualityStatus } from '../../utils/constants';
import type { GrnItem } from '../../types/grn';
import type { ApiError } from '../../types/common';

const createEmptyItem = (): GrnItem => ({
  commodity_id: 0,
  quantity: 0,
  unit_id: 0,
  quality_status: QualityStatus.GOOD,
});

function GrnCreatePage() {
  const sourceTypeOptions = [
    { value: 'Receipt', label: 'Receipt' },
    { value: 'Waybill', label: 'Waybill' },
    { value: 'Grn', label: 'GRN' },
  ];

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.userId);

  const [referenceNo, setReferenceNo] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [receivedOn, setReceivedOn] = useState<Date | null>(new Date());
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [items, setItems] = useState<GrnItem[]>([createEmptyItem()]);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const { data: stacks = [] } = useQuery({
    queryKey: ['stacks'],
    queryFn: getStacks,
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ['receipts'],
    queryFn: getReceipts,
  });

  const { data: waybills = [] } = useQuery({
    queryKey: ['waybills'],
    queryFn: getWaybills,
  });

  const { data: grns = [] } = useQuery({
    queryKey: ['grns'],
    queryFn: getGrns,
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: getUnitReferences,
  });

  const warehouseOptions =
    warehouses && warehouses.length > 0
      ? warehouses.map((warehouse) => ({
          value: warehouse.id.toString(),
          label: `${warehouse.name} (${warehouse.code})`,
        }))
      : Array.from(new Set(stores.map((store) => store.warehouse_id))).map((id) => ({
          value: id.toString(),
          label: `Warehouse #${id}`,
        }));

  const effectiveWarehouseId =
    warehouseId ?? (warehouseOptions.length === 1 ? warehouseOptions[0].value : null);
  const selectedWarehouse = warehouses?.find((warehouse) => warehouse.id.toString() === effectiveWarehouseId);
  const selectedWarehouseManagerName = selectedWarehouse?.contacts?.manager_name?.trim() || '';

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
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create GRN',
        color: 'red',
      });
    },
  });

  const handleAddItem = () => {
    setItems((currentItems) => [...currentItems, createEmptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleItemChange = <K extends keyof GrnItem>(index: number, field: K, value: GrnItem[K]) => {
    setItems((currentItems) => {
      const nextItems = [...currentItems];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return nextItems;
    });
  };

  const storeOptions = stores
    .filter((store) => !effectiveWarehouseId || store.warehouse_id.toString() === effectiveWarehouseId)
    .map((store) => ({
      value: store.id.toString(),
      label: `${store.name} (${store.code})`,
    }));

  const availableStoreIds = new Set(storeOptions.map((store) => Number(store.value)));

  const reservedStacks = stacks.filter((stack) => {
    if (!availableStoreIds.has(stack.store_id)) return false;
    return String(stack.stack_status || '').toLowerCase() === 'reserved';
  });

  const qualityOptions = Object.entries(QualityStatus).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));

  const reservedStacksForItem = (item: GrnItem) =>
    reservedStacks.filter((stack) => {
      if (item.store_id && stack.store_id !== item.store_id) return false;
      if (item.commodity_id && stack.commodity_id !== item.commodity_id) return false;
      return true;
    });

  const stackOptionsForItem = (item: GrnItem) =>
    reservedStacksForItem(item).map((stack) => ({
      value: stack.id.toString(),
      label: `${stack.code} (${stack.unit_abbreviation || stack.unit_name || 'Unit'})`,
    }));

  const unitOptions = units.map((unit) => ({
    value: unit.id.toString(),
    label: unit.abbreviation ? `${unit.name} (${unit.abbreviation})` : unit.name,
  }));

  const sourceOptions =
    sourceType === 'Receipt'
      ? receipts.map((receipt) => ({
          value: receipt.id.toString(),
          label: receipt.reference_no || `Receipt #${receipt.id}`,
        }))
      : sourceType === 'Waybill'
        ? waybills.map((waybill) => ({
            value: waybill.id.toString(),
            label: waybill.reference_no || `Waybill #${waybill.id}`,
          }))
        : sourceType === 'Grn'
          ? grns.map((grn) => ({
              value: grn.id.toString(),
              label: grn.reference_no || `GRN #${grn.id}`,
            }))
          : [];

  const selectedStackForItem = (item: GrnItem) =>
    reservedStacks.find((stack) => stack.id === item.stack_id);

  const selectedCommodityForItem = (item: GrnItem) => {
    const stack = selectedStackForItem(item);
    if (stack && stack.commodity_id === item.commodity_id) {
      return {
        id: stack.commodity_id,
        name: stack.commodity_name || stack.commodity_code || `Commodity #${stack.commodity_id}`,
        code: stack.commodity_code,
        unit_id: stack.unit_id,
        unit_name: stack.unit_name,
        unit_abbreviation: stack.unit_abbreviation,
      };
    }

    return commodities.find((commodity) => commodity.id === item.commodity_id);
  };

  const commodityOptionsForItem = (item: GrnItem) => {
    if (!item.store_id) return [];

    const seen = new Set<number>();
    return reservedStacks
      .filter((stack) => stack.store_id === item.store_id)
      .filter((stack) => {
        if (seen.has(stack.commodity_id)) return false;
        seen.add(stack.commodity_id);
        return true;
      })
      .map((stack) => ({
        value: stack.commodity_id.toString(),
        label: stack.commodity_name || stack.commodity_code || `Commodity #${stack.commodity_id}`,
      }));
  };

  const selectedCommodityTemplateStack = (item: GrnItem) =>
    reservedStacks.find(
      (stack) =>
        stack.store_id === item.store_id &&
        stack.commodity_id === item.commodity_id
    );

  const unitOptionsForItem = (item: GrnItem) => {
    const templateStack = selectedCommodityTemplateStack(item);
    if (!templateStack?.unit_id) return unitOptions;

    return unitOptions.filter((unit) => unit.value === templateStack.unit_id.toString());
  };

  const hasNoReservedStackForCommodity = (item: GrnItem) =>
    Boolean(item.store_id && item.commodity_id && reservedStacksForItem(item).length === 0);

  const handleSubmit = () => {
    if (!referenceNo || !effectiveWarehouseId || !receivedOn) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in the reference number, warehouse, and received date.',
        color: 'red',
      });
      return;
    }

    if (!currentUserId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Your session is missing the current user, so the GRN cannot be submitted.',
        color: 'red',
      });
      return;
    }

    if ((sourceType && !sourceId) || (!sourceType && sourceId)) {
      notifications.show({
        title: 'Validation Error',
        message: 'Source type and source reference must be provided together.',
        color: 'red',
      });
      return;
    }

    const hasInvalidItem =
      items.length === 0 ||
      items.some(
        (item) =>
          !item.store_id ||
          !item.stack_id ||
          !item.commodity_id ||
          !item.unit_id ||
          !item.quantity
      );

    if (hasInvalidItem) {
      notifications.show({
        title: 'Validation Error',
        message: 'Each line item must include a store, stack, commodity, quantity, and unit.',
        color: 'red',
      });
      return;
    }

    createMutation.mutate({
      reference_no: referenceNo,
      warehouse_id: parseInt(effectiveWarehouseId, 10),
      received_on: receivedOn.toISOString().split('T')[0],
      received_by_id: currentUserId,
      source_type: sourceType || undefined,
      source_id: sourceId ? parseInt(sourceId, 10) : undefined,
      items,
    });
  };

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
              onChange={(event) => setReferenceNo(event.target.value)}
              required
            />
            <Select
              label="Warehouse"
              placeholder="Select warehouse"
              data={warehouseOptions}
              value={effectiveWarehouseId}
              onChange={(value) => {
                setWarehouseId(value);
                setItems([createEmptyItem()]);
              }}
              searchable
              required
            />
          </Group>

          <Group grow align="flex-start">
            <DateInput
              label="Received On"
              placeholder="Select date"
              value={receivedOn}
              onChange={(value) => setReceivedOn(value ? new Date(value) : null)}
              required
            />
            <TextInput
              label="Received By"
              description={
                effectiveWarehouseId
                  ? selectedWarehouseManagerName
                    ? 'Shows the warehouse manager recorded in the selected warehouse contact details.'
                    : 'No warehouse manager name is recorded in this warehouse contact profile yet.'
                  : 'Select a warehouse first to show its warehouse manager.'
              }
              placeholder="Warehouse manager will appear here"
              value={selectedWarehouseManagerName}
              readOnly
            />
          </Group>

          <Group grow align="flex-start">
            <Select
              label="Source Type"
              description="Optional. Use this only when the GRN should be linked to an earlier document such as a receipt, waybill, or another GRN."
              placeholder="Select source type"
              data={sourceTypeOptions}
              value={sourceType || null}
              onChange={(value) => {
                setSourceType(value || '');
                setSourceId('');
              }}
              clearable
            />
            <Select
              label="Source Reference"
              description="Optional. Choose the exact source document to link this GRN back to."
              placeholder={sourceType ? 'Select source reference' : 'Select source type first'}
              data={sourceOptions}
              value={sourceId || null}
              onChange={(value) => setSourceId(value || '')}
              searchable
              clearable
              disabled={!sourceType}
            />
          </Group>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Line Items</Title>
            <Button leftSection={<IconPlus size={16} />} variant="light" onClick={handleAddItem}>
              Add Item
            </Button>
          </Group>

          <Alert color="blue" variant="light">
            Choose the destination store first, then the commodity. The stack list only shows reserved stacks for that store and commodity so the GRN receives goods into the correct reserved location.
          </Alert>

          <Table.ScrollContainer minWidth={1100}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Store</Table.Th>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Stack</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th>Quality Status</Table.Th>
                  <Table.Th style={{ width: 50 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => {
                  const selectedStack = selectedStackForItem(item);
                  const selectedCommodity = selectedCommodityForItem(item);

                  return (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Select
                          placeholder={effectiveWarehouseId ? 'Select store' : 'Select warehouse first'}
                          data={storeOptions}
                          value={item.store_id?.toString() || null}
                          onChange={(value) => {
                            const nextStoreId = value ? parseInt(value, 10) : undefined;
                            handleItemChange(index, 'store_id', nextStoreId);
                            handleItemChange(index, 'commodity_id', 0);
                            handleItemChange(index, 'stack_id', undefined);
                            handleItemChange(index, 'unit_id', 0);
                          }}
                          searchable
                          clearable
                          disabled={!effectiveWarehouseId}
                        />
                      </Table.Td>

                      <Table.Td>
                        <Select
                          placeholder={item.store_id ? 'Select commodity' : 'Select store first'}
                          data={commodityOptionsForItem(item)}
                          value={item.commodity_id ? item.commodity_id.toString() : null}
                          onChange={(value) => {
                            const nextCommodityId = value ? parseInt(value, 10) : 0;
                            const templateStack = reservedStacks.find(
                              (entry) =>
                                entry.store_id === item.store_id &&
                                entry.commodity_id === nextCommodityId
                            );

                            handleItemChange(index, 'commodity_id', nextCommodityId);
                            handleItemChange(index, 'stack_id', undefined);
                            handleItemChange(index, 'unit_id', templateStack?.unit_id || 0);
                          }}
                          searchable
                          clearable
                          disabled={!item.store_id}
                        />
                      </Table.Td>

                      <Table.Td>
                        <Select
                          placeholder={item.commodity_id ? 'Select reserved stack' : 'Select commodity first'}
                          data={stackOptionsForItem(item)}
                          value={item.stack_id?.toString() || null}
                          onChange={(value) => {
                            const nextStackId = value ? parseInt(value, 10) : undefined;
                            const stack = reservedStacks.find((entry) => entry.id === nextStackId);
                            handleItemChange(index, 'stack_id', nextStackId);
                            handleItemChange(index, 'unit_id', stack?.unit_id || item.unit_id || 0);
                          }}
                          searchable
                          clearable
                          disabled={!item.commodity_id}
                        />
                        {hasNoReservedStackForCommodity(item) ? (
                          <Text size="xs" c="red" mt={4}>
                            No reserved stack is available for this commodity in the selected store. Reserve one first before creating the GRN.
                          </Text>
                        ) : selectedStack ? (
                          <Text size="xs" c="dimmed" mt={4}>
                            Reserved stack selected: {selectedStack.code}
                          </Text>
                        ) : null}
                      </Table.Td>

                      <Table.Td>
                        <NumberInput
                          placeholder="Enter quantity"
                          value={item.quantity || ''}
                          onChange={(value) => handleItemChange(index, 'quantity', Number(value))}
                          min={0}
                          hideControls
                        />
                      </Table.Td>

                      <Table.Td>
                        <Select
                          placeholder="Select unit"
                          data={unitOptionsForItem(item)}
                          value={item.unit_id ? item.unit_id.toString() : null}
                          onChange={(value) =>
                            handleItemChange(index, 'unit_id', value ? parseInt(value, 10) : 0)
                          }
                          searchable
                        />
                        {selectedCommodity?.unit_name || selectedCommodity?.unit_abbreviation ? (
                          <Text size="xs" c="dimmed" mt={4}>
                            Suggested unit: {selectedCommodity.unit_abbreviation || selectedCommodity.unit_name}
                          </Text>
                        ) : null}
                      </Table.Td>

                      <Table.Td>
                        <Select
                          placeholder="Select quality"
                          data={qualityOptions}
                          value={item.quality_status}
                          onChange={(value) =>
                            handleItemChange(index, 'quality_status', value || QualityStatus.GOOD)
                          }
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
                  );
                })}
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
