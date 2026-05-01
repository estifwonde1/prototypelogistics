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
  TextInput,
  Alert,
  Divider,
  Badge,
  Progress,
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
  startStacking,
  finishStacking,
} from '../../api/receiptOrders';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { createInspection, getInspections } from '../../api/inspections';
import { getWarehouses } from '../../api/warehouses';
import { getUnitReferences, getUomConversions } from '../../api/referenceData';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ScopeBadge } from '../../components/common/ScopeBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { ReservationCard } from '../../components/common/ReservationCard';
import { WorkflowTimeline } from '../../components/common/WorkflowTimeline';
import ReceiptWarehouseAssignmentModal from '../../components/common/ReceiptWarehouseAssignmentModal';
import type { ApiError } from '../../types/common';
import { useMemo, useState } from 'react';
import type { ReceiptOrder } from '../../api/receiptOrders';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';
import { OFFICER_ROLE_SLUGS, normalizeRoleSlug } from '../../contracts/warehouse';
import type { Warehouse } from '../../types/warehouse';
import type { Store } from '../../types/store';
import type { Stack as StackType } from '../../types/stack';
import type { Inspection } from '../../types/inspection';
import type { UnitReference, UomConversion } from '../../types/referenceData';
import type { WorkflowEvent } from '../../types/assignment';

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

  // Stacking state
  const [stackingItems, setStackingItems] = useState<Array<{ stack_id: string; quantity: number }>>([{ stack_id: '', quantity: 0 }]);

  // Receipt recording state
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptQty, setReceiptQty] = useState<number | string>('');
  const [receiptCondition, setReceiptCondition] = useState<string | null>('Good');
  const [receiptGrade, setReceiptGrade] = useState('');
  const [receiptRemarks, setReceiptRemarks] = useState('');
  const [receiptLostQty, setReceiptLostQty] = useState<number | string>('');
  const [receiptLossType, setReceiptLossType] = useState<string | null>(null);
  
  // Assignment form state
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showWarehouseAssignmentModal, setShowWarehouseAssignmentModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedAssignmentStoreId, setSelectedAssignmentStoreId] = useState<string | null>(null);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [assignmentQuantity, setAssignmentQuantity] = useState<number>(0);
  
  // Space reservation form state
  const [showSpaceReservationForm, setShowSpaceReservationForm] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [reservedQuantity, setReservedQuantity] = useState<number>(0);
  const [spaceReservationNotes, setSpaceReservationNotes] = useState('');

  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const isWarehouseManager = roleSlug === 'warehouse_manager';

  const orderQuery = useQuery({
    queryKey: ['receipt_orders', id, { warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
    queryFn: () => {
      const params = isWarehouseManager && userWarehouseId ? { warehouse_id: userWarehouseId } : {};
      return getReceiptOrder(Number(id), params);
    },
  });
  const order = orderQuery.data as ReceiptOrder | undefined;
  const isLoading = orderQuery.isLoading;
  const error = orderQuery.error;
  const refetch = orderQuery.refetch;

  const warehouseIdForStores = useMemo(() => {
    const wid = order?.warehouse_id ?? order?.destination_warehouse_id ?? userWarehouseId;
    return wid != null ? Number(wid) : null;
  }, [order, userWarehouseId]);

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

  const storesQuery = useQuery({
    queryKey: ['stores', { warehouse_id: warehouseIdForStores }],
    queryFn: () => getStores({ warehouse_id: warehouseIdForStores ?? undefined }),
    enabled: showSpaceReservationForm && warehouseIdForStores != null && canReserveSpace,
  });
  const stores = (storesQuery.data as Store[]) || [];
  const storesLoading = storesQuery.isLoading;
  const storesError = storesQuery.isError;

  // Stacks for storekeeper's assigned store
  const stackingStoreId = useAuthStore((state) => state.activeAssignment?.store?.id ?? null);

  const stacksQuery = useQuery({
    queryKey: ['stacks', { store_id: stackingStoreId }],
    queryFn: () => getStacks({ store_id: stackingStoreId ?? undefined }),
    enabled: !!stackingStoreId && normalizeOrderStatus(order?.status ?? '') === 'in_progress',
  });
  const stackOptions = useMemo(() => {
    const stacks = (stacksQuery.data as StackType[]) || [];
    return stacks.map((s) => ({
      value: String(s.id),
      label: `${s.code}${s.quantity > 0 ? ` (${s.quantity} ${s.unit_name ?? ''})` : ' (empty)'}`,
    }));
  }, [stacksQuery.data]);

  // Inspections (receipt recordings) for this order
  const inspectionsQuery = useQuery({
    queryKey: ['inspections', { receipt_order_id: id }],
    queryFn: () => getInspections(),
    enabled: !!order && ['assigned', 'in_progress', 'completed'].includes(normalizeOrderStatus(order.status)),
    select: (data) => (data as Inspection[]).filter((i) => i.receipt_order_id === Number(id)),
  });
  const inspections = (inspectionsQuery.data as Inspection[]) || [];

  const allWarehousesQuery = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
    enabled: roleSlug === 'hub_manager' || showWarehouseAssignmentModal,
  });
  const allWarehouses = (allWarehousesQuery.data as Warehouse[]) || [];

  const allStoresQuery = useQuery({
    queryKey: ['stores', { warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
    queryFn: () => {
      // CRITICAL: Warehouse managers should only see stores from their active warehouse
      const params = isWarehouseManager && userWarehouseId ? { warehouse_id: userWarehouseId } : {};
      return getStores(params);
    },
    enabled: showWarehouseAssignmentModal,
  });
  const allStores = (allStoresQuery.data as Store[]) || [];

  const unitsQuery = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: () => getUnitReferences(),
    enabled: showWarehouseAssignmentModal,
  });
  const units = (unitsQuery.data as UnitReference[]) || [];

  const uomConversionsQuery = useQuery({
    queryKey: ['reference-data', 'uom_conversions'],
    queryFn: () => getUomConversions(),
    enabled: showWarehouseAssignmentModal,
  });
  const uomConversions = (uomConversionsQuery.data as UomConversion[]) || [];

  const storeSelectData = useMemo(() => {
    if (!warehouseIdForStores) return [];
    return stores
      .filter((s) => s.warehouse_id != null && Number(s.warehouse_id) === warehouseIdForStores)
      .map((s) => ({ value: String(s.id), label: s.name }));
  }, [stores, warehouseIdForStores]);

  const workflowEventsQuery = useQuery({
    queryKey: ['receipt_orders', id, 'workflow'],
    queryFn: () => getReceiptOrderWorkflow(Number(id)),
    enabled: !!order && String(order.status).toLowerCase() !== 'draft',
  });
  const workflowEvents = (workflowEventsQuery.data as WorkflowEvent[]) || [];

  const assignableManagersQuery = useQuery({
    queryKey: ['receipt_orders', id, 'assignable_managers', roleSlug, { warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
    queryFn: () => {
      const params = isWarehouseManager && userWarehouseId ? { warehouse_id: userWarehouseId } : {};
      console.log('=== Fetching Assignable Managers ===');
      console.log('isWarehouseManager:', isWarehouseManager);
      console.log('userWarehouseId:', userWarehouseId);
      console.log('isOfficerRole:', isOfficerRole);
      console.log('params:', params);
      return getReceiptOrderAssignableManagers(Number(id), isOfficerRole, params);
    },
    enabled:
      !!order &&
      showAssignmentForm &&
      ['confirmed', 'assigned', 'reserved', 'in_progress'].includes(String(order.status).toLowerCase()),
  });
  const assignableManagersPayload = assignableManagersQuery.data as any;
  const assignableManagersLoading = assignableManagersQuery.isLoading;
  const assignableManagersError = assignableManagersQuery.isError;

  const assignmentStoreSelectData = useMemo(() => {
    const rows = (assignableManagersPayload?.stores as any[]) ?? [];
    return rows.map((s: any) => ({ value: String(s.id), label: `${s.name} (${s.code})` }));
  }, [assignableManagersPayload]);

  const selectedManager = useMemo(() => {
    const rows = (assignableManagersPayload?.assignable_managers as any[]) ?? [];
    return rows.find((m: any) => m.id === Number(selectedUserId));
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
      setAssignmentQuantity(0);
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

  // ── Receipt recording mutation ───────────────────────────────────────────
  const recordReceiptMutation = useMutation({
    mutationFn: () => {
      if (!order) throw new Error('No order');
      const firstLine = lines[0];
      // Get warehouse from order or from assignments
      const warehouseId = order.warehouse_id ??
        assignments.find(a => a.warehouse_id != null)?.warehouse_id;
      if (!warehouseId) throw new Error('No warehouse assigned to this order yet. The warehouse manager must assign a warehouse first.');
      return createInspection({
        warehouse_id: warehouseId,
        inspected_on: new Date().toISOString().split('T')[0],
        inspector_id: useAuthStore.getState().userId ?? 0,
        receipt_order_id: order.id,
        status: 'confirmed',
        items: [{
          commodity_id: firstLine?.commodity_id ?? 0,
          unit_id: firstLine?.unit_id ?? 0,
          quantity_received: Number(receiptQty),
          quantity_lost: receiptLostQty ? Number(receiptLostQty) : undefined,
          quality_status: receiptCondition ?? 'Good',
          packaging_condition: receiptGrade || 'Standard',
          remarks: [
            receiptRemarks,
            receiptLossType && Number(receiptLostQty) > 0 ? `Loss type: ${receiptLossType}` : null,
          ].filter(Boolean).join(' | ') || undefined,
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections', { receipt_order_id: id }] });
      notifications.show({ title: 'Receipt Recorded', message: 'Receipt entry saved successfully.', color: 'green' });
      setReceiptQty('');
      setReceiptCondition('Good');
      setReceiptGrade('');
      setReceiptRemarks('');
      setReceiptLostQty('');
      setReceiptLossType(null);
      setShowReceiptForm(false);
      inspectionsQuery.refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<any>(error) ? error.response?.data?.error?.message : undefined) || 'Failed to record receipt',
        color: 'red',
      });
    },
  });

  // ── Stacking mutations ──────────────────────────────────────────────────
  const startStackingMutation = useMutation({
    mutationFn: () => startStacking(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders', id] });
      notifications.show({ title: 'Stacking Started', message: 'You can now add stack placements.', color: 'blue' });
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<any>(error) ? error.response?.data?.error?.message : undefined) || 'Failed to start stacking',
        color: 'red',
      });
    },
  });

  const finishStackingMutation = useMutation({
    mutationFn: () => finishStacking(Number(id), stackingItems.map(i => ({ stack_id: Number(i.stack_id), quantity: i.quantity }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_orders', id] });
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      notifications.show({ title: 'Stacking Completed', message: 'GRN has been generated and stacks updated.', color: 'green' });
      setStackingItems([{ stack_id: '', quantity: 0 }]);
      refetch();
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<any>(error) ? error.response?.data?.error?.message : undefined) || 'Failed to finish stacking',
        color: 'red',
      });
    },
  });


  const handleCreateAssignment = () => {
    if (!selectedAssignmentStoreId) {
      notifications.show({
        title: 'Error',
        message: 'Please select a store',
        color: 'red',
      });
      return;
    }

    // For warehouse managers, calculate based on their warehouse's allocation only
    let totalOrdered: number;
    let alreadyAssigned: number;
    
    if (isWarehouseManager && userWarehouseId) {
      // Find the warehouse-level assignment for this warehouse
      const warehouseAssignment = assignments.find(
        a => a.warehouse_id != null && Number(a.warehouse_id) === Number(userWarehouseId)
      );
      
      if (warehouseAssignment && warehouseAssignment.quantity != null) {
        // Use the warehouse's assigned quantity as the limit
        totalOrdered = Number(warehouseAssignment.quantity);
      } else {
        // Fallback: use total from lines (shouldn't happen in hub-scoped orders)
        totalOrdered = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
      }
      
      // Count only store assignments within this warehouse
      alreadyAssigned = assignments
        .filter(a => {
          if (a.store_id == null) return false;
          // Check if this store belongs to the current warehouse
          const store = (assignableManagersPayload?.stores as any[])?.find(
            (s: any) => Number(s.id) === Number(a.store_id)
          );
          return store && Number(store.warehouse_id) === Number(userWarehouseId);
        })
        .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
    } else {
      // For non-warehouse managers (officers, admins), use total from lines
      totalOrdered = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
      alreadyAssigned = assignments.filter(a => a.store_id != null).reduce((s, a) => s + Number(a.quantity ?? 0), 0);
    }
    
    const remaining = totalOrdered - alreadyAssigned;
    if (assignmentQuantity > remaining) {
      notifications.show({
        title: 'Validation Error',
        message: `Quantity exceeds remaining (${remaining.toLocaleString()} left)`,
        color: 'red',
      });
      return;
    }

    const payload: any = {
      assignments: [{
        store_id: Number(selectedAssignmentStoreId),
        quantity: assignmentQuantity > 0 ? assignmentQuantity : undefined,
        notes: assignmentNotes,
      }],
    };

    if (selectedUserId) {
      payload.assignments[0].assigned_to_id = Number(selectedUserId);
    }

    assignMutation.mutate(payload);
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
  const assignedLocationRows = useMemo(() => {
    const lineById = new Map(lines.map((line) => [Number(line.id), line]));
    const rows = assignments.map((assignment) => {
      const line = assignment.receipt_order_line_id != null
        ? lineById.get(Number(assignment.receipt_order_line_id))
        : undefined;
      const type = assignment.store_id != null
        ? 'Store'
        : assignment.warehouse_id != null
          ? 'Warehouse'
          : assignment.hub_id != null
            ? 'Hub'
            : 'Destination';
      const locationName =
        assignment.store_name ||
        assignment.warehouse_name ||
        assignment.hub_name ||
        'Assigned location';

      return {
        id: assignment.id,
        type,
        locationName,
        managerName: assignment.assigned_to_name || 'Assigned by facility setup',
        commodityName: line?.commodity_name || (line?.commodity_id ? `Commodity #${line.commodity_id}` : 'Order level'),
        quantity: assignment.quantity,
        status: assignment.status,
      };
    });

    if (rows.length > 0 || !order) return rows;

    if (order.warehouse_id) {
      return [{
        id: -1,
        type: 'Warehouse',
        locationName: order.warehouse_name || `Warehouse #${order.warehouse_id}`,
        managerName: 'Manager from facility setup',
        commodityName: 'Order destination',
        quantity: undefined,
        status: order.status,
      }];
    }

    if (order.hub_id) {
      return [{
        id: -1,
        type: 'Hub',
        locationName: order.hub_name || `Hub #${order.hub_id}`,
        managerName: 'Manager from facility setup',
        commodityName: 'Order destination',
        quantity: undefined,
        status: order.status,
      }];
    }

    return rows;
  }, [assignments, lines, order]);
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
    
    // Calculate total ordered quantity
    const totalOrdered = lines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
    
    // Calculate total assigned quantity to WAREHOUSES only
    // Hub-level assignments don't count as "fully assigned" because the hub manager
    // still needs to assign them down to warehouses
    const totalAssigned = assignments.reduce((sum, assignment) => {
      // Only count warehouse assignments (not hub or store-level assignments)
      if (assignment.warehouse_id != null) {
        return sum + Number(assignment.quantity ?? 0);
      }
      return sum;
    }, 0);
    
    // Check if fully assigned (with small tolerance for floating point)
    const remaining = totalOrdered - totalAssigned;
    return remaining <= 0.000001;
  }, [assignments, lines]);
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
          <Group gap="sm" align="center">
            <Title order={2}>Receipt Order RO-{order.id}</Title>
            <ScopeBadge locationName={order.location_name} hierarchicalLevel={order.hierarchical_level} />
          </Group>
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
                      Batch Number
                    </Text>
                    <Text size="sm" fw={600} mt="xs" style={{ fontFamily: 'monospace' }}>
                      {lines[0]?.commodity_batch_no?.trim() || '—'}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Receipt Created
                    </Text>
                    <Text size="sm" fw={600} mt="xs">
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Expected Delivery Date
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
                      <Table.Th>Notes</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lines.map((line, index) => {
                      const noteText = line.notes?.trim() || '';
                      const pipeIndex = noteText.indexOf(' | ');
                      const destinationPart = pipeIndex >= 0 ? noteText.slice(0, pipeIndex) : noteText;
                      const officerNotes = pipeIndex >= 0 ? noteText.slice(pipeIndex + 3) : '';
                      const isHub = destinationPart.startsWith('Hub:');
                      const isWarehouse = destinationPart.startsWith('Warehouse:');
                      const destinationLabel = isHub
                        ? destinationPart.replace('Hub:', '').trim()
                        : isWarehouse
                          ? destinationPart.replace('Warehouse:', '').trim()
                          : destinationPart || '—';

                      // Find assigned warehouse from assignments for this line (or order-level)
                      const assignedWarehouse = assignments.find(a =>
                        a.warehouse_id != null &&
                        (a.receipt_order_line_id == null || a.receipt_order_line_id === line.id)
                      );
                      const assignedWarehouseName = assignedWarehouse?.warehouse_name?.trim() || null;

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
                              <Text size="sm" c="dimmed">—</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {isHub ? (
                              assignedWarehouseName ? (
                                <Text size="sm" fw={500}>{assignedWarehouseName}</Text>
                              ) : (
                                <Text size="sm" c="dimmed">Not yet assigned</Text>
                              )
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
                          <Table.Td>
                            <Text size="sm" c={officerNotes ? undefined : 'dimmed'}>
                              {officerNotes || '—'}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </div>

            {/* ── Receipt Recording Section ── */}
            {(() => {
              const orderStatus = normalizeOrderStatus(order.status);
              const isStorekeeper = roleSlug === 'storekeeper';
              if (!isStorekeeper) return null;
              if (!['assigned', 'in_progress'].includes(orderStatus)) return null;

              const totalAuthorized = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
              const totalRecorded = inspections.reduce((s, i) => {
                return s + (i.inspection_items ?? []).reduce((ss, item) => ss + Number(item.quantity_received ?? 0) + Number(item.quantity_lost ?? 0), 0);
              }, 0);
              const remaining = Math.max(0, totalAuthorized - totalRecorded);
              const progressPct = totalAuthorized > 0 ? Math.min(100, (totalRecorded / totalAuthorized) * 100) : 0;

              return (
                <Card withBorder padding="lg" mt="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text fw={700} size="lg">Receipt Recording</Text>
                      <Badge color={totalRecorded >= totalAuthorized ? 'green' : 'blue'} size="lg">
                        {totalRecorded.toLocaleString()} / {totalAuthorized.toLocaleString()} recorded
                      </Badge>
                    </Group>

                    <Progress value={progressPct} color={totalRecorded >= totalAuthorized ? 'green' : 'blue'} size="md" />

                    <Group gap="xl">
                      <Text size="sm">Authorized: <strong>{totalAuthorized.toLocaleString()}</strong></Text>
                      <Text size="sm">Recorded: <strong>{totalRecorded.toLocaleString()}</strong></Text>
                      <Text size="sm" c={remaining > 0 ? 'dimmed' : 'green'}>
                        Remaining: <strong>{remaining.toLocaleString()}</strong>
                      </Text>
                    </Group>

                    {/* Existing inspection records */}
                    {inspections.length > 0 && (
                      <Table.ScrollContainer minWidth={500}>
                        <Table striped>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Qty Received</Table.Th>
                              <Table.Th>Qty Lost</Table.Th>
                              <Table.Th>Condition</Table.Th>
                              <Table.Th>Grade</Table.Th>
                              <Table.Th>Remarks</Table.Th>
                              <Table.Th>Recorded On</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {inspections.flatMap((inspection) =>
                              (inspection.inspection_items ?? []).map((item, idx) => (
                                <Table.Tr key={`${inspection.id}-${idx}`}>
                                  <Table.Td><Text fw={600}>{Number(item.quantity_received).toLocaleString()}</Text></Table.Td>
                                  <Table.Td>
                                    {item.quantity_lost && Number(item.quantity_lost) > 0 ? (
                                      <Badge color="red" variant="light">{Number(item.quantity_lost).toLocaleString()} lost</Badge>
                                    ) : (
                                      <Text size="sm" c="dimmed">—</Text>
                                    )}
                                  </Table.Td>
                                  <Table.Td><Badge color={item.quality_status === 'Good' ? 'green' : 'orange'} variant="light">{item.quality_status}</Badge></Table.Td>
                                  <Table.Td>{item.packaging_condition || '—'}</Table.Td>
                                  <Table.Td><Text size="sm" c="dimmed">{item.remarks || '—'}</Text></Table.Td>
                                  <Table.Td><Text size="xs" c="dimmed">{new Date(inspection.inspected_on).toLocaleDateString()}</Text></Table.Td>
                                </Table.Tr>
                              ))
                            )}
                          </Table.Tbody>
                        </Table>
                      </Table.ScrollContainer>
                    )}

                    {/* Add new receipt entry */}
                    {orderStatus !== 'completed' && remaining > 0 && (
                      <>
                        {!showReceiptForm ? (
                          <Button variant="light" size="sm" onClick={() => setShowReceiptForm(true)}>
                            + Add Receipt Entry
                          </Button>
                        ) : (
                          <Card withBorder padding="md" radius="sm">
                            <Stack gap="sm">
                              <Text fw={600} size="sm">New Receipt Entry</Text>
                              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                                <NumberInput
                                  label="Quantity Received"
                                  placeholder="Enter quantity"
                                  value={receiptQty}
                                  onChange={(val) => setReceiptQty(val)}
                                  min={0}
                                  max={remaining > 0 ? remaining : undefined}
                                  description={`Max: ${remaining.toLocaleString()} remaining`}
                                  error={Number(receiptQty) > remaining && remaining > 0 ? `Exceeds remaining (${remaining.toLocaleString()})` : null}
                                  required
                                />
                                <Select
                                  label="Condition"
                                  data={['Good', 'Damaged', 'Infested', 'Wet', 'Other']}
                                  value={receiptCondition}
                                  onChange={setReceiptCondition}
                                  required
                                />
                                <Select
                                  label="Grade"
                                  placeholder="Select grade"
                                  data={['Grade 1', 'Grade 2', 'Grade 3', 'Grade A', 'Grade B', 'Grade C', 'Substandard', 'Unknown']}
                                  value={receiptGrade || null}
                                  onChange={(val) => setReceiptGrade(val ?? '')}
                                />
                                <TextInput
                                  label="Remarks"
                                  placeholder="Any notes about the condition"
                                  value={receiptRemarks}
                                  onChange={(e) => setReceiptRemarks(e.target.value)}
                                />
                              </SimpleGrid>
                              {/* Lost Commodity — only show when received < authorized */}
                              {Number(receiptQty) > 0 && Number(receiptQty) < remaining && (
                                <>
                                  <Divider label="Lost Commodity (optional)" labelPosition="left" />
                                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                                    <NumberInput
                                      label="Quantity Lost"
                                      placeholder="How many were lost?"
                                      value={receiptLostQty}
                                      onChange={(val) => setReceiptLostQty(val)}
                                      min={0}
                                      error={(() => {
                                        const received = Number(receiptQty) || 0;
                                        const lost = Number(receiptLostQty) || 0;
                                        if (received + lost > remaining) return `Received + Lost (${received + lost}) exceeds authorized (${remaining.toLocaleString()})`;
                                        return null;
                                      })()}
                                      description="Bags that were dispatched but did not arrive"
                                    />
                                    <Select
                                      label="Loss Type"
                                      placeholder="Select reason"
                                      data={['Theft', 'Damage', 'Infested', 'Wet', 'Other']}
                                      value={receiptLossType}
                                      onChange={setReceiptLossType}
                                    />
                                  </SimpleGrid>
                                </>
                              )}
                              <Group gap="sm">
                                <Button
                                  size="sm"
                                  onClick={() => recordReceiptMutation.mutate()}
                                  loading={recordReceiptMutation.isPending}
                                  disabled={
                                    !receiptQty ||
                                    Number(receiptQty) <= 0 ||
                                    Number(receiptQty) > remaining ||
                                    Number(receiptQty) + Number(receiptLostQty || 0) > remaining
                                  }
                                >
                                  Save Entry
                                </Button>
                                <Button size="sm" variant="light" onClick={() => setShowReceiptForm(false)}>
                                  Cancel
                                </Button>
                              </Group>
                            </Stack>
                          </Card>
                        )}
                      </>
                    )}
                  </Stack>
                </Card>
              );
            })()}

            {/* ── Stacking Section ── */}
            {(() => {
              const orderStatus = normalizeOrderStatus(order.status);
              const isStorekeeper = roleSlug === 'storekeeper';
              const canStartStacking = (isStorekeeper || roleSlug === 'warehouse_manager' || roleSlug === 'admin' || roleSlug === 'superadmin') &&
                ['confirmed', 'assigned', 'reserved'].includes(orderStatus);
              const isStacking = orderStatus === 'in_progress';
              const isCompleted = orderStatus === 'completed';

              if (!canStartStacking && !isStacking && !isCompleted) return null;

              const totalOrdered = lines.reduce((sum, l) => sum + Number(l.quantity ?? 0), 0);
              // Total to stack = quantity actually received (excludes lost)
              const totalToStack = inspections.length > 0
                ? inspections.reduce((s, i) =>
                    s + (i.inspection_items ?? []).reduce((ss, item) => ss + Number(item.quantity_received ?? 0), 0), 0)
                : totalOrdered;
              const totalStacked = stackingItems.reduce((sum, i) => sum + i.quantity, 0);
              const remaining = totalToStack - totalStacked;
              const progressPct = totalToStack > 0 ? Math.min(100, (totalStacked / totalToStack) * 100) : 0;

              // For storekeepers: require at least one receipt recording before stacking
              const totalRecorded = inspections.reduce((s, i) =>
                s + (i.inspection_items ?? []).reduce((ss, item) => ss + Number(item.quantity_received ?? 0) + Number(item.quantity_lost ?? 0), 0), 0);
              const hasReceiptRecording = roleSlug !== 'storekeeper' || totalRecorded > 0;

              return (
                <Card withBorder padding="lg" mt="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text fw={700} size="lg">Stacking</Text>
                      {isCompleted && <Badge color="green" size="lg">Stacking Completed</Badge>}
                      {isStacking && <Badge color="blue" size="lg">In Progress</Badge>}
                    </Group>

                    {canStartStacking && (
                      <Alert color={hasReceiptRecording ? 'blue' : 'yellow'} variant="light">
                        {hasReceiptRecording
                          ? 'Receipt recorded. Click "Start Stacking" to begin placing goods into stacks.'
                          : 'Record the receipt above (quantity, condition, grade) before you can start stacking.'}
                      </Alert>
                    )}

                    {isStacking && (
                      <>
                        <Group>
                          <Text size="sm">Total to stack: <strong>{totalToStack.toLocaleString()}</strong></Text>
                          <Text size="sm">Stacked so far: <strong>{totalStacked}</strong></Text>
                          <Text size="sm" c={remaining < 0 ? 'red' : remaining === 0 ? 'green' : 'dimmed'}>
                            Remaining: <strong>{remaining}</strong>
                          </Text>
                        </Group>
                        <Progress value={progressPct} color={remaining === 0 ? 'green' : 'blue'} size="md" />

                        <Divider label="Add Stack Placement" labelPosition="left" />

                        {stackingItems.map((item, idx) => (
                          <Group key={idx} gap="sm" align="flex-end">
                            <Text size="sm" w={24} mb={6}>{idx + 1}.</Text>
                            <Select
                              label="Stack"
                              placeholder={stacksQuery.isLoading ? 'Loading stacks…' : stackOptions.length === 0 ? 'No stacks in your store' : 'Select a stack'}
                              data={stackOptions}
                              value={item.stack_id || null}
                              onChange={(val) => {
                                const next = [...stackingItems];
                                next[idx] = { ...next[idx], stack_id: val || '' };
                                setStackingItems(next);
                              }}
                              searchable
                              style={{ flex: 2 }}
                            />
                            <NumberInput
                              label="Quantity"
                              placeholder="Qty"
                              value={item.quantity || ''}
                              onChange={(val) => {
                                const next = [...stackingItems];
                                next[idx] = { ...next[idx], quantity: Number(val) || 0 };
                                setStackingItems(next);
                              }}
                              min={0}
                              style={{ flex: 1 }}
                            />
                            <Button
                              variant="subtle"
                              color="red"
                              size="xs"
                              mb={2}
                              onClick={() => {
                                if (stackingItems.length > 1) {
                                  setStackingItems(stackingItems.filter((_, i) => i !== idx));
                                }
                              }}
                              disabled={stackingItems.length <= 1}
                            >
                              Remove
                            </Button>
                          </Group>
                        ))}

                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => setStackingItems([...stackingItems, { stack_id: '', quantity: 0 }])}
                        >
                          + Add Stack Placement
                        </Button>
                      </>
                    )}

                    {isCompleted && (
                      <Alert color="green" variant="light">
                        Stacking is complete. GRN has been generated and stack quantities updated.
                      </Alert>
                    )}
                  </Stack>
                </Card>
              );
            })()}

            <Group justify="flex-end">
              {(() => {
                const orderStatus = normalizeOrderStatus(order.status);
                const canStartStacking = (roleSlug === 'storekeeper' || roleSlug === 'warehouse_manager' || roleSlug === 'admin' || roleSlug === 'superadmin') &&
                  ['confirmed', 'assigned', 'reserved'].includes(orderStatus);
                const isStacking = orderStatus === 'in_progress';
                const totalRecorded = inspections.reduce((s, i) =>
                  s + (i.inspection_items ?? []).reduce((ss, item) => ss + Number(item.quantity_received ?? 0) + Number(item.quantity_lost ?? 0), 0), 0);
                const hasReceiptRecording = roleSlug !== 'storekeeper' || totalRecorded > 0;

                return (
                  <>
                    {canStartStacking && (
                      <Button
                        color="blue"
                        onClick={() => startStackingMutation.mutate()}
                        loading={startStackingMutation.isPending}
                        disabled={!hasReceiptRecording}
                        title={!hasReceiptRecording ? 'Record receipt first' : undefined}
                      >
                        Start Stacking
                      </Button>
                    )}
                    {isStacking && (
                      <Button
                        color="green"
                        onClick={() => finishStackingMutation.mutate()}
                        loading={finishStackingMutation.isPending}
                        disabled={stackingItems.every(i => !i.stack_id || i.quantity <= 0)}
                      >
                        Finish Stacking
                      </Button>
                    )}
                  </>
                );
              })()}
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
              <Text fw={600}>Assigned Locations</Text>
              {canHubAssignWarehouse ? (
                <Button
                  size="sm"
                  onClick={() => setShowWarehouseAssignmentModal(true)}
                >
                  + Assign Warehouse
                </Button>
              ) : null}
              {roleSlug === 'warehouse_manager' && ['confirmed', 'assigned', 'reserved', 'in_progress'].includes(String(order.status).toLowerCase()) && (() => {
                const totalOrdered = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
                const totalStoreAssigned = assignments.filter(a => a.store_id != null).reduce((s, a) => s + Number(a.quantity ?? 0), 0);
                if (totalOrdered > 0 && totalStoreAssigned >= totalOrdered) return null;
                return (
                  <Button size="sm" onClick={() => setShowAssignmentForm(true)}>
                    + Assign Store
                  </Button>
                );
              })()}
            </Group>

            {assignedLocationRows.length === 0 ? (
              <Text c="dimmed">No assigned locations yet</Text>
            ) : (
              <Table.ScrollContainer minWidth={760}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Assigned Location</Table.Th>
                      <Table.Th>Manager</Table.Th>
                      <Table.Th>Commodity / Scope</Table.Th>
                      <Table.Th>Quantity</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {assignedLocationRows.map((row) => (
                      <Table.Tr key={row.id}>
                        <Table.Td>
                          <Badge variant="light">{row.type}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600}>{row.locationName}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{row.managerName}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{row.commodityName}</Text>
                        </Table.Td>
                        <Table.Td>
                          {row.quantity != null ? (
                            <Text fw={600}>{Number(row.quantity).toLocaleString()}</Text>
                          ) : (
                            <Text size="sm" c="dimmed">All order lines</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <StatusBadge status={row.status} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}

            {showAssignmentForm && (
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start" mb="md">
                    <Stack gap={2} style={{ flex: 1 }}>
                      {isOfficerRole ? (
                        <>
                          <Text fw={600}>Assign Manager</Text>
                          <Text size="sm" c="dimmed">
                            {order.hub_id
                              ? `Assign a Hub Manager for ${assignableManagersPayload?.hub_name || 'this hub'} to handle this receipt order.`
                              : `Assign a Warehouse Manager for ${assignableManagersPayload?.warehouse_name || 'this warehouse'} to handle this receipt order.`}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text fw={600}>Assign Store for Commodity</Text>
                          <Text size="sm" c="dimmed">
                            Select the store where the commodity will be received. The storekeeper assigned to this store will be automatically notified.
                          </Text>
                        </>
                      )}
                    </Stack>
                    <Group gap="sm">
                      <Button
                        variant="light"
                        onClick={() => setShowAssignmentForm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateAssignment}
                        loading={isLoading_}
                      >
                        {isOfficerRole ? 'Create Assignment' : 'Create Assignment'}
                      </Button>
                    </Group>
                  </Group>

                  {isOfficerRole ? (
                    <Stack gap="md">
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
                        data={[]}
                        disabled={
                          assignableManagersLoading ||
                          !assignableManagersError
                        }
                        value={selectedUserId}
                        onChange={setSelectedUserId}
                        searchable
                        required
                      />
                      {!assignableManagersLoading &&
                      false &&
                      !assignableManagersError ? (
                        <Text size="sm" c="dimmed">
                          No managers are assigned to this {order?.hub_id ? 'hub' : 'warehouse'} in admin. Add a user under Hub Manager or Warehouse Manager roles.
                        </Text>
                      ) : null}
                    </Stack>
                  ) : (
                    <Stack gap="md">
                      {assignableManagersError ? (
                        <Text size="sm" c="red">
                          Could not load available stores.
                        </Text>
                      ) : null}
                      
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <Stack gap="xs">
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
                              const store = (assignableManagersPayload?.stores as any[])?.find(
                                (s: any) => Number(s.id) === Number(val)
                              );
                              
                              if (store) {
                                const managers = assignableManagersPayload?.assignable_managers as any[] || [];
                                
                                // Find storekeeper for this store
                                // A storekeeper matches if:
                                // 1. They have a store_id that matches this store, OR
                                // 2. They have a warehouse_id that matches this store's warehouse (warehouse-level storekeeper)
                                const storekeeper = managers.find((m: any) => {
                                  const isStorekeeper = m.role === 'Storekeeper';
                                  const matchesStore = Number(m.store_id) === Number(store.id);
                                  const matchesWarehouse = m.warehouse_id && Number(m.warehouse_id) === Number(store.warehouse_id);
                                  return isStorekeeper && (matchesStore || matchesWarehouse);
                                });
                                
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
                          {assignableManagersLoading && selectedAssignmentStoreId && (
                            <Text size="xs" c="dimmed">
                              Loading storekeeper information...
                            </Text>
                          )}
                          {!assignableManagersLoading && selectedAssignmentStoreId && selectedManager && (
                            <Text size="xs" c="dimmed">
                              Storekeeper: <strong>{selectedManager.name}</strong>
                            </Text>
                          )}
                          {!assignableManagersLoading && selectedAssignmentStoreId && !selectedManager && (
                            <Text size="xs" c="orange">
                              No storekeeper is assigned to this store.
                            </Text>
                          )}
                        </Stack>

                        <NumberInput
                          label="Quantity to assign to this store"
                          placeholder={(() => {
                            if (isWarehouseManager && userWarehouseId) {
                              const warehouseAssignment = assignments.find(
                                a => a.warehouse_id != null && Number(a.warehouse_id) === Number(userWarehouseId)
                              );
                              const warehouseTotal = warehouseAssignment?.quantity 
                                ? Number(warehouseAssignment.quantity) 
                                : lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
                              return `Max: ${warehouseTotal.toLocaleString()}`;
                            }
                            return `Max: ${lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0).toLocaleString()}`;
                          })()}
                          value={assignmentQuantity || ''}
                          onChange={(val) => setAssignmentQuantity(Number(val) || 0)}
                          min={0}
                          description={(() => {
                            if (isWarehouseManager && userWarehouseId) {
                              const warehouseAssignment = assignments.find(
                                a => a.warehouse_id != null && Number(a.warehouse_id) === Number(userWarehouseId)
                              );
                              const warehouseTotal = warehouseAssignment?.quantity 
                                ? Number(warehouseAssignment.quantity) 
                                : lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
                              const alreadyAssigned = assignments
                                .filter(a => {
                                  if (a.store_id == null) return false;
                                  const store = (assignableManagersPayload?.stores as any[])?.find(
                                    (s: any) => Number(s.id) === Number(a.store_id)
                                  );
                                  return store && Number(store.warehouse_id) === Number(userWarehouseId);
                                })
                                .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
                              return `Your warehouse allocation: ${warehouseTotal.toLocaleString()} — already store-assigned: ${alreadyAssigned.toLocaleString()}`;
                            }
                            const totalOrdered = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
                            const alreadyAssigned = assignments.filter(a => a.store_id != null).reduce((s, a) => s + Number(a.quantity ?? 0), 0);
                            return `Total ordered: ${totalOrdered.toLocaleString()} — already store-assigned: ${alreadyAssigned.toLocaleString()}`;
                          })()}
                          error={(() => {
                            let totalOrdered: number;
                            let alreadyAssigned: number;
                            
                            if (isWarehouseManager && userWarehouseId) {
                              const warehouseAssignment = assignments.find(
                                a => a.warehouse_id != null && Number(a.warehouse_id) === Number(userWarehouseId)
                              );
                              totalOrdered = warehouseAssignment?.quantity 
                                ? Number(warehouseAssignment.quantity) 
                                : lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
                              alreadyAssigned = assignments
                                .filter(a => {
                                  if (a.store_id == null) return false;
                                  const store = (assignableManagersPayload?.stores as any[])?.find(
                                    (s: any) => Number(s.id) === Number(a.store_id)
                                  );
                                  return store && Number(store.warehouse_id) === Number(userWarehouseId);
                                })
                                .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
                            } else {
                              totalOrdered = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
                              alreadyAssigned = assignments.filter(a => a.store_id != null).reduce((s, a) => s + Number(a.quantity ?? 0), 0);
                            }
                            
                            const remaining = totalOrdered - alreadyAssigned;
                            if (assignmentQuantity > remaining) return `Exceeds remaining quantity (${remaining.toLocaleString()} left)`;
                            return null;
                          })()}
                        />
                      </SimpleGrid>
                      {!assignableManagersLoading &&
                      assignmentStoreSelectData.length === 0 &&
                      !assignableManagersError ? (
                        <Text size="sm" c="dimmed">
                          No stores are available for this warehouse. Add stores first.
                        </Text>
                      ) : null}
                    </Stack>
                  )}
                  
                  <Textarea
                    label="Notes"
                    placeholder="Assignment notes..."
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                    rows={2}
                  />

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
                  <Group justify="space-between" align="center" mb="xs">
                    <Text fw={600}>Reserve Space</Text>
                    <Group gap="sm">
                      <Button
                        variant="light"
                        onClick={() => setShowSpaceReservationForm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateSpaceReservation}
                        loading={isLoading_}
                      >
                        Reserve Space
                      </Button>
                    </Group>
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
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
                    <NumberInput
                      label="Quantity to Reserve"
                      placeholder="Enter quantity"
                      value={reservedQuantity}
                      onChange={(value) => setReservedQuantity(Number(value))}
                      min={0}
                    />
                  </SimpleGrid>

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

                  <Textarea
                    label="Notes"
                    placeholder="Reservation notes..."
                    value={spaceReservationNotes}
                    onChange={(e) => setSpaceReservationNotes(e.target.value)}
                    rows={2}
                  />

                  
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
