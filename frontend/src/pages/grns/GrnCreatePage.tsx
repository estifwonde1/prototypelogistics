import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { notifications } from '@mantine/notifications';
import { createGrn, getGrns } from '../../api/grns';
import { getReceipts } from '../../api/receipts';
import { getWaybills } from '../../api/waybills';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { getCommodityReferences, getUnitReferences, getUomConversions } from '../../api/referenceData';
import { getReceiptOrder, getReceiptOrders } from '../../api/receiptOrders';
import type { ReceiptOrder } from '../../api/receiptOrders';
import { useAuthStore } from '../../store/authStore';
import { QualityStatus } from '../../utils/constants';
import { generateSourceDetailReference } from '../../utils/sourceDetailReference';
import type { GrnItem } from '../../types/grn';
import type { Stack as WarehouseStack } from '../../types/stack';
import type { ApiError } from '../../types/common';

const createEmptyItem = (): GrnItem => ({
  commodity_id: 0,
  quantity: 0,
  unit_id: 0,
  quality_status: QualityStatus.GOOD,
  line_reference_no: '',
});

/** Ensures each line has a unique reference (used as batch on intake). */
function uniqueLineRefsForGrnItems(list: GrnItem[]): GrnItem[] {
  const used = new Set<string>();
  return list.map((item) => {
    let ref = (item.line_reference_no || item.batch_no || '').trim();
    if (!ref) ref = generateSourceDetailReference();
    while (used.has(ref)) ref = generateSourceDetailReference();
    used.add(ref);
    return { ...item, line_reference_no: ref, batch_no: ref };
  });
}

/** Stacks usable for GRN receiving: reserved/available/active and similar; excludes full or in-use bins. */
function isStackEligibleForGrn(stack: WarehouseStack): boolean {
  const s = String(stack.stack_status || '')
    .toLowerCase()
    .trim();
  if (s === 'full' || s === 'in use' || s === 'in_use') return false;
  return true;
}

/** Prefill GRN rows from receipt order lines; store/stack come from space reservations + reserved stacks when available. */
function mapReceiptOrderLinesToGrnItems(
  order: ReceiptOrder,
  reservedStacksList: WarehouseStack[]
): GrnItem[] {
  const lines = order.receipt_order_lines ?? order.lines ?? [];
  const reservations = order.space_reservations ?? [];

  return lines.map((line) => {
    const res = reservations.find(
      (r) => r.receipt_order_line_id != null && line.id != null && r.receipt_order_line_id === line.id
    );
    const storeId = res?.store_id;
    let stackId: number | undefined;
    if (storeId && line.commodity_id) {
      const match = reservedStacksList.find(
        (s) =>
          s.store_id === storeId &&
          s.commodity_id === line.commodity_id &&
          isStackEligibleForGrn(s)
      );
      stackId = match?.id;
    }

    return {
      commodity_id: line.commodity_id,
      quantity: line.quantity,
      unit_id: line.unit_id,
      quality_status: QualityStatus.GOOD,
      store_id: storeId,
      stack_id: stackId,
      line_reference_no: line.line_reference_no?.trim() || '',
    };
  });
}

function GrnCreatePage() {
  const sourceTypeOptions = [
    { value: 'Receipt', label: 'Receipt' },
    { value: 'Receipt Order', label: 'Receipt Order' },
    { value: 'Waybill', label: 'Waybill' },
    { value: 'Grn', label: 'GRN' },
  ];

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.userId);

  const [referenceNo, setReferenceNo] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [receivedOn, setReceivedOn] = useState<Date | null>(new Date());
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [items, setItems] = useState<GrnItem[]>([createEmptyItem()]);
  const [showLotTracking, setShowLotTracking] = useState<{ [key: number]: boolean }>({});

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStores({}),
  });

  const { data: stacks = [] } = useQuery({
    queryKey: ['stacks'],
    queryFn: () => getStacks(),
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
    queryFn: () => getGrns(),
  });

  const { data: receiptOrders = [] } = useQuery({
    queryKey: ['receipt_orders'],
    queryFn: () => getReceiptOrders({}),
  });

  const receiptOrderIdParam = useMemo(() => {
    const raw = searchParams.get('receipt_order_id');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);

  /** Load full receipt order when linked via URL or when Source Reference selects an RO. */
  const receiptOrderDetailId = useMemo(() => {
    if (sourceType === 'Receipt Order' && sourceId) {
      const n = Number(sourceId);
      return Number.isFinite(n) ? n : null;
    }
    if (receiptOrderIdParam != null) return receiptOrderIdParam;
    return null;
  }, [receiptOrderIdParam, sourceType, sourceId]);

  const { data: receiptOrderDetail } = useQuery({
    queryKey: ['receipt_orders', receiptOrderDetailId],
    queryFn: () => getReceiptOrder(receiptOrderDetailId!),
    enabled: receiptOrderDetailId != null,
  });

  const activeReceiptOrder =
    receiptOrderDetailId != null && receiptOrderDetail?.id === receiptOrderDetailId
      ? receiptOrderDetail
      : undefined;

  const prefillRoIdRef = useRef<number | null>(null);
  const stackMergeDoneRef = useRef<number | null>(null);

  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: () => getUnitReferences(),
  });

  useQuery({
    queryKey: ['reference-data', 'uom_conversions'],
    queryFn: () => getUomConversions(),
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
    return isStackEligibleForGrn(stack);
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
      : sourceType === 'Receipt Order'
        ? receiptOrders.map((order) => ({
            value: order.id.toString(),
            label: order.reference_no || `RO-${order.id}`,
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

  useEffect(() => {
    if (!activeReceiptOrder) return;

    setSourceType('Receipt Order');
    setSourceId(String(activeReceiptOrder.id));

    const wid = activeReceiptOrder.warehouse_id ?? activeReceiptOrder.destination_warehouse_id;
    if (wid != null) setWarehouseId(String(wid));

    setReferenceNo((current) => {
      if (current.trim()) return current;
      const roRef = activeReceiptOrder.reference_no?.trim() || `RO-${activeReceiptOrder.id}`;
      const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
      return `GRN-${roRef}-${date}`;
    });
  }, [activeReceiptOrder]);

  useEffect(() => {
    if (!activeReceiptOrder) {
      prefillRoIdRef.current = null;
      stackMergeDoneRef.current = null;
      return;
    }

    const roId = activeReceiptOrder.id;
    const wid = activeReceiptOrder.warehouse_id ?? activeReceiptOrder.destination_warehouse_id;
    if (!wid) return;

    const storeIds = new Set(stores.filter((s) => s.warehouse_id === wid).map((s) => s.id));
    const reservedForWh = stacks.filter(
      (stack) => storeIds.has(stack.store_id) && isStackEligibleForGrn(stack)
    );

    const mapped = mapReceiptOrderLinesToGrnItems(activeReceiptOrder, reservedForWh);

    const isNewRo = prefillRoIdRef.current !== roId;
    if (isNewRo) {
      prefillRoIdRef.current = roId;
      stackMergeDoneRef.current = null;
      setItems(mapped.length > 0 ? mapped : [createEmptyItem()]);
      return;
    }

    if (stackMergeDoneRef.current === roId) return;

    setItems((prev) => {
      const shouldMerge = mapped.some((m, i) => prev[i] && !prev[i].stack_id && m.stack_id);
      if (!shouldMerge) {
        stackMergeDoneRef.current = roId;
        return prev;
      }
      stackMergeDoneRef.current = roId;
      return prev.map((row, i) => ({
        ...row,
        store_id: row.store_id ?? mapped[i]?.store_id,
        stack_id: row.stack_id ?? mapped[i]?.stack_id,
      }));
    });
  }, [activeReceiptOrder, stores, stacks]);

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

  /** Full commodity catalog from reference data (not only commodities on reserved stacks in this store). */
  const commodityOptionsForItem = (item: GrnItem) => {
    if (!item.store_id) return [];

    const byId = new Map<string, { value: string; label: string }>();

    for (const c of commodities) {
      byId.set(c.id.toString(), {
        value: c.id.toString(),
        label: c.name || c.code || `Commodity #${c.id}`,
      });
    }

    if (activeReceiptOrder) {
      const lines = activeReceiptOrder.receipt_order_lines ?? activeReceiptOrder.lines ?? [];
      for (const line of lines) {
        if (!line.commodity_id) continue;
        const id = line.commodity_id.toString();
        if (!byId.has(id)) {
          byId.set(id, {
            value: id,
            label: line.commodity_name?.trim() || `Commodity #${line.commodity_id}`,
          });
        }
      }
    }

    if (item.commodity_id && !byId.has(item.commodity_id.toString())) {
      const ref = commodities.find((c) => c.id === item.commodity_id);
      byId.set(item.commodity_id.toString(), {
        value: item.commodity_id.toString(),
        label: ref?.name || `Commodity #${item.commodity_id}`,
      });
    }

    const reservedInStore = new Set(
      reservedStacks.filter((s) => s.store_id === item.store_id).map((s) => s.commodity_id)
    );

    const list = Array.from(byId.values());
    list.sort((a, b) => {
      const ar = reservedInStore.has(Number(a.value)) ? 0 : 1;
      const br = reservedInStore.has(Number(b.value)) ? 0 : 1;
      if (ar !== br) return ar - br;
      return a.label.localeCompare(b.label);
    });

    return list;
  };

  const selectedCommodityTemplateStack = (item: GrnItem) =>
    reservedStacks.find(
      (stack) =>
        stack.store_id === item.store_id &&
        stack.commodity_id === item.commodity_id
    );

  const unitOptionsForItem = (item: GrnItem) => {
    const templateStack = selectedCommodityTemplateStack(item);
    if (templateStack?.unit_id) {
      return unitOptions.filter((unit) => unit.value === templateStack.unit_id.toString());
    }
    const ref = commodities.find((c) => c.id === item.commodity_id);
    if (ref?.unit_id) {
      return unitOptions.filter((unit) => unit.value === ref?.unit_id?.toString());
    }
    return unitOptions;
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
      receipt_order_id: sourceType === 'Receipt Order' && sourceId ? parseInt(sourceId, 10) : undefined,
      items: uniqueLineRefsForGrnItems(items),
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
                if (
                  sourceType === 'Receipt Order' &&
                  activeReceiptOrder &&
                  value ===
                    String(
                      activeReceiptOrder.warehouse_id ?? activeReceiptOrder.destination_warehouse_id
                    )
                ) {
                  const wid =
                    activeReceiptOrder.warehouse_id ?? activeReceiptOrder.destination_warehouse_id;
                  if (wid) {
                    const storeIds = new Set(
                      stores.filter((s) => s.warehouse_id === wid).map((s) => s.id)
                    );
                    const reservedForWh = stacks.filter(
                      (stack) => storeIds.has(stack.store_id) && isStackEligibleForGrn(stack)
                    );
                    const mapped = mapReceiptOrderLinesToGrnItems(activeReceiptOrder, reservedForWh);
                    setItems(mapped.length > 0 ? mapped : [createEmptyItem()]);
                  }
                } else {
                  setItems([createEmptyItem()]);
                }
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
            Choose the destination store first, then the commodity. Each line needs a unique reference number (used as the batch when creating inventory lots). Leave it blank to auto-assign on save, or enter your own. Commodities with reserved space in this store are sorted first; stacks shown are receivable for the selected store and commodity.
          </Alert>

          <Table.ScrollContainer minWidth={1280}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Store</Table.Th>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Line ref / batch</Table.Th>
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
                    <Fragment key={index}>
                      <Table.Tr>
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
                            const refCommodity = commodities.find((c) => c.id === nextCommodityId);

                            handleItemChange(index, 'commodity_id', nextCommodityId);
                            handleItemChange(index, 'stack_id', undefined);
                            handleItemChange(
                              index,
                              'unit_id',
                              templateStack?.unit_id || refCommodity?.unit_id || 0
                            );
                          }}
                          searchable
                          clearable
                          disabled={!item.store_id}
                        />
                      </Table.Td>

                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <TextInput
                            placeholder="e.g. SD… or your batch"
                            value={item.line_reference_no || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              handleItemChange(index, 'line_reference_no', v);
                              handleItemChange(index, 'batch_no', v);
                            }}
                            style={{ minWidth: 140 }}
                          />
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const ref = generateSourceDetailReference();
                              handleItemChange(index, 'line_reference_no', ref);
                              handleItemChange(index, 'batch_no', ref);
                            }}
                          >
                            Gen
                          </Button>
                        </Group>
                      </Table.Td>

                      <Table.Td>
                        <Select
                          placeholder={item.commodity_id ? 'Select stack' : 'Select commodity first'}
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
                            No receivable stack is available for this commodity in this store. Reserve space on the receipt order first (which creates a receiving stack), or add a stack for this store and commodity.
                          </Text>
                        ) : selectedStack ? (
                          <Text size="xs" c="dimmed" mt={4}>
                            Stack selected: {selectedStack.code}
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
                        <Group gap="xs">
                          <ActionIcon
                            color="blue"
                            variant="subtle"
                            onClick={() => setShowLotTracking((prev) => ({ ...prev, [index]: !prev[index] }))}
                            title="Toggle lot tracking"
                          >
                            {showLotTracking[index] ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                          </ActionIcon>
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
                    </Table.Tr>
                    {showLotTracking[index] && (
                      <Table.Tr key={`${index}-lot`}>
                        <Table.Td colSpan={8}>
                          <Card bg="gray.0" p="md">
                            <Stack gap="md">
                              <Text size="sm" fw={600}>
                                Lot & UOM Tracking (Optional)
                              </Text>
                              <Group grow>
                                <TextInput
                                  label="Line reference / batch"
                                  description="Same value as the Line ref / batch column above."
                                  placeholder="e.g., BATCH-2026-001"
                                  value={item.line_reference_no || item.batch_no || ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    handleItemChange(index, 'line_reference_no', v);
                                    handleItemChange(index, 'batch_no', v);
                                  }}
                                />
                                <DateInput
                                  label="Expiry Date"
                                  placeholder="Select expiry date"
                                  value={item.expiry_date ? new Date(item.expiry_date as string) : null}
                                  onChange={(date) => {
                                    if (!date) {
                                      handleItemChange(index, 'expiry_date', undefined);
                                      return;
                                    }
                                    const d = date as unknown as Date;
                                    handleItemChange(index, 'expiry_date', d.toISOString().split('T')[0]);
                                  }}
                                  minDate={new Date()}
                                />
                              </Group>
                              <Group grow>
                                <Select
                                  label="Entered Unit"
                                  description="Unit as received (e.g., bags)"
                                  placeholder="Select entered unit"
                                  data={unitOptions}
                                  value={item.entered_unit_id?.toString() || null}
                                  onChange={(value) =>
                                    handleItemChange(index, 'entered_unit_id', value ? parseInt(value, 10) : undefined)
                                  }
                                  searchable
                                  clearable
                                />
                                <NumberInput
                                  label="Entered Quantity"
                                  description="Quantity in entered unit"
                                  placeholder="Enter quantity"
                                  value={item.entered_quantity || ''}
                                  onChange={(value) => handleItemChange(index, 'entered_quantity', Number(value))}
                                  min={0}
                                  hideControls
                                />
                              </Group>
                              {item.entered_unit_id && item.entered_quantity && (
                                <Alert color="blue" variant="light">
                                  <Text size="sm">
                                    Conversion: {item.entered_quantity}{' '}
                                    {units.find((u) => u.id === item.entered_unit_id)?.abbreviation || 'units'} ={' '}
                                    {item.quantity} {item.unit_abbreviation || 'base units'}
                                  </Text>
                                </Alert>
                              )}
                            </Stack>
                          </Card>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Fragment>
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




