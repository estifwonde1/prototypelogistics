import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Text,
  Button,
  Card,
  SimpleGrid,
  Divider,
  Table,
  Group,
  TextInput,
  Select,
  Alert,
  Badge,
  LoadingOverlay,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';

import { SearchableSelect } from '../../components/common/SearchableSelect';
import {
  confirmDispatchOrderAuthorization,
  createDispatchOrderAuthorization,
  assignStorekeeperToDa,
  getAssignableStorekeepers,
} from '../../api/dispatchOrderAuthorizations';
import type { CreateDispatchOrderAuthorizationPayload } from '../../api/dispatchOrderAuthorizations';
import { getDispatchOrders } from '../../api/dispatchOrders';
import { getStores } from '../../api/stores';
import { getWarehouses } from '../../api/warehouses';
import { getCommodityReferences, getUnitReferences, getUomConversions } from '../../api/referenceData';
import { getStockBalances } from '../../api/stockBalances';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { findDirectedMultiplier } from '../../utils/uomConversions';
import {
  checkDispatchQuantityLimit,
  checkStockQuantityLimit,
  dispatchOrderRemainingQuantity,
  exceedsDispatchRemaining,
  findDispatchOrderLine,
  formatDispatchRemainingExceededMessage,
  quantityInDispatchCanonicalUnit,
} from '../../utils/dispatchAuthorizationQuantity';
import type { ApiError } from '../../types/common';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------
type StoreAllocLine = {
  store_id: string | null;
  commodity_id: string | null;
  quantity: number;
  unit_id: string | null;
  availableStock: number | null; // for display
};

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------
export default function WarehouseDispatchAuthorizationFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Auth
  const activeAssignment = useAuthStore((s) => s.activeAssignment);
  const role = useAuthStore((s) => s.role);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || role);
  const isWarehouseManager = roleSlug === 'warehouse_manager';

  const userHubId = activeAssignment?.hub?.id;
  const userWarehouseId = activeAssignment?.warehouse?.id;

  const basePath = location.pathname.startsWith('/warehouse')
    ? '/warehouse/dispatch-authorizations'
    : '/hub/dispatch-authorizations';

  // --------------------------------------------------------------------
  // URL param: pre‑select a dispatch order
  // --------------------------------------------------------------------
  const [dispatchOrderId, setDispatchOrderId] = useState<string | null>(
    searchParams.get('dispatch_order_id')
  );

  // --------------------------------------------------------------------
  // Form state
  // --------------------------------------------------------------------
  const [storeLines, setStoreLines] = useState<StoreAllocLine[]>([]);

  // Transport
  const [transporterName, setTransporterName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverIdNum, setDriverIdNum] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [truckPlate, setTruckPlate] = useState('');

  // Storekeeper (to be assigned after creation)
  const [selectedStorekeeperId, setSelectedStorekeeperId] = useState<string | null>(null);

  // --------------------------------------------------------------------
  // Data fetching
  // --------------------------------------------------------------------
  // 1. Dispatch Orders (only eligible)
  const { data: dispatchOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['dispatch_orders', 'for_da_warehouse', { warehouse_id: userWarehouseId }],
    queryFn: () =>
      userWarehouseId
        ? getDispatchOrders({ warehouse_id: userWarehouseId })
        : getDispatchOrders({}),
    enabled: isWarehouseManager && !!userWarehouseId,
    select: (orders) =>
      orders.filter((o: any) => {
        if (o.status === 'Draft' || o.status === 'Completed') return false;
        if (o.remaining_quantity != null && Number(o.remaining_quantity) <= 0) return false;
        return true;
      }),
  });

  // 2. Stores in this warehouse
  const { data: stores = [] } = useQuery({
    queryKey: ['stores', { warehouse_id: userWarehouseId }],
    queryFn: () => getStores({ warehouse_id: userWarehouseId! }),
    enabled: isWarehouseManager && !!userWarehouseId,
  });

  // 3. Reference data
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
    enabled: isWarehouseManager,
  });

  // 4. Stock balances (per store + commodity)
  const { data: allStockBalances = [] } = useQuery({
    queryKey: ['stock_balances', { warehouse_id: userWarehouseId }],
    queryFn: () => getStockBalances({ warehouse_id: userWarehouseId! }),
    enabled: isWarehouseManager && !!userWarehouseId,
  });

  // 5. Assignable storekeepers
  const { data: assignableStorekeepers = [] } = useQuery({
    queryKey: ['dispatch_order_assignable_storekeepers', userWarehouseId],
    queryFn: () => getAssignableStorekeepers(userWarehouseId!),
    enabled: isWarehouseManager && !!userWarehouseId,
  });

  // --------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------
  const selectedOrder = useMemo(
    () => (dispatchOrderId ? dispatchOrders.find((o: any) => String(o.id) === dispatchOrderId) : undefined),
    [dispatchOrderId, dispatchOrders]
  );

  // Map: store_id:commodity_id -> total available stock
  const storeStockMap = useMemo(() => {
    const map = new Map<string, number>();
    (allStockBalances ?? []).forEach((b: any) => {
      if (!b.store_id || b.quantity == null) return;
      const key = `${b.store_id}:${b.commodity_id}`;
      const current = map.get(key) ?? 0;
      map.set(key, current + Number(b.quantity));
    });
    return map;
  }, [allStockBalances]);

  const storeStockUnitMap = useMemo(() => {
    const map = new Map<string, number>();
    (allStockBalances ?? []).forEach((b: any) => {
      if (!b.store_id || b.unit_id == null) return;
      const key = `${b.store_id}:${b.commodity_id}`;
      if (!map.has(key)) map.set(key, Number(b.unit_id));
    });
    return map;
  }, [allStockBalances]);

  const getAvailableForStore = (storeId: string | null, commodityId: string | null): number | null => {
    if (!storeId || !commodityId) return null;
    const available = storeStockMap.get(`${storeId}:${commodityId}`);
    return available != null ? Number(available) : 0;
  };

  // Commodities that appear in the selected order
  const orderCommodityIds = useMemo(() => {
    if (!selectedOrder) return [];
    const ids = (selectedOrder.lines ?? []).map((l: any) => String(l.commodity_id)).filter(Boolean);
    return Array.from(new Set(ids));
  }, [selectedOrder]);

  const orderCommodityOptions = useMemo(() => {
    if (!orderCommodityIds.length) return [];
    return commodities
      .filter((c: any) => orderCommodityIds.includes(String(c.id)))
      .map((c: any) => ({
        value: String(c.id),
        label: c.name ?? `Commodity #${c.id}`,
      }));
  }, [commodities, orderCommodityIds]);

  // Stores that have at least one commodity of the order in stock
  const eligibleStores = useMemo(() => {
    if (!selectedOrder) return [];
    return stores.filter((s: any) =>
      orderCommodityIds.some((cid) => {
        const avail = getAvailableForStore(String(s.id), cid);
        return avail != null && avail > 0;
      })
    );
  }, [stores, orderCommodityIds, storeStockMap]);

  // Store options for dropdowns (only eligible)
  const storeOptions = useMemo(
    () =>
      eligibleStores.map((s: any) => ({
        value: String(s.id),
        label: s.name,
        // optionally store the storekeeper? Not needed.
      })),
    [eligibleStores]
  );

  // Unit options
  const unitOptions = useMemo(
    () =>
      units.map((u: any) => ({
        value: String(u.id),
        label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name,
      })),
    [units]
  );

  // --------------------------------------------------------------------
  // Auto‑populate store lines when order changes.
  // IMPORTANT: don't depend on storeStockMap (which changes when stock refetches)
  // because it can cause repeated setState -> render loops.
  // --------------------------------------------------------------------
  // Ref: This effect must never cause an update loop.
  // - We only set state when the computed lines actually differ.
  // - We do NOT include derived values that may change due to other state/refetches.
  useEffect(() => {
    if (!isWarehouseManager || !selectedOrder || !orderCommodityIds.length) {
      setStoreLines((prev) => (prev.length ? [] : prev));
      return;
    }

    const newLines = orderCommodityIds.map((commodityId) => {
      const doLine = selectedOrder.lines?.find(
        (l: any) => String(l.commodity_id) === commodityId
      );
      const unitId = doLine?.unit_id != null ? String(doLine.unit_id) : null;

      const eligibleStore = eligibleStores.find((s: any) => {
        const avail = getAvailableForStore(String(s.id), commodityId);
        return avail != null && avail > 0;
      });
      const storeId = eligibleStore ? String(eligibleStore.id) : null;

      return {
        store_id: storeId,
        commodity_id: commodityId,
        quantity: 0,
        unit_id: unitId,
        availableStock: storeId
          ? getAvailableForStore(storeId, commodityId)
          : null,
      };
    });

    setStoreLines((prev) => {
      if (prev.length !== newLines.length) return newLines;
      for (let i = 0; i < prev.length; i++) {
        if (
          prev[i].store_id !== newLines[i].store_id ||
          prev[i].commodity_id !== newLines[i].commodity_id ||
          prev[i].unit_id !== newLines[i].unit_id
        ) {
          return newLines;
        }
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder, orderCommodityIds, isWarehouseManager]);

  // --------------------------------------------------------------------
  // Computed totals & remaining (in canonical units)
  // --------------------------------------------------------------------
  const canonicalQuantities = useMemo(() => {
    if (!selectedOrder) return { total: 0, remaining: 0, orderRemaining: null as number | null };
    let totalCanonical = 0;
    storeLines.forEach((line) => {
      if (!line.quantity || !line.unit_id || !line.commodity_id) return;
      const doLine = findDispatchOrderLine(selectedOrder, line.commodity_id);
      const canonical = quantityInDispatchCanonicalUnit(line, doLine, uomConversions);
      if (canonical != null) totalCanonical += canonical;
    });
    const orderRemaining = dispatchOrderRemainingQuantity(selectedOrder);
    return {
      total: totalCanonical,
      remaining: orderRemaining != null ? Math.max(0, orderRemaining - totalCanonical) : 0,
      orderRemaining,
    };
  }, [storeLines, selectedOrder, uomConversions]);

  const totalExceedsRemaining = useMemo(() => {
    if (canonicalQuantities.orderRemaining == null) return false;
    return exceedsDispatchRemaining(canonicalQuantities.total, canonicalQuantities.orderRemaining);
  }, [canonicalQuantities]);

  const dispatchUnitLabel = useMemo(() => {
    const unitId = selectedOrder?.lines?.[0]?.unit_id;
    if (unitId == null) return '';
    const unit = units.find((u: any) => String(u.id) === String(unitId));
    return unit?.abbreviation || unit?.name || '';
  }, [selectedOrder, units]);

  const totalRemainingExceededMessage = useMemo(() => {
    if (!totalExceedsRemaining || canonicalQuantities.orderRemaining == null) return null;
    return formatDispatchRemainingExceededMessage(
      canonicalQuantities.orderRemaining,
      dispatchUnitLabel
    );
  }, [totalExceedsRemaining, canonicalQuantities.orderRemaining, dispatchUnitLabel]);

  // --------------------------------------------------------------------
  // Validation helpers
  // --------------------------------------------------------------------
  const getLineError = (line: StoreAllocLine): string | null => {
    if (!line.store_id) return 'Select a store';
    if (!line.commodity_id) return 'Select a commodity';
    if (!line.unit_id) return 'Select a unit';
    if (line.quantity <= 0) return 'Quantity must be positive';

    const dispatchErr = checkDispatchQuantityLimit(line, selectedOrder, uomConversions, {
      unitLabel: dispatchUnitLabel,
    });
    if (dispatchErr) return dispatchErr;

    const avail = getAvailableForStore(line.store_id, line.commodity_id);
    const stockUnitId = storeStockUnitMap.get(`${line.store_id}:${line.commodity_id}`);
    const stockErr = checkStockQuantityLimit(
      line,
      avail,
      stockUnitId,
      selectedOrder,
      uomConversions
    );
    if (stockErr) return stockErr;

    return null;
  };

  const isQuantityFieldError = (error: string | null): boolean =>
    !!error &&
    !error.startsWith('Select a ') &&
    error !== 'Quantity must be positive';

  const allLinesValid = storeLines.every((line) => getLineError(line) === null);
  const transportValid =
    transporterName.trim().length > 0 &&
    driverName.trim().length > 0 &&
    driverIdNum.trim().length > 0 &&
    truckPlate.trim().length > 0;

  const canSubmit =
    dispatchOrderId &&
    allLinesValid &&
    transportValid &&
    !!selectedStorekeeperId &&
    !totalExceedsRemaining;

  // --------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (shouldConfirm: boolean) => {
      if (!canSubmit) throw new Error('Please fill in all required fields correctly.');

      // Build payload
      const firstLine = storeLines[0];
      const payload: CreateDispatchOrderAuthorizationPayload = {
        dispatch_order_id: Number(dispatchOrderId),
        warehouse_id: Number(userWarehouseId!),
        // Top‑level fields (taken from first line for compatibility)
        commodity_id: firstLine.commodity_id ? Number(firstLine.commodity_id) : undefined,
        authorized_quantity: firstLine.quantity,
        authorized_quantity_input_unit_id: firstLine.unit_id ? Number(firstLine.unit_id) : undefined,
        transporter_name: transporterName.trim(),
        driver_name: driverName.trim(),
        driver_id_number: driverIdNum.trim(),
        driver_phone: driverPhone.trim() || undefined,
        truck_plate_number: truckPlate.trim(),
        // All allocation lines
        authorization_stores: storeLines
          .filter((l) => l.store_id && l.commodity_id && l.quantity > 0)
          .map((l) => ({
            store_id: Number(l.store_id!),
            commodity_id: Number(l.commodity_id!),
            authorized_quantity: l.quantity,
          })),
      };

      const dao = await createDispatchOrderAuthorization(payload);
      if (shouldConfirm) return confirmDispatchOrderAuthorization(dao.id);
      return dao;
    },
    onSuccess: async (dao: any) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });

      let assigned = false;
      if (selectedStorekeeperId) {
        try {
          await assignStorekeeperToDa(dao.id, {
            storekeeper_user_id: Number(selectedStorekeeperId),
            store_id: storeLines[0]?.store_id ? Number(storeLines[0].store_id) : undefined,
          });
          assigned = true;
          queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations', dao.id] });
          queryClient.invalidateQueries({ queryKey: ['dispatch_order_assignable_storekeepers'] });
        } catch (error) {
          notifications.show({
            title: 'Storekeeper assignment failed',
            message:
              (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
              'DA created but storekeeper not assigned. You can assign later from the detail page.',
            color: 'orange',
          });
        }
      }

      notifications.show({
        title: 'Success',
        message: assigned
          ? `Dispatch Authorization ${dao.reference_no} ${dao.status === 'confirmed' ? 'confirmed' : 'saved as draft'}. Storekeeper notified.`
          : `Dispatch Authorization ${dao.reference_no} ${dao.status === 'confirmed' ? 'confirmed' : 'saved as draft'} successfully.`,
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

  // --------------------------------------------------------------------
  // Handlers for line changes
  // --------------------------------------------------------------------
  const updateLine = (index: number, field: keyof StoreAllocLine, value: any) => {
    setStoreLines((prev) => {
      const next = [...prev];
      const line = { ...next[index] };
      line[field] = value;

      // If store changes, update available stock for that commodity
      if (field === 'store_id') {
        line.availableStock = getAvailableForStore(line.store_id, line.commodity_id);
        // Reset quantity to 0 if stock changed? We'll keep it, but validation will catch.
      }
      if (field === 'commodity_id') {
        // Reset unit to order's default?
        const doLine = selectedOrder?.lines?.find((l: any) => String(l.commodity_id) === String(value));
        line.unit_id = doLine?.unit_id != null ? String(doLine.unit_id) : null;
        line.availableStock = getAvailableForStore(line.store_id, line.commodity_id);
        line.quantity = 0;
      }
      if (field === 'unit_id') {
        // No auto‑change
      }
      if (field === 'quantity') {
        // No auto‑change
      }
      next[index] = line;
      return next;
    });
  };

  // --------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------
  if (!isWarehouseManager) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        Only warehouse managers can create dispatch authorizations.
      </Alert>
    );
  }

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={loadingOrders} />

      <div>
        <Title order={2}>Create Dispatch Authorization</Title>
        <Text c="dimmed" size="sm">
          Authorize dispatch from your warehouse to fulfil a dispatch order.
        </Text>
      </div>

      {/* --------------------------------------------------------------------
          Dispatch Order Card
          -------------------------------------------------------------------- */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Dispatch Order</Text>
          <SearchableSelect
            label="Dispatch Order"
            placeholder="Select a confirmed dispatch order"
            data={dispatchOrders.map((o: any) => ({
              value: String(o.id),
              label: `${o.reference_no || `DO-${o.id}`} — ${o.fdp_name || o.destination_name || 'No dest'} (${o.status}) · ${Number(o.remaining_quantity || 0).toLocaleString()} remaining`,
            }))}
            value={dispatchOrderId}
            onChange={setDispatchOrderId}
            searchable
            required
          />

          {selectedOrder && (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2 }} mt="sm">
                <div>
                  <Text size="xs" c="dimmed">FDP / Destination</Text>
                  <Text size="sm" fw={600}>{selectedOrder.fdp_name || selectedOrder.destination_name || '—'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Status</Text>
                  <Badge color={selectedOrder.status === 'Confirmed' ? 'green' : 'yellow'}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Items</Text>
                  <Text size="sm" fw={600}>
                    {selectedOrder.lines?.map((l: any) => {
                      const comm = commodities.find((c: any) => String(c.id) === String(l.commodity_id));
                      return comm?.name || `#${l.commodity_id}`;
                    }).join(', ') || '—'}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Assigned</Text>
                  <Text size="sm" fw={600}>
                    {Number(selectedOrder.total_quantity - selectedOrder.remaining_quantity).toLocaleString()}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Remaining</Text>
                  {/* remaining_quantity from backend is in canonical unit; show canonical unit label when possible */}
                  <Text size="sm" fw={600} c={Number(selectedOrder.remaining_quantity) <= 0 ? 'red' : 'inherit'}>
                    {Number(selectedOrder.remaining_quantity).toLocaleString()}
                    {(() => {
                      const firstLine = selectedOrder.lines?.[0];
                      const canonicalUnitId = firstLine?.unit_id != null ? String(firstLine.unit_id) : null;
                      const canonicalUnit = canonicalUnitId
                        ? units.find((u: any) => String(u.id) === canonicalUnitId)
                        : null;
                      return canonicalUnit?.abbreviation ? ` ${canonicalUnit.abbreviation}` : '';
                    })()}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Expected Date</Text>
                  <Text size="sm" fw={600}>
                    {selectedOrder.expected_pickup_date
                      ? new Date(selectedOrder.expected_pickup_date).toLocaleDateString()
                      : '—'}
                  </Text>
                </div>
              </SimpleGrid>
            </>
          )}
        </Stack>
      </Card>

      {/* --------------------------------------------------------------------
          Source Stores Table
          -------------------------------------------------------------------- */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Source Stores</Text>
          {storeLines.length === 0 ? (
            <Text c="dimmed" size="sm">Select a dispatch order to populate stores.</Text>
          ) : (
            <>
              <Table striped highlightOnHover>
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>Commodity</th>
                    <th>Quantity</th>
                    <th>UOM</th>
                    <th>Available (Eligible)</th>
                  </tr>
                </thead>
                <tbody>
                  {storeLines.map((line, idx) => {
                    const error = getLineError(line);
                    return (
                      <tr key={idx}>
                        <td>
                          <Select
                            placeholder="Select store"
                            data={storeOptions}
                            value={line.store_id}
                            onChange={(v) => updateLine(idx, 'store_id', v)}
                            searchable
                            clearable
                            error={error && line.store_id === null ? 'Required' : undefined}
                          />
                        </td>
                        <td>
                          <Select
                            placeholder="Commodity"
                            data={orderCommodityOptions}
                            value={line.commodity_id}
                            onChange={(v) => updateLine(idx, 'commodity_id', v)}
                            searchable
                            clearable
                            disabled={orderCommodityOptions.length === 1}
                            error={error && line.commodity_id === null ? 'Required' : undefined}
                          />
                        </td>
                        <td>
                          <TextInput
                            value={line.quantity === 0 ? '' : line.quantity}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') {
                                updateLine(idx, 'quantity', 0);
                                return;
                              }
                              const next = Number(raw);
                              updateLine(idx, 'quantity', Number.isFinite(next) ? next : 0);
                            }}
                            type="number"
                            min={0}
                            error={isQuantityFieldError(error) ? error : undefined}
                          />
                        </td>
                        <td>
                          <Select
                            placeholder="UOM"
                            data={unitOptions}
                            value={line.unit_id}
                            onChange={(v) => updateLine(idx, 'unit_id', v)}
                            searchable
                            clearable
                            error={error && line.unit_id === null ? 'Required' : undefined}
                          />
                        </td>
                        <td>
                          {line.availableStock != null ? (
                            <Text size="sm" c={line.availableStock > 0 ? 'green' : 'red'}>
                              {line.availableStock.toLocaleString()}
                              {line.commodity_id && line.unit_id && (
                                <>
                                  {' '}
                                  <Badge size="xs" variant="outline">
                                    Remaining: {Number(selectedOrder?.remaining_quantity ?? 0).toLocaleString()}
                                  </Badge>
                                </>
                              )}
                            </Text>
                          ) : (
                            <Text size="sm" c="dimmed">—</Text>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>

              {/* UOM Preview */}
              <Divider label="UOM Preview" labelPosition="left" />
              <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xs">
                {storeLines.map((line, idx) => {
                  const doLine = selectedOrder?.lines?.find((l: any) => String(l.commodity_id) === line.commodity_id);
                  const canonUnitId = doLine?.unit_id ? String(doLine.unit_id) : null;
                  const canonUnit = units.find((u: any) => String(u.id) === canonUnitId);
                  let canonQty = line.quantity;
                  if (line.unit_id && canonUnitId && line.unit_id !== canonUnitId && line.commodity_id) {
                    const m = findDirectedMultiplier(
                      Number(line.unit_id),
                      Number(canonUnitId),
                      Number(line.commodity_id),
                      uomConversions
                    );
                    if (m) canonQty = Number((line.quantity * m).toFixed(4));
                  }
                  const commodityName = commodities.find((c: any) => String(c.id) === line.commodity_id)?.name || `#${line.commodity_id}`;
                  return (
                    <Group key={idx} justify="space-between">
                      <Text size="sm">{commodityName}</Text>
                      <Text size="sm">
                        Entered: {line.quantity} {line.unit_id ? units.find((u: any) => String(u.id) === line.unit_id)?.abbreviation || '' : ''} &rarr;
                        Canonical: {canonQty} {canonUnit?.abbreviation || ''}
                      </Text>
                    </Group>
                  );
                })}
              </SimpleGrid>
            </>
          )}
        </Stack>
      </Card>

      {/* --------------------------------------------------------------------
          Transport Card
          -------------------------------------------------------------------- */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Transport</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Transporter Name"
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
              required
            />
            <TextInput
              label="Driver Name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              required
            />
            <TextInput
              label="Driver ID Number"
              value={driverIdNum}
              onChange={(e) => setDriverIdNum(e.target.value)}
              required
            />
            <TextInput
              label="Driver Phone"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
            />
            <TextInput
              label="Vehicle Plate Number"
              value={truckPlate}
              onChange={(e) => setTruckPlate(e.target.value)}
              required
            />
          </SimpleGrid>
        </Stack>
      </Card>

      {/* --------------------------------------------------------------------
          Review & Save Card
          -------------------------------------------------------------------- */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Review &amp; Save</Text>

          <Divider label="Storekeeper" labelPosition="left" />
          <SearchableSelect
            label="Storekeeper"
            placeholder="Select storekeeper to assign"
            data={assignableStorekeepers.map((sk: any) => ({
              value: String(sk.id),
              label: sk.store_name ? `${sk.name} (${sk.store_name})` : sk.name,
            }))}
            value={selectedStorekeeperId}
            onChange={(v) => setSelectedStorekeeperId(v)}
            searchable
            clearable
            required
          />
          <Text size="xs" c="dimmed">
            The selected storekeeper will be responsible for this dispatch.
          </Text>

          <Divider label="Quantities Summary" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Text size="sm">
              Total allocated (canonical): <strong>{canonicalQuantities.total.toFixed(2)}</strong>
            </Text>
            <Text size="sm" c={canonicalQuantities.remaining < 0 || totalExceedsRemaining ? 'red' : 'green'}>
              Remaining for this order: <strong>{canonicalQuantities.remaining.toFixed(2)}</strong>
            </Text>
          </SimpleGrid>

          {totalExceedsRemaining && totalRemainingExceededMessage && (
            <Alert color="red" icon={<IconAlertCircle size={16} />} title="Above the dispatch limit">
              {totalRemainingExceededMessage}
            </Alert>
          )}

          {!allLinesValid && !totalExceedsRemaining && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {storeLines.map((line, idx) => {
                const err = getLineError(line);
                return err ? (
                  <div key={idx}>
                    Line {idx + 1}: {err}
                  </div>
                ) : null;
              }).filter(Boolean)}
            </Alert>
          )}

          {!transportValid && (
            <Alert color="orange" icon={<IconAlertCircle size={16} />}>
              Please fill in all transport fields.
            </Alert>
          )}

          {!selectedStorekeeperId && (
            <Alert color="orange" icon={<IconAlertCircle size={16} />}>
              A storekeeper must be selected before saving.
            </Alert>
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