import { useState, useEffect, useRef } from 'react';
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
import { IconTrash, IconPlus, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { createGin } from '../../api/gins';
import { getDispatches } from '../../api/dispatches';
import { getWaybills } from '../../api/waybills';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { getStockBalances } from '../../api/stockBalances';
import { getInventoryLots } from '../../api/referenceData';
import { notifications } from '@mantine/notifications';
import { ExpiryBadge } from '../../components/common/ExpiryBadge';
import type { GinItem } from '../../types/gin';
import type { ApiError } from '../../types/common';
import { useAuthStore } from '../../store/authStore';

function GinCreatePage() {
  const destinationTypeOptions = [
    { value: 'Dispatch', label: 'Dispatch' },
    { value: 'Waybill', label: 'Waybill' },
  ];

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loggedInUserId = useAuthStore((s) => s.userId);
  const defaultedIssuedByRef = useRef(false);

  // Form state
  const [referenceNo, setReferenceNo] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [issuedOn, setIssuedOn] = useState<Date | null>(new Date());
  const [issuedById, setIssuedById] = useState('');

  useEffect(() => {
    if (loggedInUserId != null && !defaultedIssuedByRef.current) {
      setIssuedById(String(loggedInUserId));
      defaultedIssuedByRef.current = true;
    }
  }, [loggedInUserId]);
  const [destinationType, setDestinationType] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [items, setItems] = useState<GinItem[]>([
    {
      commodity_id: 0,
      quantity: 0,
      unit_id: 0,
    },
  ]);
  const [showLotInfo, setShowLotInfo] = useState<{ [key: number]: boolean }>({});

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
  });

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStores({}),
  });

  const { data: stacks = [] } = useQuery({
    queryKey: ['stacks'],
    queryFn: () => getStacks(),
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
    queryFn: () => getStockBalances({}),
    refetchOnMount: 'always',
  });

  const { data: inventoryLots = [] } = useQuery({
    queryKey: ['reference-data', 'inventory_lots'],
    queryFn: getInventoryLots,
  });

  useEffect(() => {
    if (warehouseId !== null) return;
    if (warehouses && warehouses.length === 1) {
      setWarehouseId(String(warehouses[0].id));
      return;
    }
    if ((!warehouses || warehouses.length === 0) && stores && stores.length > 0) {
      const uniqueWarehouseIds = Array.from(new Set(stores.map((s) => s.warehouse_id)));
      if (uniqueWarehouseIds.length === 1) {
        setWarehouseId(String(uniqueWarehouseIds[0]));
      }
    }
  }, [warehouses, stores, warehouseId]);

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

  /** Always use functional updates so rapid multi-field edits (store + stack) don't clobber each other. */
  const handleItemChange = <K extends keyof GinItem>(
    index: number,
    field: K,
    value: GinItem[K]
  ) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const updateItemFields = (index: number, patch: Partial<GinItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
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

    if (!issuedById?.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Issued By (User ID) is required — it defaults to your account after login.',
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
      issued_by_id: parseInt(issuedById.trim(), 10),
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

  const availableLotsForItem = (item: GinItem) => {
    const effectiveWarehouseId =
      warehouseId ?? (warehouseOptions.length === 1 ? warehouseOptions[0].value : null);
    
    if (!effectiveWarehouseId || !item.commodity_id) return [];
    
    return inventoryLots.filter((lot) => {
      if (lot.warehouse_id !== Number(effectiveWarehouseId)) return false;
      if (lot.commodity_id !== item.commodity_id) return false;
      if (lot.status !== 'Active') return false;
      return true;
    });
  };

  const selectedLotForItem = (item: GinItem) => {
    if (!item.inventory_lot_id) return null;
    return inventoryLots.find((lot) => lot.id === item.inventory_lot_id);
  };

  const applyCommoditySelection = (index: number, value: string | null) => {
    setItems((prev) => {
      const next = [...prev];
      if (!value) {
        next[index] = {
          ...next[index],
          commodity_id: 0,
          unit_id: 0,
          store_id: undefined,
          stack_id: undefined,
          quantity: 0,
        };
        return next;
      }
      const parts = value.split(':');
      const commodityId = Number(parts[0]);
      const unitId = Number(parts[1]);
      const storeId = parts[2] !== undefined && parts[2] !== '' ? Number(parts[2]) : undefined;
      const stackId = parts[3] !== undefined && parts[3] !== '' ? Number(parts[3]) : undefined;
      next[index] = {
        ...next[index],
        commodity_id: commodityId,
        unit_id: unitId,
        store_id: storeId,
        stack_id: stackId,
        quantity: 0,
      };
      return next;
    });
  };

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
                    commodity_id: 0,
                    unit_id: 0,
                    quantity: 0,
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
              description="Defaults to the signed-in user; required by the server."
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
                  <>
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
                        onChange={(value) => applyCommoditySelection(index, value)}
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
                          const nextStoreId = val ? parseInt(val, 10) : undefined;
                          updateItemFields(index, {
                            store_id: nextStoreId,
                            stack_id: undefined,
                            commodity_id: 0,
                            unit_id: 0,
                            quantity: 0,
                          });
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
                          const nextStackId = val ? parseInt(val, 10) : undefined;
                          updateItemFields(index, {
                            stack_id: nextStackId,
                            commodity_id: 0,
                            unit_id: 0,
                            quantity: 0,
                          });
                        }}
                        searchable
                        clearable
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {availableLotsForItem(item).length > 0 && (
                          <ActionIcon
                            color="blue"
                            variant="subtle"
                            onClick={() => setShowLotInfo((prev) => ({ ...prev, [index]: !prev[index] }))}
                            title="Toggle lot information"
                          >
                            {showLotInfo[index] ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                          </ActionIcon>
                        )}
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length === 1}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                        </>
                      );
                    })()}
                  </Table.Tr>
                  {showLotInfo[index] && availableLotsForItem(items[index]).length > 0 && (
                    <Table.Tr key={`${index}-lot`}>
                      <Table.Td colSpan={7}>
                        <Card bg="blue.0" p="md">
                          <Stack gap="md">
                            <Text size="sm" fw={600}>
                              Lot Selection (Optional)
                            </Text>
                            <Select
                              label="Select Lot"
                              description="Choose which lot to issue from"
                              placeholder="Select lot"
                              data={availableLotsForItem(items[index]).map((lot) => ({
                                value: lot.id.toString(),
                                label: `${lot.batch_no} - Exp: ${new Date(lot.expiry_date).toLocaleDateString()}`,
                              }))}
                              value={items[index].inventory_lot_id?.toString() || null}
                              onChange={(value) => {
                                const lotId = value ? parseInt(value, 10) : undefined;
                                const selectedLot = inventoryLots.find((l) => l.id === lotId);
                                handleItemChange(index, 'inventory_lot_id', lotId);
                                if (selectedLot) {
                                  handleItemChange(index, 'batch_no', selectedLot.batch_no);
                                  handleItemChange(index, 'expiry_date', selectedLot.expiry_date);
                                }
                              }}
                              searchable
                              clearable
                            />
                            {selectedLotForItem(items[index]) && (
                              <Card bg="white" p="sm" withBorder>
                                <Group justify="space-between">
                                  <div>
                                    <Text size="sm" fw={600}>
                                      Batch: {selectedLotForItem(items[index])?.batch_no}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      Lot Code: {selectedLotForItem(items[index])?.lot_code}
                                    </Text>
                                  </div>
                                  <ExpiryBadge expiryDate={selectedLotForItem(items[index])!.expiry_date} />
                                </Group>
                              </Card>
                            )}
                          </Stack>
                        </Card>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </>
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



