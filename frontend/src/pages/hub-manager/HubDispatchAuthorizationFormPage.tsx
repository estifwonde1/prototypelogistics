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
  ActionIcon,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import {
  confirmDispatchOrderAuthorization,
  createDispatchOrderAuthorization,
  assignStorekeeperToDa,
  getAssignableStorekeepers,
} from '../../api/dispatchOrderAuthorizations';
import type { CreateDispatchOrderAuthorizationPayload } from '../../api/dispatchOrderAuthorizations';
import { getDispatchOrders } from '../../api/dispatchOrders';
import { getWarehouses } from '../../api/warehouses';
import { getCommodityReferences, getUnitReferences, getUomConversions } from '../../api/referenceData';
import { getStockBalances } from '../../api/stockBalances';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { findDirectedMultiplier } from '../../utils/uomConversions';
import {
  checkDispatchQuantityLimit,
  dispatchOrderRemainingQuantity,
  findDispatchOrderLine,
  formatDispatchRemainingExceededMessage,
} from '../../utils/dispatchAuthorizationQuantity';
import type { ApiError } from '../../types/common';
import { useForm } from '@mantine/form';

type WarehouseLineItem = {
  warehouse_id: string | null;
  commodity_id: string | null;
  quantity: number;
  unit_id: string | null;
};

const emptyLine = (): WarehouseLineItem => ({
  warehouse_id: null,
  commodity_id: null,
  quantity: 0,
  unit_id: null,
});

export default function HubDispatchAuthorizationFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const activeAssignment = useAuthStore((s) => s.activeAssignment);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((s) => s.role));
  const isHubManager = roleSlug === 'hub_manager';

  const userHubId = activeAssignment?.hub?.id;
  const userWarehouseId = activeAssignment?.warehouse?.id;

  const basePath = location.pathname.startsWith('/warehouse')
    ? '/warehouse/dispatch-authorizations'
    : '/hub/dispatch-authorizations';

  const [dispatchOrderId, setDispatchOrderId] = useState<string | null>(
    searchParams.get('dispatch_order_id')
  );

  const [lines, setLines] = useState<WarehouseLineItem[]>([]);

  const [transporterName, setTransporterName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverIdNum, setDriverIdNum] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [truckPlate, setTruckPlate] = useState('');

  // Storekeeper assignment section (hub flow can still assign if needed)
  const [selectedStorekeeperId, setSelectedStorekeeperId] = useState<string | null>(null);

  const { data: dispatchOrders = [] } = useQuery({
    queryKey: ['dispatch_orders', 'for_da_hub', { hub_id: userHubId }],
    queryFn: () => (userHubId ? getDispatchOrders({ hub_id: userHubId }) : getDispatchOrders({})),
    enabled: isHubManager,
    select: (orders) =>
      orders.filter((o: any) => {
        if (o.status === 'Draft' || o.status === 'Completed') return false;
        if (o.remaining_quantity != null && o.remaining_quantity <= 0) return false;
        return true;
      }),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', { hub_id: userHubId }],
    queryFn: () => getWarehouses({ hub_id: isHubManager ? userHubId : undefined }),
    enabled: isHubManager,
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
    queryKey: ['stock_balances', 'hub-da-form', userHubId],
    queryFn: () => getStockBalances({ hub_id: isHubManager && userHubId ? userHubId : undefined }),
    enabled: isHubManager,
    staleTime: 0,
  });

  // For hub managers: show/compute remaining amounts using only stock belonging to the active hub.
  // If a multi-location order exists, we still filter to the logged-in hub.
  const hubWarehouseIds = useMemo(() => {
    if (!isHubManager || !userHubId) return null;
    // getWarehouses({hub_id}) already scopes warehouses to the hub, so eligible list below is hub-scoped.
    // Here we keep ids for filtering any later computation that might use non-hub data.
    return new Set((warehouses ?? []).map((w: any) => String(w.id)));
  }, [isHubManager, userHubId, warehouses]);

  // Optional: if hub DA needs storekeeper assignment, keep this for future compatibility.
  // For now we rely on existing backend behavior in createDispatchOrderAuthorization.
  const { data: assignableStorekeepers = [] } = useQuery({
    queryKey: ['dispatch_order_assignable_storekeepers', userWarehouseId],
    queryFn: () => getAssignableStorekeepers(userWarehouseId!),
    enabled: isHubManager && !!userWarehouseId,
  });

  const selectedOrder = useMemo(
    () => (dispatchOrderId ? dispatchOrders.find((o: any) => String(o.id) === dispatchOrderId) : undefined),
    [dispatchOrderId, dispatchOrders]
  );

  // Hub-scoped Assigned + Remaining shown in the Dispatch Order card.
  // Derivation strategy: sum over dispatch order lines filtered to the active hub (line.hub_id).
  // Quantities are kept in the dispatch order line's own (canonical) unit as returned by the API.
  const hubAssignedCanonicalQty = useMemo(() => {
    if (!selectedOrder || !isHubManager) return 0;
    const hubId = userHubId != null ? String(userHubId) : null;
    const hubLines = (selectedOrder.lines ?? []).filter((l: any) =>
      hubId ? String(l.hub_id) === hubId : false
    );

    // Prefer explicit per-line authorized quantity if API provides it; otherwise fallback to ordered quantity.
    // The backend for dispatch-order lines often includes fields like authorized_quantity / assigned_quantity.
    const sum = hubLines.reduce((acc: number, l: any) => {
      const qty =
        l.authorized_quantity != null
          ? Number(l.authorized_quantity)
          : l.assigned_quantity != null
            ? Number(l.assigned_quantity)
            : l.quantity != null
              ? Number(l.quantity)
              : 0;
      return acc + (Number.isFinite(qty) ? qty : 0);
    }, 0);
    return sum;
  }, [selectedOrder, isHubManager, userHubId]);

  const hubRemainingCanonicalQty = useMemo(() => {
    if (!selectedOrder || !isHubManager) return 0;
    const totalRemaining = selectedOrder.remaining_quantity != null ? Number(selectedOrder.remaining_quantity) : null;

    // If backend remaining_quantity is already hub-scoped, trust it.
    // Otherwise compute a hub-scoped remaining from hub lines.
    if (totalRemaining != null && Number.isFinite(totalRemaining)) {
      return totalRemaining;
    }

    const hubId = userHubId != null ? String(userHubId) : null;
    const hubLines = (selectedOrder.lines ?? []).filter((l: any) =>
      hubId ? String(l.hub_id) === hubId : false
    );

    const hubOrdered = hubLines.reduce((acc: number, l: any) => {
      const qty = l.quantity != null ? Number(l.quantity) : 0;
      return acc + (Number.isFinite(qty) ? qty : 0);
    }, 0);

    const hubAssigned = hubAssignedCanonicalQty;
    return hubOrdered - hubAssigned;
  }, [selectedOrder, isHubManager, userHubId, hubAssignedCanonicalQty]);

  const hubCanonicalUnitLabel = useMemo(() => {
    if (!selectedOrder || !isHubManager) return '';
    const hubId = userHubId != null ? String(userHubId) : null;
    const hubLine = (selectedOrder.lines ?? []).find((l: any) =>
      hubId ? String(l.hub_id) === hubId : false
    );

    // Try to show an abbreviation/name if API exposes unit on the dispatch-order line.
    // DispatchOrderLine type in this project doesn't include these fields, so keep this defensive.
    return (hubLine as any)?.unit_abbreviation || (hubLine as any)?.unit_name || '';
  }, [selectedOrder, isHubManager, userHubId]);

  const orderCommodityIds = useMemo(() => {
    const ids = (selectedOrder?.lines ?? []).map((l: any) => String(l.commodity_id)).filter(Boolean);
    return Array.from(new Set(ids)) as string[];
  }, [selectedOrder]);

  const commodityById = useMemo(() => {
    const map = new Map<string, any>();
    (commodities ?? []).forEach((c: any) => map.set(String(c.id), c));
    return map;
  }, [commodities]);

  const availableMap = useMemo(() => {
    const map = new Map<string, number>();
    (allStockBalances ?? []).forEach((b: any) => {
      const key = `${b.warehouse_id}:${b.commodity_id}`;
      // Prefer available_quantity (unreserved stock) over raw quantity.
      // Fall back to quantity if available_quantity is not present (older API).
      const eligible =
        b.available_quantity != null ? Number(b.available_quantity) : Number(b.quantity || 0);
      map.set(key, (map.get(key) ?? 0) + (Number.isFinite(eligible) ? eligible : 0));
    });
    return map;
  }, [allStockBalances]);

  const getAvailableForWarehouse = (warehouseId: string | null, commodityId: string | null) => {
    if (!warehouseId || !commodityId) return null;
    return availableMap.get(`${warehouseId}:${commodityId}`) ?? 0;
  };

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
    () => units.map((u: any) => ({ value: String(u.id), label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name })),
    [units]
  );

  const storekeeperOptions = useMemo(
    () =>
      assignableStorekeepers.map((sk: any) => ({
        value: String(sk.id),
        label: sk.store_name ? `${sk.name} (${sk.store_name})` : sk.name,
      })),
    [assignableStorekeepers]
  );

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

  useEffect(() => {
    if (!isHubManager) return;
    if (!selectedOrder) {
      setLines([]);
      return;
    }

    const next = orderCommodityIds.map((commodityId) => {
      const doLine = selectedOrder.lines?.find((l: any) => String(l.commodity_id) === String(commodityId));
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

  // Backfill warehouse_id on lines that were set before stock balances or warehouses loaded.
  useEffect(() => {
    if (!isHubManager || !selectedOrder || allStockBalances.length === 0 || warehouses.length === 0) return;
    setLines((prev) => {
      const hasNull = prev.some((l) => l.warehouse_id === null && l.commodity_id);
      if (!hasNull) return prev;
      // Compute eligible warehouses per commodity OUTSIDE setLines so we use current closure values
      const eligibleByComm = new Map<string, string | null>();
      prev.forEach((l) => {
        if (l.commodity_id && !eligibleByComm.has(l.commodity_id)) {
          const opts = warehouseOptionsForCommodity(l.commodity_id);
          eligibleByComm.set(l.commodity_id, opts.length ? String(opts[0].value) : null);
        }
      });
      return prev.map((l) => {
        if (l.warehouse_id !== null || !l.commodity_id) return l;
        return { ...l, warehouse_id: eligibleByComm.get(l.commodity_id) ?? null };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStockBalances, warehouses, isHubManager, selectedOrder]);

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

  const transportValid =
    !!transporterName.trim() &&
    !!driverName.trim() &&
    !!driverIdNum.trim() &&
    !!truckPlate.trim();

  const getLineRemainingError = (line: WarehouseLineItem): string | null => {
    if (!selectedOrder || !line.quantity || line.quantity <= 0) return null;

    const doLine = findDispatchOrderLine(selectedOrder, line.commodity_id);
    const canonUnit = units.find((u: any) => String(u.id) === String(doLine?.unit_id));
    const unitLabel = hubCanonicalUnitLabel || canonUnit?.abbreviation || canonUnit?.name || '';

    return checkDispatchQuantityLimit(line, selectedOrder, uomConversions, {
      remainingOverride: isHubManager ? hubRemainingCanonicalQty : undefined,
      unitLabel,
    });
  };

  const hasRemainingExceeded = lines.some((l) => getLineRemainingError(l) != null);

  const canSubmit =
    !!dispatchOrderId &&
    lines.length > 0 &&
    lines.every((l) => !!l.warehouse_id && !!l.commodity_id && l.quantity > 0 && !!l.unit_id) &&
    transportValid &&
    !hasRemainingExceeded &&
    lines.every((l) => getLineRemainingError(l) == null);

  const queryParams = new URLSearchParams(searchParams);

  const createMutation = useMutation({
    mutationFn: async (shouldConfirm: boolean) => {
      if (!canSubmit) throw new Error('Fill in all required fields');

      const primaryLine = lines[0];
      const payload: CreateDispatchOrderAuthorizationPayload = {
        dispatch_order_id: Number(dispatchOrderId),
        warehouse_id: Number(primaryLine.warehouse_id!),
        commodity_id: primaryLine.commodity_id ? Number(primaryLine.commodity_id) : undefined,
        transporter_name: transporterName.trim(),
        authorized_quantity: primaryLine.quantity,
        authorized_quantity_input_unit_id: primaryLine.unit_id ? Number(primaryLine.unit_id) : undefined,
        driver_name: driverName.trim(),
        driver_id_number: driverIdNum.trim(),
        driver_phone: driverPhone.trim() || undefined,
        truck_plate_number: truckPlate.trim(),
      };

      const dao = await createDispatchOrderAuthorization(payload);
      if (shouldConfirm) return confirmDispatchOrderAuthorization(dao.id);
      return dao;
    },
    onSuccess: async (dao: any) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });

      let assignedStorekeeper = false;
      if (selectedStorekeeperId && storekeeperOptions.length > 0) {
        try {
          await assignStorekeeperToDa(dao.id, { storekeeper_user_id: Number(selectedStorekeeperId) });
          assignedStorekeeper = true;
          queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations', dao.id] });
          queryClient.invalidateQueries({ queryKey: ['dispatch_order_assignable_storekeepers'] });
        } catch (error: unknown) {
          notifications.show({
            title: 'Storekeeper assignment failed',
            message:
              (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
              'Dispatch Authorization was created. Assign the storekeeper from the detail page.',
            color: 'orange',
          });
        }
      }

      notifications.show({
        title: 'Success',
        message: assignedStorekeeper
          ? `Dispatch Authorization ${dao.reference_no} ${dao.status === 'confirmed' ? 'confirmed' : 'saved as draft'}. The selected storekeeper will be notified.`
          : `Dispatch Authorization ${dao.reference_no} ${dao.status === 'confirmed' ? 'confirmed' : 'saved as draft'} successfully`,
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

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Create Dispatch Authorization</Title>
        <Text c="dimmed" size="sm">
          Authorize dispatch from your hub's warehouses to fulfil a dispatch order.
        </Text>
      </div>

      {/* Dispatch Order card */}
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
                <Text size="sm" fw={600}>{selectedOrder.fdp_name || selectedOrder.destination_name || '—'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Status</Text>
                <Text size="sm" fw={600}>{selectedOrder.status}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Items</Text>
                <Text size="sm" fw={600}>
                  {(selectedOrder.lines ?? [])
                    .reduce((acc: string[], l: any) => {
                      const key = String(l.commodity_id);
                      if (!key) return acc;
                      if (acc.includes(key)) return acc;
                      return [...acc, key];
                    }, [])
                    .map((cid: string) => commodityById.get(cid)?.name ?? `Commodity #${cid}`)
                    .join(', ') || '—'}
                </Text>
              </div>

              <div>
                <Text size="xs" c="dimmed">Assigned (hub)</Text>
                <Text size="sm" fw={700}>
                  {hubAssignedCanonicalQty.toLocaleString()}{
                    hubCanonicalUnitLabel ? ` ${hubCanonicalUnitLabel}` : ''
                  }
                </Text>
              </div>

              <div>
                <Text size="xs" c="dimmed">Remaining (hub)</Text>
                <Text size="sm" fw={700} c={hubRemainingCanonicalQty <= 0 ? 'red' : 'green'}>
                  {hubRemainingCanonicalQty.toLocaleString()}{
                    hubCanonicalUnitLabel ? ` ${hubCanonicalUnitLabel}` : ''
                  }
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
          )}
        </Stack>
      </Card>

      {/* Source Warehouses */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Source Warehouses</Text>

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
                    const doLine = findDispatchOrderLine(selectedOrder, line.commodity_id);
                    const remainingError = getLineRemainingError(line);

                    return (
                      <Table.Tr key={idx}>
                        <Table.Td style={{ minWidth: 240 }}>
                          <SearchableSelect
                            placeholder={eligible.length > 0 ? 'Select eligible warehouse' : 'No eligible warehouses'}
                            data={eligible}
                            value={line.warehouse_id}
                            onChange={(v) => handleLineChange(idx, 'warehouse_id', v)}
                            searchable
                          />
                          {eligible.length === 0 && (
                            <Text size="xs" c="red" mt={4}>No warehouse has eligible stock for this commodity.</Text>
                          )}
                        </Table.Td>
                        <Table.Td style={{ minWidth: 220 }}>
                          <Text size="sm" fw={600}>
                            {commodityById.get(String(line.commodity_id))?.name ?? `Commodity #${line.commodity_id}`}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ minWidth: 160 }}>
                          <TextInput
                            value={line.quantity === 0 ? '' : line.quantity}
                            onChange={(e) => {
                              const raw = e.target.value;
                              // Allow user to clear the input (empty string) without forcing 0.
                              if (raw === '') {
                                handleLineChange(idx, 'quantity', 0);
                                return;
                              }
                              const next = Number(raw);
                              handleLineChange(idx, 'quantity', Number.isFinite(next) ? next : 0);
                            }}
                            min={0}
                            type="number"
                            error={remainingError}
                            styles={{ input: { textAlign: 'left' } }}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
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
                              (Remaining: {hubRemainingCanonicalQty.toLocaleString()}
                              {hubCanonicalUnitLabel ? ` ${hubCanonicalUnitLabel}` : ''})
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

      {/* UOM Preview */}
      {lines.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Text fw={600} size="sm">UOM Preview</Text>
            <Text size="sm" c="dimmed">Quantities converted to the dispatch order's canonical unit.</Text>

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
                  const commName = commodityById.get(String(line.commodity_id))?.name ?? `Commodity #${line.commodity_id}`;
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
              <Alert color="orange" icon={<IconAlertCircle size={16} />}>Some lines have no conversion path.</Alert>
            )}
          </Stack>
        </Card>
      )}

      {/* Transport */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Transport</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Transporter Name" value={transporterName} onChange={(e) => setTransporterName(e.target.value)} required />
            <TextInput label="Driver Name" value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
            <TextInput label="Driver ID Number" value={driverIdNum} onChange={(e) => setDriverIdNum(e.target.value)} required />
            <TextInput label="Driver Phone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
            <TextInput label="Vehicle Plate Number" value={truckPlate} onChange={(e) => setTruckPlate(e.target.value)} required />
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Review & Save */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={600} size="sm">Review & Save</Text>

          <Divider label="Warehouse Lines" labelPosition="left" />

          {hasRemainingExceeded && selectedOrder && (
            <Alert color="red" icon={<IconAlertCircle size={16} />} title="Above the dispatch limit">
              <Text size="sm">
                {formatDispatchRemainingExceededMessage(
                  isHubManager
                    ? hubRemainingCanonicalQty
                    : dispatchOrderRemainingQuantity(selectedOrder) ?? 0,
                  hubCanonicalUnitLabel ||
                    units.find((u: any) => String(u.id) === String(selectedOrder.lines?.[0]?.unit_id))
                      ?.abbreviation ||
                    units.find((u: any) => String(u.id) === String(selectedOrder.lines?.[0]?.unit_id))?.name ||
                    ''
                )}
              </Text>
            </Alert>
          )}

          {lines.map((line, idx) => (
            <Group key={idx} justify="space-between" align="center">
              <Text size="sm" fw={600}>
                {line.warehouse_id ? warehouses.find((w: any) => String(w.id) === String(line.warehouse_id))?.name : '—'}
              </Text>
              <Text size="sm" c="dimmed">
                {commodityById.get(String(line.commodity_id))?.name ?? `Commodity #${line.commodity_id}`}: {line.quantity}
              </Text>
            </Group>
          ))}

          <Group justify="flex-end" mt="xl">
            <Button variant="light" onClick={() => navigate(basePath)}>Cancel</Button>
            <Button
              variant="outline"
              loading={createMutation.isPending}
              disabled={!canSubmit}
              onClick={() => createMutation.mutate(false)}
            >
              Save Draft
            </Button>
            <Button loading={createMutation.isPending} disabled={!canSubmit} onClick={() => createMutation.mutate(true)}>
              Confirm Dispatch Authorization
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

