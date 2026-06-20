/**
 * DAFormPage — Create a Dispatch Authorization (Hub Manager & Warehouse Manager)
 *
 * Warehouse Manager (independent warehouse) flow:
 * - No source warehouse picker — the warehouse is implicit (their own).
 * - Sources are STORES: WM picks store + commodity + quantity + unit per line.
 * - Multiple store allocation lines supported.
 *
 * Hub Manager flow:
 * - One row per commodity from the selected dispatch order.
 * - Eligible warehouses filtered to those with available stock > 0.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Text,
  Button,
  Group,
  Card,
  TextInput,
  NumberInput,
  SimpleGrid,
  Table,
  ActionIcon,
  Divider,
  Alert,
} from '@mantine/core';
import { IconTrash, IconPlus, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import {
  createDispatchOrderAuthorization,
  confirmDispatchOrderAuthorization,
} from '../../api/dispatchOrderAuthorizations';
import type { CreateDispatchOrderAuthorizationPayload } from '../../api/dispatchOrderAuthorizations';
import { getDispatchOrders } from '../../api/dispatchOrders';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import { getCommodityReferences, getUnitReferences, getUomConversions } from '../../api/referenceData';
import { getStockBalances } from '../../api/stockBalances';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { findDirectedMultiplier } from '../../utils/uomConversions';
import type { ApiError } from '../../types/common';

// Hub manager: one warehouse line per commodity
type WarehouseLineItem = {
  warehouse_id: string | null;
  commodity_id: string | null;
  quantity: number;
  unit_id: string | null;
};

// Warehouse manager: one store allocation line per commodity/store
type StoreAllocLine = {
  store_id: string | null;
  commodity_id: string | null;
  quantity: number;
  unit_id: string | null;
};

const emptyStoreLine = (): StoreAllocLine => ({
  store_id: null,
  commodity_id: null,
  quantity: 0,
  unit_id: null,
});

export default function DAFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const activeAssignment = useAuthStore((s) => s.activeAssignment);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((s) => s.role));
  const isHubManager = roleSlug === 'hub_manager';
  const isWarehouseManager = roleSlug === 'warehouse_manager';

  const userHubId = activeAssignment?.hub?.id;
  const userWarehouseId = activeAssignment?.warehouse?.id;

  const basePath = location.pathname.startsWith('/warehouse')
    ? '/warehouse/dispatch-authorizations'
    : '/hub/dispatch-authorizations';

  const [dispatchOrderId, setDispatchOrderId] = useState<string | null>(
    searchParams.get('dispatch_order_id')
  );

  // Hub manager: one line per commodity in the dispatch order
  const [lines, setLines] = useState<WarehouseLineItem[]>([]);

  // Warehouse manager: store-based allocation lines
  const [storeLines, setStoreLines] = useState<StoreAllocLine[]>([emptyStoreLine()]);

  // Transport fields
  const [transporterName, setTransporterName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverIdNum, setDriverIdNum] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [truckPlate, setTruckPlate] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: dispatchOrders = [] } = useQuery({
    queryKey: ['dispatch_orders', 'for_da', { hub_id: userHubId, warehouse_id: userWarehouseId }],
    queryFn: () =>
      isHubManager && userHubId
        ? getDispatchOrders({ hub_id: userHubId })
        : isWarehouseManager && userWarehouseId
          ? getDispatchOrders({ warehouse_id: userWarehouseId })
          : getDispatchOrders({}),
    select: (orders) =>
      orders.filter((o) => {
        if (o.status === 'Draft' || o.status === 'Completed') return false;
        if (isHubManager && o.remaining_quantity != null && o.remaining_quantity <= 0) return false;
        return true;
      }),
  });

  // Hub manager needs warehouse list to pick eligible source warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => getWarehouses({ hub_id: isHubManager ? userHubId : undefined }),
    enabled: isHubManager,
  });

  // Warehouse manager needs stores in their warehouse
  const { data: stores = [] } = useQuery({
    queryKey: ['stores', { warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
    queryFn: () => getStores({ warehouse_id: isWarehouseManager ? userWarehouseId : undefined }),
    enabled: isWarehouseManager,
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: getUnitReferences,
  });

  const { data: uomConversions = [] } = useQuery({
    queryKey: ['reference-data', 'uom_conversions'],
    queryFn: getUomConversions,
  });

  const { data: allStockBalances = [] } = useQuery({
    queryKey: ['stock_balances'],
    queryFn: () => getStockBalances({}),
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const selectedOrder = useMemo(
    () => (dispatchOrderId ? dispatchOrders.find((o: any) => String(o.id) === dispatchOrderId) : undefined),
    [dispatchOrderId, dispatchOrders]
  );

  const orderCommodityIds = useMemo(() => {
    const ids = (selectedOrder?.lines ?? []).map((l: any) => String(l.commodity_id)).filter(Boolean);
    return Array.from(new Set(ids)) as string[];
  }, [selectedOrder]);

  const commodityById = useMemo(() => {
    const map = new Map<string, any>();
    (commodities ?? []).forEach((c: any) => map.set(String(c.id), c));
    return map;
  }, [commodities]);

  // Stock available per warehouse:commodity
  const availableMap = useMemo(() => {
    const map = new Map<string, number>();
    (allStockBalances ?? []).forEach((b: any) => {
      const key = `${b.warehouse_id}:${b.commodity_id}`;
      map.set(key, (map.get(key) ?? 0) + (b.quantity || 0));
    });
    return map;
  }, [allStockBalances]);

  // Stock available per store:commodity
  const storeStockMap = useMemo(() => {
    const map = new Map<string, number>();
    (allStockBalances ?? []).forEach((b: any) => {
      if (!b.store_id) return;
      const key = `${b.store_id}:${b.commodity_id}`;
      map.set(key, (map.get(key) ?? 0) + (b.quantity || 0));
    });
    return map;
  }, [allStockBalances]);

  const getAvailableForWarehouse = (warehouseId: string | null, commodityId: string | null) => {
    if (!warehouseId || !commodityId) return null;
    return availableMap.get(`${warehouseId}:${commodityId}`) ?? 0;
  };

  const getAvailableForStore = (storeId: string | null, commodityId: string | null) => {
    if (!storeId || !commodityId) return null;
    return storeStockMap.get(`${storeId}:${commodityId}`) ?? 0;
  };

  // ── Select options ────────────────────────────────────────────────────────

  const orderOptions = useMemo(
    () =>
      dispatchOrders.map((o: any) => {
        const dest = o.fdp_name || o.destination_name || 'No dest';
        const rem =
          o.remaining_quantity != null
            ? ` · ${Number(o.remaining_quantity).toLocaleString()} remaining`
            : '';
        return {
          value: String(o.id),
          label: `${o.reference_no || `DO-${o.id}`} — ${dest} (${o.status})${rem}`,
        };
      }),
    [dispatchOrders]
  );

  const warehouseOptionsForCommodity = (commodityId: string | null) => {
    if (!commodityId) return [];
    return warehouses
      .filter((w: any) => {
        const avail = getAvailableForWarehouse(String(w.id), commodityId);
        return avail != null && avail > 0;
      })
      .map((w: any) => ({ value: String(w.id), label: w.name }));
  };

  const unitOptions = useMemo(
    () =>
      units.map((u: any) => ({
        value: String(u.id),
        label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name,
      })),
    [units]
  );

  const storeOptions = useMemo(
    () => stores.map((s: any) => ({ value: String(s.id), label: s.name })),
    [stores]
  );

  const commodityOptions = useMemo(
    () =>
      commodities.map((c: any) => ({
        value: String(c.id),
        label: c.name ?? `Commodity #${c.id}`,
      })),
    [commodities]
  );

  // ── UOM preview (hub manager flow) ────────────────────────────────────────

  const conversionPreviews = useMemo(() => {
    return lines.map((line) => {
      if (!line.commodity_id || !line.unit_id || !line.quantity) return null;
      const doLine = selectedOrder?.lines?.find(
        (l: any) => String(l.commodity_id) === String(line.commodity_id)
      );
      if (!doLine) return null;

      const fromUnitId = Number(line.unit_id);
      const toUnitId = doLine.unit_id;
      const commodityId = Number(line.commodity_id);

      if (fromUnitId === toUnitId) return { qty: line.quantity, unitName: doLine.unit_name };

      const multiplier = findDirectedMultiplier(fromUnitId, toUnitId, commodityId, uomConversions);
      if (!multiplier) return { qty: null, unitName: doLine.unit_name };

      return { qty: Number((line.quantity * multiplier).toFixed(4)), unitName: doLine.unit_name };
    });
  }, [lines, selectedOrder, uomConversions]);

  // ── Prefill hub-manager lines when order changes ──────────────────────────

  useEffect(() => {
    if (!isHubManager) return;
    if (!selectedOrder) {
      setLines([]);
      return;
    }

    const next = orderCommodityIds.map((commodityId) => {
      const doLine = selectedOrder.lines?.find(
        (l: any) => String(l.commodity_id) === String(commodityId)
      );
      const unitId = doLine?.unit_id != null ? String(doLine.unit_id) : null;

      const eligible = warehouseOptionsForCommodity(String(commodityId));
      const defaultWarehouseId = eligible.length ? String(eligible[0].value) : null;

      return {
        warehouse_id: defaultWarehouseId,
        commodity_id: String(commodityId),
        quantity: 0,
        unit_id: unitId,
      };
    });

    setLines(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchOrderId, selectedOrder, isHubManager]);

  // Reset store lines when order changes (warehouse manager)
  useEffect(() => {
    if (!isWarehouseManager) return;
    setStoreLines([emptyStoreLine()]);
  }, [dispatchOrderId, isWarehouseManager]);

  // ── Change handlers ───────────────────────────────────────────────────────

  const handleLineChange = <K extends keyof WarehouseLineItem>(
    index: number,
    field: K,
    value: WarehouseLineItem[K]
  ) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleStoreLineChange = <K extends keyof StoreAllocLine>(
    index: number,
    field: K,
    value: StoreAllocLine[K]
  ) => {
    setStoreLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const transportValid =
    !!transporterName.trim() &&
    !!driverName.trim() &&
    !!driverIdNum.trim() &&
    !!truckPlate.trim();

  const canSubmit = isWarehouseManager
    ? !!dispatchOrderId &&
      storeLines.length > 0 &&
      storeLines.every(
        (l) => !!l.store_id && !!l.commodity_id && l.quantity > 0 && !!l.unit_id
      ) &&
      transportValid
    : !!dispatchOrderId &&
      lines.length > 0 &&
      lines.every(
        (l) => !!l.warehouse_id && !!l.commodity_id && l.quantity > 0 && !!l.unit_id
      ) &&
      transportValid &&
      lines.every((l) => {
        const doLine = selectedOrder?.lines?.find(
          (x: any) => String(x.commodity_id) === String(l.commodity_id)
        );
        const orderQty = doLine?.quantity != null ? Number(doLine.quantity) : null;
        if (orderQty == null || !Number.isFinite(orderQty)) return true;
        return Number(l.quantity) <= orderQty;
      });

  // ── Submit mutation ───────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (shouldConfirm: boolean) => {
      if (!canSubmit) throw new Error('Fill in all required fields');

      let payload: CreateDispatchOrderAuthorizationPayload;

      if (isWarehouseManager) {
        // Warehouse manager: source is implicit (their own warehouse), lines are store allocations
        const firstLine = storeLines[0];
        payload = {
          dispatch_order_id: Number(dispatchOrderId),
          warehouse_id: Number(userWarehouseId!),
          commodity_id: firstLine.commodity_id ? Number(firstLine.commodity_id) : undefined,
          transporter_name: transporterName.trim(),
          authorized_quantity: firstLine.quantity,
          authorized_quantity_input_unit_id: firstLine.unit_id ? Number(firstLine.unit_id) : undefined,
          driver_name: driverName.trim(),
          driver_id_number: driverIdNum.trim(),
          driver_phone: driverPhone.trim() || undefined,
          truck_plate_number: truckPlate.trim(),
          authorization_stores: storeLines
            .filter((l) => l.store_id && l.commodity_id && l.quantity > 0)
            .map((l) => ({
              store_id: Number(l.store_id!),
              commodity_id: Number(l.commodity_id!),
              authorized_quantity: l.quantity,
            })),
        };
      } else {
        // Hub manager: source warehouses from lines table
        const primaryLine = lines[0];
        payload = {
          dispatch_order_id: Number(dispatchOrderId),
          warehouse_id: Number(primaryLine.warehouse_id!),
          commodity_id: primaryLine.commodity_id ? Number(primaryLine.commodity_id) : undefined,
          transporter_name: transporterName.trim(),
          authorized_quantity: primaryLine.quantity,
          authorized_quantity_input_unit_id: primaryLine.unit_id
            ? Number(primaryLine.unit_id)
            : undefined,
          driver_name: driverName.trim(),
          driver_id_number: driverIdNum.trim(),
          driver_phone: driverPhone.trim() || undefined,
          truck_plate_number: truckPlate.trim(),
        };
      }

      const dao = await createDispatchOrderAuthorization(payload);
      if (shouldConfirm) return confirmDispatchOrderAuthorization(dao.id);
      return dao;
    },
    onSuccess: (dao: any) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({
        title: 'Success',
        message: `Dispatch Authorization ${dao.reference_no} ${dao.status === 'confirmed' ? 'confirmed' : 'saved as draft'} successfully`,
        color: 'green',
      });
      navigate(`${basePath}/${dao.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          (error instanceof Error ? error.message : 'Failed to save Dispatch Authorization'),
        color: 'red',
      });
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Create Dispatch Authorization</Title>
        <Text c="dimmed" size="sm">
          {isHubManager
            ? "Authorize dispatch from your hub's warehouses to fulfil a dispatch order."
            : 'Authorize dispatch from your stores to fulfil a dispatch order.'}
        </Text>
      </div>

      {/* ── Dispatch Order card ── */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Dispatch Order</Text>
          <SearchableSelect
            label="Dispatch Order"
            placeholder="Select a confirmed dispatch order"
            data={orderOptions}
            value={dispatchOrderId}
            onChange={setDispatchOrderId}
            searchable
            required
          />

          {selectedOrder && (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <div>
                <Text size="xs" c="dimmed">FDP / Destination</Text>
                <Text size="sm" fw={600}>
                  {selectedOrder.fdp_name || selectedOrder.destination_name || '—'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Status</Text>
                <Text size="sm" fw={600}>{selectedOrder.status}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Items</Text>
                <Text size="sm" fw={600}>{selectedOrder.lines?.length ?? 0} line(s)</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Expected Date</Text>
                <Text size="sm" fw={600}>
                  {selectedOrder.expected_pickup_date
                    ? new Date(selectedOrder.expected_pickup_date).toLocaleDateString()
                    : '—'}
                </Text>
              </div>
              {selectedOrder.remaining_quantity != null && (
                <div>
                  <Text size="xs" c="dimmed">Remaining Quantity</Text>
                  <Text
                    size="sm"
                    fw={700}
                    c={selectedOrder.remaining_quantity <= 0 ? 'red' : 'green'}
                  >
                    {Number(selectedOrder.remaining_quantity).toLocaleString()}
                  </Text>
                </div>
              )}
              {selectedOrder.total_authorized_quantity != null &&
                selectedOrder.total_authorized_quantity > 0 && (
                  <div>
                    <Text size="xs" c="dimmed">Already Authorized</Text>
                    <Text size="sm" fw={600}>
                      {Number(selectedOrder.total_authorized_quantity).toLocaleString()}
                    </Text>
                  </div>
                )}
            </SimpleGrid>
          )}
        </Stack>
      </Card>

      {/* ── Warehouse Manager: Store Allocations ── */}
      {isWarehouseManager && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600} size="sm">Store Allocations</Text>
              <Text size="sm" c="dimmed">
                {selectedOrder ? 'Select stores and quantities to dispatch from' : 'Select an order first'}
              </Text>
            </Group>

            <Table.ScrollContainer minWidth={700}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Store</Table.Th>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>UOM</Table.Th>
                    <Table.Th>Available in Store</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {storeLines.map((line, idx) => {
                    const avail = getAvailableForStore(line.store_id, line.commodity_id);
                    const typedQty = Number(line.quantity);
                    const aboveAvail =
                      avail != null && Number.isFinite(avail) && typedQty > avail;

                    return (
                      <Table.Tr key={idx}>
                        <Table.Td style={{ minWidth: 220 }}>
                          <SearchableSelect
                            placeholder={storeOptions.length > 0 ? 'Select store' : 'No stores found'}
                            data={storeOptions}
                            value={line.store_id}
                            onChange={(v) => handleStoreLineChange(idx, 'store_id', v)}
                            searchable
                          />
                        </Table.Td>
                        <Table.Td style={{ minWidth: 220 }}>
                          <SearchableSelect
                            placeholder="Select commodity"
                            data={commodityOptions}
                            value={line.commodity_id}
                            onChange={(v) => handleStoreLineChange(idx, 'commodity_id', v)}
                            searchable
                          />
                        </Table.Td>
                        <Table.Td style={{ minWidth: 150 }}>
                          <NumberInput
                            placeholder="0"
                            value={line.quantity}
                            onChange={(v) => handleStoreLineChange(idx, 'quantity', Number(v) || 0)}
                            min={0}
                            error={aboveAvail ? 'Exceeds available stock' : undefined}
                          />
                        </Table.Td>
                        <Table.Td style={{ minWidth: 160 }}>
                          <SearchableSelect
                            placeholder="Select unit"
                            data={unitOptions}
                            value={line.unit_id}
                            onChange={(v) => handleStoreLineChange(idx, 'unit_id', v)}
                            searchable
                          />
                        </Table.Td>
                        <Table.Td style={{ minWidth: 140 }}>
                          <Text size="sm" c={avail != null && avail > 0 ? 'green' : 'dimmed'}>
                            {avail != null ? Number(avail).toFixed(2) : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {storeLines.length > 1 && (
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() =>
                                setStoreLines((p) => p.filter((_, i) => i !== idx))
                              }
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => setStoreLines((p) => [...p, emptyStoreLine()])}
            >
              Add Store Line
            </Button>
          </Stack>
        </Card>
      )}

      {/* ── Hub Manager: Source Warehouses ── */}
      {isHubManager && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600} size="sm">Source Warehouses</Text>
              <Text size="sm" c="dimmed">
                {selectedOrder
                  ? orderCommodityIds.length === 1
                    ? '1 commodity — prefills warehouse from eligible stock'
                    : `${orderCommodityIds.length} commodities`
                  : 'Select an order first'}
              </Text>
            </Group>

            <Table.ScrollContainer minWidth={760}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Warehouse</Table.Th>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>UOM</Table.Th>
                    <Table.Th>Available (Eligible)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {selectedOrder ? (
                    lines.map((line, idx) => {
                      const eligible = warehouseOptionsForCommodity(line.commodity_id);
                      const avail = getAvailableForWarehouse(line.warehouse_id, line.commodity_id);
                      const doLine = selectedOrder?.lines?.find(
                        (l: any) => String(l.commodity_id) === String(line.commodity_id)
                      );
                      const orderQty = doLine?.quantity != null ? Number(doLine.quantity) : 0;
                      const typedQty = Number(line.quantity);
                      const aboveOrder =
                        orderQty > 0 && Number.isFinite(orderQty) && typedQty > orderQty;

                      return (
                        <Table.Tr key={idx}>
                          <Table.Td style={{ minWidth: 240 }}>
                            <SearchableSelect
                              placeholder={
                                eligible.length > 0
                                  ? 'Select eligible warehouse'
                                  : 'No eligible warehouses'
                              }
                              data={eligible}
                              value={line.warehouse_id}
                              onChange={(v) => handleLineChange(idx, 'warehouse_id', v)}
                              searchable
                            />
                            {eligible.length === 0 && (
                              <Text size="xs" c="red" mt={4}>
                                No warehouse has eligible stock for this commodity.
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td style={{ minWidth: 220 }}>
                            <Text size="sm" fw={600}>
                              {commodityById.get(String(line.commodity_id))?.name ??
                                `Commodity #${line.commodity_id}`}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ minWidth: 160 }}>
                            <NumberInput
                              placeholder="0"
                              value={line.quantity}
                              onChange={(v) => handleLineChange(idx, 'quantity', Number(v) || 0)}
                              min={0}
                              error={aboveOrder ? 'Exceeds dispatch order quantity.' : undefined}
                            />
                          </Table.Td>
                          <Table.Td style={{ minWidth: 160 }}>
                            <SearchableSelect
                              placeholder="Select unit"
                              data={unitOptions}
                              value={line.unit_id}
                              onChange={(v) => handleLineChange(idx, 'unit_id', v)}
                              searchable
                            />
                          </Table.Td>
                          <Table.Td style={{ minWidth: 170 }}>
                            <Text size="sm" c={avail != null && avail > 0 ? 'green' : 'dimmed'}>
                              {avail != null ? Number(avail).toFixed(2) : '—'}
                              <Text component="span" size="xs" c="dimmed" ml={8}>
                                (Order: {orderQty.toFixed(2)})
                              </Text>
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  ) : (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text size="sm" c="dimmed">Select a dispatch order to configure sources.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        </Card>
      )}

      {/* ── UOM Preview (hub manager only) ── */}
      {isHubManager && lines.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Text fw={600} size="sm">UOM Preview</Text>
            <Text size="sm" c="dimmed">
              Quantities converted to the dispatch order's canonical unit.
            </Text>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Entered Qty</Table.Th>
                  <Table.Th>Canonical Qty</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lines.map((line, idx) => {
                  const commName =
                    commodityById.get(String(line.commodity_id))?.name ??
                    `Commodity #${line.commodity_id}`;
                  const preview = conversionPreviews[idx];
                  return (
                    <Table.Tr key={idx}>
                      <Table.Td>{commName}</Table.Td>
                      <Table.Td>{line.quantity}</Table.Td>
                      <Table.Td>
                        {preview?.qty != null ? (
                          <Text c="dimmed" fw={600}>{preview.qty}</Text>
                        ) : (
                          <Text c="red" size="xs">No conversion path</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
            {conversionPreviews.some((p) => p?.qty == null) && (
              <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                Some lines have no conversion path. Saving may still be allowed, but preview is unavailable.
              </Alert>
            )}
          </Stack>
        </Card>
      )}

      {/* ── Transport ── */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Transport</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Transporter Name"
              placeholder="e.g. Abyssinia Logistics"
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
              required
            />
            <TextInput
              label="Driver Name"
              placeholder="Full name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              required
            />
            <TextInput
              label="Driver ID Number"
              placeholder="National ID or license no."
              value={driverIdNum}
              onChange={(e) => setDriverIdNum(e.target.value)}
              required
            />
            <TextInput
              label="Driver Phone"
              placeholder="+251 9xx xxx xxxx"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
            />
            <TextInput
              label="Vehicle Plate Number"
              placeholder="e.g. AA-12345"
              value={truckPlate}
              onChange={(e) => setTruckPlate(e.target.value)}
              required
            />
          </SimpleGrid>
        </Stack>
      </Card>

      {/* ── Review & Save ── */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Review & Save</Text>

          {isWarehouseManager ? (
            <>
              <Divider label="Store Allocations" labelPosition="left" />
              {storeLines.filter((l) => l.store_id && l.commodity_id && l.quantity > 0).length === 0 ? (
                <Text size="sm" c="dimmed">No allocations entered yet.</Text>
              ) : (
                storeLines
                  .filter((l) => l.store_id && l.commodity_id && l.quantity > 0)
                  .map((line, idx) => (
                    <Group key={idx} justify="space-between" align="center">
                      <Text size="sm" fw={600}>
                        {stores.find((s: any) => String(s.id) === String(line.store_id))?.name ?? '—'}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {commodityById.get(String(line.commodity_id))?.name ??
                          `Commodity #${line.commodity_id}`}
                        : {line.quantity}
                      </Text>
                    </Group>
                  ))
              )}
            </>
          ) : (
            <>
              <Divider label="Warehouse Lines" labelPosition="left" />
              {lines.map((line, idx) => (
                <Group key={idx} justify="space-between" align="center">
                  <Text size="sm" fw={600}>
                    {line.warehouse_id
                      ? warehouses.find((w: any) => String(w.id) === String(line.warehouse_id))?.name
                      : '—'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {commodityById.get(String(line.commodity_id))?.name ??
                      `Commodity #${line.commodity_id}`}
                    : {line.quantity}
                  </Text>
                </Group>
              ))}
            </>
          )}

          <Group justify="flex-end" mt="xl">
            <Button variant="light" onClick={() => navigate(basePath)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              loading={createMutation.isPending}
              disabled={!canSubmit}
              onClick={() => createMutation.mutate(false)}
            >
              Save Draft
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!canSubmit}
              onClick={() => createMutation.mutate(true)}
            >
              Confirm Dispatch Authorization
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
