import { useMemo, useState, useEffect, useRef } from 'react';
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
  NumberInput,
  Card,
  Table,
  ActionIcon,
  Text,
  Alert,
  SimpleGrid,
  Divider,
} from '@mantine/core';
import { IconPlus, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getDispatchOrder } from '../../api/dispatchOrders';
import {
  createDispatchOrderAuthorization,
  getAuthorizationStoresLookup,
  getDispatchOrderAuthorizations,
} from '../../api/dispatchOrderAuthorizations';
import { useAuthStore } from '../../store/authStore';
import type { ApiError } from '../../types/common';
import type { DispatchOrderLineV2 } from '../../types/dispatchV2';
import { formatDestinationAllocations } from '../../utils/dispatchAllocations';
import {
  type DispatchAuthorizationBasePath,
  dispatchAuthorizationDetailPath,
  dispatchAuthorizationListPath,
} from '../../utils/dispatchAuthorizationPaths';
import { remainingQtyAtWarehouseForCommodity, warehouseLabelFromOrder } from '../../utils/dispatchAuthorizationUtils';
import { getDispatchOrderReference } from '../../utils/dispatchOrderReference';
import { LoadingState } from '../../components/common/LoadingState';

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

type SplitRow = {
  clientKey: string;
  store_id: number;
  commodity_id: number;
  authorized_quantity: number;
  base_quantity: number;
};

export default function DispatchAuthorizationFormPage({
  basePath,
}: {
  basePath: DispatchAuthorizationBasePath;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const warehouseIdFromAssignment = useAuthStore((s) => s.activeAssignment?.warehouse?.id);

  const qpOrder = searchParams.get('dispatch_order_id');
  const qpWarehouse = searchParams.get('warehouse_id');
  const fromList = !!(qpOrder && qpWarehouse);

  const [dispatchOrderId, setDispatchOrderId] = useState<number>(qpOrder ? Number(qpOrder) : 0);
  const [warehouseId, setWarehouseId] = useState<number>(
    qpWarehouse ? Number(qpWarehouse) : warehouseIdFromAssignment || 0
  );
  const [selectedCommodityId, setSelectedCommodityId] = useState<number>(0);
  const [authorizedQty, setAuthorizedQty] = useState<number>(0);
  const [inputUnitId, setInputUnitId] = useState<number>(0);
  const [transporterName, setTransporterName] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverIdNumber, setDriverIdNumber] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const prefilledRef = useRef(false);

  useEffect(() => {
    if (qpOrder) setDispatchOrderId(Number(qpOrder));
    if (qpWarehouse) setWarehouseId(Number(qpWarehouse));
    else if (warehouseIdFromAssignment) setWarehouseId(warehouseIdFromAssignment);
  }, [qpOrder, qpWarehouse, warehouseIdFromAssignment]);

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['dispatch_orders', dispatchOrderId],
    queryFn: () => getDispatchOrder(dispatchOrderId),
    enabled: dispatchOrderId > 0,
  });

  const { data: existingAuths = [] } = useQuery({
    queryKey: ['dispatch_order_authorizations', { dispatch_order_id: dispatchOrderId }],
    queryFn: () => getDispatchOrderAuthorizations({ dispatch_order_id: dispatchOrderId }),
    enabled: dispatchOrderId > 0,
  });

  const linesAtWarehouse: DispatchOrderLineV2[] = useMemo(() => {
    const lines = order?.dispatch_order_lines ?? [];
    if (!warehouseId) return lines;
    return lines.filter((l) =>
      (l.source_allocations || []).some((s) => Number(s.warehouse_id) === Number(warehouseId))
    );
  }, [order, warehouseId]);

  const commodityOptions = useMemo(
    () =>
      linesAtWarehouse.map((l) => ({
        value: String(l.commodity_id),
        label: l.commodity_name || `Commodity ${l.commodity_id}`,
      })),
    [linesAtWarehouse]
  );

  const selectedLine = useMemo(() => {
    if (!selectedCommodityId) return null;
    return linesAtWarehouse.find((l) => Number(l.commodity_id) === Number(selectedCommodityId)) ?? null;
  }, [linesAtWarehouse, selectedCommodityId]);

  const remainingQty = useMemo(() => {
    if (!order || !warehouseId || !selectedCommodityId) return 0;
    return remainingQtyAtWarehouseForCommodity(order, warehouseId, selectedCommodityId, existingAuths);
  }, [order, warehouseId, selectedCommodityId, existingAuths]);

  const { data: storesData } = useQuery({
    queryKey: ['auth_lookup_stores', warehouseId],
    queryFn: () => getAuthorizationStoresLookup({ warehouse_id: warehouseId }),
    enabled: warehouseId > 0,
  });
  const storeOptions = useMemo(
    () => storesData?.items.map((s) => ({ value: String(s.id), label: s.label })) ?? [],
    [storesData]
  );

  const unitOptions = useMemo(() => {
    const units = new Map<number, string>();
    const lines = selectedLine ? [selectedLine] : linesAtWarehouse;
    lines.forEach((line) => {
      units.set(line.unit_id, line.unit_name || String(line.unit_id));
      line.source_allocations?.forEach((s) => {
        if (s.unit_id) units.set(s.unit_id, s.unit_name || String(s.unit_id));
      });
    });
    return [...units.entries()].map(([id, label]) => ({ value: String(id), label }));
  }, [linesAtWarehouse, selectedLine]);

  const primaryUnitId = selectedLine?.unit_id ?? linesAtWarehouse[0]?.unit_id ?? 0;
  const primaryUnitName = selectedLine?.unit_name ?? linesAtWarehouse[0]?.unit_name ?? '';

  useEffect(() => {
    if (!order || !warehouseId || !selectedCommodityId || prefilledRef.current || remainingQty <= 0) return;
    prefilledRef.current = true;

    setAuthorizedQty(remainingQty);
    if (primaryUnitId) setInputUnitId(primaryUnitId);

    const stores = storesData?.items ?? [];
    if (stores.length === 1 && selectedLine) {
      setSplits([
        {
          clientKey: newKey(),
          store_id: stores[0].id,
          commodity_id: selectedCommodityId,
          authorized_quantity: remainingQty,
          base_quantity: remainingQty,
        },
      ]);
    } else if (selectedLine && stores.length > 0) {
      setSplits([
        {
          clientKey: newKey(),
          store_id: 0,
          commodity_id: selectedCommodityId,
          authorized_quantity: remainingQty,
          base_quantity: remainingQty,
        },
      ]);
    }
  }, [order, warehouseId, selectedCommodityId, remainingQty, primaryUnitId, selectedLine, storesData]);

  const handleCommodityChange = (v: string | null) => {
    const newId = Number(v);
    prefilledRef.current = false;
    setSplits([]);
    setAuthorizedQty(0);
    setSelectedCommodityId(newId);
  };

  const splitsSum = splits.reduce((s, r) => s + Number(r.authorized_quantity ?? 0), 0);
  const splitsValid = Math.abs(splitsSum - authorizedQty) < 0.001;

  const addSplit = () => {
    setSplits((prev) => [
      ...prev,
      {
        clientKey: newKey(),
        store_id: 0,
        commodity_id: selectedCommodityId,
        authorized_quantity: 0,
        base_quantity: 0,
      },
    ]);
  };

  const validate = (): string | null => {
    if (!dispatchOrderId || !warehouseId) return 'Select a dispatch order and warehouse';
    if (!selectedCommodityId) return 'Select a commodity to authorize';
    if (remainingQty <= 0) return 'No remaining quantity to authorize for this commodity at this warehouse';
    if (authorizedQty <= 0 || authorizedQty > remainingQty) {
      return `Authorized quantity must be between 0 and ${remainingQty}`;
    }
    if (!inputUnitId) return 'Select a quantity unit';
    if (!transporterName.trim()) return 'Transporter name is required';
    if (!driverName.trim()) return 'Driver name is required';
    if (!driverIdNumber.trim()) return 'Driver license / ID is required';
    if (!truckPlate.trim()) return 'Truck plate is required';
    if (!driverPhone.trim()) return 'Driver phone is required';
    if (splits.length > 0 && splits.some((s) => !s.store_id || !s.commodity_id)) {
      return 'Complete all store split rows';
    }
    if (splits.length > 0 && !splitsValid) {
      return `Store splits must sum to ${authorizedQty} (currently ${splitsSum})`;
    }
    return null;
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const err = validate();
      if (err) throw new Error(err);
      return createDispatchOrderAuthorization({
        dispatch_order_id: dispatchOrderId,
        warehouse_id: warehouseId,
        commodity_id: selectedCommodityId,
        authorized_quantity: authorizedQty,
        authorized_quantity_input_unit_id: inputUnitId,
        transporter_name: transporterName.trim(),
        driver_name: driverName.trim(),
        driver_id_number: driverIdNumber.trim(),
        truck_plate_number: truckPlate.trim(),
        driver_phone: driverPhone.trim(),
        store_splits: splits.length
          ? splits.map((s) => ({
              store_id: s.store_id,
              commodity_id: s.commodity_id,
              authorized_quantity: s.authorized_quantity,
              base_quantity: s.base_quantity || s.authorized_quantity,
            }))
          : [],
      });
    },
    onSuccess: (auth) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders', 'awaiting_authorization'] });
      notifications.show({ title: 'Created', message: 'Authorization draft saved', color: 'green' });
      navigate(dispatchAuthorizationDetailPath(basePath, auth.id));
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error
          ? error.message
          : (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
            'Failed to create authorization';
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    },
  });

  if (dispatchOrderId > 0 && orderLoading) {
    return <LoadingState message="Loading dispatch order..." />;
  }

  const warehouseLabel =
    order && warehouseId ? warehouseLabelFromOrder(order, warehouseId) : `WH-${warehouseId}`;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Authorize dispatch release</Title>
        <Button variant="light" onClick={() => navigate(dispatchAuthorizationListPath(basePath))}>
          Back
        </Button>
      </Group>

      {order && (
        <Card withBorder padding="lg" bg="gray.0">
          <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase">
                Dispatch reference
              </Text>
              <Text fw={600}>{getDispatchOrderReference(order)}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase">
                Source warehouse
              </Text>
              <Text fw={600}>{warehouseLabel}</Text>
            </div>
          </SimpleGrid>
          {order.description && (
            <Text size="sm" c="dimmed" mb="sm">
              {order.description}
            </Text>
          )}
          <Divider my="sm" label="Commodity lines at this warehouse" labelPosition="left" />
          {linesAtWarehouse.map((line) => (
            <Group key={line.id ?? line.commodity_id} gap="lg" mb="xs">
              <Text size="sm" fw={500}>
                {line.commodity_name || `Commodity #${line.commodity_id}`}
              </Text>
              <Text size="sm" c="dimmed">
                Source:{' '}
                {(line.source_allocations ?? [])
                  .filter((s) => Number(s.warehouse_id) === Number(warehouseId))
                  .map((s) => `${s.quantity} ${s.unit_name ?? ''}`)
                  .join(', ')}
              </Text>
              <Text size="sm" c="dimmed">
                Destinations: {formatDestinationAllocations(line)}
              </Text>
            </Group>
          ))}
        </Card>
      )}

      {!fromList && (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <NumberInput
              label="Dispatch order ID"
              description="Enter manually only when not opened from the pending queue"
              value={dispatchOrderId}
              onChange={(v) => {
                prefilledRef.current = false;
                setDispatchOrderId(Number(v));
              }}
              min={1}
            />
            <NumberInput
              label="Source warehouse ID"
              value={warehouseId}
              onChange={(v) => {
                prefilledRef.current = false;
                setWarehouseId(Number(v));
              }}
              min={1}
            />
          </Stack>
        </Card>
      )}

      <Card withBorder padding="lg">
        <Title order={5} mb="sm">
          Select commodity to authorize
        </Title>
        <Select
          placeholder="Pick a commodity"
          searchable
          data={commodityOptions}
          value={selectedCommodityId ? String(selectedCommodityId) : null}
          onChange={handleCommodityChange}
          nothingFoundMessage="No commodities at this warehouse"
        />
      </Card>

      {selectedCommodityId && remainingQty <= 0 && order && (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
          This warehouse has no remaining quantity to authorize for the selected commodity.
        </Alert>
      )}

      {selectedCommodityId && remainingQty > 0 && (
        <>
          <Card withBorder padding="lg">
            <Title order={5} mb="sm">
              Authorization quantity
            </Title>
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Remaining to authorize:{' '}
                <Text span fw={600}>
                  {remainingQty} {primaryUnitName}
                </Text>
              </Text>
              <NumberInput
                label="Authorized quantity"
                description={`Maximum ${remainingQty} ${primaryUnitName}`}
                value={authorizedQty}
                onChange={(v) => setAuthorizedQty(Number(v))}
                min={0}
                max={remainingQty}
              />
              <Select
                label="Quantity unit"
                data={unitOptions}
                value={inputUnitId ? String(inputUnitId) : null}
                onChange={(v) => setInputUnitId(Number(v))}
              />
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Title order={5} mb="sm">
              Transport details
            </Title>
            <Stack gap="sm">
              <TextInput
                label="Transporter"
                required
                placeholder="Enter transporter name"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
              />
              <TextInput
                label="Driver name"
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
              <TextInput
                label="Driver ID / license"
                required
                value={driverIdNumber}
                onChange={(e) => setDriverIdNumber(e.target.value)}
              />
              <TextInput
                label="Truck plate"
                required
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value)}
              />
              <TextInput
                label="Driver phone"
                required
                placeholder="e.g. 0911000000"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
              />
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Group justify="space-between" mb="sm">
              <div>
                <Title order={5}>Store splits</Title>
                <Text size="sm" c={splitsValid ? 'dimmed' : 'red'}>
                  Distributed: {splitsSum} / {authorizedQty} {primaryUnitName}
                </Text>
                <Text size="xs" c="dimmed">
                  Optional at this stage. If left empty, storekeeper can add or update splits later.
                </Text>
              </div>
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addSplit}>
                Add store
              </Button>
            </Group>
            <Table.ScrollContainer minWidth={560}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Store</Table.Th>
                    <Table.Th>Qty</Table.Th>
                    <Table.Th w={40} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {splits.map((row, idx) => (
                    <Table.Tr key={row.clientKey}>
                      <Table.Td>
                        <Select
                          searchable
                          data={storeOptions}
                          value={row.store_id ? String(row.store_id) : null}
                          onChange={(v) => {
                            const next = [...splits];
                            next[idx] = { ...row, store_id: Number(v) };
                            setSplits(next);
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          value={row.authorized_quantity}
                          onChange={(v) => {
                            const next = [...splits];
                            const q = Number(v);
                            next[idx] = { ...row, authorized_quantity: q, base_quantity: q };
                            setSplits(next);
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={() => setSplits((p) => p.filter((_, i) => i !== idx))}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>

          <Button
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            disabled={remainingQty <= 0}
          >
            Save draft authorization
          </Button>
        </>
      )}
    </Stack>
  );
}
