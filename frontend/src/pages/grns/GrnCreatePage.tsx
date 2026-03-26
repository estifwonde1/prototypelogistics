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
import { createGrn } from '../../api/grns';
import { getReceipts } from '../../api/receipts';
import { getWaybills } from '../../api/waybills';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { notifications } from '@mantine/notifications';
import { QualityStatus } from '../../utils/constants';
import { getGrns } from '../../api/grns';
import type { GrnItem } from '../../types/grn';
import type { ApiError } from '../../types/common';

function GrnCreatePage() {
  const sourceTypeOptions = [
    { value: 'Receipt', label: 'Receipt' },
    { value: 'Waybill', label: 'Waybill' },
    { value: 'Grn', label: 'GRN' },
  ];

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

  const handleItemChange = <K extends keyof GrnItem>(
    index: number,
    field: K,
    value: GrnItem[K]
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = () => {
    const effectiveWarehouseId =
      warehouseId ?? (warehouseOptions.length === 1 ? warehouseOptions[0].value : null);

    if (!referenceNo || !effectiveWarehouseId || !receivedOn) {
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

    if ((sourceType && !sourceId) || (!sourceType && sourceId)) {
      notifications.show({
        title: 'Validation Error',
        message: 'Source type and source ID must be provided together.',
        color: 'red',
      });
      return;
    }

    createMutation.mutate({
      reference_no: referenceNo,
      warehouse_id: parseInt(effectiveWarehouseId),
      received_on: receivedOn.toISOString().split('T')[0],
      received_by_id: receivedById ? parseInt(receivedById) : undefined,
      source_type: sourceType || undefined,
      source_id: sourceId ? parseInt(sourceId) : undefined,
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

  const qualityOptions = Object.entries(QualityStatus).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));

  const stackOptionsForItem = (storeId?: number) =>
    stacks
      .filter((stack) => availableStoreIds.has(stack.store_id))
      .filter((stack) => !storeId || stack.store_id === storeId)
      .map((stack) => ({
        value: stack.id.toString(),
        label: `${stack.code} (#${stack.id})`,
      }));

  const sourceOptions =
    sourceType === 'Receipt'
      ? receipts.map((receipt) => ({
          value: receipt.id.toString(),
          label: `${receipt.reference_no || 'Receipt'} (#${receipt.id})`,
        }))
      : sourceType === 'Waybill'
        ? waybills.map((waybill) => ({
            value: waybill.id.toString(),
            label: `${waybill.reference_no || 'Waybill'} (#${waybill.id})`,
          }))
        : sourceType === 'Grn'
          ? grns.map((grn) => ({
              value: grn.id.toString(),
              label: `${grn.reference_no || 'GRN'} (#${grn.id})`,
        }))
          : [];

  const selectedReceipt = sourceType === 'Receipt' ? receipts.find((receipt) => receipt.id === Number(sourceId)) : undefined;
  const selectedWaybill = sourceType === 'Waybill' ? waybills.find((waybill) => waybill.id === Number(sourceId)) : undefined;
  const selectedSourceGrn = sourceType === 'Grn' ? grns.find((grn) => grn.id === Number(sourceId)) : undefined;

  const sourceItemOptions =
    sourceType === 'Receipt'
      ? selectedReceipt && selectedReceipt.commodity_id
        ? [
            {
              value: `${selectedReceipt.commodity_id}:${selectedReceipt.unit_id}`,
              label: `${selectedReceipt.commodity_name || `Commodity #${selectedReceipt.commodity_id}`} | ${selectedReceipt.quantity.toLocaleString()} ${selectedReceipt.unit_abbreviation || selectedReceipt.unit_name || `Unit #${selectedReceipt.unit_id}`}`,
            },
          ]
        : []
      : sourceType === 'Waybill'
      ? (selectedWaybill?.waybill_items ?? []).map((item) => ({
          value: `${item.commodity_id}:${item.unit_id}`,
          label: `Commodity #${item.commodity_id} | ${item.quantity.toLocaleString()} Unit #${item.unit_id}`,
        }))
      : sourceType === 'Grn'
        ? (selectedSourceGrn?.grn_items ?? []).map((item) => ({
            value: `${item.commodity_id}:${item.unit_id}`,
            label: `Commodity #${item.commodity_id} | ${item.quantity.toLocaleString()} Unit #${item.unit_id}`,
          }))
        : [];

  const sourceItems =
    sourceType === 'Receipt'
      ? selectedReceipt && selectedReceipt.commodity_id
        ? [
            {
              commodity_id: selectedReceipt.commodity_id,
              unit_id: selectedReceipt.unit_id,
              quantity: selectedReceipt.quantity,
            },
          ]
        : []
      : sourceType === 'Waybill'
      ? selectedWaybill?.waybill_items ?? []
      : sourceType === 'Grn'
        ? selectedSourceGrn?.grn_items ?? []
        : [];

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
              label="Received On"
              placeholder="Select date"
              value={receivedOn}
              onChange={(value) => setReceivedOn(value ? new Date(value) : null)}
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
            <Select
              label="Source Type"
              placeholder="Select source type"
              data={sourceTypeOptions}
              value={sourceType}
              onChange={(value) => {
                setSourceType(value || '');
                setSourceId('');
              }}
              clearable
            />
            <Select
              label="Source Reference"
              placeholder={sourceType ? 'Select source reference' : 'Select source type first'}
              data={sourceOptions}
              value={sourceId || null}
              onChange={(value) => {
                const nextSourceId = value || '';
                setSourceId(nextSourceId);
              }}
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
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={handleAddItem}
            >
              Add Item
            </Button>
          </Group>

          <Alert color="blue" variant="light">
            Source-backed item selection is available for receipts, waybills, and source GRNs. When a source item is selected, commodity and unit are filled from that source to reduce manual entry.
          </Alert>

          <Table.ScrollContainer minWidth={800}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th>Quality Status</Table.Th>
                  <Table.Th>Store</Table.Th>
                  <Table.Th>Stack</Table.Th>
                  <Table.Th style={{ width: 50 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      {sourceItemOptions.length > 0 ? (
                        <Select
                          placeholder="Select source item"
                          data={sourceItemOptions}
                          value={
                            item.commodity_id && item.unit_id
                              ? `${item.commodity_id}:${item.unit_id}`
                              : null
                          }
                          onChange={(value) => {
                            if (!value) {
                              handleItemChange(index, 'commodity_id', 0);
                              handleItemChange(index, 'unit_id', 0);
                              return;
                            }

                            const [commodityId, unitId] = value.split(':');
                            const sourceItem = sourceItems.find(
                              (entry) =>
                                entry.commodity_id === Number(commodityId) &&
                                entry.unit_id === Number(unitId)
                            );
                            handleItemChange(index, 'commodity_id', Number(commodityId));
                            handleItemChange(index, 'unit_id', Number(unitId));
                            if (!item.quantity && sourceItem) {
                              handleItemChange(index, 'quantity', Number(sourceItem.quantity));
                            }
                          }}
                          searchable
                          clearable
                        />
                      ) : (
                        <NumberInput
                          placeholder="Commodity ID"
                          value={item.commodity_id || ''}
                          onChange={(val) =>
                            handleItemChange(index, 'commodity_id', Number(val))
                          }
                          min={1}
                          hideControls
                        />
                      )}
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
                      {sourceItemOptions.length > 0 || selectedReceipt ? (
                        <Text size="sm">
                          {item.unit_id
                            ? `Unit #${item.unit_id}`
                            : selectedReceipt?.unit_id
                              ? `Unit #${selectedReceipt.unit_id}`
                              : '-'}
                        </Text>
                      ) : (
                        <NumberInput
                          placeholder="Unit ID"
                          value={item.unit_id || ''}
                          onChange={(val) => handleItemChange(index, 'unit_id', Number(val))}
                          min={1}
                          hideControls
                        />
                      )}
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
                        onChange={(val) => {
                          const nextStoreId = val ? parseInt(val) : undefined;
                          handleItemChange(index, 'store_id', nextStoreId);
                          handleItemChange(index, 'stack_id', undefined);
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
                        onChange={(val) => {
                          const nextStackId = val ? parseInt(val) : undefined;
                          const selectedStack = stacks.find((stack) => stack.id === nextStackId);
                          handleItemChange(index, 'stack_id', nextStackId);

                          if (selectedStack) {
                            handleItemChange(index, 'commodity_id', selectedStack.commodity_id);
                            handleItemChange(index, 'unit_id', selectedStack.unit_id);
                          }
                        }}
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
