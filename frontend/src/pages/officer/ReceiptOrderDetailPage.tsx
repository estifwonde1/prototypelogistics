import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Button,
  Group,
  Card,
  Table,
  Text,
  SimpleGrid,
  Dialog,
  Tabs,
  Select,
  Textarea,
  NumberInput,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  getReceiptOrder,
  confirmReceiptOrder,
  deleteReceiptOrder,
  assignReceiptOrder,
  getReceiptOrderAssignableManagers,
  reserveSpace,
  getReceiptOrderWorkflow,
} from '../../api/receiptOrders';
import { getStores } from '../../api/stores';
import { getWarehouses } from '../../api/warehouses';
import { getUnitReferences, getUomConversions } from '../../api/referenceData';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { AssignmentCard } from '../../components/common/AssignmentCard';
import { ReservationCard } from '../../components/common/ReservationCard';
import { WorkflowTimeline } from '../../components/common/WorkflowTimeline';
import ReceiptWarehouseAssignmentModal from '../../components/common/ReceiptWarehouseAssignmentModal';
import type { ApiError } from '../../types/common';
import { useMemo, useState } from 'react';
import type { ReceiptOrder } from '../../api/receiptOrders';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';
import { OFFICER_ROLE_SLUGS, normalizeRoleSlug } from '../../contracts/warehouse';

function formatReceiptDate(order: ReceiptOrder): string {
  const raw = order.received_date || order.expected_delivery_date;
  if (!raw) return '—';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function receiptSourceLabel(order: ReceiptOrder): string {
  const type = order.source_type?.trim();
  const label =
    order.source_name ||
    order.name ||
    (order.source_reference != null ? String(order.source_reference) : '');
  if (type && label) return `${type} — ${label}`;
  if (label) return label;
  if (type) return type;
  return '—';
}

function receiptLines(order: ReceiptOrder) {
  return order.receipt_order_lines ?? order.lines ?? [];
}

function normalizeOrderStatus(status: string | undefined): string {
  return String(status || '').toLowerCase().replace(/\s+/g, '_');
}

function totalReceiptOrderLineQuantity(order: ReceiptOrder): number {
  return receiptLines(order).reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
}

function totalSpaceReservedQuantity(
  reservations: NonNullable<ReceiptOrder['space_reservations']> | undefined
): number {
  if (!Array.isArray(reservations)) return 0;
  return reservations.reduce((sum, r) => {
    const st = String(r.status ?? '').toLowerCase();
    if (st === 'cancelled' || st === 'released') return sum;
    return sum + Number(r.reserved_quantity ?? 0);
  }, 0);
}

/** Line quantity for progress / context when a reservation targets a specific line (or single-line order). */
function lineQuantityForReservation(order: ReceiptOrder, reservation: { receipt_order_line_id?: number }): number {
  const lines = receiptLines(order);
  if (reservation.receipt_order_line_id != null) {
    const line = lines.find((l) => l.id === reservation.receipt_order_line_id);
    if (line) return Number(line.quantity ?? 0);
  }
  if (lines.length === 1) return Number(lines[0].quantity ?? 0);
  return totalReceiptOrderLineQuantity(order);
}

function ReceiptOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const isOfficerRole = roleSlug ? OFFICER_ROLE_SLUGS.includes(roleSlug) : false;
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('details');
  
  // Assignment form state
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showWarehouseAssignmentModal, setShowWarehouseAssignmentModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedAssignmentStoreId, setSelectedAssignmentStoreId] = useState<string | null>(null);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  
  // Space reservation form state
  const [showSpaceReservationForm, setShowSpaceReservationForm] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [reservedQuantity, setReservedQuantity] = useState<number>(0);
  const [spaceReservationNotes, setSpaceReservationNotes] = useState('');

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['receipt_orders', id],
    queryFn: () => getReceiptOrder(Number(id)),
  });

  const warehouseIdForStores = useMemo(() => {
    const wid = order?.warehouse_id ?? order?.destination_warehouse_id;
    return wid != null ? Number(wid) : null;
  }, [order]);

  const reservationTotals = useMemo(() => {
    if (!order) return { totalOrdered: 0, totalReserved: 0, remaining: 0 };
    const totalOrdered = totalReceiptOrderLineQuantity(order);
    const totalReserved = totalSpaceReservedQuantity(order.space_reservations);
    return {
      totalOrdered,
      totalReserved,
      remaining: Math.max(0, totalOrdered - totalReserved),
    };
  }, [order]);

  const canReserveSpace = useMemo(() => {
    if (!order) return false;
    if (isOfficerRole) return false;
    if (
      !['admin', 'superadmin', 'warehouse_manager', 'storekeeper'].includes(roleSlug || '')
    ) {
      return false;
    }

    const status = normalizeOrderStatus(order.status);
    if (status === 'draft' || status === 'completed') return false;

    const { totalOrdered, remaining } = reservationTotals;
    if (totalOrdered <= 0) return false;
    return remaining > 1e-6;
  }, [order, isOfficerRole, roleSlug, reservationTotals]);

  const showOfficerSpaceReservationHint = useMemo(() => {
    if (!order) return false;
    const status = normalizeOrderStatus(order.status);
    if (!isOfficerRole) return false;
    if (status === 'draft' || status === 'completed') return false;
    return ['confirmed', 'assigned', 'reserved', 'in_progress'].includes(status);
  }, [order, isOfficerRole]);

  const {
    data: stores = [],
    isLoading: storesLoading,
    isError: storesError,
  } = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStores(),
    enabled: showSpaceReservationForm && warehouseIdForStores != null && canReserveSpace,
  });

  const { data: allWarehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
    enabled: showWarehouseAssignmentModal,
  });

  const { data: allStores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStores(),
    enabled: showWarehouseAssignmentModal,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: () => getUnitReferences(),
    enabled: showWarehouseAssignmentModal,
  });

  const { data: uomConversions = [] } = useQuery({
    queryKey: ['reference-data', 'uom_conversions'],
    queryFn: () => getUomConversions(),
    enabled: showWarehouseAssignmentModal,
  });

  const storeSelectData = useMemo(() => {
    if (!warehouseIdForStores) return [];
    return stores
      .filter((s) => Number(s.warehouse_id) === warehouseIdForStores)
      .map((s) => ({ value: String(s.id), label: s.name }));
  }, [stores, warehouseIdForStores]);

  const { data: workflowEvents = [] } = useQuery({
    queryKey: ['receipt_orders', id, 'workflow'],
    queryFn: () => getReceiptOrderWorkflow(Number(id)),
    enabled: !!order && String(order.status).toLowerCase() !== 'draft',
  });

  const {
    data: assignableManagersPayload,
    isLoading: assignableManagersLoading,
    isError: assignableManagersError,
  } = useQuery({
    queryKey: ['receipt_orders', id, 'assignable_managers', roleSlug],
    queryFn: () => getReceiptOrderAssignableManagers(Number(id), isOfficerRole),
    enabled:
      !!order &&
      showAssignmentForm &&
      ['confirmed', 'assigned', 'reserved', 'in_progress'].includes(String(order.status).toLowerCase()),
  });

  const managerSelectData = useMemo(() => {
    const rows = assignableManagersPayload?.assignable_managers ?? [];
    const seen = new Set<string>();
    return rows
      .filter((m) => {
        const key = String(m.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((m) => ({
        value: String(m.id),
        label: `${m.name}${m.role === 'Storekeeper' && m.store_name ? ` (${m.store_name})` : ''}`,
      }));
  }, [assignableManagersPayload]);

  const assignmentStoreSelectData = useMemo(() => {
    const rows = assignableManagersPayload?.stores ?? [];
    return rows.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }));
  }, [assignableManagersPayload]);

  const selectedManager = useMemo(() => {
    const rows = assignableManagersPayload?.assignable_managers ?? [];
    return rows.find((m) => m.id === Number(selectedUserId));
  }, [assignableManagersPayload, selectedUserId]);

  const confirmMutation = useMutation({
    mutationFn: () => confirmReceiptOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Receipt Order confirmed successfully',
        color: 'green',
      });
      setConfirmDialogOpen(false);
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to confirm Receipt Order',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReceiptOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Receipt Order deleted successfully',
        color: 'green',
      });
      navigate(location.pathname.startsWith('/officer/') ? '/officer/receipt-orders' : '/receipt-orders');
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to delete Receipt Order',
        color: 'red',
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (payload: any) => assignReceiptOrder(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders', id] });
      notifications.show({
        title: 'Success',
        message: 'Assignment created successfully',
        color: 'green',
      });
      setShowAssignmentForm(false);
      setShowWarehouseAssignmentModal(false);
      setSelectedUserId(null);
      setSelectedAssignmentStoreId(null);
      setAssignmentNotes('');
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create assignment',
        color: 'red',
      });
    },
  });

  const reserveSpaceMutation = useMutation({
    mutationFn: (payload: any) => reserveSpace(Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders', id] });
      queryClient.invalidateQueries({ queryKey: ['receipt_orders', id, 'workflow'] });
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      notifications.show({
        title: 'Success',
        message: 'Space reservation created successfully',
        color: 'green',
      });
      setShowSpaceReservationForm(false);
      setSelectedStoreId(null);
      setReservedQuantity(0);
      setSpaceReservationNotes('');
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create space reservation',
        color: 'red',
      });
    },
  });

  const handleCreateAssignment = () => {
    if (isOfficerRole) {
      if (!selectedUserId) {
        notifications.show({
          title: 'Error',
          message: 'Please select a manager to assign',
          color: 'red',
        });
        return;
      }

      assignMutation.mutate({
        assignments: [{
          assigned_to_id: Number(selectedUserId),
          notes: assignmentNotes,
        }],
      });
    } else {
      if (!selectedAssignmentStoreId) {
        notifications.show({
          title: 'Error',
          message: 'Please select a store',
          color: 'red',
        });
        return;
      }

      const payload: any = {
        assignments: [{
          store_id: Number(selectedAssignmentStoreId),
          notes: assignmentNotes,
        }],
      };

      if (selectedUserId) {
        payload.assignments[0].assigned_to_id = Number(selectedUserId);
      }

      assignMutation.mutate(payload);
    }
  };

  const handleCreateSpaceReservation = () => {
    if (!selectedStoreId || !reservedQuantity) {
      notifications.show({
        title: 'Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }
    reserveSpaceMutation.mutate({
      reservations: [{
        store_id: Number(selectedStoreId),
        reserved_quantity: reservedQuantity,
        notes: spaceReservationNotes,
      }],
    });
  };

  const assignments = order?.assignments || [];
  const spaceReservations = order?.space_reservations || [];
  const lines = order ? receiptLines(order) : [];
  const isDraft = String(order?.status || '').toLowerCase() === 'draft';
  const canCreateGrn = can('grns', 'create') && !!order && !isDraft;
  const canUpdateOrder = can('receipt_orders', 'update');
  const canDeleteOrder = can('receipt_orders', 'delete');
  const canConfirmOrder = can('receipt_orders', 'confirm');
  const listPath = location.pathname.startsWith('/officer/') ? '/officer/receipt-orders' : '/receipt-orders';
  const hubScopedWarehouses = useMemo(() => {
    if (!order?.hub_id) return [];
    return allWarehouses.filter((warehouse) => Number(warehouse.hub_id) === Number(order.hub_id));
  }, [allWarehouses, order?.hub_id]);
  const assignedByLine = useMemo(() => {
    const result: Record<number, number> = {};
    assignments.forEach((assignment) => {
      const lineId = assignment.receipt_order_line_id;
      if (lineId == null) return;
      result[lineId] = (result[lineId] || 0) + Number(assignment.quantity ?? 0);
    });
    return result;
  }, [assignments]);
  const fullyAssigned = useMemo(() => {
    if (lines.length === 0) return false;
    return lines.every((line) => {
      const lineId = Number(line.id);
      const assigned = assignedByLine[lineId] || 0;
      return Number(line.quantity ?? 0) - assigned <= 0.000001;
    });
  }, [assignedByLine, lines]);
  const canHubAssignWarehouse =
    roleSlug === 'hub_manager' &&
    !isDraft &&
    normalizeOrderStatus(order?.status) !== 'completed' &&
    !fullyAssigned &&
    hubScopedWarehouses.length > 0;

  if (isLoading) {
    return <LoadingState message="Loading Receipt Order..." />;
  }

  if (error || !order) {
    return (
      <ErrorState
        message="Failed to load Receipt Order. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const isLoading_ = confirmMutation.isPending || deleteMutation.isPending || assignMutation.isPending || reserveSpaceMutation.isPending;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Receipt Order RO-{order.id}</Title>
          <Text c="dimmed" size="sm">
            Created on {new Date(order.created_at).toLocaleDateString()}
          </Text>
        </div>
        <Group gap="sm">
          {canReserveSpace && (
            <Button
              size="sm"
              onClick={() => {
                setActiveTab('space-reservations');
                setShowSpaceReservationForm(true);
                setReservedQuantity(
                  reservationTotals.remaining > 0 ? reservationTotals.remaining : 0
                );
              }}
            >
              {reservationTotals.totalReserved > 0 && reservationTotals.remaining > 0
                ? 'Reserve remaining space'
                : 'Reserve Space'}
            </Button>
          )}
          {canCreateGrn && (
            <Button
              size="sm"
              variant="light"
              onClick={() => navigate(`/grns/new?receipt_order_id=${order.id}`)}
            >
              Create GRN
            </Button>
          )}
          {canHubAssignWarehouse ? (
            <Button
              size="sm"
              onClick={() => {
                setActiveTab('assignments');
                setShowWarehouseAssignmentModal(true);
              }}
            >
              Assign Warehouse
            </Button>
          ) : null}
          <StatusBadge status={order.status} />
        </Group>
      </Group>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'details')}>
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          {!isDraft && (
            <>
              <Tabs.Tab value="assignments">Assignments</Tabs.Tab>
              <Tabs.Tab value="space-reservations">Space Reservations</Tabs.Tab>
              <Tabs.Tab value="workflow">Workflow Timeline</Tabs.Tab>
            </>
          )}
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <Stack gap="md">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Source
                    </Text>
                    <Text size="sm" fw={600} mt="xs">
                      {(() => {
                        const firstLine = lines[0];
                        const sourceType = firstLine?.source_type?.trim();
                        const sourceName = firstLine?.source_name?.trim();
                        if (sourceType && sourceName) return `${sourceType} — ${sourceName}`;
                        if (sourceName) return sourceName;
                        if (sourceType) return sourceType;
                        return receiptSourceLabel(order);
                      })()}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Received date
                    </Text>
                    <Text size="sm" fw={600} mt="xs">
                      {formatReceiptDate(order)}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Status
                    </Text>
                    <Text size="sm" fw={600} mt="xs">
                      {order.status}
                    </Text>
                  </div>
                </SimpleGrid>
                {(order.notes || order.description) && (
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Notes
                    </Text>
                    <Text size="sm" mt="xs">
                      {order.notes ?? order.description}
                    </Text>
                  </div>
                )}
              </Stack>
            </Card>

            <div>
              <Text size="sm" fw={600} mb="md">
                Destinations
              </Text>
              <Table.ScrollContainer minWidth={600}>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Commodity</Table.Th>
                      <Table.Th>Destination</Table.Th>
                      <Table.Th>Warehouse</Table.Th>
                      <Table.Th>Quantity</Table.Th>
                      <Table.Th>Unit</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lines.map((line, index) => {
                      // Parse destination from line notes: "Hub: Bole Hub" or "Warehouse: Bole Central"
                      const noteText = line.notes?.trim() || '';
                      const isHub = noteText.startsWith('Hub:');
                      const isWarehouse = noteText.startsWith('Warehouse:');
                      const destinationLabel = isHub
                        ? noteText.replace('Hub:', '').trim()
                        : isWarehouse
                          ? noteText.replace('Warehouse:', '').trim()
                          : noteText || '—';
                      const destinationType = isHub ? 'Hub' : isWarehouse ? 'Warehouse' : '—';

                      return (
                        <Table.Tr key={line.id ?? index}>
                          <Table.Td>
                            <Text fw={500}>
                              {line.commodity_name?.trim() ||
                                (line.commodity_id ? `Commodity #${line.commodity_id}` : '—')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {isHub ? (
                              <div>
                                <Text size="sm" fw={600}>{destinationLabel}</Text>
                                <Text size="xs" c="dimmed">Hub</Text>
                              </div>
                            ) : isWarehouse ? (
                              <div>
                                <Text size="sm" fw={600}>{destinationLabel}</Text>
                                <Text size="xs" c="dimmed">Warehouse</Text>
                              </div>
                            ) : (
                              <Text size="sm" c="dimmed">{destinationType}</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {isHub ? (
                              <Text size="sm" c="dimmed">Not yet assigned</Text>
                            ) : isWarehouse ? (
                              <Text size="sm" fw={500}>{destinationLabel}</Text>
                            ) : (
                              <Text size="sm" c="dimmed">—</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Text fw={600}>{line.quantity}</Text>
                          </Table.Td>
                          <Table.Td>
                            {line.unit_name?.trim() || (line.unit_id ? `Unit #${line.unit_id}` : '—')}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </div>

            <Group justify="flex-end">
              {isDraft && (
                <>
                  {canUpdateOrder ? (
                    <Button
                      variant="light"
                      onClick={() => navigate(`/officer/receipt-orders/${order.id}/edit`)}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {canDeleteOrder ? (
                    <Button
                      color="red"
                      variant="light"
                      onClick={() => deleteMutation.mutate()}
                      loading={isLoading_}
                    >
                      Delete
                    </Button>
                  ) : null}
                  {canConfirmOrder ? (
                    <Button
                      onClick={() => setConfirmDialogOpen(true)}
                      loading={isLoading_}
                    >
                      Confirm Order
                    </Button>
                  ) : null}
                </>
              )}
              {!isDraft && (
                <Button variant="light" onClick={() => navigate(listPath)}>
                  Back to List
                </Button>
              )}
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="assignments" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>Warehouse Assignments</Text>
              {canHubAssignWarehouse ? (
                <Button
                  size="sm"
                  onClick={() => setShowWarehouseAssignmentModal(true)}
                >
                  + Assign Warehouse
                </Button>
              ) : null}
              {roleSlug === 'warehouse_manager' && ['confirmed', 'assigned', 'reserved', 'in_progress'].includes(String(order.status).toLowerCase()) && (
                <Button
                  size="sm"
                  onClick={() => setShowAssignmentForm(true)}
                >
                  + Assign Store
                </Button>
              )}
              {isOfficerRole && String(order.status).toLowerCase() === 'confirmed' && (
                <Button
                  size="sm"
                  onClick={() => setShowAssignmentForm(true)}
                >
                  + Assign Manager
                </Button>
              )}
            </Group>

            {assignments.length === 0 ? (
              <Text c="dimmed">No assignments yet</Text>
            ) : (
              assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                />
              ))
            )}

            {showAssignmentForm && (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  {isOfficerRole ? (
                    <>
                      <Text fw={600}>Assign Manager</Text>
                      <Text size="sm" c="dimmed">
                        {order.hub_id
                          ? `Assign a Hub Manager for ${assignableManagersPayload?.hub_name || 'this hub'} to handle this receipt order.`
                          : `Assign a Warehouse Manager for ${assignableManagersPayload?.warehouse_name || 'this warehouse'} to handle this receipt order.`}
                      </Text>
                      {assignableManagersError ? (
                        <Text size="sm" c="red">
                          Could not load available managers.
                        </Text>
                      ) : null}
                      <Select
                        label="Manager"
                        placeholder={
                          assignableManagersLoading
                            ? 'Loading managers…'
                            : 'Select a manager to assign'
                        }
                        data={managerSelectData}
                        disabled={
                          assignableManagersLoading ||
                          (!assignableManagersError && managerSelectData.length === 0)
                        }
                        value={selectedUserId}
                        onChange={setSelectedUserId}
                        searchable
                        required
                      />
                      {!assignableManagersLoading &&
                      managerSelectData.length === 0 &&
                      !assignableManagersError ? (
                        <Text size="sm" c="dimmed">
                          No managers are assigned to this {order.hub_id ? 'hub' : 'warehouse'} in admin. Add a user under Hub Manager or Warehouse Manager roles.
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Text fw={600}>Assign Store for Commodity</Text>
                      <Text size="sm" c="dimmed">
                        Select the store where the commodity will be received. The storekeeper assigned to this store will be automatically notified.
                      </Text>
                      {assignableManagersError ? (
                        <Text size="sm" c="red">
                          Could not load available stores.
                        </Text>
                      ) : null}
                      <Select
                        label="Store"
                        placeholder={
                          assignableManagersLoading
                            ? 'Loading stores…'
                            : 'Select a store'
                        }
                        data={assignmentStoreSelectData}
                        disabled={
                          assignableManagersLoading ||
                          (!assignableManagersError && assignmentStoreSelectData.length === 0)
                        }
                        value={selectedAssignmentStoreId}
                        onChange={(val) => {
                          setSelectedAssignmentStoreId(val);
                          const store = assignableManagersPayload?.stores?.find(
                            (s) => s.id === Number(val)
                          );
                          if (store) {
                            const storekeeper = assignableManagersPayload?.assignable_managers?.find(
                              (m) => m.role === 'Storekeeper' && m.store_id === store.id
                            );
                            if (storekeeper) {
                              setSelectedUserId(String(storekeeper.id));
                            } else {
                              setSelectedUserId(null);
                            }
                          } else {
                            setSelectedUserId(null);
                          }
                        }}
                        required
                        searchable
                      />
                      {selectedAssignmentStoreId && selectedManager && (
                        <Text size="sm" c="dimmed">
                          Storekeeper: <strong>{selectedManager.name}</strong>
                        </Text>
                      )}
                      {selectedAssignmentStoreId && !selectedManager && (
                        <Text size="sm" c="orange">
                          No storekeeper is assigned to this store. The assignment will still be created.
                        </Text>
                      )}
                      {!assignableManagersLoading &&
                      assignmentStoreSelectData.length === 0 &&
                      !assignableManagersError ? (
                        <Text size="sm" c="dimmed">
                          No stores are available for this warehouse. Add stores first.
                        </Text>
                      ) : null}
                    </>
                  )}
                  <Textarea
                    label="Notes"
                    placeholder="Assignment notes..."
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                  />
                  <Group gap="sm">
                    <Button
                      onClick={handleCreateAssignment}
                      loading={isLoading_}
                    >
                      Create Assignment
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => setShowAssignmentForm(false)}
                    >
                      Cancel
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="space-reservations" pt="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>Reserved Space</Text>
              {canReserveSpace && (
                <Button
                  size="sm"
                  onClick={() => {
                    setShowSpaceReservationForm(true);
                    setReservedQuantity(
                      reservationTotals.remaining > 0 ? reservationTotals.remaining : 0
                    );
                  }}
                >
                  {reservationTotals.totalReserved > 0 && reservationTotals.remaining > 0
                    ? '+ Reserve remaining space'
                    : '+ Reserve Space'}
                </Button>
              )}
            </Group>

            {reservationTotals.totalOrdered > 0 ? (
              <Text size="sm" c="dimmed">
                Reserved {reservationTotals.totalReserved} of {reservationTotals.totalOrdered} units
                {reservationTotals.remaining > 0
                  ? ` (${reservationTotals.remaining} remaining)`
                  : ' — fully reserved'}
              </Text>
            ) : null}

            {showOfficerSpaceReservationHint ? (
              <Alert color="blue" variant="light">
                Space is reserved by warehouse staff at the destination warehouse. When they reserve space, it will
                appear here with warehouse and store details. Check the Workflow Timeline tab for status updates.
              </Alert>
            ) : null}

            {spaceReservations.length === 0 ? (
              <Text c="dimmed">No space reservations yet</Text>
            ) : (
              spaceReservations.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  type="space"
                  progressDenominator={lineQuantityForReservation(order, reservation)}
                />
              ))
            )}

            {showSpaceReservationForm && canReserveSpace && (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Select
                    label="Store"
                    placeholder={
                      storesLoading ? 'Loading stores…' : 'Select store'
                    }
                    data={storeSelectData}
                    disabled={storesLoading || !warehouseIdForStores}
                    value={selectedStoreId}
                    onChange={setSelectedStoreId}
                    searchable
                  />
                  {storesError ? (
                    <Text size="sm" c="red">
                      Could not load stores for this warehouse.
                    </Text>
                  ) : null}
                  {!storesLoading &&
                  warehouseIdForStores &&
                  storeSelectData.length === 0 &&
                  !storesError ? (
                    <Text size="sm" c="dimmed">
                      No stores found for this warehouse. Create stores first under
                      Admin &gt; Stores (or the Stores page).
                    </Text>
                  ) : null}
                  <NumberInput
                    label="Quantity to Reserve"
                    placeholder="Enter quantity"
                    value={reservedQuantity}
                    onChange={(value) => setReservedQuantity(Number(value))}
                    min={0}
                  />
                  <Textarea
                    label="Notes"
                    placeholder="Reservation notes..."
                    value={spaceReservationNotes}
                    onChange={(e) => setSpaceReservationNotes(e.target.value)}
                  />
                  <Group gap="sm">
                    <Button
                      onClick={handleCreateSpaceReservation}
                      loading={isLoading_}
                    >
                      Reserve Space
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => setShowSpaceReservationForm(false)}
                    >
                      Cancel
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="workflow" pt="md">
          <WorkflowTimeline events={workflowEvents} />
        </Tabs.Panel>
      </Tabs>

      <Dialog
        opened={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        title="Confirm Receipt Order?"
        size="sm"
      >
        <Text size="sm" mb="md">
          This will lock the order and create workflow for warehouse managers.
        </Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={() => setConfirmDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => confirmMutation.mutate()} loading={isLoading_}>
            Confirm
          </Button>
        </Group>
      </Dialog>

      <ReceiptWarehouseAssignmentModal
        opened={showWarehouseAssignmentModal}
        onClose={() => setShowWarehouseAssignmentModal(false)}
        receiptOrder={order}
        warehouses={hubScopedWarehouses}
        stores={allStores}
        units={units}
        uomConversions={uomConversions}
        onSubmit={(payload) => assignMutation.mutate(payload)}
        loading={isLoading_}
      />
    </Stack>
  );
}

export default ReceiptOrderDetailPage;
