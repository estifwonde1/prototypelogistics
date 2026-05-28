import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Button,
  Group,
  Card,
  Text,
  Badge,
  SimpleGrid,
  Divider,
  Alert,
  NumberInput,
  Textarea,
  Select,
  Table,
  ActionIcon,
  TextInput,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconTruckDelivery,
  IconAlertCircle,
  IconPlus,
  IconTrash,
  IconCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  getDispatchOrderAuthorization,
  createDispatchOrderAuthorizationExecution,
  driverConfirmDispatchOrderAuthorization,
  getAuthorizationStoresLookup,
  getAuthorizationStacksLookup,
  updateDispatchOrderAuthorizationStoreSplits,
} from '../../api/dispatchOrderAuthorizations';
import { getDispatchOrder } from '../../api/dispatchOrders';
import { getGin, confirmGin, postGinStackAllocations, getGins } from '../../api/gins';
import type { ApiError } from '../../types/common';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { formatDestinationAllocations } from '../../utils/dispatchAllocations';
import { getDispatchOrderReference } from '../../utils/dispatchOrderReference';

type StackRow = {
  clientKey: string;
  store_id: number;
  commodity_id: number;
  stack_id: number;
  quantity: number;
  commodity_grade: string;
};

type SplitRow = {
  clientKey: string;
  store_id: number;
  commodity_id: number;
  authorized_quantity: number;
  base_quantity: number;
};

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function StorekeeperDispatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authId = Number(id);

  const [execStoreId, setExecStoreId] = useState<number>(0);
  const [execQty, setExecQty] = useState<number>(0);
  const [execGrade, setExecGrade] = useState('Grade A');
  const [shortageReason, setShortageReason] = useState('');
  const [ginId, setGinId] = useState<number | null>(null);
  const [stackRows, setStackRows] = useState<StackRow[]>([]);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  const [showRecordForm, setShowRecordForm] = useState(true);
  const [driverPhone, setDriverPhone] = useState('');
  const [allocationsSaved, setAllocationsSaved] = useState(false);

  const { data: auth, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_order_authorizations', authId],
    queryFn: () => getDispatchOrderAuthorization(authId),
    enabled: Number.isFinite(authId) && authId > 0,
  });

  const { data: order } = useQuery({
    queryKey: ['dispatch_orders', auth?.dispatch_order_id],
    queryFn: () => getDispatchOrder(auth!.dispatch_order_id),
    enabled: !!auth?.dispatch_order_id,
  });

  const { data: storesLookup } = useQuery({
    queryKey: ['auth_lookup_stores', auth?.warehouse_id],
    queryFn: () => getAuthorizationStoresLookup({ warehouse_id: auth!.warehouse_id }),
    enabled: !!auth?.warehouse_id,
  });

  const { data: linkedGins } = useQuery({
    queryKey: ['gins', { dispatch_order_authorization_id: authId }],
    queryFn: () => getGins({ dispatch_order_authorization_id: authId }),
    enabled:
      Number.isFinite(authId) &&
      authId > 0 &&
      (!!auth?.driver_confirmed_at || String(auth?.status ?? '').toLowerCase() === 'completed'),
  });

  const effectiveGinId = ginId ?? linkedGins?.[0]?.id ?? null;

  const { data: gin } = useQuery({
    queryKey: ['gin', effectiveGinId],
    queryFn: () => getGin(effectiveGinId!),
    enabled: effectiveGinId != null && effectiveGinId > 0,
  });

  const selectedStore = auth?.dispatch_order_authorization_stores?.find(
    (s) => s.id === execStoreId
  );
  const remainingForStore = Number(selectedStore?.remaining_quantity ?? 0);
  const needsShortageReason =
    execQty > 0 && execQty < remainingForStore - 0.001;

  const executions = auth?.dispatch_order_authorization_executions ?? [];
  const stores = auth?.dispatch_order_authorization_stores ?? [];
  const storesWithRemaining = stores.filter((s) => Number(s.remaining_quantity) > 0);
  const hasExecutionWithQty = executions.some((e) => Number(e.quantity) > 0);
  const canDriverConfirm =
    !!auth &&
    !auth.driver_confirmed_at &&
    hasExecutionWithQty &&
    ['confirmed', 'in_progress'].includes(String(auth.status).toLowerCase());
  const effectiveDriverPhone = (auth?.driver_phone?.trim() || driverPhone.trim());
  const driverPhoneRequired = canDriverConfirm && !effectiveDriverPhone;

  const primaryExecution = useMemo(
    () => executions.find((e) => Number(e.quantity) > 0) ?? executions[0],
    [executions]
  );
  const executionStoreRow = useMemo(
    () =>
      primaryExecution
        ? stores.find((s) => s.id === primaryExecution.dispatch_order_authorization_store_id)
        : undefined,
    [primaryExecution, stores]
  );

  const stackCommodityId =
    gin?.gin_items?.[0]?.commodity_id ??
    primaryExecution?.commodity_id ??
    executionStoreRow?.commodity_id ??
    0;
  const stackStoreId =
    gin?.gin_items?.[0]?.store_id ??
    executionStoreRow?.store_id ??
    stores[0]?.store_id ??
    0;
  const canEditSplits = !auth?.driver_confirmed_at && executions.length === 0;

  const dispatchTargetQty = useMemo(() => {
    const execSum = executions.reduce((sum, e) => sum + Number(e.quantity || 0), 0);
    if (execSum > 0) return execSum;
    return Number(gin?.gin_items?.[0]?.quantity ?? 0);
  }, [executions, gin]);

  const allocatedSum = useMemo(
    () => stackRows.reduce((sum, r) => sum + Number(r.quantity || 0), 0),
    [stackRows]
  );
  const allocationRemaining = Math.max(0, dispatchTargetQty - allocatedSum);
  const allocationsMatch =
    dispatchTargetQty > 0 && Math.abs(allocatedSum - dispatchTargetQty) < 0.001;
  const stackRowsValid =
    stackRows.length > 0 &&
    stackRows.every((r) => r.stack_id > 0 && Number(r.quantity) > 0) &&
    allocationsMatch;

  useEffect(() => {
    if (!auth) return;
    const hasExec = (auth.dispatch_order_authorization_executions ?? []).some(
      (e) => Number(e.quantity) > 0
    );
    setShowRecordForm(!hasExec);
  }, [auth?.id, auth?.dispatch_order_authorization_executions]);

  useEffect(() => {
    if (!auth) return;
    setSplitRows(
      (auth.dispatch_order_authorization_stores ?? []).map((s) => ({
        clientKey: newKey(),
        store_id: s.store_id,
        commodity_id: s.commodity_id,
        authorized_quantity: Number(s.authorized_quantity),
        base_quantity: Number(s.base_quantity ?? s.authorized_quantity),
      }))
    );
  }, [auth?.id, auth?.dispatch_order_authorization_stores]);

  useEffect(() => {
    if (!auth) return;
    setDriverPhone((auth.driver_phone ?? '').trim());
  }, [auth?.id, auth?.driver_phone]);

  const { data: stacksData } = useQuery({
    queryKey: ['auth_lookup_stacks', stackStoreId, stackCommodityId],
    queryFn: () =>
      getAuthorizationStacksLookup({ store_id: stackStoreId, commodity_id: stackCommodityId }),
    enabled: stackStoreId > 0 && stackCommodityId > 0 && !!auth?.driver_confirmed_at,
  });

  useEffect(() => {
    if (!gin?.dispatch_stack_allocations?.length) return;
    setStackRows(
      gin.dispatch_stack_allocations.map((a) => ({
        clientKey: newKey(),
        store_id: stackStoreId,
        commodity_id:
          stacksData?.items?.find((s) => s.id === a.stack_id)?.commodity_id ?? stackCommodityId,
        stack_id: a.stack_id,
        quantity: Number(a.quantity),
        commodity_grade: a.commodity_grade ?? execGrade,
      }))
    );
    setAllocationsSaved(true);
  }, [gin?.id, gin?.dispatch_stack_allocations, stackStoreId, stackCommodityId, execGrade, stacksData?.items]);

  const stackAvailableById = useMemo(() => {
    const map = new Map<number, number>();
    (stacksData?.items ?? []).forEach((s) => map.set(s.id, Number(s.available_quantity ?? 0)));
    return map;
  }, [stacksData]);

  const stackOptionsForRow = (row: StackRow, rowIndex: number) => {
    const usedElsewhere = new Set(
      stackRows
        .filter((_, i) => i !== rowIndex)
        .filter((r) => r.stack_id > 0)
        .map((r) => r.stack_id)
    );
    return (stacksData?.items ?? [])
      .filter((s) => !usedElsewhere.has(s.id) || s.id === row.stack_id)
      .map((s) => ({
        value: String(s.id),
        label: `${s.label} (${s.available_quantity} avail)`,
      }));
  };

  const maxQtyForRow = (row: StackRow, rowIndex: number) => {
    const stackAvail = stackAvailableById.get(row.stack_id) ?? 0;
    const otherAllocated = stackRows.reduce(
      (sum, r, i) => (i === rowIndex ? sum : sum + Number(r.quantity || 0)),
      0
    );
    const remaining = Math.max(0, dispatchTargetQty - otherAllocated);
    return Math.min(stackAvail, remaining);
  };

  const splitStoreOptions = useMemo(
    () => (storesLookup?.items ?? []).map((s) => ({ value: String(s.id), label: s.label })),
    [storesLookup]
  );

  const splitCommodityOptions = useMemo(() => {
    const lines = (order?.dispatch_order_lines ?? []).filter((line) =>
      (line.source_allocations ?? []).some((s) => Number(s.warehouse_id) === Number(auth?.warehouse_id))
    );
    return lines.map((line) => ({
      value: String(line.commodity_id),
      label: line.commodity_name || `Commodity ${line.commodity_id}`,
    }));
  }, [order, auth?.warehouse_id]);

  const splitSum = splitRows.reduce((sum, row) => sum + Number(row.authorized_quantity || 0), 0);
  const splitValid =
    splitRows.length > 0 &&
    splitRows.every((r) => r.store_id && r.commodity_id && Number(r.authorized_quantity) > 0) &&
    Math.abs(splitSum - Number(auth?.authorized_quantity ?? 0)) < 0.001;

  const splitMutation = useMutation({
    mutationFn: () => {
      if (!splitValid) {
        throw new Error(
          `Store splits must be complete and sum to ${auth.authorized_quantity} (currently ${splitSum})`
        );
      }

      return updateDispatchOrderAuthorizationStoreSplits(authId, {
        store_splits: splitRows.map((r) => ({
          store_id: r.store_id,
          commodity_id: r.commodity_id,
          authorized_quantity: r.authorized_quantity,
          base_quantity: r.base_quantity || r.authorized_quantity,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations', authId] });
      notifications.show({ title: 'Saved', message: 'Store splits updated', color: 'green' });
      setExecStoreId(0);
      setExecQty(0);
      setShortageReason('');
      refetch();
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          err instanceof Error
            ? err.message
            : (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
              'Failed to update store splits',
        color: 'red',
      });
    },
  });

  const executionMutation = useMutation({
    mutationFn: () => {
      if (!selectedStore) throw new Error('Select a store row');
      if (execQty <= 0) throw new Error('Enter a quantity');
      if (execQty > remainingForStore + 0.001) {
        throw new Error(`Quantity cannot exceed ${remainingForStore}`);
      }
      if (needsShortageReason && !shortageReason.trim()) {
        throw new Error('Shortage reason is required when quantity is less than remaining');
      }
      return createDispatchOrderAuthorizationExecution(authId, {
        dispatch_order_authorization_store_id: selectedStore.id,
        quantity: execQty,
        commodity_grade: execGrade,
        shortage_reason: needsShortageReason ? shortageReason.trim() : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations', authId] });
      notifications.show({ title: 'Recorded', message: 'Dispatch quantity saved', color: 'green' });
      setExecStoreId(0);
      setExecQty(0);
      setShortageReason('');
      setShowRecordForm(false);
      refetch();
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          err instanceof Error
            ? err.message
            : (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
              'Failed to record execution',
        color: 'red',
      });
    },
  });

  const driverConfirmMutation = useMutation({
    mutationFn: () => {
      const phone = effectiveDriverPhone;
      if (!phone) throw new Error('Driver phone is required');
      return driverConfirmDispatchOrderAuthorization(authId, { driver_phone: phone });
    },
    onSuccess: (data) => {
      setGinId(data.gin_id);
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations', authId] });
      notifications.show({ title: 'Driver confirmed', message: 'Draft GIN generated', color: 'green' });
      refetch();
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
          'Driver confirm failed',
        color: 'red',
      });
    },
  });

  const saveStackAllocations = async () => {
    if (!effectiveGinId) throw new Error('No GIN');
    if (stackRows.length === 0) throw new Error('Add stack allocations');
    if (!allocationsMatch) {
      throw new Error(
        `Stack allocations must sum to ${dispatchTargetQty} (currently ${allocatedSum})`
      );
    }
    for (let i = 0; i < stackRows.length; i += 1) {
      const row = stackRows[i];
      if (!row.stack_id) throw new Error('Select a stack for each row');
      const maxQty = maxQtyForRow(row, i);
      if (Number(row.quantity) > maxQty + 0.001) {
        throw new Error(`Row ${i + 1} exceeds available stack quantity (max ${maxQty})`);
      }
    }
    await postGinStackAllocations(
      effectiveGinId,
      stackRows.map((r) => ({
        stack_id: r.stack_id,
        quantity: r.quantity,
        commodity_id: r.commodity_id,
        commodity_grade: r.commodity_grade,
      }))
    );
    setAllocationsSaved(true);
  };

  const stackMutation = useMutation({
    mutationFn: saveStackAllocations,
    onSuccess: () => {
      setAllocationsSaved(true);
      notifications.show({ title: 'Stacks assigned', message: 'Stack allocations saved', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['gin', effectiveGinId] });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
          'Stack allocation failed',
        color: 'red',
      });
    },
  });

  const confirmGinMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveGinId) throw new Error('No GIN');
      if (!stackRowsValid) {
        throw new Error('Complete stack allocations before finishing dispatch');
      }
      if (!allocationsSaved) {
        await saveStackAllocations();
      }
      return confirmGin(effectiveGinId, crypto.randomUUID());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({ title: 'Dispatch complete', message: 'GIN confirmed — stock issued', color: 'green' });
      navigate('/storekeeper/dispatch-authorizations');
    },
    onError: (err: unknown) => {
      const apiMessage = isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined;
      const localMessage = err instanceof Error ? err.message : undefined;
      notifications.show({
        title: 'Error',
        message: apiMessage || localMessage || 'GIN confirm failed',
        color: 'red',
      });
    },
  });

  if (isLoading) return <LoadingState message="Loading dispatch authorization..." />;
  if (error || !auth) {
    return <ErrorState message="Failed to load authorization" onRetry={refetch} />;
  }

  const dispatchRef =
    order ? getDispatchOrderReference(order) : '—';
  const isCompleted = String(auth.status).toLowerCase() === 'completed';
  const hasStoreSplits = stores.length > 0;
  const showStackSection = !!auth.driver_confirmed_at && !isCompleted;
  const completedGin = gin ?? linkedGins?.[0];
  const stackAllocations = completedGin?.dispatch_stack_allocations ?? [];
  const ginRef = completedGin?.reference_no || (completedGin ? `GIN-${completedGin.id}` : null);
  const ginConfirmedAt = completedGin?.updated_at;

  const addStackRow = () => {
    setAllocationsSaved(false);
    const remaining = Math.max(0, dispatchTargetQty - allocatedSum);
    setStackRows((prev) => [
      ...prev,
      {
        clientKey: newKey(),
        store_id: stackStoreId,
        commodity_id: stackCommodityId,
        stack_id: 0,
        quantity: remaining > 0 ? remaining : 0,
        commodity_grade: execGrade,
      },
    ]);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/storekeeper/dispatch-authorizations')}
          >
            Back
          </Button>
          <Title order={2}>Outbound dispatch</Title>
          <Badge variant="light">{auth.status_label ?? auth.status}</Badge>
        </Group>
        {canDriverConfirm && (
          <Button
            color="green"
            leftSection={<IconTruckDelivery size={16} />}
            loading={driverConfirmMutation.isPending}
            disabled={driverPhoneRequired}
            onClick={() => driverConfirmMutation.mutate()}
          >
            Driver confirmed pickup
          </Button>
        )}
      </Group>

      <Card withBorder padding="lg">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          <div>
            <Text size="xs" c="dimmed">
              Authorization
            </Text>
            <Text fw={600}>{auth.reference_no || `DA-${auth.id}`}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Dispatch ref
            </Text>
            <Text fw={600}>{dispatchRef}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Driver / plate
            </Text>
            <Text fw={600}>
              {auth.driver_name} — {auth.truck_plate_number}
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Driver phone
            </Text>
            {canDriverConfirm && !auth.driver_phone ? (
              <TextInput
                placeholder="e.g. 0911000000"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                required
              />
            ) : (
              <Text fw={600}>{effectiveDriverPhone || '—'}</Text>
            )}
          </div>
        </SimpleGrid>
        {order && (
          <>
            <Divider my="sm" />
            {(order.dispatch_order_lines ?? [])
              .filter((line) =>
                (line.source_allocations ?? []).some(
                  (s) => Number(s.warehouse_id) === Number(auth.warehouse_id)
                )
              )
              .map((line) => (
                <Text key={line.id ?? line.commodity_id} size="sm" c="dimmed">
                  {line.commodity_name} → {formatDestinationAllocations(line)}
                </Text>
              ))}
          </>
        )}
      </Card>

      {!isCompleted && canEditSplits && (
        <Card withBorder padding="lg">
          <Group justify="space-between" mb="sm">
            <div>
              <Title order={5}>Store splits</Title>
              <Text size="sm" c={splitValid || splitRows.length === 0 ? 'dimmed' : 'red'}>
                Distributed: {splitSum} / {auth.authorized_quantity}
              </Text>
            </div>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() =>
                setSplitRows((prev) => [
                  ...prev,
                  {
                    clientKey: newKey(),
                    store_id: 0,
                    commodity_id: Number(splitCommodityOptions[0]?.value ?? 0),
                    authorized_quantity: 0,
                    base_quantity: 0,
                  },
                ])
              }
            >
              Add store
            </Button>
          </Group>
          <Table.ScrollContainer minWidth={560}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Store</Table.Th>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Qty</Table.Th>
                  <Table.Th w={40} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {splitRows.map((row, idx) => (
                  <Table.Tr key={row.clientKey}>
                    <Table.Td>
                      <Select
                        searchable
                        data={splitStoreOptions}
                        value={row.store_id ? String(row.store_id) : null}
                        onChange={(v) => {
                          const next = [...splitRows];
                          next[idx] = { ...row, store_id: Number(v) };
                          setSplitRows(next);
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        searchable
                        data={splitCommodityOptions}
                        value={row.commodity_id ? String(row.commodity_id) : null}
                        onChange={(v) => {
                          const next = [...splitRows];
                          next[idx] = { ...row, commodity_id: Number(v) };
                          setSplitRows(next);
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        min={0}
                        value={row.authorized_quantity}
                        onChange={(v) => {
                          const q = Number(v);
                          const next = [...splitRows];
                          next[idx] = { ...row, authorized_quantity: q, base_quantity: q };
                          setSplitRows(next);
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => setSplitRows((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Group mt="md">
            <Button loading={splitMutation.isPending} onClick={() => splitMutation.mutate()}>
              Save store splits
            </Button>
            {splitRows.length === 0 && (
              <Text size="sm" c="dimmed">
                Add rows and save to continue dispatch execution.
              </Text>
            )}
          </Group>
        </Card>
      )}

      {executions.length > 0 && (
        <Card withBorder padding="lg">
          <Group justify="space-between" mb="sm">
            <Title order={5}>{isCompleted ? 'Dispatch record' : 'Recorded dispatch'}</Title>
            {isCompleted ? (
              <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
                Complete
              </Badge>
            ) : (
              storesWithRemaining.length > 0 &&
              !showRecordForm && (
                <Button size="xs" variant="light" onClick={() => setShowRecordForm(true)}>
                  Record another store
                </Button>
              )
            )}
          </Group>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Store</Table.Th>
                <Table.Th>Qty</Table.Th>
                <Table.Th>Grade</Table.Th>
                <Table.Th>Shortage</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {executions.map((e) => {
                const storeRow = stores.find((s) => s.id === e.dispatch_order_authorization_store_id);
                return (
                  <Table.Tr key={e.id}>
                    <Table.Td>{storeRow?.store_name ?? e.dispatch_order_authorization_store_id}</Table.Td>
                    <Table.Td>{e.quantity}</Table.Td>
                    <Table.Td>{e.commodity_grade ?? '—'}</Table.Td>
                    <Table.Td>{e.shortage_reason ?? '—'}</Table.Td>
                    <Table.Td>{e.status}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {!isCompleted && showRecordForm && hasStoreSplits && storesWithRemaining.length > 0 && (
        <Card withBorder padding="lg">
          <Group justify="space-between" mb="sm">
            <Title order={5}>Record dispatch by store</Title>
            {executions.length > 0 && (
              <Button size="xs" variant="subtle" onClick={() => setShowRecordForm(false)}>
                Cancel
              </Button>
            )}
          </Group>
          <Stack gap="sm">
            <Select
              label="Store row"
              data={storesWithRemaining.map((s) => ({
                value: String(s.id),
                label: `${s.store_name ?? s.store_id} — ${s.remaining_quantity} remaining`,
              }))}
              value={execStoreId ? String(execStoreId) : null}
              onChange={(v) => setExecStoreId(Number(v))}
            />
            <NumberInput
              label="Quantity to dispatch"
              description={
                selectedStore ? `Remaining: ${remainingForStore}` : 'Select a store first'
              }
              value={execQty}
              onChange={(v) => setExecQty(Number(v))}
              min={0}
              max={remainingForStore}
            />
            <TextInput
              label="Commodity grade"
              value={execGrade}
              onChange={(e) => setExecGrade(e.target.value)}
            />
            {needsShortageReason && (
              <Textarea
                label="Shortage reason"
                required
                value={shortageReason}
                onChange={(e) => setShortageReason(e.target.value)}
                placeholder="Explain why less than remaining is dispatched"
              />
            )}
            <Button
              loading={executionMutation.isPending}
              disabled={!execStoreId || execQty <= 0}
              onClick={() => executionMutation.mutate()}
            >
              Record dispatch
            </Button>
          </Stack>
        </Card>
      )}

      {!isCompleted && !hasStoreSplits && (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
          No store splits are assigned yet. Add and save store splits first.
        </Alert>
      )}

      {canDriverConfirm && (
        <Alert color="blue" icon={<IconTruckDelivery size={16} />}>
          Dispatch recorded.{' '}
          {driverPhoneRequired
            ? 'Enter the driver phone number, then confirm pickup to generate the GIN.'
            : 'Confirm driver pickup to generate the GIN and continue loading the truck.'}
        </Alert>
      )}

      {showStackSection && (
        <Card withBorder padding="lg">
          <Title order={5} mb="xs">
            Stack allocations {gin ? `(GIN ${gin.reference_no})` : ''}
          </Title>
          <Text size="sm" c={allocationsMatch ? 'dimmed' : 'orange'} mb="sm">
            Dispatch qty: {dispatchTargetQty} · Allocated: {allocatedSum.toFixed(3)} · Remaining:{' '}
            {allocationRemaining.toFixed(3)}
          </Text>
          {stackStoreId <= 0 && (
            <Text size="sm" c="red" mb="sm">
              Could not resolve store from recorded dispatch. Reload the page or re-record execution.
            </Text>
          )}
          {!effectiveGinId && auth.driver_confirmed_at && (
            <Text size="sm" c="dimmed" mb="sm">
              GIN was generated on driver confirm. Reload if stack section is empty.
            </Text>
          )}
          <Group mb="sm">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={addStackRow}
              disabled={stackStoreId <= 0 || stackCommodityId <= 0}
            >
              Add stack row
            </Button>
          </Group>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Stack</Table.Th>
                <Table.Th>Qty</Table.Th>
                <Table.Th>Grade</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stackRows.map((row, idx) => (
                <Table.Tr key={row.clientKey}>
                  <Table.Td>
                    <Select
                      searchable
                      data={stackOptionsForRow(row, idx)}
                      value={row.stack_id ? String(row.stack_id) : null}
                      onChange={(v) => {
                        setAllocationsSaved(false);
                        const selected = (stacksData?.items ?? []).find((s) => s.id === Number(v));
                        const next = [...stackRows];
                        next[idx] = {
                          ...row,
                          stack_id: Number(v),
                          commodity_id: selected?.commodity_id ?? row.commodity_id,
                        };
                        setStackRows(next);
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      min={0}
                      max={maxQtyForRow(row, idx)}
                      value={row.quantity}
                      onChange={(v) => {
                        setAllocationsSaved(false);
                        const next = [...stackRows];
                        next[idx] = { ...row, quantity: Number(v) };
                        setStackRows(next);
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={row.commodity_grade}
                      onChange={(e) => {
                        setAllocationsSaved(false);
                        const next = [...stackRows];
                        next[idx] = { ...row, commodity_grade: e.target.value };
                        setStackRows(next);
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      color="red"
                      variant="light"
                      onClick={() => {
                        setAllocationsSaved(false);
                        setStackRows((p) => p.filter((_, i) => i !== idx));
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group mt="md">
            <Button
              loading={stackMutation.isPending}
              onClick={() => stackMutation.mutate()}
              disabled={!effectiveGinId || !stackRowsValid}
            >
              Save stack allocations
            </Button>
            <Button
              color="green"
              leftSection={<IconCheck size={16} />}
              loading={confirmGinMutation.isPending || stackMutation.isPending}
              disabled={!effectiveGinId || !stackRowsValid}
              onClick={() => confirmGinMutation.mutate()}
            >
              Finish dispatch (confirm GIN)
            </Button>
          </Group>
        </Card>
      )}

      {isCompleted && (
        <>
          <Alert color="green" icon={<IconCheck size={16} />}>
            Outbound dispatch complete. Stock was issued from the stacks below and recorded on GIN{' '}
            <Text span fw={600} style={{ fontFamily: 'monospace' }}>
              {ginRef ?? '—'}
            </Text>
            .
          </Alert>

          <Card withBorder padding="lg">
            <Title order={5} mb="sm">
              Transaction summary
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              <div>
                <Text size="xs" c="dimmed">
                  Dispatch reference
                </Text>
                <Text fw={600} style={{ fontFamily: 'monospace' }}>
                  {dispatchRef}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Authorization
                </Text>
                <Text fw={600} style={{ fontFamily: 'monospace' }}>
                  {auth.reference_no || `DA-${auth.id}`}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  GIN
                </Text>
                <Text fw={600} style={{ fontFamily: 'monospace' }}>
                  {ginRef ?? '—'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Store
                </Text>
                <Text fw={600}>
                  {stores.map((s) => s.store_name).filter(Boolean).join(', ') || '—'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Commodity / qty
                </Text>
                <Text fw={600}>
                  {stores.map((s) => `${s.commodity_name ?? 'Commodity'} (${s.authorized_quantity})`).join(', ') ||
                    auth.authorized_quantity}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  GIN status
                </Text>
                <Badge color="green" variant="light">
                  {completedGin?.status ?? 'Confirmed'}
                </Badge>
              </div>
              {ginConfirmedAt && (
                <div>
                  <Text size="xs" c="dimmed">
                    Completed at
                  </Text>
                  <Text fw={600}>
                    {new Date(ginConfirmedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Text>
                </div>
              )}
            </SimpleGrid>
          </Card>

          {stackAllocations.length > 0 && (
            <Card withBorder padding="lg">
              <Title order={5} mb="sm">
                Stacks used
              </Title>
              <Text size="sm" c="dimmed" mb="sm">
                Inventory was deducted from these stacks when the GIN was confirmed.
              </Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Stack</Table.Th>
                    <Table.Th>Store</Table.Th>
                    <Table.Th>Qty issued</Table.Th>
                    <Table.Th>Grade</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stackAllocations.map((a) => (
                    <Table.Tr key={a.id}>
                      <Table.Td>
                        <Text fw={600} style={{ fontFamily: 'monospace' }}>
                          {a.stack_code || `Stack #${a.stack_id}`}
                        </Text>
                      </Table.Td>
                      <Table.Td>{a.store_name ?? '—'}</Table.Td>
                      <Table.Td>{a.quantity}</Table.Td>
                      <Table.Td>{a.commodity_grade ?? '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}
