import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Stack, Title, Button, Group, Card, NumberInput, TextInput, Text, Alert, Divider, Checkbox } from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  assignStorekeeperToRa,
  createReceiptAuthorization,
  getAssignableStorekeepers,
  getReceiptAuthorizations,
} from '../../api/receiptAuthorizations';
import { getReceiptOrders, type ReceiptOrderLine } from '../../api/receiptOrders';
import { getCommodityReferences, getUnitReferences, getUomConversions } from '../../api/referenceData';
import { getStores } from '../../api/stores';
import { getWarehouses } from '../../api/warehouses';
import type { ReceiptOrderAssignment } from '../../types/assignment';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { receiptAuthorizationBasePath } from '../../utils/receiptAuthorizationPaths';
import { useWarehouseManagerRaAccess } from '../../hooks/useWarehouseManagerRaAccess';
import { findDirectedMultiplier } from '../../utils/uomConversions';
import { computePackagingPackagesHint } from '../../utils/packagingQuantityHint';
import type { ApiError } from '../../types/common';

function isAssignmentRejected(status: string | undefined) {
  return String(status ?? '')
    .trim()
    .toLowerCase()
    === 'rejected';
}

function lineForAssignment(
  assignmentLineId: number | undefined,
  lines: ReceiptOrderLine[]
): ReceiptOrderLine | undefined {
  if (assignmentLineId != null) {
    return lines.find((ln) => ln.id != null && Number(ln.id) === Number(assignmentLineId));
  }
  return lines[0];
}

function assignmentBelongsToHub(
  a: ReceiptOrderAssignment,
  hubId: number,
  hubWarehouseIds: Set<number>
): boolean {
  // If the assignment points to a specific warehouse, trust the warehouse's
  // actual hub membership — not the hub_id stamp on the assignment row
  // (which is inherited from the order and may be wrong for cross-hub assignments).
  if (a.warehouse_id != null) {
    return hubWarehouseIds.has(Number(a.warehouse_id));
  }
  // Hub-level assignment (no warehouse yet) — check hub_id directly.
  if (a.hub_id != null) {
    return Number(a.hub_id) === hubId;
  }
  return false;
}

/** Planned assignment rows eligible for RA truck authorization (role-aware). */
function plannedRaAssignments(
  assignments: ReceiptOrderAssignment[],
  opts: {
    isStandaloneWM: boolean;
    isWarehouseManager?: boolean;
    isHubManager?: boolean;
    scopedHubId?: number;
    hubWarehouseIds?: Set<number>;
    scopedWarehouseId?: number;
    standaloneStores?: { id: number }[];
  }
): ReceiptOrderAssignment[] {
  const active = assignments.filter((a) => !isAssignmentRejected(a.status));

  if (opts.isHubManager && opts.scopedHubId != null) {
    const hubId = Number(opts.scopedHubId);
    const whIds = opts.hubWarehouseIds ?? new Set<number>();
    return active.filter(
      (a) =>
        a.warehouse_id != null &&
        a.store_id == null &&
        assignmentBelongsToHub(a, hubId, whIds)
    );
  }

  if (opts.isWarehouseManager && opts.scopedWarehouseId != null) {
    const whId = Number(opts.scopedWarehouseId);
    if (opts.isStandaloneWM) {
      const storeIds = new Set((opts.standaloneStores ?? []).map((s) => Number(s.id)));
      return active.filter(
        (a) =>
          a.store_id != null &&
          (a.warehouse_id != null
            ? Number(a.warehouse_id) === whId
            : storeIds.has(Number(a.store_id)))
      );
    }
    // Hub-affiliated warehouse manager: only this warehouse's hub→warehouse plan rows.
    return active.filter(
      (a) =>
        a.warehouse_id != null &&
        Number(a.warehouse_id) === whId &&
        a.store_id == null
    );
  }

  return active.filter((a) => a.warehouse_id != null && a.store_id == null);
}

function plannedWarehouseIdsOnLine(
  assignments: ReceiptOrderAssignment[],
  lineId: number | null,
  singleLineOrder: boolean
): number[] {
  if (lineId == null) return [];

  const ids = assignments.filter(
    (a) =>
      a.warehouse_id != null &&
      !isAssignmentRejected(a.status) &&
      (a.receipt_order_line_id != null
        ? Number(a.receipt_order_line_id) === Number(lineId)
        : singleLineOrder)
  );
  return [...new Set(ids.map((a) => Number(a.warehouse_id)))];
}

/** RAs explicitly linked to an assignment row (receipt_order_assignment_id). */
function usedQtyDirectlyLinkedByAssignmentId(
  orderRAs: { status: string; receipt_order_assignment_id?: number | null; authorized_quantity: number }[]
): Map<number, number> {
  const m = new Map<number, number>();
  for (const ra of orderRAs) {
    if (ra.status === 'cancelled') continue;
    const aid = ra.receipt_order_assignment_id;
    if (aid == null) continue;
    const k = Number(aid);
    m.set(k, (m.get(k) ?? 0) + Number(ra.authorized_quantity ?? 0));
  }
  return m;
}

/**
 * Older or routed trucks may have receipt_order_assignment_id unset while still matching
 * warehouse + line. Spread that quantity across matching hub→warehouse plan rows (pro-rata
 * by row quantity when several rows share the same warehouse+line).
 */
function mergeOrphanRasIntoAssignmentUsage(
  orderRAs: {
    status: string;
    receipt_order_assignment_id?: number | null;
    receipt_order_line_id?: number | null;
    warehouse_id: number;
    authorized_quantity: number;
  }[],
  warehouseAssignments: ReceiptOrderAssignment[],
  orderLines: ReceiptOrderLine[],
  direct: Map<number, number>
): Map<number, number> {
  const m = new Map(direct);
  const singleLineId =
    orderLines.length === 1 && orderLines[0].id != null ? Number(orderLines[0].id) : undefined;

  for (const ra of orderRAs) {
    if (ra.status === 'cancelled') continue;
    if (ra.receipt_order_assignment_id != null) continue;
    const w = ra.warehouse_id;
    if (w == null) continue;

    const raLine =
      ra.receipt_order_line_id != null
        ? Number(ra.receipt_order_line_id)
        : singleLineId != null
          ? singleLineId
          : NaN;
    if (Number.isNaN(raLine)) continue;

    const matches = warehouseAssignments.filter((a) => {
      if (Number(a.warehouse_id) !== Number(w)) return false;
      if (a.receipt_order_line_id == null) {
        return orderLines.length === 1 && Number(orderLines[0].id) === raLine;
      }
      return Number(a.receipt_order_line_id) === raLine;
    });
    if (matches.length === 0) continue;

    const qty = Number(ra.authorized_quantity ?? 0);
    const weights = matches.map((a) => Number(a.quantity ?? 0) || 0);
    const sumW = weights.reduce((s, x) => s + x, 0);
    if (sumW <= 1e-9) {
      const share = qty / matches.length;
      matches.forEach((a) => {
        const id = Number(a.id);
        m.set(id, (m.get(id) ?? 0) + share);
      });
    } else {
      matches.forEach((a, idx) => {
        const id = Number(a.id);
        const share = (qty * weights[idx]) / sumW;
        m.set(id, (m.get(id) ?? 0) + share);
      });
    }
  }
  return m;
}

export default function ReceiptAuthorizationFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const authRole = useAuthStore((state) => state.role);
  const roleSlug = normalizeRoleSlug(
    activeAssignment?.role_name || authRole
  );
  const raBasePath = receiptAuthorizationBasePath(roleSlug);
  const { isWarehouseManager, isStandaloneWarehouse: isStandaloneAssignment } =
    useWarehouseManagerRaAccess();
  const isHubManager = roleSlug === 'hub_manager';
  const scopedHubId = activeAssignment?.hub?.id;
  const scopedWarehouseId = activeAssignment?.warehouse?.id;
  const scopedWarehouseName = activeAssignment?.warehouse?.name;

  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [usePlannedAllocation, setUsePlannedAllocation] = useState(true);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [explicitWarehouseId, setExplicitWarehouseId] = useState<string | null>(null);
  const [overrideReceiptLineId, setOverrideReceiptLineId] = useState<string | null>(null);
  const [notifyPlannedFacilities, setNotifyPlannedFacilities] = useState(false);
  const [transporterName, setTransporterName] = useState('');
  const [authorizedUnitId, setAuthorizedUnitId] = useState<string | null>(null);
  const [authorizedQuantity, setAuthorizedQuantity] = useState<number | string>('');
  const [driverName, setDriverName] = useState('');
  const [driverIdNumber, setDriverIdNumber] = useState('');
  const [truckPlateNumber, setTruckPlateNumber] = useState('');
  const [waybillNumber, setWaybillNumber] = useState('');
  const [selectedStorekeeperId, setSelectedStorekeeperId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  useEffect(() => {
    const roId = searchParams.get('receipt_order_id');
    if (roId) setReceiptOrderId(roId);
  }, [searchParams]);

  const { data: receiptOrders = [] } = useQuery({
    queryKey: ['receipt_orders', { status: 'confirmed', hub_id: scopedHubId, warehouse_id: scopedWarehouseId }],
    queryFn: () =>
      getReceiptOrders(
        scopedWarehouseId
          ? { warehouse_id: scopedWarehouseId }
          : scopedHubId
            ? { hub_id: scopedHubId }
            : undefined
      ),
    select: (orders) =>
      orders.filter((o) => {
        // Serializer titleizes statuses: "in_progress" → "In Progress".
        // Normalise to snake_case before comparing so "In Progress" matches 'in_progress'.
        const s = String(o.status || '').toLowerCase().replace(/\s+/g, '_');
        const statusMatch =
          s === 'confirmed' ||
          s === 'assigned' ||
          s === 'reserved' ||
          s === 'in_progress' ||
          s === 'completed';
        if (!statusMatch) return false;

        const assignments = o.receipt_order_assignments ?? o.assignments ?? [];
        if (scopedWarehouseId) {
          if (Number(o.warehouse_id) === Number(scopedWarehouseId)) return true;
          return assignments.some((a) => Number(a.warehouse_id) === Number(scopedWarehouseId));
        }
        // Hub manager: list is already policy-scoped server-side (includes warehouse assignments,
        // line destination_hub_id, and RAs under this hub). Do not re-filter by order.hub_id — that drops
        // federal / multi-hub rows where work happens at this hub but order.hub_id is blank.
        if (scopedHubId) {
          return true;
        }
        return true;
      }),
  });

  const selectedOrder = receiptOrders.find((o) => String(o.id) === receiptOrderId);

  const { data: hubWarehousesForScope = [] } = useQuery({
    queryKey: ['warehouses', { hub_id: scopedHubId, context: 'ra-hub-scope' }],
    queryFn: () => getWarehouses({ hub_id: scopedHubId! }),
    enabled: isHubManager && !!scopedHubId,
  });
  const hubWarehouseIdSet = useMemo(
    () => new Set(hubWarehousesForScope.map((w) => Number(w.id))),
    [hubWarehousesForScope]
  );

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: getUnitReferences,
  });
  const { data: uomConversions = [] } = useQuery({
    queryKey: ['reference-data', 'uom_conversions'],
    queryFn: getUomConversions,
  });
  const { data: assignableStorekeepers = [], isLoading: storekeepersLoading } = useQuery({
    queryKey: ['assignable_storekeepers', scopedWarehouseId],
    queryFn: () => getAssignableStorekeepers(scopedWarehouseId!),
    enabled: isWarehouseManager && isStandaloneAssignment && !!scopedWarehouseId,
  });
  const { data: standaloneStores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['stores', { warehouse_id: scopedWarehouseId, context: 'ra-form' }],
    queryFn: () => getStores({ warehouse_id: scopedWarehouseId! }),
    enabled: isWarehouseManager && !!scopedWarehouseId,
  });
  const { data: commodityRefs = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
    enabled: !!selectedOrder,
  });

  const assignmentsAll = useMemo(() => {
    const raw = selectedOrder?.receipt_order_assignments ?? selectedOrder?.assignments ?? [];
    if (isHubManager && scopedHubId != null) {
      const hubId = Number(scopedHubId);
      return raw.filter((a) => assignmentBelongsToHub(a, hubId, hubWarehouseIdSet));
    }
    if (!isWarehouseManager || scopedWarehouseId == null) return raw;

    const whId = Number(scopedWarehouseId);
    const storeIds = new Set(standaloneStores.map((s) => Number(s.id)));
    return raw.filter((a) => {
      if (a.warehouse_id != null && Number(a.warehouse_id) === whId) return true;
      if (a.store_id != null && storeIds.has(Number(a.store_id))) return true;
      return false;
    });
  }, [
    selectedOrder?.receipt_order_assignments,
    selectedOrder?.assignments,
    isHubManager,
    isWarehouseManager,
    scopedHubId,
    hubWarehouseIdSet,
    scopedWarehouseId,
    standaloneStores,
  ]);
  const warehouseAssignments = useMemo(
    () =>
      plannedRaAssignments(assignmentsAll, {
        isStandaloneWM: isWarehouseManager && isStandaloneAssignment,
        isWarehouseManager,
        isHubManager,
        scopedHubId,
        hubWarehouseIds: hubWarehouseIdSet,
        scopedWarehouseId,
        standaloneStores,
      }),
    [
      assignmentsAll,
      isWarehouseManager,
      isHubManager,
      isStandaloneAssignment,
      scopedHubId,
      hubWarehouseIdSet,
      scopedWarehouseId,
      standaloneStores,
    ]
  );
  const orderLines = useMemo(() => {
    const lines = selectedOrder?.receipt_order_lines ?? selectedOrder?.lines ?? [];
    if (isHubManager && scopedHubId != null) {
      const hubId = Number(scopedHubId);
      const assignmentLineIds = new Set(
        assignmentsAll
          .filter((a) => a.receipt_order_line_id != null)
          .map((a) => Number(a.receipt_order_line_id))
      );

      const filtered = lines.filter((ln) => {
        if (ln.id != null && assignmentLineIds.has(Number(ln.id))) return true;
        if (ln.destination_hub_id != null && Number(ln.destination_hub_id) === hubId) return true;
        if (
          ln.destination_warehouse_id != null &&
          hubWarehouseIdSet.has(Number(ln.destination_warehouse_id))
        ) {
          return true;
        }
        return false;
      });

      if (filtered.length > 0) return filtered;
      if (lines.length === 1 && assignmentsAll.length > 0) return lines;
      return filtered;
    }
    if (!isWarehouseManager || scopedWarehouseId == null) return lines;

    const whId = Number(scopedWarehouseId);
    const assignmentLineIds = new Set(
      assignmentsAll
        .filter((a) => a.receipt_order_line_id != null)
        .map((a) => Number(a.receipt_order_line_id))
    );

    const filtered = lines.filter((ln) => {
      if (ln.id != null && assignmentLineIds.has(Number(ln.id))) return true;
      if (ln.destination_warehouse_id != null && Number(ln.destination_warehouse_id) === whId) return true;
      return false;
    });

    if (filtered.length > 0) return filtered;
    if (lines.length === 1 && assignmentsAll.some((a) => Number(a.warehouse_id) === whId)) return lines;
    return filtered;
  }, [
    selectedOrder?.receipt_order_lines,
    selectedOrder?.lines,
    isHubManager,
    isWarehouseManager,
    scopedHubId,
    hubWarehouseIdSet,
    scopedWarehouseId,
    assignmentsAll,
  ]);
  const standaloneWarehouseRaMode = isWarehouseManager && isStandaloneAssignment;
  const hasPlannedWarehouseRows = warehouseAssignments.length > 0;
  const routingByOverride =
    standaloneWarehouseRaMode || !usePlannedAllocation || !hasPlannedWarehouseRows;
  const hubIdForRo = isHubManager ? (selectedOrder?.hub_id ?? scopedHubId ?? undefined) : (scopedHubId ?? undefined);

  useEffect(() => {
    if (!standaloneWarehouseRaMode || !scopedWarehouseId) return;
    setUsePlannedAllocation(false);
    setExplicitWarehouseId(String(scopedWarehouseId));
    setAssignmentId(null);
  }, [standaloneWarehouseRaMode, scopedWarehouseId, receiptOrderId]);

  const { data: hubWarehouses = [] } = useQuery({
    queryKey: ['warehouses', { hub_id: hubIdForRo }],
    queryFn: () => getWarehouses({ hub_id: hubIdForRo! }),
    enabled: !!selectedOrder && !!hubIdForRo && routingByOverride,
  });

  const { data: orderRAs = [] } = useQuery({
    queryKey: [
      'receipt_authorizations',
      {
        receipt_order_id: selectedOrder?.id,
        warehouse_id: scopedWarehouseId,
        hub_id: scopedHubId,
        list: 'form',
      },
    ],
    queryFn: () =>
      getReceiptAuthorizations({
        receipt_order_id: selectedOrder?.id,
        ...(scopedWarehouseId ? { warehouse_id: scopedWarehouseId } : {}),
      }),
    enabled: !!selectedOrder?.id,
    select: (ras) => {
      if (!isHubManager || scopedHubId == null) return ras;
      return ras.filter(
        (ra) =>
          ra.warehouse_id != null && hubWarehouseIdSet.has(Number(ra.warehouse_id))
      );
    },
  });

  /** Authorized qty per assignment row: linked RAs + orphan same-warehouse/line trucks (pro-rata). */
  const usedQtyByAssignmentId = useMemo(() => {
    const direct = usedQtyDirectlyLinkedByAssignmentId(orderRAs);
    return mergeOrphanRasIntoAssignmentUsage(orderRAs, warehouseAssignments, orderLines, direct);
  }, [orderRAs, warehouseAssignments, orderLines]);

  const openTruckCountByAssignmentId = useMemo(() => {
    const m = new Map<number, number>();
    for (const ra of orderRAs) {
      if (ra.status !== 'pending' && ra.status !== 'active') continue;
      const aid = ra.receipt_order_assignment_id;
      if (aid == null) continue;
      const k = Number(aid);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [orderRAs]);

  const assignmentOptions = useMemo(
    () =>
      warehouseAssignments.map((a) => {
        const whName = a.warehouse_name || `Warehouse #${a.warehouse_id}`;
        const storePart = a.store_name ? ` → ${a.store_name}` : '';
        const allocated = Number(a.quantity ?? 0);
        const u = (a.quantity_unit_abbreviation || '').trim();
        const uPart = u ? ` ${u}` : '';
        const used = usedQtyByAssignmentId.get(Number(a.id)) ?? 0;
        const remaining = Math.max(0, allocated - used);
        const complete = remaining <= 1e-9;
        const trucks = openTruckCountByAssignmentId.get(Number(a.id)) ?? 0;
        const lineHint =
          a.receipt_order_line_id != null && orderLines.length > 1
            ? ` · line #${a.receipt_order_line_id}`
            : '';

        const allocTag = ` · alloc #${a.id}`;
        let label: string;
        if (complete) {
          label =
            `${whName}${storePart} — plan complete (${allocated.toLocaleString()}${uPart} authorized)${lineHint}${allocTag}` +
            (trucks > 0 ? ` · ${trucks} truck(s) still in hub flow (pending/active)` : '');
        } else {
          const truckPart = trucks > 0 ? ` · ${trucks} truck(s) in progress` : '';
          label =
            `${whName}${storePart} — ${remaining.toLocaleString()} / ${allocated.toLocaleString()}${uPart} remaining` +
            ` (${used.toLocaleString()}${uPart} already on trucks)${truckPart}${lineHint}${allocTag}`;
        }

        return { value: String(a.id), label, disabled: complete };
      }),
    [warehouseAssignments, usedQtyByAssignmentId, openTruckCountByAssignmentId, orderLines.length]
  );

  useEffect(() => {
    setAssignmentId(null);
    setExplicitWarehouseId(null);
    setAuthorizedUnitId(null);
    setNotifyPlannedFacilities(false);
    if (standaloneWarehouseRaMode) {
      setUsePlannedAllocation(false);
    } else if (hasPlannedWarehouseRows) {
      setUsePlannedAllocation(true);
    } else {
      setUsePlannedAllocation(false);
    }
  }, [receiptOrderId, hasPlannedWarehouseRows, standaloneWarehouseRaMode]);

  useEffect(() => {
    const lines = selectedOrder?.receipt_order_lines ?? selectedOrder?.lines ?? [];
    if (lines.length === 1 && lines[0].id != null) {
      setOverrideReceiptLineId(String(lines[0].id));
    } else {
      setOverrideReceiptLineId(null);
    }
  }, [receiptOrderId, selectedOrder?.receipt_order_lines, selectedOrder?.lines]);

  const receiptOrderOptions = receiptOrders.map((o) => {
    const sNorm = String(o.status || '').toLowerCase().replace(/\s+/g, '_');
    const statusSuffix = sNorm === 'completed' ? ' [Complete]' : sNorm === 'in_progress' ? ' [In Progress]' : '';
    return { value: String(o.id), label: `RO-${o.id}${statusSuffix}` };
  });

  const selectedAssignment = warehouseAssignments.find((a) => String(a.id) === assignmentId);

  useEffect(() => {
    if (selectedAssignment?.store_id != null) {
      setSelectedStoreId(String(selectedAssignment.store_id));
    }
  }, [assignmentId, selectedAssignment?.store_id]);

  const overrideLine =
    overrideReceiptLineId != null
      ? orderLines.find((ln) => ln.id != null && String(ln.id) === overrideReceiptLineId)
      : orderLines.length === 1
        ? orderLines[0]
        : undefined;

  const selectedLinePlanned = lineForAssignment(
    selectedAssignment?.receipt_order_line_id != null ? Number(selectedAssignment.receipt_order_line_id) : undefined,
    orderLines
  );

  const effectiveLine = routingByOverride ? overrideLine : selectedLinePlanned;

  const effectiveLineNumericId = effectiveLine?.id != null ? Number(effectiveLine.id) : null;
  const lineTotal =
    effectiveLine != null && !Number.isNaN(Number(effectiveLine.quantity))
      ? Number(effectiveLine.quantity)
      : null;

  const measurementUnitId =
    effectiveLine?.unit_id != null
      ? Number(effectiveLine.unit_id)
      : selectedAssignment?.quantity_unit_id != null
        ? Number(selectedAssignment.quantity_unit_id)
        : undefined;
  const measurementCommodityId = effectiveLine?.commodity_id != null ? Number(effectiveLine.commodity_id) : undefined;

  const measurementUnitLabel = useMemo(() => {
    if (selectedAssignment?.quantity_unit_abbreviation && !routingByOverride)
      return selectedAssignment.quantity_unit_abbreviation;
    if (effectiveLine?.unit_name) return effectiveLine.unit_name;
    if (measurementUnitId == null) return 'units';
    const unit = units.find((u) => u.id === measurementUnitId);
    return unit?.abbreviation || unit?.name || 'units';
  }, [
    selectedAssignment?.quantity_unit_abbreviation,
    effectiveLine?.unit_name,
    measurementUnitId,
    units,
    routingByOverride,
  ]);

  const lineContextKey = `${receiptOrderId ?? ''}:${overrideReceiptLineId ?? ''}:${assignmentId ?? ''}`;

  useEffect(() => {
    if (measurementUnitId == null) {
      setAuthorizedUnitId(null);
      return;
    }
    setAuthorizedUnitId(String(measurementUnitId));
  }, [lineContextKey, measurementUnitId]);

  const usedOnAssignment =
    selectedAssignment != null
      ? usedQtyByAssignmentId.get(Number(selectedAssignment.id)) ?? 0
      : 0;
  const usedDirectLinkedOnAssignment =
    selectedAssignment != null
      ? usedQtyDirectlyLinkedByAssignmentId(orderRAs).get(Number(selectedAssignment.id)) ?? 0
      : 0;
  const usedOrphanAttributedOnAssignment = Math.max(0, usedOnAssignment - usedDirectLinkedOnAssignment);

  const allocatedOnAssignment = Number(selectedAssignment?.quantity ?? 0);
  const remainingOnAssignment = Math.max(0, allocatedOnAssignment - usedOnAssignment);

  const usedOnPlannedLineAllRas = useMemo(() => {
    if (routingByOverride || selectedLinePlanned?.id == null) return 0;
    const lid = Number(selectedLinePlanned.id);
    return orderRAs
      .filter((ra) => ra.status !== 'cancelled')
      .filter((ra) =>
        ra.receipt_order_line_id != null ? Number(ra.receipt_order_line_id) === lid : orderLines.length === 1
      )
      .reduce((s, ra) => s + Number(ra.authorized_quantity || 0), 0);
  }, [routingByOverride, selectedLinePlanned?.id, orderRAs, orderLines.length]);

  const allowedUnitOptions = useMemo(() => {
    if (measurementUnitId == null) return [];

    const lineUnit = units.find((u) => u.id === measurementUnitId);
    const lineOption = {
      value: String(measurementUnitId),
      label: lineUnit
        ? lineUnit.abbreviation
          ? `${lineUnit.name} (${lineUnit.abbreviation})`
          : lineUnit.name
        : measurementUnitLabel,
    };

    if (measurementCommodityId == null) {
      return [lineOption];
    }

    const convertible = units
      .filter((unit) => {
        if (unit.id === measurementUnitId) return true;
        return (
          findDirectedMultiplier(unit.id, measurementUnitId, measurementCommodityId, uomConversions) != null
        );
      })
      .map((unit) => ({
        value: String(unit.id),
        label: unit.abbreviation ? `${unit.name} (${unit.abbreviation})` : unit.name,
      }));

    const seen = new Set<string>();
    return [lineOption, ...convertible].filter((opt) => {
      if (seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    });
  }, [measurementUnitId, measurementCommodityId, units, uomConversions, measurementUnitLabel]);

  const destinationWarehouseReady =
    !routingByOverride ||
    Boolean(
      explicitWarehouseId ||
        (isWarehouseManager && isStandaloneAssignment && scopedWarehouseId != null)
    );

  const enteredQty = Number(authorizedQuantity);
  const previewMultiplier = useMemo(() => {
    if (!effectiveLine || !authorizedUnitId || measurementUnitId == null) return null;
    if (Number(authorizedUnitId) === measurementUnitId) return 1;
    if (measurementCommodityId == null) return null;
    return findDirectedMultiplier(
      Number(authorizedUnitId),
      measurementUnitId,
      measurementCommodityId,
      uomConversions
    );
  }, [
    effectiveLine,
    authorizedUnitId,
    measurementUnitId,
    measurementCommodityId,
    uomConversions,
  ]);
  const previewNormalizedQty =
    Number.isFinite(enteredQty) && enteredQty > 0 && previewMultiplier != null
      ? Number((enteredQty * previewMultiplier).toFixed(6))
      : null;

  const lineRemainingPlanned =
    !routingByOverride && lineTotal != null ? Math.max(0, lineTotal - usedOnPlannedLineAllRas) : null;
  const exceedsLineTotalPlanned =
    !routingByOverride &&
    lineRemainingPlanned != null &&
    previewNormalizedQty != null &&
    previewNormalizedQty - lineRemainingPlanned > 0.0001;

  const exceedsRemainingAssignment =
    !routingByOverride && previewNormalizedQty != null && previewNormalizedQty - remainingOnAssignment > 0.0001;
  const remainingAfterThisTruckAssignment =
    previewNormalizedQty != null && !routingByOverride
      ? Math.max(0, Number((remainingOnAssignment - previewNormalizedQty).toFixed(6)))
      : null;

  const usedOnReceiptLineApprox = useMemo(() => {
    if (routingByOverride && effectiveLine?.id != null && orderRAs.length > 0) {
      const lid = Number(effectiveLine.id);
      return orderRAs
        .filter((ra) => ra.status !== 'cancelled')
        .filter((ra) =>
          ra.receipt_order_line_id != null ? Number(ra.receipt_order_line_id) === lid : orderLines.length === 1
        )
        .reduce((s, ra) => s + Number(ra.authorized_quantity || 0), 0);
    }
    return 0;
  }, [routingByOverride, effectiveLine?.id, orderRAs, orderLines.length]);

  const lineRemainingApprox =
    lineTotal != null && routingByOverride ? Math.max(0, lineTotal - usedOnReceiptLineApprox) : null;
  const exceedsLineTotal =
    routingByOverride &&
    lineRemainingApprox != null &&
    previewNormalizedQty != null &&
    previewNormalizedQty - lineRemainingApprox > 0.0001;

  const warehouseOptionsRouting = hubWarehouses.map((w) => ({
    value: String(w.id),
    label: `${w.name} (#${w.id})`,
  }));

  const receiptLineOptions = orderLines
    .filter((ln) => ln.id != null)
    .map((ln) => ({
      value: String(ln.id),
      label: `${ln.line_reference_no ?? `Line ${ln.id}`} — ${Number(ln.quantity ?? 0).toLocaleString()} ${ln.unit_name ?? ''}`,
    }));

  const directToStorekeepers =
    isWarehouseManager && isStandaloneAssignment && standaloneStores.length === 1;
  const collectStorekeeperAssignment =
    isWarehouseManager &&
    isStandaloneAssignment &&
    assignableStorekeepers.length > 0 &&
    !directToStorekeepers;
  const showIndependentStoreSelection =
    isWarehouseManager && isStandaloneAssignment && standaloneStores.length > 0;
  const showIndependentAssignmentSection = collectStorekeeperAssignment || showIndependentStoreSelection;
  const storekeeperOptions = assignableStorekeepers.map((sk) => ({
    value: String(sk.id),
    label: sk.store_name ? `${sk.name} (${sk.store_name})` : sk.name,
  }));
  const storeOptions = Array.from(
    new Map(
      [
        ...standaloneStores.map((store) => [String(store.id), store.name] as const),
        ...assignableStorekeepers
          .filter((sk) => sk.store_id != null)
          .map((sk) => [String(sk.store_id), sk.store_name || `Store #${sk.store_id}`] as const),
      ]
    ).entries()
  ).map(([value, label]) => ({ value, label }));

  const plannedIdsForChosenLine =
    effectiveLineNumericId != null
      ? plannedWarehouseIdsOnLine(assignmentsAll, effectiveLineNumericId, orderLines.length === 1)
      : [];

  const planDeviates =
    routingByOverride &&
    plannedIdsForChosenLine.length > 0 &&
    explicitWarehouseId != null &&
    !plannedIdsForChosenLine.includes(Number(explicitWarehouseId));

  const planAdvisoryNotify =
    routingByOverride &&
    notifyPlannedFacilities &&
    plannedIdsForChosenLine.length > 0 &&
    explicitWarehouseId != null &&
    plannedIdsForChosenLine.includes(Number(explicitWarehouseId));

  const selectedInputUnit = authorizedUnitId ? units.find((u) => u.id === Number(authorizedUnitId)) : undefined;
  const selectedInputUnitLabel = selectedInputUnit ? selectedInputUnit.abbreviation || selectedInputUnit.name : '';

  const commodityIdForPackaging =
    effectiveLine?.commodity_id != null ? Number(effectiveLine.commodity_id) : null;
  const commodityRefForPackaging = useMemo(
    () =>
      commodityIdForPackaging != null
        ? commodityRefs.find((c) => c.id === commodityIdForPackaging)
        : undefined,
    [commodityRefs, commodityIdForPackaging]
  );

  const createMutation = useMutation({
    mutationFn: () => {
      if (
        !receiptOrderId ||
        !transporterName.trim() ||
        !authorizedUnitId ||
        !authorizedQuantity ||
        !driverName ||
        !driverIdNumber ||
        !truckPlateNumber
      ) {
        throw new Error('Please fill in all required fields');
      }
      const enteredQtyLocal = Number(authorizedQuantity);
      if (!Number.isFinite(enteredQtyLocal) || enteredQtyLocal <= 0) {
        throw new Error('Enter a quantity greater than zero');
      }
      if (measurementUnitId == null || !effectiveLine) {
        throw new Error('Select receipt order line and destination so quantity units resolve.');
      }
      const unitMultiplier =
        Number(authorizedUnitId) === measurementUnitId
          ? 1
          : measurementCommodityId != null
            ? findDirectedMultiplier(
                Number(authorizedUnitId),
                measurementUnitId,
                measurementCommodityId,
                uomConversions
              )
            : null;
      if (unitMultiplier == null) {
        throw new Error('Selected unit cannot be converted to the receipt order line unit');
      }
      const normalizedQty = Number((enteredQtyLocal * unitMultiplier).toFixed(6));

      const payloadReceiptLineId: number | null =
        effectiveLine.id != null ? Number(effectiveLine.id) : null;

      if (!routingByOverride) {
        if (hasPlannedWarehouseRows && !assignmentId) {
          throw new Error('Select a warehouse assignment for this receipt order');
        }
        if (exceedsRemainingAssignment) {
          throw new Error(
            `Cannot authorize ${normalizedQty.toLocaleString()} ${measurementUnitLabel}; only ${remainingOnAssignment.toLocaleString()} ${measurementUnitLabel} remains for this warehouse`
          );
        }
        if (exceedsLineTotalPlanned) {
          throw new Error(
            `Cannot authorize ${normalizedQty.toLocaleString()} ${measurementUnitLabel}; only ${(lineRemainingPlanned ?? 0).toLocaleString()} ${measurementUnitLabel} remains on the receipt order line after trucks already on file`
          );
        }
        const plannedStoreId =
          selectedStoreId != null
            ? Number(selectedStoreId)
            : selectedAssignment?.store_id != null
              ? Number(selectedAssignment.store_id)
              : undefined;
        return createReceiptAuthorization({
          receipt_order_id: Number(receiptOrderId),
          receipt_order_assignment_id: assignmentId ? Number(assignmentId) : null,
          receipt_order_line_id: payloadReceiptLineId,
          store_id: plannedStoreId,
          transporter_name: transporterName.trim(),
          authorized_quantity: normalizedQty,
          authorized_quantity_input: enteredQtyLocal,
          authorized_quantity_input_unit_id: Number(authorizedUnitId),
          driver_name: driverName.trim(),
          driver_id_number: driverIdNumber.trim(),
          truck_plate_number: truckPlateNumber.trim(),
          waybill_number: waybillNumber.trim() || undefined,
        });
      }

      const destinationWarehouseId =
        explicitWarehouseId ??
        (isWarehouseManager && scopedWarehouseId != null ? String(scopedWarehouseId) : null);
      if (!destinationWarehouseId) {
        throw new Error('Select a destination warehouse');
      }
      if (orderLines.length > 1 && !overrideReceiptLineId) {
        throw new Error('Select which receipt order line this truck belongs to');
      }
      if (exceedsLineTotal) {
        throw new Error('Quantity exceeds remaining quantity on the selected receipt order line');
      }

      return createReceiptAuthorization({
        receipt_order_id: Number(receiptOrderId),
        receipt_order_assignment_id: null,
        receipt_order_line_id: payloadReceiptLineId,
        warehouse_id: Number(destinationWarehouseId),
        store_id: selectedStoreId ? Number(selectedStoreId) : undefined,
        transporter_name: transporterName.trim(),
        authorized_quantity: normalizedQty,
        authorized_quantity_input: enteredQtyLocal,
        authorized_quantity_input_unit_id: Number(authorizedUnitId),
        driver_name: driverName.trim(),
        driver_id_number: driverIdNumber.trim(),
        truck_plate_number: truckPlateNumber.trim(),
        waybill_number: waybillNumber.trim() || undefined,
        notify_planned_facilities: notifyPlannedFacilities || undefined,
      });
    },
    onSuccess: async (ra) => {
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      let assignedStorekeeper = false;
      if (selectedStorekeeperId && !directToStorekeepers) {
        try {
          await assignStorekeeperToRa(ra.id, {
            storekeeper_user_id: Number(selectedStorekeeperId),
            ...(selectedStoreId ? { store_id: Number(selectedStoreId) } : {}),
          });
          assignedStorekeeper = true;
          queryClient.invalidateQueries({ queryKey: ['receipt_authorizations', ra.id] });
          queryClient.invalidateQueries({ queryKey: ['assignable_storekeepers'] });
        } catch (error: unknown) {
          notifications.show({
            title: 'Storekeeper assignment failed',
            message:
              (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
              'Receipt Authorization was created. Assign the storekeeper from the detail page.',
            color: 'orange',
          });
        }
      }
      notifications.show({
        title: 'Receipt Authorization Created',
        message: assignedStorekeeper
          ? `${ra.reference_no} created. The selected storekeeper will be notified.`
          : directToStorekeepers
            ? `${ra.reference_no} created. Storekeepers at this warehouse will be notified automatically.`
            : `${ra.reference_no} created. Warehouse staff will be notified.`,
        color: 'green',
      });
      navigate(`${raBasePath}/${ra.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          (error instanceof Error ? error.message : 'Failed to create Receipt Authorization'),
        color: 'red',
      });
    },
  });

  const qtySectionEnabled =
    !routingByOverride
      ? !!selectedAssignment && allowedUnitOptions.length > 0
      : destinationWarehouseReady && !!effectiveLine && allowedUnitOptions.length > 0;

  const packagingAuthorizedHint = useMemo(() => {
    if (!qtySectionEnabled || !Number.isFinite(enteredQty) || enteredQty <= 0 || !authorizedUnitId) {
      return null;
    }
    const destUnitId = Number(authorizedUnitId);
    const pkgSize =
      effectiveLine?.packaging_size != null && !Number.isNaN(Number(effectiveLine.packaging_size))
        ? Number(effectiveLine.packaging_size)
        : commodityRefForPackaging?.package_size ?? null;
    const pkgLabel =
      effectiveLine?.packaging_unit_name ?? commodityRefForPackaging?.package_unit_name ?? null;
    return computePackagingPackagesHint({
      qty: enteredQty,
      destUnitId,
      commodityId: measurementCommodityId ?? null,
      packagingSize: pkgSize,
      packagingUnitLabel: pkgLabel,
      packageUnitPerPackageNumericId: commodityRefForPackaging?.package_unit_per_package_id ?? null,
      packageUnitPerPackageName: commodityRefForPackaging?.package_unit_per_package_name ?? null,
      fallbackBatchUnitNumericId: commodityRefForPackaging?.unit_id ?? measurementUnitId ?? null,
      units,
      uomConversions,
    });
  }, [
    qtySectionEnabled,
    enteredQty,
    authorizedUnitId,
    effectiveLine?.packaging_size,
    effectiveLine?.packaging_unit_name,
    commodityRefForPackaging,
    measurementCommodityId,
    measurementUnitId,
    units,
    uomConversions,
  ]);

  const disableSubmit =
    createMutation.isPending ||
    !transporterName.trim() ||
    (!routingByOverride &&
      ((!assignmentId && hasPlannedWarehouseRows) ||
        !authorizedUnitId ||
        remainingOnAssignment <= 0 ||
        exceedsRemainingAssignment ||
        exceedsLineTotalPlanned)) ||
    (routingByOverride &&
      (!destinationWarehouseReady ||
        !effectiveLine ||
        !authorizedUnitId ||
        (orderLines.length > 1 && !overrideReceiptLineId) ||
        exceedsLineTotal)) ||
    (collectStorekeeperAssignment && !selectedStorekeeperId);

  return (
    <Stack gap="md">
      <Group>
        <Button variant="default" onClick={() => navigate(raBasePath)}>
          ← Back
        </Button>
        <Title order={2}>New Receipt Authorization</Title>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {standaloneWarehouseRaMode
              ? 'Create one Receipt Authorization per truck for your independent warehouse. Quantity is capped by the receipt order line total; store and storekeeper can be assigned on this form or later on the RA detail page.'
              : isWarehouseManager
                ? 'Create one Receipt Authorization per truck for this warehouse. Each truck authorizes inbound quantity against a warehouse allocation from the Receipt Order plan; storekeepers use this to run inspection and GRN.'
                : 'Create one Receipt Authorization per truck. You can follow hub→warehouse rows from the Receipt Order allocation, or route directly to a warehouse under your hub when the plan is only guidance; quantity is always capped by the receipt order line total. Store assignment stays on the Receipt Order.'}
          </Text>

          <Divider label="Receipt Order" labelPosition="left" />

          <SearchableSelect
            label="Receipt Order"
            placeholder="Select a confirmed receipt order"
            data={receiptOrderOptions}
            value={receiptOrderId}
            onChange={setReceiptOrderId}
            searchable
            required
            description="Includes completed for rare legacy rows; prefer orders still in hub flow. New RAs stay blocked if the order is truly complete at the API."
          />

          {receiptOrderId && hasPlannedWarehouseRows && !standaloneWarehouseRaMode ? (
            <Checkbox
              label="Use planned warehouse allocation (Receipt Order assignment rows)"
              checked={usePlannedAllocation}
              onChange={(e) => setUsePlannedAllocation(e.currentTarget.checked)}
            />
          ) : null}

          {!routingByOverride && assignmentOptions.length > 0 ? (
            <>
              <SearchableSelect
                label={isWarehouseManager && isStandaloneAssignment ? 'Store assignment (planned)' : 'Warehouse Assignment'}
                placeholder={
                  isWarehouseManager && isStandaloneAssignment
                    ? 'Select store allocation from the plan'
                    : 'Select warehouse allocation'
                }
                data={assignmentOptions}
                value={assignmentId}
                onChange={setAssignmentId}
                searchable
                required
                description={
                  isWarehouseManager && isStandaloneAssignment
                    ? 'Each row is a planned store allocation: remaining / plan shows how much you can still put on trucks for that store.'
                    : 'Each row is a planned hub→warehouse bucket: remaining / plan shows how much you can still put on trucks. Rows marked plan complete are disabled.'
                }
              />
              {assignmentOptions.every((o) => o.disabled) ? (
                <Alert color="yellow" variant="light" title="All planned buckets are full">
                  Every warehouse allocation row for this receipt order already has the full planned quantity on
                  receipt authorizations. Uncheck planned allocation if you intentionally need an extra truck outside
                  the plan; quantity is still capped by the receipt order line.
                </Alert>
              ) : null}
            </>
          ) : null}

          {routingByOverride && receiptOrderId ? (
            <>
              {standaloneWarehouseRaMode && scopedWarehouseId ? (
                <Alert color="blue" variant="light" title="Independent warehouse">
                  Trucks are authorized for{' '}
                  <strong>{scopedWarehouseName ?? `warehouse #${scopedWarehouseId}`}</strong> on this receipt order.
                  Store assignment from the receipt order plan is optional — assign a store or storekeeper below if
                  you already know the destination.
                </Alert>
              ) : !hubIdForRo ? (
                <Alert icon={<IconAlertCircle size={16} />} title="Hub required" color="yellow">
                  This receipt order has no hub on file; authorize only after hub routing exists on the order, or use an
                  order tied to your hub assignment.
                </Alert>
              ) : (
                <SearchableSelect
                  label="Destination warehouse"
                  placeholder="Select warehouse under hub"
                  data={warehouseOptionsRouting}
                  value={explicitWarehouseId}
                  onChange={setExplicitWarehouseId}
                  searchable
                  required
                  description="Direct hub routing — does not consume a particular assignment row quantity bucket"
                />
              )}
              {orderLines.length > 1 ? (
                <SearchableSelect
                  label="Receipt order line"
                  placeholder="Which commodity line on the RO?"
                  data={receiptLineOptions}
                  value={overrideReceiptLineId}
                  onChange={setOverrideReceiptLineId}
                  searchable
                  required
                />
              ) : null}
              {routingByOverride && plannedIdsForChosenLine.length > 0 && explicitWarehouseId ? (
                <>
                  <Alert color={planDeviates ? 'orange' : 'teal'} variant="light" title="Routing impact">
                    <Text size="sm">
                      Planned warehouses for this line:{' '}
                      {plannedIdsForChosenLine.length ? plannedIdsForChosenLine.map((id) => `#${id}`).join(', ') : '—'}
                      . Chosen: #{explicitWarehouseId}.
                    </Text>
                    <Text size="sm" mt={6}>
                      {planDeviates
                        ? 'Staff at planned warehouses (except the chosen one) will be notified this truck does not serve their planned destination.'
                        : 'This truck still lands at a warehouse that appears on the plan for this line. No automatic diversion alert unless you enable the option below.'}
                    </Text>
                  </Alert>
                  <Checkbox
                    label="Notify planned warehouse contacts anyway (optional advisory)"
                    checked={notifyPlannedFacilities}
                    onChange={(e) => setNotifyPlannedFacilities(e.currentTarget.checked)}
                  />
                  {planAdvisoryNotify && (
                    <Text size="xs" c="dimmed">
                      An advisory notification will also be sent to planned warehouse/store contacts for this line.
                    </Text>
                  )}
                </>
              ) : routingByOverride && plannedIdsForChosenLine.length === 0 && explicitWarehouseId ? (
                <Alert color="gray" variant="light" title="No warehouse plan rows for this line">
                  Routing is recorded for traceability; nobody was notified from assignment rows because none exist with a
                  warehouse for this line.
                </Alert>
              ) : null}
            </>
          ) : null}

          {selectedAssignment && !routingByOverride && (
            <Alert
              color="blue"
              variant="light"
              title={
                isWarehouseManager && isStandaloneAssignment
                  ? 'Selected store allocation'
                  : 'Selected Warehouse Allocation'
              }
            >
              <Text size="sm">
                <strong>
                  {isWarehouseManager && isStandaloneAssignment
                    ? `Store plan (alloc #${selectedAssignment.id})`
                    : `Hub → warehouse plan (this row, alloc #${selectedAssignment.id})`}
                </strong>
                : up to{' '}
                {allocatedOnAssignment.toLocaleString()} {measurementUnitLabel} for this bucket. Trucks counted toward
                this row: {usedOnAssignment.toLocaleString()} {measurementUnitLabel} (
                {usedDirectLinkedOnAssignment.toLocaleString()} linked to this plan row
                {usedOrphanAttributedOnAssignment > 0.0001
                  ? ` + ${usedOrphanAttributedOnAssignment.toLocaleString()} same warehouse/line without a link`
                  : ''}
                ). You can still put on trucks for <em>this</em> row:{' '}
                <strong>
                  {remainingOnAssignment.toLocaleString()} {measurementUnitLabel}
                </strong>
                .
              </Text>
              {lineTotal != null && !(isWarehouseManager && isStandaloneAssignment) ? (
                <Text size="sm" mt={8}>
                  <strong>Receipt order line ceiling</strong>: {lineTotal.toLocaleString()} {measurementUnitLabel}{' '}
                  ordered; {usedOnPlannedLineAllRas.toLocaleString()} already authorized on this line (all trucks).
                  Room left before hitting the line cap:{' '}
                  <strong>
                    {(lineRemainingPlanned ?? Math.max(0, lineTotal - usedOnPlannedLineAllRas)).toLocaleString()}{' '}
                    {measurementUnitLabel}
                  </strong>
                  .
                </Text>
              ) : null}
              {(openTruckCountByAssignmentId.get(Number(selectedAssignment.id)) ?? 0) > 0 ? (
                <Text size="sm" mt={6}>
                  {`${openTruckCountByAssignmentId.get(Number(selectedAssignment.id))} receipt authorization(s) for this row are still pending or active at the warehouse.`}
                </Text>
              ) : null}
            </Alert>
          )}
          {selectedAssignment && !routingByOverride && exceedsLineTotalPlanned && previewNormalizedQty != null && (
            <Alert color="red" title="Quantity exceeds receipt line ceiling">
              {`This truck converts to ${previewNormalizedQty.toLocaleString()} ${measurementUnitLabel}, but only ${(lineRemainingPlanned ?? 0).toLocaleString()} ${measurementUnitLabel} remains on the receipt order line after trucks already on file.`}
            </Alert>
          )}
          {selectedAssignment && !routingByOverride && exceedsRemainingAssignment && previewNormalizedQty != null && (
            <Alert color="red" title="Quantity exceeds allocation">
              {`This truck quantity converts to ${previewNormalizedQty.toLocaleString()} ${measurementUnitLabel}, but only ${remainingOnAssignment.toLocaleString()} ${measurementUnitLabel} remains for this warehouse assignment.`}
            </Alert>
          )}
          {effectiveLine && previewNormalizedQty != null && (
            <Alert
              color={exceedsRemainingAssignment || exceedsLineTotal || exceedsLineTotalPlanned ? 'red' : 'teal'}
              variant="light"
              title="Unit conversion preview"
            >
              {`${enteredQty.toLocaleString()} ${selectedInputUnitLabel} = ${previewNormalizedQty.toLocaleString()} ${measurementUnitLabel}. `}
              {!routingByOverride && remainingAfterThisTruckAssignment != null
                ? `Remaining on assignment after this truck: ${remainingAfterThisTruckAssignment.toLocaleString()} ${measurementUnitLabel}.`
                : null}
              {!routingByOverride && lineTotal != null ? (
                <Text size="sm" mt={4} component="span">
                  {` Line total ${lineTotal.toLocaleString()} ${measurementUnitLabel}; all trucks on this line: ${usedOnPlannedLineAllRas.toLocaleString()}; remaining under line cap: ${(lineRemainingPlanned ?? 0).toLocaleString()}.`}
                </Text>
              ) : null}
              {routingByOverride && lineTotal != null ? (
                <Text size="sm" mt={4} component="span">
                  {` Line total ${lineTotal.toLocaleString()} ${measurementUnitLabel}; other RAs on this line (approx.): ${usedOnReceiptLineApprox.toLocaleString()}; remaining (approx.): ${(lineRemainingApprox ?? 0).toLocaleString()}. Final cap is enforced on save.`}
                </Text>
              ) : null}
            </Alert>
          )}

          <Group grow align="flex-start">
            <NumberInput
              label="Authorized Quantity"
              placeholder="e.g. 500"
              value={authorizedQuantity}
              onChange={setAuthorizedQuantity}
              min={0.001}
              decimalScale={3}
              required
              error={
                exceedsRemainingAssignment
                  ? `Exceeded assignment: ${previewNormalizedQty?.toLocaleString()} ${measurementUnitLabel} > ${remainingOnAssignment.toLocaleString()} remaining`
                  : exceedsLineTotalPlanned
                    ? `Exceeds line remaining: ${previewNormalizedQty?.toLocaleString()} ${measurementUnitLabel} > ${(lineRemainingPlanned ?? 0).toLocaleString()} ${measurementUnitLabel}`
                    : exceedsLineTotal
                      ? `Exceeds line remaining (approx.): ${previewNormalizedQty?.toLocaleString()} ${measurementUnitLabel} > ${lineRemainingApprox?.toLocaleString()} ${measurementUnitLabel}`
                      : undefined
              }
              description={
                routingByOverride
                  ? `Per truck; converted to receipt order line unit (${measurementUnitLabel})`
                  : `Per truck; converted to ${measurementUnitLabel} and capped by allocation`
              }
            />
            <SearchableSelect
              label="Quantity Unit"
              placeholder="Select unit"
              data={allowedUnitOptions}
              value={authorizedUnitId}
              onChange={setAuthorizedUnitId}
              searchable
              required
              disabled={!qtySectionEnabled}
              description={
                qtySectionEnabled
                  ? `Units convertible to ${measurementUnitLabel}`
                  : routingByOverride
                    ? orderLines.length > 1 && !overrideReceiptLineId
                      ? 'Select the receipt order line first'
                      : !effectiveLine
                        ? 'Select a receipt order with line details first'
                        : 'Confirm destination warehouse for this truck'
                    : 'Select warehouse assignment first'
              }
            />
          </Group>

          {packagingAuthorizedHint ? (
            <Alert color="gray" variant="light" title="Expected packaging">
              <Text size="sm">
                Package spec: <strong>{packagingAuthorizedHint.packageSpec}</strong>
                {' — '}
                approximately <strong>{packagingAuthorizedHint.packagesFormatted}</strong>{' '}
                {packagingAuthorizedHint.containerLabel}
                {!packagingAuthorizedHint.isWholeNumber ? ' (not a whole number of packages)' : ''}.
              </Text>
            </Alert>
          ) : null}

          <Divider label="Vehicle & Driver Details" labelPosition="left" />

          <TextInput
            label="Transporter"
            placeholder="Company or carrier name"
            description="Recorded as typed; reused if this name already exists."
            value={transporterName}
            onChange={(e) => setTransporterName(e.target.value)}
            required
          />

          <Group grow>
            <TextInput
              label="Driver Name"
              placeholder="Full name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              required
            />
            <TextInput
              label="Driver ID Number"
              placeholder="National ID or license number"
              value={driverIdNumber}
              onChange={(e) => setDriverIdNumber(e.target.value)}
              required
            />
          </Group>

          <Group grow>
            <TextInput
              label="Truck Plate Number"
              placeholder="e.g. AA-12345"
              value={truckPlateNumber}
              onChange={(e) => setTruckPlateNumber(e.target.value)}
              required
              style={{ fontFamily: 'monospace' }}
            />
            <TextInput
              label="Waybill Number"
              placeholder="Leave blank to auto-generate"
              description="Auto-generated if left blank; enter manually to match an existing waybill document."
              value={waybillNumber}
              onChange={(e) => setWaybillNumber(e.target.value)}
              style={{ fontFamily: 'monospace' }}
            />
          </Group>

          {showIndependentAssignmentSection || directToStorekeepers ? (
            <>
              <Divider
                label={
                  collectStorekeeperAssignment
                    ? 'Storekeeper & Store Assignment'
                    : directToStorekeepers
                      ? 'Storekeeper notification'
                      : 'Store Assignment'
                }
                labelPosition="left"
              />
              {directToStorekeepers ? (
                <Alert color="teal" variant="light">
                  This warehouse has a single store. All eligible storekeepers will be notified automatically when this
                  truck is authorized — no manual assignment is required.
                </Alert>
              ) : (
              <Alert color="blue" variant="light">
                {collectStorekeeperAssignment
                  ? 'Assign the storekeeper now — they will be notified immediately after this truck is authorized.'
                  : 'Select a destination store for this independent warehouse RA. You can leave it blank and assign later.'}
              </Alert>
              )}
              {collectStorekeeperAssignment ? (
                <SearchableSelect
                  label="Storekeeper"
                  placeholder={storekeepersLoading ? 'Loading…' : 'Select storekeeper'}
                  data={storekeeperOptions}
                  value={selectedStorekeeperId}
                  onChange={setSelectedStorekeeperId}
                  searchable
                  required
                  disabled={storekeepersLoading || storekeeperOptions.length === 0}
                />
              ) : null}
              {storeOptions.length > 0 ? (
                <SearchableSelect
                  label="Store (optional)"
                  placeholder={storesLoading ? 'Loading stores…' : 'Use storekeeper default or choose store'}
                  data={storeOptions}
                  value={selectedStoreId}
                  onChange={setSelectedStoreId}
                  clearable
                  searchable
                  disabled={storesLoading}
                />
              ) : null}
            </>
          ) : null}

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => navigate(raBasePath)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={disableSubmit}>
              Create Receipt Authorization
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
