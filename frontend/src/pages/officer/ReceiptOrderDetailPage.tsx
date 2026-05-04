import { useLocation, useParams, useNavigate, Link } from 'react-router-dom';
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
  Anchor,
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
import { getStores, getStore } from '../../api/stores';
import { getReceiptAuthorizations } from '../../api/receiptAuthorizations';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { notificationsQueryKey, notificationsUnreadCountKey } from '../../api/notifications';
import { getStacks } from '../../api/stacks';
import { createInspection, getInspections } from '../../api/inspections';
import { createGrn } from '../../api/grns';
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
import { useEffect, useMemo, useState } from 'react';
import type { ReceiptOrder, ReceiptOrderLine } from '../../api/receiptOrders';
import type { ReceiptOrderAssignment } from '../../types/assignment';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';
import { OFFICER_ROLE_SLUGS, normalizeRoleSlug } from '../../contracts/warehouse';
import type { Warehouse } from '../../types/warehouse';
import type { Store } from '../../types/store';
import type { Inspection } from '../../types/inspection';
import type { UnitReference, UomConversion } from '../../types/referenceData';
import type { WorkflowEvent } from '../../types/assignment';
import { findDirectedMultiplier } from '../../utils/uomConversions';

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

/** Hub → warehouse allocations: assignments with a warehouse that apply to this line (and optional hub). */
function warehouseAssignmentsForHubDestLine(
  assignments: ReceiptOrderAssignment[],
  line: Pick<ReceiptOrderLine, 'id' | 'quantity' | 'destination_hub_id'>,
  opts: { scopeHubId: number | undefined; visibleLineCount: number }
): ReceiptOrderAssignment[] {
  const lineId = line.id;
  return assignments.filter((a) => {
    if (a.warehouse_id == null) return false;
    if (
      opts.scopeHubId != null &&
      a.hub_id != null &&
      Number(a.hub_id) !== Number(opts.scopeHubId)
    ) {
      return false;
    }
    if (a.receipt_order_line_id != null) {
      return lineId != null && Number(a.receipt_order_line_id) === Number(lineId);
    }
    return opts.visibleLineCount <= 1;
  });
}

function sumWarehouseAssignedQty(rows: ReceiptOrderAssignment[]): number {
  return rows.reduce((s, a) => s + Number(a.quantity ?? 0), 0);
}

function lineForAssignment(a: ReceiptOrderAssignment, lines: ReceiptOrderLine[]): ReceiptOrderLine | undefined {
  if (a.receipt_order_line_id != null) {
    return lines.find((ln) => ln.id != null && Number(ln.id) === Number(a.receipt_order_line_id));
  }
  return lines[0];
}

function assignmentMeasureUnitId(a: ReceiptOrderAssignment, lines: ReceiptOrderLine[]): number | undefined {
  if (a.quantity_unit_id != null) return a.quantity_unit_id;
  const ln = lineForAssignment(a, lines);
  return ln?.unit_id != null ? Number(ln.unit_id) : undefined;
}

/** Sum quantities for matching rows, each converted to `targetUnitId` when possible. */
function sumAssignmentsInUnit(
  rows: ReceiptOrderAssignment[],
  predicate: (a: ReceiptOrderAssignment) => boolean,
  targetUnitId: number,
  lines: ReceiptOrderLine[],
  conversions: UomConversion[]
): number | null {
  let total = 0;
  for (const a of rows) {
    if (!predicate(a) || a.quantity == null) continue;
    const line = lineForAssignment(a, lines);
    const commodityId = Number(line?.commodity_id ?? lines[0]?.commodity_id ?? 0);
    const fromId = assignmentMeasureUnitId(a, lines);
    if (fromId == null) return null;
    if (fromId === targetUnitId) {
      total += Number(a.quantity);
      continue;
    }
    const m = findDirectedMultiplier(fromId, targetUnitId, commodityId, conversions);
    if (m == null) return null;
    total += Number(a.quantity) * m;
  }
  return total;
}

/** All hub→warehouse chunks for this warehouse (store not set yet). */
function warehouseOnlyAssignmentsForManager(
  assignments: ReceiptOrderAssignment[],
  userWarehouseId: number
): ReceiptOrderAssignment[] {
  return assignments.filter(
    (a) =>
      a.warehouse_id != null &&
      Number(a.warehouse_id) === Number(userWarehouseId) &&
      a.store_id == null
  );
}

function withKntlSuffix(
  qty: number,
  baseUnitId: number | undefined,
  commodityId: number,
  baseAbbrev: string,
  units: UnitReference[],
  conversions: UomConversion[]
): string {
  const ab = baseAbbrev.trim() || 'units';
  const core = `${qty.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${ab}`;
  if (baseUnitId == null || !conversions.length) return core;
  const kntl = units.find((u) => (u.abbreviation || '').toLowerCase() === 'kntl');
  if (!kntl?.id) return core;
  const m = findDirectedMultiplier(baseUnitId, kntl.id, commodityId, conversions);
  if (m == null) return core;
  return `${core} (~${(qty * m).toLocaleString(undefined, { maximumFractionDigits: 2 })} kntl)`;
}

function computeWarehouseManagerStoreRemaining(
  assignments: ReceiptOrderAssignment[],
  userWarehouseId: number,
  storesPayload: { id: number; warehouse_id: number }[] | undefined
): { pool: number; assigned: number; remaining: number } {
  const pool = warehouseOnlyAssignmentsForManager(assignments, userWarehouseId).reduce(
    (s, a) => s + Number(a.quantity ?? 0),
    0
  );
  const stores = storesPayload ?? [];
  const assigned = assignments
    .filter((a) => {
      if (a.store_id == null) return false;
      if (a.warehouse_id != null && Number(a.warehouse_id) === Number(userWarehouseId)) return true;
      const store = stores.find((s) => Number(s.id) === Number(a.store_id));
      return !!store && Number(store.warehouse_id) === Number(userWarehouseId);
    })
    .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
  return { pool, assigned, remaining: pool - assigned };
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
  /** Unit for the quantity typed in the store-assignment form (converted to order line unit on submit). */
  const [assignmentEntryUnitId, setAssignmentEntryUnitId] = useState<number | null>(null);

  // Space reservation form state
  const [showSpaceReservationForm, setShowSpaceReservationForm] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [reservedQuantity, setReservedQuantity] = useState<number>(0);
  const [spaceReservationNotes, setSpaceReservationNotes] = useState('');

  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userHubId = activeAssignment?.hub?.id;
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

    // For warehouse managers in a hub-scoped order, scope totals to their allocation only.
    // The hub assigned a specific quantity to this warehouse — that is the ceiling, not the
    // full line quantity which belongs to the hub.
    let totalOrdered: number;
    if (isWarehouseManager && userWarehouseId) {
      const warehouseAssignments = (order.assignments ?? order.receipt_order_assignments ?? [])
        .filter(a => a.warehouse_id != null && Number(a.warehouse_id) === Number(userWarehouseId));
      if (warehouseAssignments.length > 0) {
        totalOrdered = warehouseAssignments.reduce((s, a) => s + Number(a.quantity ?? 0), 0);
      } else {
        // No hub-level assignment yet — fall back to full line quantity
        totalOrdered = totalReceiptOrderLineQuantity(order);
      }
    } else {
      totalOrdered = totalReceiptOrderLineQuantity(order);
    }

    // Only count reservations that belong to this warehouse's stores
    let totalReserved: number;
    if (isWarehouseManager && userWarehouseId) {
      const reservations = order.space_reservations ?? [];
      totalReserved = reservations.reduce((sum, r) => {
        const st = String(r.status ?? '').toLowerCase();
        if (st === 'cancelled' || st === 'released') return sum;
        if (r.warehouse_id != null && Number(r.warehouse_id) !== Number(userWarehouseId)) return sum;
        return sum + Number(r.reserved_quantity ?? 0);
      }, 0);
    } else {
      totalReserved = totalSpaceReservedQuantity(order.space_reservations);
    }

    return {
      totalOrdered,
      totalReserved,
      remaining: Math.max(0, totalOrdered - totalReserved),
    };
  }, [order, isWarehouseManager, userWarehouseId]);

  const canReserveSpace = useMemo(() => {
    if (!order) return false;
    if (isOfficerRole) return false;
    // Storekeepers should not reserve space — that's the warehouse manager's job
    if (roleSlug === 'storekeeper') return false;
    if (
      !['admin', 'superadmin', 'warehouse_manager'].includes(roleSlug || '')
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

  // Fetch the storekeeper's store to resolve its warehouse_id (needed for inspection creation
  // when the receipt order is hub-level and warehouse_id is not set on the order itself)
  const storekeeperStoreQuery = useQuery({
    queryKey: ['store', stackingStoreId],
    queryFn: () => getStore(stackingStoreId!),
    enabled: roleSlug === 'storekeeper' && !!stackingStoreId,
    staleTime: 5 * 60 * 1000, // 5 min — store data rarely changes
  });
  const storekeeperStoreWarehouseId = storekeeperStoreQuery.data?.warehouse_id ?? null;

  const stacksQuery = useQuery({
    queryKey: ['stacks', { store_id: stackingStoreId }],
    queryFn: () => getStacks({ store_id: stackingStoreId ?? undefined }),
    enabled: !!stackingStoreId,
  });

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
    enabled:
      showWarehouseAssignmentModal ||
      showAssignmentForm ||
      (!!order && activeTab === 'assignments'),
  });
  const units = (unitsQuery.data as UnitReference[]) || [];

  const uomConversionsQuery = useQuery({
    queryKey: ['reference-data', 'uom_conversions'],
    queryFn: () => getUomConversions(),
    enabled:
      showWarehouseAssignmentModal ||
      showAssignmentForm ||
      (!!order && activeTab === 'assignments'),
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

  const receiptAuthorizationsQuery = useQuery({
    queryKey: ['receipt_authorizations', { receipt_order_id: id }],
    queryFn: () => getReceiptAuthorizations({ receipt_order_id: Number(id) }),
    enabled: !!order && String(order?.status || '').toLowerCase() !== 'draft',
  });
  const receiptAuthorizations = (receiptAuthorizationsQuery.data as ReceiptAuthorization[]) || [];

  const assignableManagersQuery = useQuery({
    queryKey: ['receipt_orders', id, 'assignable_managers', roleSlug, { warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
    queryFn: () => {
      const params = isWarehouseManager && userWarehouseId ? { warehouse_id: userWarehouseId } : {};
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
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      queryClient.invalidateQueries({ queryKey: notificationsUnreadCountKey });
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
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      queryClient.invalidateQueries({ queryKey: notificationsUnreadCountKey });
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
      // Use visibleLines (scoped to this storekeeper's store) for commodity/unit context
      const firstVisibleLine = visibleLines[0] ?? lines[0];

      // Resolve warehouse ID — try multiple sources in priority order:
      // 1. Order's own warehouse_id (set when order is warehouse-level)
      // 2. Warehouse-level assignment on the order
      // 3. The storekeeper's active assignment warehouse (populated by me_controller for store-level assignments)
      // 4. The storekeeper's store's warehouse_id (fetched separately — most reliable for hub-level orders)
      // 5. Store-level assignment's warehouse_id (if populated by backend)
      const storekeeperStoreId = activeAssignment?.store?.id;
      const storekeeperWarehouseId = activeAssignment?.warehouse?.id;

      const warehouseId =
        order.warehouse_id ??
        assignments.find(a => a.warehouse_id != null)?.warehouse_id ??
        storekeeperWarehouseId ??
        storekeeperStoreWarehouseId ??
        assignments.find(a => a.store_id != null && a.store_id === storekeeperStoreId)?.warehouse_id;

      if (!warehouseId) {
        throw new Error(
          'Cannot determine warehouse for this receipt. ' +
          'The warehouse manager must assign a warehouse to this order first.'
        );
      }

      return createInspection({
        warehouse_id: warehouseId,
        inspected_on: new Date().toISOString().split('T')[0],
        inspector_id: useAuthStore.getState().userId ?? 0,
        receipt_order_id: order.id,
        status: 'confirmed',
        items: [{
          commodity_id: firstVisibleLine?.commodity_id ?? 0,
          unit_id: firstVisibleLine?.unit_id ?? 0,
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

  // ── Auto-create GRN from inspection data (storekeeper flow) ─────────────
  const autoCreateGrnMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('No order');

      // Resolve warehouse — same chain as recordReceiptMutation
      const storekeeperStoreId = activeAssignment?.store?.id;
      const storekeeperWarehouseId = activeAssignment?.warehouse?.id;
      const warehouseId =
        order.warehouse_id ??
        assignments.find(a => a.warehouse_id != null)?.warehouse_id ??
        storekeeperWarehouseId ??
        storekeeperStoreWarehouseId ??
        assignments.find(a => a.store_id != null && a.store_id === storekeeperStoreId)?.warehouse_id;

      if (!warehouseId) throw new Error('Cannot determine warehouse for this GRN.');

      // Build GRN items from confirmed inspection items for this order
      const confirmedInspections = inspections.filter(
        (i) => String(i.status || '').toLowerCase() === 'confirmed'
      );
      if (confirmedInspections.length === 0) throw new Error('No confirmed inspection found.');

      // Find the storekeeper's reserved stack for auto-filling stack_id
      const storeId = storekeeperStoreId;
      const reservedStack = storeId
        ? (stacksQuery.data as import('../../types/stack').Stack[] | undefined)?.find(
            (s) => s.store_id === storeId
          )
        : undefined;

      const today = new Date().toISOString().split('T')[0];
      const refNo = `GRN-RO${order.id}-${today.replace(/-/g, '')}`;

      const items = confirmedInspections.flatMap((inspection) =>
        (inspection.inspection_items ?? [])
          .filter((item) => Number(item.quantity_received) > 0)
          .map((item) => ({
            commodity_id: item.commodity_id,
            quantity: Number(item.quantity_received),
            unit_id: item.unit_id ?? visibleLines.find(l => l.commodity_id === item.commodity_id)?.unit_id ?? 0,
            quality_status: item.quality_status || 'good',
            // Do NOT pass line_reference_no from the inspection — that reference is already
            // taken by the InspectionItem record. The backend will generate a fresh unique ref.
            store_id: storeId,
            stack_id: reservedStack?.id,
          }))
      );

      if (items.length === 0) throw new Error('No received items found in inspection.');

      return createGrn({
        reference_no: refNo,
        warehouse_id: warehouseId,
        received_on: today,
        received_by_id: useAuthStore.getState().userId ?? undefined,
        receipt_order_id: order.id,
        status: 'draft',
        items,
      });
    },
    onSuccess: (grn) => {
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      notifications.show({
        title: 'GRN Created',
        message: `GRN ${grn.reference_no} created successfully. Review and confirm below.`,
        color: 'green',
      });
      navigate(`/grns/${grn.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<any>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create GRN',
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

    const primaryLine = visibleLines[0] ?? lines[0];
    const baseUnitId = primaryLine?.unit_id != null ? Number(primaryLine.unit_id) : undefined;
    const commodityId = Number(primaryLine?.commodity_id ?? 0);

    let qtyInOrderUnit = assignmentQuantity;
    const entryUnit = assignmentEntryUnitId ?? baseUnitId;
    if (
      assignmentQuantity > 0 &&
      entryUnit != null &&
      baseUnitId != null &&
      entryUnit !== baseUnitId
    ) {
      const m = findDirectedMultiplier(entryUnit, baseUnitId, commodityId, uomConversions);
      if (m == null) {
        notifications.show({
          title: 'Validation Error',
          message: 'Cannot convert the selected unit to the order unit. Pick another unit or quantity.',
          color: 'red',
        });
        return;
      }
      qtyInOrderUnit = Number((assignmentQuantity * m).toFixed(6));
    }

    // For warehouse managers, cap by sum of all hub→warehouse allocations (not only the first row).
    let totalOrdered: number;
    let alreadyAssigned: number;

    if (isWarehouseManager && userWarehouseId) {
      const whOnly = warehouseOnlyAssignmentsForManager(assignments, userWarehouseId);
      const { pool, assigned } = computeWarehouseManagerStoreRemaining(
        assignments,
        userWarehouseId,
        (assignableManagersPayload?.stores as { id: number; warehouse_id: number }[] | undefined) ?? []
      );
      if (whOnly.length > 0) {
        totalOrdered = pool;
        alreadyAssigned = assigned;
      } else {
        totalOrdered = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
        alreadyAssigned = assignments
          .filter((a) => {
            if (a.store_id == null) return false;
            if (a.warehouse_id != null && Number(a.warehouse_id) === Number(userWarehouseId)) return true;
            const store = (assignableManagersPayload?.stores as any[])?.find(
              (s: any) => Number(s.id) === Number(a.store_id)
            );
            return store && Number(store.warehouse_id) === Number(userWarehouseId);
          })
          .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
      }
    } else {
      totalOrdered = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
      alreadyAssigned = assignments.filter((a) => a.store_id != null).reduce((s, a) => s + Number(a.quantity ?? 0), 0);
    }

    const remaining = totalOrdered - alreadyAssigned;
    if (qtyInOrderUnit > remaining + 0.000001) {
      notifications.show({
        title: 'Validation Error',
        message: `Quantity exceeds remaining (${remaining.toLocaleString()} ${primaryLine?.unit_name || ''} left)`,
        color: 'red',
      });
      return;
    }

    const payload: any = {
      assignments: [{
        store_id: Number(selectedAssignmentStoreId),
        quantity: qtyInOrderUnit > 0 ? qtyInOrderUnit : undefined,
        notes: assignmentNotes,
        // Include line ID so storekeeper sees only their line
        receipt_order_line_id: visibleLines.length === 1 ? visibleLines[0].id : undefined,
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

  // Hub managers only see lines destined for their hub
  // Warehouse managers only see lines assigned to their warehouse
  const visibleLines = useMemo(() => {
    if (!order) return lines;

    if (roleSlug === 'hub_manager') {
      // CRITICAL: Use the user's assigned hub, not the order-level hub_id
      const hubId = userHubId;
      if (!hubId) return lines;
      
      // Filter lines by destination_hub_id matching the user's hub
      const filtered = lines.filter(l => l.destination_hub_id === hubId);
      
      // If no lines match by destination_hub_id, check assignments
      if (filtered.length === 0) {
        const assignedLineIds = new Set(
          assignments
            .filter(a => a.hub_id === hubId && a.receipt_order_line_id != null)
            .map(a => a.receipt_order_line_id!)
        );
        if (assignedLineIds.size > 0) {
          return lines.filter(l => l.id != null && assignedLineIds.has(l.id));
        }
        
        // CRITICAL FIX: If no assignments yet, but this hub manager has access to this order,
        // show all lines that don't have a specific destination_hub_id set (they're pending assignment)
        // This allows hub managers to see and assign lines in multi-hub orders
        const linesWithoutDestination = lines.filter(l => !l.destination_hub_id && !l.destination_warehouse_id);
        if (linesWithoutDestination.length > 0) {
          return linesWithoutDestination;
        }
      }
      
      return filtered.length > 0 ? filtered : lines;
    }

    if (roleSlug === 'warehouse_manager') {
      const warehouseId = activeAssignment?.warehouse?.id;
      if (!warehouseId) return lines;
      // Lines assigned to this warehouse via assignments
      const assignedLineIds = new Set(
        assignments
          .filter(a => a.warehouse_id === warehouseId && a.receipt_order_line_id != null)
          .map(a => a.receipt_order_line_id!)
      );
      if (assignedLineIds.size > 0) {
        return lines.filter(l => l.id != null && assignedLineIds.has(l.id));
      }
      // Fall back: lines with destination_warehouse_id matching
      const byDest = lines.filter(l => l.destination_warehouse_id === warehouseId);
      // Do NOT fall back to all lines — if this warehouse has no assignment yet,
      // return empty so the manager doesn't see the full hub quantity.
      return byDest;
    }

    if (roleSlug === 'storekeeper') {
      const storeId = activeAssignment?.store?.id;
      if (!storeId) return lines;
      // Lines assigned to this storekeeper's store via assignments
      const assignedLineIds = new Set(
        assignments
          .filter(a => a.store_id === storeId && a.receipt_order_line_id != null)
          .map(a => a.receipt_order_line_id!)
      );
      if (assignedLineIds.size > 0) {
        return lines.filter(l => l.id != null && assignedLineIds.has(l.id));
      }
      // No line-level assignment exists (warehouse manager assigned to store without specifying a line).
      // Return all lines — the storekeeper can see the commodity — but quantity display and
      // totalAuthorized will be capped by the store assignment's quantity, not the line quantity.
      return lines;
    }

    return lines;
  }, [lines, order, roleSlug, assignments, activeAssignment, userHubId]);

  const warehouseManagerStoreAssignHints = useMemo(() => {
    if (!isWarehouseManager || userWarehouseId == null) return null;
    const storesPayload =
      (assignableManagersPayload?.stores as { id: number; warehouse_id: number }[] | undefined) ?? [];
    const { pool, assigned, remaining } = computeWarehouseManagerStoreRemaining(
      assignments,
      userWarehouseId,
      storesPayload
    );
    const primaryLine = visibleLines[0] ?? lines[0];
    const baseUnitId = primaryLine?.unit_id != null ? Number(primaryLine.unit_id) : undefined;
    const commodityId = Number(primaryLine?.commodity_id ?? 0);
    const baseAbbrev = primaryLine?.unit_name?.trim() || '';

    let poolKntl = '';
    let assignedKntl = '';
    let remainingKntl = '';
    if (baseUnitId != null && uomConversions.length > 0) {
      const kntl = units.find((u) => (u.abbreviation || '').toLowerCase() === 'kntl');
      if (kntl?.id != null) {
        const toKntl = findDirectedMultiplier(baseUnitId, kntl.id, commodityId, uomConversions);
        if (toKntl != null) {
          poolKntl = ` (~${(pool * toKntl).toLocaleString(undefined, { maximumFractionDigits: 2 })} kntl)`;
          assignedKntl = ` (~${(assigned * toKntl).toLocaleString(undefined, { maximumFractionDigits: 2 })} kntl)`;
          remainingKntl = ` (~${(remaining * toKntl).toLocaleString(undefined, { maximumFractionDigits: 2 })} kntl)`;
        }
      }
    }

    const u = baseAbbrev || 'order unit';
    const detailLines = [
      `Warehouse allocation (all hub→warehouse rows for you): ${pool.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${u}${poolKntl}`,
      `Already assigned to stores here: ${assigned.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${u}${assignedKntl}`,
      `Remaining for stores: ${remaining.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${u}${remainingKntl}`,
    ];
    return { pool, assigned, remaining, detailLines, baseAbbrev: u, baseUnitId, commodityId };
  }, [
    isWarehouseManager,
    userWarehouseId,
    assignments,
    assignableManagersPayload,
    visibleLines,
    lines,
    uomConversions,
    units,
  ]);

  const storeAssignUnitOptions = useMemo(() => {
    if (!showAssignmentForm) return [];
    const baseLine = visibleLines[0] ?? lines[0];
    const baseId = baseLine?.unit_id != null ? Number(baseLine.unit_id) : undefined;
    const cid = Number(baseLine?.commodity_id ?? 0);
    if (baseId == null) return [];
    return units
      .filter(
        (unit) =>
          Number(unit.id) === baseId ||
          findDirectedMultiplier(Number(unit.id), baseId, cid, uomConversions) != null
      )
      .map((unit) => ({
        value: String(unit.id),
        label: unit.abbreviation ? `${unit.name} (${unit.abbreviation})` : unit.name,
      }));
  }, [showAssignmentForm, units, uomConversions, visibleLines, lines]);

  useEffect(() => {
    if (!showAssignmentForm) return;
    const ln = visibleLines[0] ?? lines[0];
    if (ln?.unit_id != null) setAssignmentEntryUnitId(Number(ln.unit_id));
  }, [showAssignmentForm, visibleLines, lines]);

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

      const unitAbbrev =
        assignment.quantity_unit_abbreviation?.trim() ||
        line?.unit_name?.trim() ||
        (line?.unit_id != null ? `unit #${line.unit_id}` : undefined);

      return {
        id: assignment.id,
        type,
        locationName,
        managerName: assignment.assigned_to_name || 'Assigned by facility setup',
        commodityName: line?.commodity_name || (line?.commodity_id ? `Commodity #${line.commodity_id}` : 'Order level'),
        quantity: assignment.quantity,
        unitAbbrev,
        status: assignment.status,
      };
    });

    if (rows.length > 0 || !order) return rows;

    const fallbackUnit = lines[0]?.unit_name?.trim() || (lines[0]?.unit_id != null ? `unit #${lines[0].unit_id}` : undefined);

    if (order.warehouse_id) {
      return [{
        id: -1,
        type: 'Warehouse',
        locationName: order.warehouse_name || `Warehouse #${order.warehouse_id}`,
        managerName: 'Manager from facility setup',
        commodityName: 'Order destination',
        quantity: undefined,
        unitAbbrev: fallbackUnit,
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
        unitAbbrev: fallbackUnit,
        status: order.status,
      }];
    }

    return rows;
  }, [assignments, lines, order]);
  const isDraft = String(order?.status || '').toLowerCase() === 'draft';

  const assignmentsTabSummary = useMemo(() => {
    if (!order || isDraft) return null;
    const linesForScope = visibleLines.length > 0 ? visibleLines : lines;
    if (linesForScope.length === 0) return null;

    const primaryLine = linesForScope[0];
    const baseUnitId = primaryLine?.unit_id != null ? Number(primaryLine.unit_id) : undefined;
    const commodityId = Number(primaryLine?.commodity_id ?? 0);
    const baseAbbrev = primaryLine?.unit_name?.trim() || '';

    const lineIdSet = new Set(
      linesForScope
        .map((l) => (l.id != null ? Number(l.id) : NaN))
        .filter((id) => !Number.isNaN(id))
    );
    const belongsToScope = (a: ReceiptOrderAssignment) => {
      if (a.receipt_order_line_id == null) return true;
      return lineIdSet.has(Number(a.receipt_order_line_id));
    };

    let warehouseReceived = 0;
    let storeAssigned = 0;

    if ((isWarehouseManager || roleSlug === 'storekeeper') && userWarehouseId != null) {
      const storesPayload =
        (assignableManagersPayload?.stores as { id: number; warehouse_id: number }[] | undefined) ?? [];
      const { pool, assigned } = computeWarehouseManagerStoreRemaining(
        assignments,
        userWarehouseId,
        storesPayload
      );
      warehouseReceived = pool;
      storeAssigned = assigned;
    } else if (roleSlug === 'hub_manager' && userHubId != null) {
      const whIds = new Set(
        allWarehouses.filter((w) => Number(w.hub_id) === Number(userHubId)).map((w) => Number(w.id))
      );
      warehouseReceived = assignments
        .filter(
          (a) =>
            a.store_id == null &&
            a.warehouse_id != null &&
            belongsToScope(a) &&
            (Number(a.hub_id) === Number(userHubId) || whIds.has(Number(a.warehouse_id)))
        )
        .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
      storeAssigned = assignments
        .filter(
          (a) =>
            a.store_id != null &&
            belongsToScope(a) &&
            (Number(a.hub_id) === Number(userHubId) ||
              (a.warehouse_id != null && whIds.has(Number(a.warehouse_id))))
        )
        .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
    } else {
      warehouseReceived = assignments
        .filter((a) => a.store_id == null && a.warehouse_id != null)
        .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
      storeAssigned = assignments
        .filter((a) => a.store_id != null)
        .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
    }

    const remaining = Math.max(0, warehouseReceived - storeAssigned);

    return {
      warehouseReceived,
      storeAssigned,
      remaining,
      warehouseReceivedLabel: withKntlSuffix(
        warehouseReceived,
        baseUnitId,
        commodityId,
        baseAbbrev,
        units,
        uomConversions
      ),
      storeAssignedLabel: withKntlSuffix(
        storeAssigned,
        baseUnitId,
        commodityId,
        baseAbbrev,
        units,
        uomConversions
      ),
      remainingLabel: withKntlSuffix(
        remaining,
        baseUnitId,
        commodityId,
        baseAbbrev,
        units,
        uomConversions
      ),
    };
  }, [
    order,
    isDraft,
    visibleLines,
    lines,
    assignments,
    roleSlug,
    userHubId,
    userWarehouseId,
    assignableManagersPayload,
    isWarehouseManager,
    allWarehouses,
    units,
    uomConversions,
  ]);

  // For storekeepers: GRN can only be created after inspection is completed (has at least one confirmed inspection)
  const hasCompletedInspection = inspections.some(
    (i) => String(i.status || '').toLowerCase() === 'confirmed'
  );
  const canCreateGrn = can('grns', 'create') && !!order && !isDraft &&
    (roleSlug !== 'storekeeper' || hasCompletedInspection);
  const canUpdateOrder = can('receipt_orders', 'update');
  const canDeleteOrder = can('receipt_orders', 'delete');
  const canConfirmOrder = can('receipt_orders', 'confirm');
  const listPath = location.pathname.startsWith('/officer/') ? '/officer/receipt-orders' : '/receipt-orders';
  const hubScopedWarehouses = useMemo(() => {
    // CRITICAL: Use userHubId (the manager's assigned hub), not order.hub_id
    // For multi-hub orders, each hub manager should see their own hub's warehouses
    const targetHubId = userHubId || order?.hub_id;
    if (!targetHubId) return [];
    
    return allWarehouses.filter((warehouse) => Number(warehouse.hub_id) === Number(targetHubId));
  }, [allWarehouses, order?.hub_id, userHubId]);
  const fullyAssigned = useMemo(() => {
    // For hub managers: check if THEIR hub's lines are fully assigned to warehouses
    // For others: check if ALL lines are fully assigned
    const linesToCheck = roleSlug === 'hub_manager' && userHubId 
      ? lines.filter(l => l.destination_hub_id === userHubId)
      : lines;
    
    if (linesToCheck.length === 0) {
      return false;
    }
    
    // Calculate total ordered quantity for the lines we're checking
    const totalOrdered = linesToCheck.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
    
    // Calculate total assigned quantity to WAREHOUSES only for these lines
    // CRITICAL: Only count assignments that have warehouse_id AND belong to this hub
    const totalAssigned = assignments.reduce((sum, assignment) => {
      // Must have warehouse_id (not just hub_id)
      if (!assignment.warehouse_id) return sum;
      
      // For hub managers, only count assignments for their hub
      if (roleSlug === 'hub_manager' && userHubId) {
        if (assignment.hub_id !== userHubId) return sum;
      }
      
      // Check if this assignment belongs to one of our lines
      const belongsToOurLines = assignment.receipt_order_line_id != null
        ? linesToCheck.some(l => l.id === assignment.receipt_order_line_id)
        : true; // Order-level assignment counts for all lines
      
      if (belongsToOurLines) {
        return sum + Number(assignment.quantity ?? 0);
      }
      return sum;
    }, 0);
    
    // Check if fully assigned (with small tolerance for floating point)
    const remaining = totalOrdered - totalAssigned;
    return remaining <= 0.000001;
  }, [assignments, lines, roleSlug, userHubId]);
  const canHubAssignWarehouse =
    roleSlug === 'hub_manager' &&
    !isDraft &&
    normalizeOrderStatus(order?.status) !== 'completed' &&
    !fullyAssigned &&
    hubScopedWarehouses.length > 0;

  // Lines scoped to this hub manager's hub — used in the Assign Warehouse modal
  const hubScopedLines = useMemo(() => {
    if (roleSlug !== 'hub_manager' || !order) return lines;
    // CRITICAL: Use userHubId (the manager's assigned hub), not order.hub_id
    const hubId = userHubId || order.hub_id;
    
    if (!hubId) return lines;
    // Filter lines that are destined for this hub
    const filtered = lines.filter(l => l.destination_hub_id === hubId);
    
    // Fall back to all lines if no lines have destination_hub_id set (old orders)
    return filtered.length > 0 ? filtered : lines.filter(l => !l.destination_warehouse_id);
  }, [lines, order, roleSlug, userHubId]);

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
            roleSlug === 'storekeeper' ? (
              <Button
                size="sm"
                color="green"
                onClick={() => autoCreateGrnMutation.mutate()}
                loading={autoCreateGrnMutation.isPending}
              >
                Create GRN
              </Button>
            ) : (
              <Button
                size="sm"
                variant="light"
                onClick={() => navigate(`/grns/new?receipt_order_id=${order.id}`)}
              >
                Create GRN
              </Button>
            )
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
              <Tabs.Tab value="receipt-authorizations">
                Receipt Authorizations
                {receiptAuthorizations.length > 0 && (
                  <Badge size="xs" ml={6} variant="light">
                    {receiptAuthorizations.length}
                  </Badge>
                )}
              </Tabs.Tab>
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
                    {visibleLines.map((line, index) => {
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

                      const scopeHubId: number | undefined =
                        roleSlug === 'hub_manager'
                          ? (userHubId != null
                              ? Number(userHubId)
                              : line.destination_hub_id != null
                                ? Number(line.destination_hub_id)
                                : undefined)
                          : line.destination_hub_id != null
                            ? Number(line.destination_hub_id)
                            : undefined;

                      const whRowsForLine = isHub
                        ? warehouseAssignmentsForHubDestLine(assignments, line, {
                            scopeHubId,
                            visibleLineCount: visibleLines.length,
                          })
                        : [];
                      const hubAssignedTotal = sumWarehouseAssignedQty(whRowsForLine);
                      const hubOrderedTotal = Number(line.quantity ?? 0);
                      const hubRemaining = Math.max(0, hubOrderedTotal - hubAssignedTotal);

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
                              whRowsForLine.length === 0 ? (
                                <Text size="sm" c="dimmed">Not yet assigned to a warehouse</Text>
                              ) : (
                                <Stack gap={6}>
                                  {whRowsForLine.map((a) => (
                                    <div key={a.id}>
                                      <Text size="sm" fw={500}>
                                        {a.warehouse_name?.trim() || `Warehouse #${a.warehouse_id}`}
                                      </Text>
                                      {a.quantity != null && (
                                        <Text size="xs" c="dimmed">
                                          {Number(a.quantity).toLocaleString()}{' '}
                                          {line.unit_name?.trim() || (line.unit_id ? `unit #${line.unit_id}` : '')}
                                        </Text>
                                      )}
                                    </div>
                                  ))}
                                </Stack>
                              )
                            ) : isWarehouse ? (
                              <Text size="sm" fw={500}>{destinationLabel}</Text>
                            ) : (
                              <Text size="sm" c="dimmed">—</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {(() => {
                              // For warehouse managers in hub-scoped orders, show their
                              // allocated quantity (from the hub assignment), not the full line quantity.
                              if (isWarehouseManager && userWarehouseId && line.id != null) {
                                const warehouseAssignment = assignments.find(
                                  (a) =>
                                    a.warehouse_id != null &&
                                    Number(a.warehouse_id) === Number(userWarehouseId) &&
                                    (a.receipt_order_line_id == null || a.receipt_order_line_id === line.id)
                                );
                                if (warehouseAssignment?.quantity != null) {
                                  return (
                                    <Text fw={600}>
                                      {Number(warehouseAssignment.quantity).toLocaleString()}
                                    </Text>
                                  );
                                }
                              }
                              // For storekeepers: show their store's allocated quantity
                              if (roleSlug === 'storekeeper') {
                                const storeId = activeAssignment?.store?.id;
                                const storeAssignment =
                                  storeId != null
                                    ? assignments.find(
                                        (a) =>
                                          a.store_id != null &&
                                          Number(a.store_id) === Number(storeId) &&
                                          (a.receipt_order_line_id == null || a.receipt_order_line_id === line.id)
                                      )
                                    : undefined;
                                if (storeAssignment?.quantity != null) {
                                  return (
                                    <Text fw={600}>
                                      {Number(storeAssignment.quantity).toLocaleString()}
                                    </Text>
                                  );
                                }
                              }
                              if (isHub) {
                                const unit =
                                  line.unit_name?.trim() ||
                                  (line.unit_id ? `unit #${line.unit_id}` : '');
                                return (
                                  <Stack gap={4}>
                                    <Group gap={6} wrap="nowrap" align="baseline">
                                      <Text fw={700} component="span">
                                        {hubAssignedTotal.toLocaleString()}
                                      </Text>
                                      <Text size="sm" c="dimmed" component="span">
                                        of
                                      </Text>
                                      <Text fw={600} component="span">
                                        {hubOrderedTotal.toLocaleString()}
                                      </Text>
                                      {unit ? (
                                        <Text size="xs" c="dimmed" component="span">
                                          {unit}
                                        </Text>
                                      ) : null}
                                    </Group>
                                    {hubRemaining > 1e-6 ? (
                                      <Text size="xs" c="dimmed">
                                        {hubRemaining.toLocaleString()} still to assign to a warehouse
                                      </Text>
                                    ) : hubOrderedTotal > 0 ? (
                                      <Text size="xs" c="green.7">
                                        Fully assigned to warehouses
                                      </Text>
                                    ) : null}
                                  </Stack>
                                );
                              }
                              return <Text fw={600}>{line.quantity}</Text>;
                            })()}
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

              // For storekeepers: use their assigned quantity, not the full order quantity
              const storeId = activeAssignment?.store?.id;
              const storekeeperAssignments = assignments.filter(
                (a) => a.store_id != null && Number(a.store_id) === Number(storeId)
              );
              // Use the store assignment quantity as the ceiling.
              // If quantity is null on the assignment (warehouse manager didn't set one),
              // fall back to visibleLines — which for storekeepers is already scoped to their lines.
              // Never fall back to the raw line quantity which belongs to the hub.
              const totalAuthorized = storekeeperAssignments.length > 0
                ? storekeeperAssignments.reduce((s, a) => {
                    // If assignment has an explicit quantity, use it
                    if (a.quantity != null) return s + Number(a.quantity);
                    // Otherwise sum the visible lines (already scoped to this storekeeper)
                    return s + visibleLines.reduce((ls, l) => ls + Number(l.quantity ?? 0), 0);
                  }, 0)
                : visibleLines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);

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

            {assignmentsTabSummary ? (
              <Card withBorder padding="sm" radius="md" bg="var(--mantine-color-body)">
                <Group gap="xl" align="flex-start" wrap="wrap">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Total received at warehouse (from hub)
                    </Text>
                    <Text size="sm" fw={700}>
                      {assignmentsTabSummary.warehouseReceivedLabel}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Assigned to stores
                    </Text>
                    <Text size="sm" fw={700}>
                      {assignmentsTabSummary.storeAssignedLabel}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Remaining to assign to stores
                    </Text>
                    <Text size="sm" fw={700} c={assignmentsTabSummary.remaining > 0.0001 ? undefined : 'green'}>
                      {assignmentsTabSummary.remainingLabel}
                    </Text>
                  </div>
                </Group>
              </Card>
            ) : null}

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
                      <Table.Th>Quantity (UOM)</Table.Th>
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
                            <Group gap={6} wrap="nowrap">
                              <Text fw={600}>{Number(row.quantity).toLocaleString()}</Text>
                              {row.unitAbbrev ? (
                                <Text size="sm" c="dimmed">
                                  {row.unitAbbrev}
                                </Text>
                              ) : null}
                            </Group>
                          ) : (
                            <Text size="sm" c="dimmed">
                              All order lines
                              {row.unitAbbrev ? (
                                <>
                                  {' '}
                                  <Text component="span" size="sm" c="dimmed">
                                    ({row.unitAbbrev})
                                  </Text>
                                </>
                              ) : null}
                            </Text>
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
                      
                      {warehouseManagerStoreAssignHints ? (
                        <Stack gap={4}>
                          {warehouseManagerStoreAssignHints.detailLines.map((hintLine, idx) => (
                            <Text key={idx} size="xs" c="dimmed">
                              {hintLine}
                            </Text>
                          ))}
                        </Stack>
                      ) : null}

                      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
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

                                const storekeeper = managers.find((m: any) => {
                                  const isStorekeeper = m.role === 'Storekeeper';
                                  const matchesStore = Number(m.store_id) === Number(store.id);
                                  const matchesWarehouse =
                                    m.warehouse_id && Number(m.warehouse_id) === Number(store.warehouse_id);
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

                        <Select
                          label="Quantity unit"
                          description="Saved in the receipt line unit (e.g. mt)."
                          placeholder="Unit"
                          data={storeAssignUnitOptions}
                          value={assignmentEntryUnitId != null ? String(assignmentEntryUnitId) : undefined}
                          onChange={(v) => setAssignmentEntryUnitId(v != null ? Number(v) : null)}
                          disabled={storeAssignUnitOptions.length <= 1}
                          searchable
                        />

                        <NumberInput
                          label="Quantity to assign"
                          placeholder={
                            warehouseManagerStoreAssignHints
                              ? `≤ ${warehouseManagerStoreAssignHints.remaining.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${warehouseManagerStoreAssignHints.baseAbbrev}`
                              : `Max: ${lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0).toLocaleString()}`
                          }
                          value={assignmentQuantity || ''}
                          onChange={(val) => setAssignmentQuantity(Number(val) || 0)}
                          min={0}
                          description={
                            isWarehouseManager && userWarehouseId
                              ? undefined
                              : (() => {
                                  const totalOrdered = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
                                  const alreadyAssigned = assignments
                                    .filter((a) => a.store_id != null)
                                    .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
                                  return `Total ordered: ${totalOrdered.toLocaleString()} — already store-assigned: ${alreadyAssigned.toLocaleString()}`;
                                })()
                          }
                          error={(() => {
                            if (isWarehouseManager && userWarehouseId && warehouseManagerStoreAssignHints) {
                              const rem = warehouseManagerStoreAssignHints.remaining;
                              const baseId = warehouseManagerStoreAssignHints.baseUnitId;
                              const cid = warehouseManagerStoreAssignHints.commodityId;
                              const entry = assignmentEntryUnitId ?? baseId;
                              if (assignmentQuantity <= 0) return null;
                              if (entry == null || baseId == null) return null;
                              let qtyBase = assignmentQuantity;
                              if (entry !== baseId) {
                                const m = findDirectedMultiplier(entry, baseId, cid, uomConversions);
                                if (m == null) return 'No conversion from selected unit to order unit';
                                qtyBase = assignmentQuantity * m;
                              }
                              if (qtyBase > rem + 0.000001) {
                                return `Exceeds remaining (${rem.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${warehouseManagerStoreAssignHints.baseAbbrev} left)`;
                              }
                              return null;
                            }

                            const totalOrdered = lines.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
                            const alreadyAssigned = assignments
                              .filter((a) => a.store_id != null)
                              .reduce((s, a) => s + Number(a.quantity ?? 0), 0);
                            const remaining = totalOrdered - alreadyAssigned;
                            if (assignmentQuantity > remaining) {
                              return `Exceeds remaining quantity (${remaining.toLocaleString()} left)`;
                            }
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

        <Tabs.Panel value="receipt-authorizations" pt="md">
          {(() => {
            const nonCancelled = receiptAuthorizations.filter(
              (ra) => ra.status !== 'cancelled'
            );
            const closedCount = nonCancelled.filter((ra) => ra.status === 'closed').length;
            const totalCount = nonCancelled.length;

            return (
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Text fw={600}>Receipt Authorizations</Text>
                  {totalCount > 0 && (
                    <Badge
                      size="lg"
                      color={closedCount === totalCount ? 'green' : 'blue'}
                      variant="light"
                    >
                      {closedCount} of {totalCount} trucks completed
                    </Badge>
                  )}
                </Group>

                {totalCount > 0 && (
                  <Progress
                    value={totalCount > 0 ? (closedCount / totalCount) * 100 : 0}
                    color={closedCount === totalCount ? 'green' : 'blue'}
                    size="sm"
                  />
                )}

                {receiptAuthorizationsQuery.isLoading ? (
                  <Text c="dimmed" size="sm">Loading receipt authorizations…</Text>
                ) : receiptAuthorizationsQuery.isError ? (
                  <Text c="red" size="sm">Failed to load receipt authorizations.</Text>
                ) : receiptAuthorizations.length === 0 ? (
                  <Text c="dimmed">No receipt authorizations yet for this order.</Text>
                ) : (
                  <Table.ScrollContainer minWidth={800}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Reference</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Store</Table.Th>
                          <Table.Th>Warehouse</Table.Th>
                          <Table.Th>Qty Authorized</Table.Th>
                          <Table.Th>Driver</Table.Th>
                          <Table.Th>Plate No.</Table.Th>
                          <Table.Th>GRN</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {receiptAuthorizations.map((ra) => (
                          <Table.Tr key={ra.id}>
                            <Table.Td>
                              <Anchor
                                component={Link}
                                to={`/hub/receipt-authorizations/${ra.id}`}
                                size="sm"
                                fw={600}
                              >
                                {ra.reference_no || `RA-${ra.id}`}
                              </Anchor>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={
                                  ra.status === 'closed'
                                    ? 'green'
                                    : ra.status === 'active'
                                      ? 'blue'
                                      : ra.status === 'cancelled'
                                        ? 'red'
                                        : 'yellow'
                                }
                                variant="light"
                                tt="capitalize"
                              >
                                {ra.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{ra.store_name || `Store #${ra.store_id}`}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{ra.warehouse_name || `Warehouse #${ra.warehouse_id}`}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text fw={600} size="sm">
                                {Number(ra.authorized_quantity).toLocaleString()}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{ra.driver_name}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" style={{ fontFamily: 'monospace' }}>
                                {ra.truck_plate_number}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              {ra.grn_reference_no ? (
                                <Badge
                                  color={ra.grn_status === 'confirmed' ? 'green' : 'gray'}
                                  variant="light"
                                  size="sm"
                                >
                                  {ra.grn_reference_no}
                                </Badge>
                              ) : (
                                <Text size="sm" c="dimmed">—</Text>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </Stack>
            );
          })()}
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
        filteredLines={hubScopedLines}
        warehouses={hubScopedWarehouses}
        stores={allStores}
        units={units}
        uomConversions={uomConversions}
        onSubmit={(payload) => assignMutation.mutate(payload)}
        loading={isLoading_}
        hubId={userHubId}
      />
    </Stack>
  );
}

export default ReceiptOrderDetailPage;
