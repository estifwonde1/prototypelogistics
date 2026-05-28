import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Button,
  Group,
  Table,
  Text,
  Select,
  Card,
  Divider,
  ActionIcon,
  Tooltip,
  SimpleGrid,
} from '@mantine/core';
import { IconPlus, IconEye, IconCheckbox } from '@tabler/icons-react';
import { getDispatchOrderAuthorizations } from '../../api/dispatchOrderAuthorizations';
import { getDispatchOrders } from '../../api/dispatchOrders';
import { useAuthStore } from '../../store/authStore';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { DispatchOrderAuthorization, DispatchOrderV2 } from '../../types/dispatchV2';
import { formatDestinationAllocations } from '../../utils/dispatchAllocations';
import { getDispatchOrderReference } from '../../utils/dispatchOrderReference';
import { buildPendingRows } from '../../utils/dispatchAuthorizationUtils';
import {
  type DispatchAuthorizationBasePath,
  dispatchAuthorizationDetailPath,
  dispatchAuthorizationNewPath,
} from '../../utils/dispatchAuthorizationPaths';

export default function DispatchAuthorizationListPage({
  basePath,
}: {
  basePath: DispatchAuthorizationBasePath;
}) {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((s) => s.activeAssignment);
  const warehouseId = activeAssignment?.warehouse?.id;
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  const isWarehouseScope = basePath === 'warehouse';

  const {
    data: pendingOrders,
    isLoading: pendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: [
      'dispatch_orders',
      'awaiting_authorization',
      isWarehouseScope ? warehouseId : 'hub',
    ],
    queryFn: () =>
      getDispatchOrders(
        isWarehouseScope && warehouseId
          ? { warehouse_id: warehouseId, status: 'confirmed' }
          : { status: 'confirmed' }
      ),
    enabled: isWarehouseScope ? !!warehouseId : true,
  });

  const {
    data: authorizations,
    isLoading: authLoading,
    error: authError,
    refetch: refetchAuths,
  } = useQuery({
    queryKey: [
      'dispatch_order_authorizations',
      { warehouse_id: isWarehouseScope ? warehouseId : undefined, status: authStatus },
    ],
    queryFn: () =>
      getDispatchOrderAuthorizations({
        ...(isWarehouseScope && warehouseId ? { warehouse_id: warehouseId } : {}),
        status: authStatus || undefined,
      }),
    enabled: isWarehouseScope ? !!warehouseId : true,
  });

  const authRows = useMemo(() => authorizations ?? [], [authorizations]);

  const orderRefMap = useMemo(() => {
    const map = new Map<number, string>();
    (pendingOrders ?? []).forEach((o) => map.set(o.id, getDispatchOrderReference(o)));
    return map;
  }, [pendingOrders]);

  const awaitingAuthorization = useMemo(
    () =>
      buildPendingRows(
        pendingOrders ?? [],
        authorizations ?? [],
        isWarehouseScope ? warehouseId : undefined
      ),
    [pendingOrders, authorizations, isWarehouseScope, warehouseId]
  );

  const summaryCounts = useMemo(() => {
    const awaiting = awaitingAuthorization.length;
    const draft = authRows.filter((a) => String(a.status).toLowerCase() === 'draft').length;
    const confirmed = authRows.filter((a) => String(a.status).toLowerCase() === 'confirmed').length;
    const inProgress = authRows.filter((a) => {
      const s = String(a.status).toLowerCase();
      return s === 'in_progress' || s === 'partially_dispatched';
    }).length;
    return { awaiting, draft, confirmed, inProgress };
  }, [awaitingAuthorization, authRows]);

  if (isWarehouseScope && !warehouseId) {
    return (
      <Text c="red">
        No warehouse selected on your assignment. Switch workspace from role selection.
      </Text>
    );
  }

  const isLoading = pendingLoading || authLoading;
  const error = pendingError || authError;

  if (isLoading) return <LoadingState message="Loading dispatch work..." />;
  if (error) {
    return (
      <ErrorState
        message="Failed to load dispatch authorizations"
        onRetry={() => {
          refetchPending();
          refetchAuths();
        }}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Dispatch authorizations</Title>
        {awaitingAuthorization.length === 0 && (
          <Button
            leftSection={<IconPlus size={16} />}
            variant="light"
            onClick={() => navigate(dispatchAuthorizationNewPath(basePath))}
          >
            New authorization
          </Button>
        )}
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Awaiting authorization
          </Text>
          <Text size="xl" fw={700}>
            {summaryCounts.awaiting}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Draft
          </Text>
          <Text size="xl" fw={700}>
            {summaryCounts.draft}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Confirmed
          </Text>
          <Text size="xl" fw={700}>
            {summaryCounts.confirmed}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            In progress
          </Text>
          <Text size="xl" fw={700}>
            {summaryCounts.inProgress}
          </Text>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        <Group mb="xs" gap="xs">
          <IconCheckbox size={18} />
          <Text fw={600}>Confirmed dispatch orders awaiting authorization</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          The officer has confirmed a dispatch order where a warehouse is a{' '}
          <strong>source</strong>. Review the details and create an authorization to release stock
          to storekeepers.
        </Text>
        {awaitingAuthorization.length === 0 ? (
          <EmptyState message="No confirmed dispatch orders need authorization right now." />
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Dispatch reference</Table.Th>
                  {!isWarehouseScope && <Table.Th>Source warehouse</Table.Th>}
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Qty to Release</Table.Th>
                  <Table.Th>Destination(s)</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {awaitingAuthorization.map(({ order, warehouseId: whId, warehouseLabel }) => (
                  <PendingOrderRow
                    key={`${order.id}-${whId}`}
                    order={order}
                    warehouseId={whId}
                    warehouseLabel={warehouseLabel}
                    showWarehouse={!isWarehouseScope}
                    onAuthorize={() =>
                      navigate(
                        dispatchAuthorizationNewPath(basePath, {
                          dispatch_order_id: order.id,
                          warehouse_id: whId,
                        })
                      )
                    }
                  />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <Divider label="Authorizations you created" labelPosition="left" />

      <Group>
        <Select
          label="Filter by status"
          description="Filter authorization records you created."
          clearable
          placeholder="All statuses"
          data={[
            { value: 'draft', label: 'Draft' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'in_progress', label: 'In progress' },
            { value: 'completed', label: 'Completed' },
          ]}
          value={authStatus}
          onChange={setAuthStatus}
          w={260}
        />
      </Group>

      {authRows.length === 0 ? (
        <EmptyState message="No authorizations match this filter." />
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Auth Ref</Table.Th>
                <Table.Th>Dispatch reference</Table.Th>
                <Table.Th>Warehouse</Table.Th>
                <Table.Th>Authorized Qty</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {authRows.map((a) => {
                const dispatchRef = orderRefMap.get(a.dispatch_order_id) || `DO-${a.dispatch_order_id}`;
                return (
                  <Table.Tr key={a.id}>
                    <Table.Td style={{ fontWeight: 600 }}>
                      {a.reference_no || `DA-${a.id}`}
                    </Table.Td>
                    <Table.Td>{dispatchRef}</Table.Td>
                    <Table.Td>{a.warehouse?.label ?? `WH-${a.warehouse_id}`}</Table.Td>
                    <Table.Td>{a.authorized_quantity}</Table.Td>
                    <Table.Td>
                      <StatusBadge status={a.status_label ?? a.status} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        <Tooltip label="View authorization">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() =>
                              navigate(dispatchAuthorizationDetailPath(basePath, a.id))
                            }
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}

function PendingOrderRow({
  order,
  warehouseId,
  warehouseLabel,
  showWarehouse,
  onAuthorize,
}: {
  order: DispatchOrderV2;
  warehouseId: number;
  warehouseLabel: string;
  showWarehouse: boolean;
  onAuthorize: () => void;
}) {
  const lines = order.dispatch_order_lines ?? [];

  const linesForWarehouse = lines.filter((line) =>
    (line.source_allocations || []).some((s) => Number(s.warehouse_id) === Number(warehouseId))
  );

  const rowSpan = Math.max(linesForWarehouse.length, 1);

  if (linesForWarehouse.length === 0) {
    return (
      <Table.Tr>
        <Table.Td style={{ fontWeight: 600 }}>{getDispatchOrderReference(order)}</Table.Td>
        {showWarehouse && <Table.Td>{warehouseLabel}</Table.Td>}
        <Table.Td colSpan={3}>
          <Text size="sm" c="dimmed">
            No commodity lines allocated from this warehouse.
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'right' }}>
          <Button size="xs" onClick={onAuthorize}>
            Authorize
          </Button>
        </Table.Td>
      </Table.Tr>
    );
  }

  return (
    <>
      {linesForWarehouse.map((line, idx) => {
        const srcQty =
          (line.source_allocations ?? [])
            .filter((s) => Number(s.warehouse_id) === Number(warehouseId))
            .map((s) => `${s.quantity}${s.unit_name ? ` ${s.unit_name}` : ''}`)
            .join(', ') || `${line.quantity}${line.unit_name ? ` ${line.unit_name}` : ''}`;

        const destinations = formatDestinationAllocations(line);

        return (
          <Table.Tr key={line.id ?? `${order.id}-${idx}`}>
            {idx === 0 && (
              <>
                <Table.Td rowSpan={rowSpan} style={{ fontWeight: 600, verticalAlign: 'top' }}>
                  {getDispatchOrderReference(order)}
                </Table.Td>
                {showWarehouse && (
                  <Table.Td rowSpan={rowSpan} style={{ verticalAlign: 'top' }}>
                    {warehouseLabel}
                  </Table.Td>
                )}
              </>
            )}
            <Table.Td>
              <Text size="sm" fw={500}>
                {line.commodity_name || `Commodity #${line.commodity_id}`}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{srcQty}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{destinations}</Text>
            </Table.Td>
            {idx === 0 && (
              <Table.Td rowSpan={rowSpan} style={{ textAlign: 'right', verticalAlign: 'top' }}>
                <Button size="xs" onClick={onAuthorize}>
                  Authorize
                </Button>
              </Table.Td>
            )}
          </Table.Tr>
        );
      })}
    </>
  );
}

export { buildPendingRows, remainingQtyAtWarehouse, sourceQtyAtWarehouse } from '../../utils/dispatchAuthorizationUtils';
