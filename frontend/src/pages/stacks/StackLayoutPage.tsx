import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Divider, Group, Loader, Modal, NumberInput, Progress, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { useForm } from '@mantine/form';
import {
  IconBox,
  IconBuildingWarehouse,
  IconCheck,
  IconDeviceFloppy,
  IconEdit,
  IconInfoCircle,
  IconMapPin,
  IconX,
  IconCalculator,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { AxiosError } from 'axios';
import { createStack, getStacks, updateStack } from '../../api/stacks';
import { getStore, getStores } from '../../api/stores';
import { getCommodityReferences, getUnitReferences } from '../../api/referenceData';
import { getCommodityDefinitions } from '../../api/commodityDefinitions';
import type { CommodityDefinition } from '../../api/commodityDefinitions';
import {
  getReceiptAuthorization,
  getReceiptAuthorizations,
  isRaReadyForStacking,
} from '../../api/receiptAuthorizations';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { finishStacking, startStacking } from '../../api/receiptOrders';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { pickAccessibleStoreId } from '../../utils/stackLayoutStore';
import type { Stack as StackType } from '../../types/stack';
import {
  mtFromVolume,
  stackDimensionHints,
  formatStackFootprintHint,
  dimensionAxisStatus,
  footprintStatus,
  dimensionInputBorderStyle,
  dimensionValidLabel,
  type DimensionFieldStatus,
} from '../../utils/capacityCalculator';

/** Hub / receipt line unit for quantities on this RA (full name or abbreviation from API). */
function raQuantityUnit(ra: ReceiptAuthorization): string {
  return (ra.unit_label ?? ra.unit_name ?? '').trim();
}

/** Unit + qty as typed by the user when the RA was created (e.g. 30 Kuntal). */
function raDisplayUnit(ra: ReceiptAuthorization): string {
  const inputName = (ra.authorized_quantity_input_unit_name ?? '').trim();
  const inputAbbr = (ra.authorized_quantity_input_unit_abbreviation ?? '').trim();
  return inputName || inputAbbr || raQuantityUnit(ra);
}

function raDisplayQty(ra: ReceiptAuthorization): number {
  const v = ra.authorized_quantity_input;
  if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) return Number(v);
  return Number(ra.authorized_quantity);
}

function raLineToInputMultiplier(ra: ReceiptAuthorization): number {
  const input = Number(ra.authorized_quantity_input ?? 0);
  const line = Number(ra.authorized_quantity ?? 0);
  if (input > 0 && line > 0) return input / line;
  return 1;
}

/** True when the hub typed qty in a different unit than the receipt line (e.g. Kuntal vs MT). */
function raUsesInputUnit(ra: ReceiptAuthorization): boolean {
  const uLine = raQuantityUnit(ra);
  const uDisp = raDisplayUnit(ra);
  return Boolean(uDisp && uLine && uDisp !== uLine);
}

function raPrimaryUnit(ra: ReceiptAuthorization): string {
  return raUsesInputUnit(ra) ? raDisplayUnit(ra) : raQuantityUnit(ra);
}

function convertRaLineToInput(value: number, ra: ReceiptAuthorization): number {
  return raUsesInputUnit(ra) ? value * raLineToInputMultiplier(ra) : value;
}

function convertRaInputToLine(value: number, ra: ReceiptAuthorization): number {
  if (!raUsesInputUnit(ra)) return value;
  const m = raLineToInputMultiplier(ra);
  return m > 0 ? value / m : value;
}

type StackFormValues = {
  id?: number;
  code: string;
  stack_status: string;
  /** Officer commodity definition id (same list as Officer → Commodities). */
  commodity_definition_id: string;
  /** Core commodity row id for the selected batch (cats_core_commodities). */
  commodity_id: string;
  commodity_name: string;
  length: number;
  width: number;
  height: number;
  start_x: number;
  start_y: number;
  quantity: number;
  unit_id: string;
  store_id: string;
  reference: string;
};

type DraftArea = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

const STATUS_META: Record<
  string,
  {
    label: string;
    fill: string;
    border: string;
    color: string;
    badge: string;
  }
> = {
  active: {
    label: 'Active',
    fill: '#1fbe84',
    border: '#16a06d',
    color: '#ffffff',
    badge: '#e7fbf3',
  },
  reserved: {
    label: 'Reserved',
    fill: '#f6a313',
    border: '#d68a00',
    color: '#ffffff',
    badge: '#fff4dd',
  },
  inactive: {
    label: 'Inactive',
    fill: '#edf1f7',
    border: '#c7d0df',
    color: '#5f6b7a',
    badge: '#f4f6fa',
  },
  empty: {
    label: 'Empty',
    fill: '#ffffff',
    border: '#c7d0df',
    color: '#a4afbf',
    badge: '#ffffff',
  },
};

const stackStatusOptions = [
  { value: 'active', label: 'Active / Allocated' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'empty', label: 'Empty' },
];

const baseInputStyles = {
  label: {
    fontSize: '0.74rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: '#42506a',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#eaf0ff',
    borderColor: '#d5def2',
    color: '#1f2a44',
    fontWeight: 700,
  },
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MIN_DRAW_SIZE_METERS = 0.5;
/** Meters — treat touching edges as non-overlap */
const STACK_LAYOUT_EPS = 1e-4;

/** Reject bad `store_id` query values (e.g. `store_id=undefined` from template literals). */
function sanitizeStoreIdParam(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (t === '' || t === 'undefined' || t === 'null') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return String(n);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Axis-aligned footprint overlap in floor (X/Y) plane; length along X, width along Y. */
function rectanglesOverlap2D(
  ax: number,
  ay: number,
  aLen: number,
  aWid: number,
  bx: number,
  by: number,
  bLen: number,
  bWid: number,
  eps = STACK_LAYOUT_EPS
): boolean {
  if (aLen <= 0 || aWid <= 0 || bLen <= 0 || bWid <= 0) return false;
  return (
    ax < bx + bLen - eps &&
    bx < ax + aLen - eps &&
    ay < by + bWid - eps &&
    by < ay + aWid - eps
  );
}

function isStackPositionedOnFloor(s: StackType): boolean {
  return (
    s.start_x != null &&
    s.start_y != null &&
    Number(s.length) > STACK_LAYOUT_EPS &&
    Number(s.width) > STACK_LAYOUT_EPS
  );
}

/** Footprint must fit inside the store floor (same bounds as draw + backend validation). */
function isStackWithinStoreFloor(
  s: StackType,
  storeLength: number,
  storeWidth: number
): boolean {
  if (!isStackPositionedOnFloor(s)) return false;
  const sx = Number(s.start_x);
  const sy = Number(s.start_y);
  const sl = Number(s.length);
  const sw = Number(s.width);
  return (
    sx >= -STACK_LAYOUT_EPS &&
    sy >= -STACK_LAYOUT_EPS &&
    sx + sl <= storeLength + STACK_LAYOUT_EPS &&
    sy + sw <= storeWidth + STACK_LAYOUT_EPS
  );
}

function firstOverlappingStack(
  stacks: StackType[],
  footprint: { start_x: number; start_y: number; length: number; width: number },
  excludeId?: number
): StackType | null {
  for (const s of stacks) {
    if (excludeId != null && Number(s.id) === Number(excludeId)) continue;
    if (!isStackPositionedOnFloor(s)) continue;
    if (
      rectanglesOverlap2D(
        footprint.start_x,
        footprint.start_y,
        footprint.length,
        footprint.width,
        Number(s.start_x),
        Number(s.start_y),
        Number(s.length),
        Number(s.width)
      )
    ) {
      return s;
    }
  }
  return null;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function getStatusMeta(status?: string) {
  return STATUS_META[status || 'empty'] || STATUS_META.empty;
}

function createInitialValues(storeId: string | null): StackFormValues {
  return {
    code: '',
    stack_status: 'empty',
    commodity_definition_id: '',
    commodity_id: '',
    commodity_name: '',
    length: 6,
    width: 4,
    height: 0,
    start_x: 0,
    start_y: 0,
    quantity: 0,
    unit_id: '',
    store_id: storeId || '',
    reference: '',
  };
}

export default function StackLayoutPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [storeId, setStoreId] = useState<string | null>(() =>
    sanitizeStoreIdParam(searchParams.get('store_id'))
  );
  const [editMode, setEditMode] = useState(searchParams.get('mode') === 'create');
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedStack, setSelectedStack] = useState<StackType | null>(null);
  const [draftArea, setDraftArea] = useState<DraftArea | null>(null);
  const draftPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // ── Receipt Authorization selector state (storekeeper stacking flow) ──
  const [selectedRAId, setSelectedRAId] = useState<string | null>(
    searchParams.get('receipt_authorization_id')
  );
  const [finishStackingModalOpen, setFinishStackingModalOpen] = useState(false);

  // ── Placement state — tracks how much of the RA goods go into each stack ──
  const [placements, setPlacements] = useState<Record<string, number>>({});
  const [placementModalStack, setPlacementModalStack] = useState<StackType | null>(null);

  const autoPrepare = searchParams.get('auto_prepare') === 'true';

  // Strip invalid store_id from the URL (e.g. legacy links with store_id=undefined).
  useEffect(() => {
    const raw = searchParams.get('store_id');
    if (raw == null || raw === '') return;
    if (sanitizeStoreIdParam(raw) !== null) return;
    const next = new URLSearchParams(searchParams);
    next.delete('store_id');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Get active assignment context for filtering
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userStoreId = activeAssignment?.store?.id;
  const userHubId = activeAssignment?.hub?.id;
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const isStorekeeper = roleSlug === 'storekeeper';
  const isHubManager = roleSlug === 'hub_manager';
  const driverArrivalRAId = searchParams.get('receipt_authorization_id');
  const isDriverArrivalStacking = isStorekeeper && Boolean(driverArrivalRAId);

  const { data: driverArrivalRAById } = useQuery({
    queryKey: ['receipt_authorization', driverArrivalRAId],
    queryFn: () => getReceiptAuthorization(Number(driverArrivalRAId)),
    enabled: isDriverArrivalStacking && Boolean(driverArrivalRAId),
  });

  /** Populated for storekeepers from /me/assignments (store-level includes parent warehouse). */
  const storekeeperWarehouseId =
    isStorekeeper && activeAssignment?.warehouse?.id != null
      ? activeAssignment.warehouse.id
      : isStorekeeper && driverArrivalRAById?.warehouse_id != null
        ? driverArrivalRAById.warehouse_id
        : undefined;

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: [
      'stores',
      {
        warehouse_id: isWarehouseManager ? userWarehouseId : storekeeperWarehouseId,
        hub_id: isHubManager ? userHubId : undefined,
      },
    ],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) {
        return getStores({ warehouse_id: userWarehouseId });
      }
      if (isStorekeeper && storekeeperWarehouseId != null) {
        return getStores({ warehouse_id: storekeeperWarehouseId });
      }
      if (isHubManager && userHubId) {
        // For hub managers, get stores from warehouses in their hub
        return getStores(); // Backend should handle hub-level filtering
      }
      return getStores();
    },
  });

  const effectivePickerStoreId = sanitizeStoreIdParam(storeId);
  const accessibleStoreIds = useMemo(() => stores.map((s) => s.id), [stores]);

  const validatedStoreIdNum = useMemo(() => {
    if (storesLoading) return null;
    return pickAccessibleStoreId(
      [
        effectivePickerStoreId ? Number(effectivePickerStoreId) : null,
        isDriverArrivalStacking && driverArrivalRAById?.store_id != null
          ? driverArrivalRAById.store_id
          : null,
        userStoreId ?? null,
      ],
      accessibleStoreIds
    );
  }, [
    storesLoading,
    accessibleStoreIds,
    effectivePickerStoreId,
    userStoreId,
    isDriverArrivalStacking,
    driverArrivalRAById?.store_id,
  ]);

  const resolvedStoreIdEarly =
    validatedStoreIdNum != null ? String(validatedStoreIdNum) : null;

  // Drop stale store_id from URL/state (e.g. deleted store or old assignment).
  useEffect(() => {
    if (storesLoading) return;

    const rawUrl = searchParams.get('store_id');
    const sanitizedUrl = sanitizeStoreIdParam(rawUrl);
    const urlInvalid =
      sanitizedUrl != null &&
      !accessibleStoreIds.includes(Number(sanitizedUrl));

    const stateInvalid =
      storeId != null &&
      sanitizeStoreIdParam(storeId) != null &&
      !accessibleStoreIds.includes(Number(storeId));

    if (!urlInvalid && !stateInvalid) return;

    const nextId =
      validatedStoreIdNum != null ? String(validatedStoreIdNum) : null;

    if (storeId !== nextId) setStoreId(nextId);

    const next = new URLSearchParams(searchParams);
    next.delete('store_id');
    if (nextId) next.set('store_id', nextId);
    setSearchParams(next, { replace: true });
  }, [
    storesLoading,
    accessibleStoreIds,
    validatedStoreIdNum,
    searchParams,
    setSearchParams,
    storeId,
  ]);

  const stacksFetchParams = useMemo(() => {
    if (!storesLoading && validatedStoreIdNum != null) {
      return { store_id: validatedStoreIdNum };
    }
    if (isWarehouseManager && userWarehouseId) {
      return { warehouse_id: userWarehouseId };
    }
    if (isStorekeeper && storekeeperWarehouseId != null) {
      return { warehouse_id: storekeeperWarehouseId };
    }
    return {};
  }, [
    storesLoading,
    validatedStoreIdNum,
    isWarehouseManager,
    userWarehouseId,
    isStorekeeper,
    storekeeperWarehouseId,
  ]);

  const { data: stacks, isLoading, error, refetch } = useQuery({
    queryKey: ['stacks', stacksFetchParams],
    queryFn: () => getStacks(stacksFetchParams),
    enabled:
      !storesLoading &&
      (Boolean(validatedStoreIdNum) ||
        Boolean(userWarehouseId) ||
        storekeeperWarehouseId != null ||
        isHubManager),
  });

  /** Same payload as Officer → Commodities (batches / core commodity rows). */
  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: () => getCommodityReferences(),
  });

  /** Same list as Officer → Commodities dropdown (admin definitions). */
  const { data: commodityDefinitions = [] } = useQuery({
    queryKey: ['commodity-definitions'],
    queryFn: () => getCommodityDefinitions(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['unit-references'],
    queryFn: () => getUnitReferences(),
  });

  // ── Active RAs with Draft GRN for the storekeeper (store-scoped or whole warehouse) ──
  const { data: activeRAsForStacking = [] } = useQuery({
    queryKey: [
      'receipt_authorizations',
      {
        store_id: userStoreId,
        warehouse_id: isStorekeeper && !userStoreId ? storekeeperWarehouseId : undefined,
        status: 'active',
        stacking: true,
      },
    ],
    queryFn: () =>
      getReceiptAuthorizations({
        status: 'active',
        ...(userStoreId ? { store_id: userStoreId } : {}),
        ...(isStorekeeper && !userStoreId && storekeeperWarehouseId != null
          ? { warehouse_id: storekeeperWarehouseId }
          : {}),
      }),
    enabled: isDriverArrivalStacking && (!!userStoreId || storekeeperWarehouseId != null),
    select: (data: ReceiptAuthorization[]) => data.filter(isRaReadyForStacking),
  });

  const driverArrivalRAsForStacking = isDriverArrivalStacking
    ? (() => {
        const fromList = activeRAsForStacking.filter((ra) => String(ra.id) === driverArrivalRAId);
        if (fromList.length > 0) return fromList;
        if (
          driverArrivalRAById &&
          String(driverArrivalRAById.id) === driverArrivalRAId &&
          isRaReadyForStacking(driverArrivalRAById)
        ) {
          return [driverArrivalRAById];
        }
        return [];
      })()
    : [];

  const selectedDriverArrivalRA = driverArrivalRAsForStacking.find((ra) => String(ra.id) === selectedRAId);
  const canPlaceDriverArrivalGoods = isDriverArrivalStacking && Boolean(selectedDriverArrivalRA);

  useEffect(() => {
    if (isDriverArrivalStacking) {
      setSelectedRAId(driverArrivalRAId);
      return;
    }

    setSelectedRAId(null);
    setPlacements({});
  }, [driverArrivalRAId, isDriverArrivalStacking]);

  // ── Finish Stacking mutation ──
  const finishStackingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRAId) throw new Error('No Receipt Authorization selected');
      const selectedRA = selectedDriverArrivalRA;
      if (!selectedRA) throw new Error('Receipt Authorization not found');

      // Use explicit placements entered by the storekeeper
      const placementList = Object.entries(placements)
        .filter(([, qty]) => qty > 0)
        .map(([stackId, qty]) => ({ stack_id: Number(stackId), quantity: qty }));

      if (placementList.length === 0) throw new Error('Please assign goods to at least one stack before finishing.');

      // Backend requires receipt order status `in_progress` for finish_stacking.
      // The finish_stacking action auto-transitions when receipt_authorization_id is present.
      return finishStacking(selectedRA.receipt_order_id, placementList, selectedRA.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      queryClient.invalidateQueries({ queryKey: ['receipt_authorizations'] });
      notifications.show({
        title: 'Stacking Complete',
        message: 'Stacking finished. The GRN has been confirmed and the Receipt Authorization is now Closed.',
        color: 'green',
      });
      setFinishStackingModalOpen(false);
      setSelectedRAId(null);
      setPlacements({});
      const next = new URLSearchParams(searchParams);
      next.delete('receipt_authorization_id');
      setSearchParams(next, { replace: true });
    },
    onError: (mutationError: AxiosError<{ error?: { message?: string } }>) => {
      notifications.show({
        title: 'Finish Stacking Failed',
        message:
          mutationError.response?.data?.error?.message || 'Failed to finish stacking. Please try again.',
        color: 'red',
      });
    },
  });

  const resolvedStoreId =
    resolvedStoreIdEarly ||
    (stores && stores.length > 0 ? String(stores[0].id) : null);

  const selectedStoreFromList = useMemo(
    () => stores?.find((store) => String(store.id) === resolvedStoreId) || null,
    [resolvedStoreId, stores]
  );

  const resolvedStoreIdNum = resolvedStoreId != null ? Number(resolvedStoreId) : NaN;
  const shouldFetchFallbackStore =
    Boolean(resolvedStoreId) &&
    !Number.isNaN(resolvedStoreIdNum) &&
    !storesLoading &&
    !selectedStoreFromList &&
    accessibleStoreIds.includes(resolvedStoreIdNum);

  const { data: fallbackStore, isLoading: fallbackStoreLoading } = useQuery({
    queryKey: ['store', resolvedStoreId],
    queryFn: () => getStore(resolvedStoreIdNum),
    enabled: shouldFetchFallbackStore,
    retry: false,
  });

  const selectedStore = selectedStoreFromList ?? fallbackStore ?? null;

  const storeStacks = useMemo(() => {
    if (!resolvedStoreId) return stacks || [];
    return stacks?.filter((stack) => String(stack.store_id) === resolvedStoreId) || [];
  }, [resolvedStoreId, stacks]);

  /** All stacks with floor coordinates — used for overlap detection (includes off-board tiles). */
  const positionedStoreStacks = useMemo(
    () => storeStacks.filter(isStackPositionedOnFloor),
    [storeStacks]
  );

  const boardStacks = useMemo(() => {
    if (!selectedStore) return [];
    const sl = Number(selectedStore.length);
    const sw = Number(selectedStore.width);
    return storeStacks.filter((s) => isStackWithinStoreFloor(s, sl, sw));
  }, [storeStacks, selectedStore]);

  const stacksNeedingPlacement = useMemo(() => {
    if (!selectedStore) return storeStacks;
    const sl = Number(selectedStore.length);
    const sw = Number(selectedStore.width);
    return storeStacks.filter((s) => !isStackWithinStoreFloor(s, sl, sw));
  }, [storeStacks, selectedStore]);

  const form = useForm<StackFormValues>({
    initialValues: createInitialValues(storeId),
    validate: {
      code: (value) => (!value ? 'Stack code is required' : null),
      stack_status: (value) => (!value ? 'Stack status is required' : null),
      length: (value) => (value <= 0 ? 'Length must be greater than 0' : null),
      width: (value) => (value <= 0 ? 'Width must be greater than 0' : null),
      height: (value) => (value <= 0 ? 'Height must be greater than 0' : null),
      start_x: (value) => (value < 0 ? 'X position cannot be negative' : null),
      start_y: (value) => (value < 0 ? 'Y position cannot be negative' : null),
      store_id: (value) => (!value ? 'Store is required' : null),
    },
  });

  const definitionSelectOptions = useMemo(
    () =>
      commodityDefinitions.map((d: CommodityDefinition) => {
        const name = (d.name || '').trim() || `Commodity #${d.id}`;
        const cat = (d.category_name || '').trim();
        const label = cat ? `${name} (${cat})` : name;
        return { value: String(d.id), label };
      }),
    [commodityDefinitions]
  );

  const batchSelectOptions = useMemo(() => {
    const defId = form.values.commodity_definition_id;
    if (!defId) return [];

    const definition = commodityDefinitions.find((d) => String(d.id) === defId);
    if (!definition?.name) return [];

    const defName = definition.name.trim().toLowerCase();
    const batches = commodities
      .filter((b) => (b.name || '').trim().toLowerCase() === defName)
      .slice()
      .sort((a, b) => b.id - a.id);

    const options = batches.map((b) => {
      const batchLabel = (b.batch_no || '').trim() || `Lot #${b.id}`;
      const extra = [b.source_name, b.source_type].filter(Boolean).join(' · ');
      const label = extra ? `${batchLabel} · ${extra}` : batchLabel;
      return { value: String(b.id), label };
    });

    const sid = form.values.commodity_id;
    if (
      sid &&
      selectedStack &&
      String(selectedStack.commodity_id) === sid &&
      !options.some((o) => o.value === sid)
    ) {
      const ref = (selectedStack.reference || '').trim() || `Lot #${sid}`;
      options.unshift({ value: sid, label: ref });
    }

    return options;
  }, [
    commodityDefinitions,
    commodities,
    form.values.commodity_definition_id,
    form.values.commodity_id,
    selectedStack,
  ]);

  const unitOptions = useMemo(() => {
    const options = units.map((unit) => {
      const name = (unit.name || '').trim();
      const label = name || `Unit #${unit.id}`;
      return { value: unit.id.toString(), label };
    });

    if (form.values.unit_id && !options.some((o) => o.value === form.values.unit_id.toString())) {
      const fromStack =
        selectedStack && String(selectedStack.unit_id) === String(form.values.unit_id)
          ? (selectedStack.unit_name || '').trim()
          : '';
      const fromUnits = units.find((u) => String(u.id) === String(form.values.unit_id));
      const fallbackName = (fromUnits?.name || '').trim();
      options.unshift({
        value: form.values.unit_id.toString(),
        label: fromStack || fallbackName || `Unit #${form.values.unit_id}`,
      });
    }

    return options;
  }, [units, form.values.unit_id, selectedStack]);

  // Auto-select user's assigned store for storekeepers
  useEffect(() => {
    if (isStorekeeper && userStoreId && !storeId) {
      setStoreId(String(userStoreId));
    }
  }, [isStorekeeper, userStoreId, storeId]);

  /** When creating a new stack, inherit height from the selected store. */
  useEffect(() => {
    if (!modalOpened || selectedStack) return;
    if (selectedStore && (!form.values.height || form.values.height === 0)) {
      form.setFieldValue('height', selectedStore.height);
    }
  }, [modalOpened, selectedStack, selectedStore]); // eslint-disable-line react-hooks/exhaustive-deps

  /** If definitions load after opening edit, attach definition id from stack commodity name. */
  useEffect(() => {
    if (!modalOpened || !selectedStack || form.values.id !== selectedStack.id) return;
    if (form.values.commodity_definition_id) return;
    const def = commodityDefinitions.find(
      (d) => (d.name || '').trim().toLowerCase() === (selectedStack.commodity_name || '').trim().toLowerCase()
    );
    if (def) form.setFieldValue('commodity_definition_id', String(def.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when definitions or modal/stack context changes
  }, [modalOpened, selectedStack, commodityDefinitions, form.values.id, form.values.commodity_definition_id]);

  const upsertMutation = useMutation({
    mutationFn: async (values: StackFormValues) => {
      // Stack is a physical space — do NOT send commodity/unit/quantity when creating.
      // Commodity gets assigned automatically when goods are placed via the stacking flow.
      const payload: Partial<StackType> = {
        code: values.code,
        stack_status: values.stack_status,
        length: values.length,
        width: values.width,
        height: values.height,
        start_x: values.start_x,
        start_y: values.start_y,
        store_id: Number(values.store_id),
      };

      if (values.id) {
        return updateStack(values.id, payload);
      }

      return createStack(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacks'] });
      notifications.show({
        title: 'Success',
        message: selectedStack ? 'Stack updated successfully' : 'Stack created successfully',
        color: 'green',
      });
      setModalOpened(false);
      setSelectedStack(null);
      setDraftArea(null);
    },
    onError: (mutationError: AxiosError<{ error?: { message?: string } }>) => {
      notifications.show({
        title: 'Unable to save stack',
        message:
          mutationError.response?.data?.error?.message || 'Please review the form values and try again.',
        color: 'red',
      });
    },
  });

  const storeOptions = useMemo(() => {
    const fromList =
      stores?.map((store) => ({
        value: String(store.id),
        label: `${store.name} (${store.code})`,
      })) || [];
    if (
      fallbackStore &&
      !fromList.some((o) => o.value === String(fallbackStore.id))
    ) {
      return [
        {
          value: String(fallbackStore.id),
          label: `${fallbackStore.name} (${fallbackStore.code})`,
        },
        ...fromList,
      ];
    }
    return fromList;
  }, [stores, fallbackStore]);

  const totalArea = selectedStore?.usable_space || (selectedStore ? selectedStore.length * selectedStore.width : 0);
  const allocatedArea = storeStacks
    .filter((stack) => !['empty', 'inactive'].includes(stack.stack_status))
    .reduce((sum, stack) => sum + stack.length * stack.width, 0);
  const reservedArea = storeStacks
    .filter((stack) => stack.stack_status === 'reserved')
    .reduce((sum, stack) => sum + stack.length * stack.width, 0);

  const editingStackId = form.values.id ?? selectedStack?.id;
  const stackDimHints = useMemo(() => {
    if (!selectedStore) return null;
    return stackDimensionHints(
      selectedStore.length,
      selectedStore.width,
      selectedStore.height,
      positionedStoreStacks,
      editingStackId
    );
  }, [selectedStore, positionedStoreStacks, editingStackId]);

  const stackFootprint = (form.values.length || 0) * (form.values.width || 0);
  const stackVolumeM3 = stackFootprint * (form.values.height || 0);
  const stackMaxMt = mtFromVolume(stackVolumeM3);

  const stackLengthStatus: DimensionFieldStatus = stackDimHints
    ? dimensionAxisStatus(form.values.length, stackDimHints.maxLengthM)
    : 'empty';
  const stackWidthStatus: DimensionFieldStatus = stackDimHints
    ? dimensionAxisStatus(form.values.width, stackDimHints.maxWidthM)
    : 'empty';
  const stackHeightStatus: DimensionFieldStatus = stackDimHints
    ? dimensionAxisStatus(form.values.height, stackDimHints.maxHeightM)
    : 'empty';
  const stackFloorStatus: DimensionFieldStatus = stackDimHints
    ? footprintStatus(stackFootprint, stackDimHints.remainingFootprintSqm)
    : 'empty';

  const stackDimensionsValid =
    stackLengthStatus === 'valid' &&
    stackWidthStatus === 'valid' &&
    stackHeightStatus === 'valid' &&
    stackFloorStatus === 'valid';

  const siblingStackMt = storeStacks
    .filter((s) => s.id !== editingStackId)
    .reduce((sum, s) => sum + Number(s.max_capacity_mt ?? mtFromVolume(s.length * s.width * s.height)), 0);
  const storeAllocatedMt = Number(selectedStore?.allocated_capacity_mt) || 0;
  const storeMtBudgetRemaining =
    storeAllocatedMt > 0 ? Math.max(storeAllocatedMt - siblingStackMt, 0) : null;
  const stackMtExceedsStore =
    storeAllocatedMt > 0 &&
    stackMaxMt > 0 &&
    siblingStackMt + stackMaxMt > storeAllocatedMt + 1e-6;

  const stackConfigCanSave =
    !selectedStore || (stackDimensionsValid && !stackMtExceedsStore);

  const stackLengthError =
    stackLengthStatus === 'invalid'
      ? `Length cannot exceed ${stackDimHints?.maxLengthM} m (store limit)`
      : stackFloorStatus === 'invalid' && stackFootprint > 0
        ? `Footprint exceeds ${stackDimHints?.remainingFootprintSqm.toLocaleString()} m² left in store`
        : undefined;
  const stackWidthError =
    stackWidthStatus === 'invalid'
      ? `Width cannot exceed ${stackDimHints?.maxWidthM} m (store limit)`
      : undefined;
  const stackHeightError =
    stackHeightStatus === 'invalid'
      ? `Height cannot exceed ${stackDimHints?.maxHeightM} m (store ceiling)`
      : undefined;

  const boardScale = useMemo(() => {
    if (!selectedStore) return 1;
    const lengthScale = 860 / Math.max(selectedStore.length || 1, 1);
    const widthScale = 340 / Math.max(selectedStore.width || 1, 1);
    return Math.min(lengthScale, widthScale);
  }, [selectedStore]);

  const boardWidth = selectedStore ? Math.max(selectedStore.length * boardScale, 480) : 480;
  const boardHeight = selectedStore ? Math.max(selectedStore.width * boardScale, 240) : 240;
  const draftPreview = useMemo(() => {
    if (!draftArea) return null;

    const left = Math.min(draftArea.startX, draftArea.currentX) * boardScale;
    const top = Math.min(draftArea.startY, draftArea.currentY) * boardScale;
    const width = Math.max(Math.abs(draftArea.currentX - draftArea.startX) * boardScale, 0);
    const height = Math.max(Math.abs(draftArea.currentY - draftArea.startY) * boardScale, 0);

    return { left, top, width, height };
  }, [boardScale, draftArea]);

  const openEditor = (stack?: StackType) => {
    if (stack) {
      setSelectedStack(stack);
      const def = commodityDefinitions.find(
        (d) => d.name?.trim().toLowerCase() === (stack.commodity_name || '').trim().toLowerCase()
      );
      form.setValues({
        id: stack.id,
        code: stack.code,
        stack_status: stack.stack_status,
        commodity_definition_id: def ? String(def.id) : '',
        commodity_id: stack.commodity_id != null ? String(stack.commodity_id) : '',
        commodity_name: stack.commodity_name || '',
        length: stack.length,
        width: stack.width,
        height: selectedStore ? selectedStore.height : stack.height,
        start_x: stack.start_x ?? 1,
        start_y: stack.start_y ?? 1,
        quantity: stack.quantity,
        unit_id: String(stack.unit_id || ''),
        store_id: String(stack.store_id),
        reference: stack.reference || '',
      });
    } else {
      setSelectedStack(null);
      const defaults = createInitialValues(resolvedStoreId);
      if (selectedStore) {
        defaults.height = selectedStore.height;
      }
      form.setValues(defaults);
    }

    setModalOpened(true);
  };

  const openCreateEditorFromDraw = (area: DraftArea) => {
    if (!selectedStore) return;

    const startX = Math.min(area.startX, area.currentX);
    const startY = Math.min(area.startY, area.currentY);
    const length = Math.abs(area.currentX - area.startX);
    const width = Math.abs(area.currentY - area.startY);

    if (length < MIN_DRAW_SIZE_METERS || width < MIN_DRAW_SIZE_METERS) {
      notifications.show({
        title: 'Area too small',
        message: 'Drag a larger area on the layout to create a new stack.',
        color: 'yellow',
      });
      setDraftArea(null);
      return;
    }

    if (
      startX < -STACK_LAYOUT_EPS ||
      startY < -STACK_LAYOUT_EPS ||
      startX + length > selectedStore.length + STACK_LAYOUT_EPS ||
      startY + width > selectedStore.width + STACK_LAYOUT_EPS
    ) {
      notifications.show({
        title: 'Outside store floor',
        message: 'Draw only inside the store boundaries. Stacks cannot extend past the floor.',
        color: 'yellow',
      });
      return;
    }

    const overlap = firstOverlappingStack(positionedStoreStacks, { start_x: startX, start_y: startY, length, width });
    if (overlap) {
      notifications.show({
        title: 'Overlaps another stack',
        message: `This area crosses "${overlap.code}". Use empty floor space, or edit or remove the other stack first.`,
        color: 'red',
      });
      return;
    }

    setSelectedStack(null);
    form.setValues({
      ...createInitialValues(resolvedStoreId),
      length: roundToTwo(length),
      width: roundToTwo(width),
      height: selectedStore ? selectedStore.height : 0,
      start_x: roundToTwo(startX),
      start_y: roundToTwo(startY),
    });
    setModalOpened(true);
    setDraftArea(null);
  };

  const readPointFromEvent = (clientX: number, clientY: number) => {
    if (!boardRef.current || !selectedStore) return null;

    const rect = boardRef.current.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / boardScale, 0, selectedStore.length);
    const y = clamp((clientY - rect.top) / boardScale, 0, selectedStore.width);

    return { x, y };
  };

  const handleBoardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode || !selectedStore) return;
    if ((event.target as HTMLElement).closest('[data-stack-tile="true"]')) return;

    const point = readPointFromEvent(event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draftPointerStartRef.current = { x: event.clientX, y: event.clientY };
    setDraftArea({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  };

  const handleBoardPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draftArea) return;

    const point = readPointFromEvent(event.clientX, event.clientY);
    if (!point) return;

    setDraftArea((current) =>
      current
        ? {
            ...current,
            currentX: point.x,
            currentY: point.y,
          }
        : current
    );
  };

  const handleBoardPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draftArea) return;

    const point = readPointFromEvent(event.clientX, event.clientY);
    const completedArea = point
      ? {
          ...draftArea,
          currentX: point.x,
          currentY: point.y,
        }
      : draftArea;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const pointerStart = draftPointerStartRef.current;
    draftPointerStartRef.current = null;
    const movedPixels = pointerStart
      ? Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
      : 0;

    // Clear draft area first to prevent re-triggering
    setDraftArea(null);

    if (movedPixels < 6) {
      return;
    }

    // Use setTimeout to break out of the current render cycle
    setTimeout(() => {
      openCreateEditorFromDraw(completedArea);
    }, 0);
  };

  const handleEditModeToggle = () => {
    setEditMode((value) => {
      const next = !value;
      setDraftArea(null);

      if (!next && searchParams.get('mode') === 'create') {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('mode');
        setSearchParams(nextParams, { replace: true });
      }

      return next;
    });
  };

  const handleSubmit = (values: StackFormValues) => {
    if (!selectedStore) {
      upsertMutation.mutate(values);
      return;
    }

    if (!stackDimensionsValid) {
      notifications.show({
        title: 'Dimensions out of range',
        message: 'Stack length, width, and height must fit inside the store.',
        color: 'red',
      });
      return;
    }

    if (stackMtExceedsStore) {
      notifications.show({
        title: 'Capacity exceeded',
        message: `This stack would use ${stackMaxMt.toFixed(2)} MT but only ${storeMtBudgetRemaining?.toFixed(2) ?? '0'} MT remains in the store budget.`,
        color: 'red',
      });
      return;
    }

    const sx = Number(values.start_x);
    const sy = Number(values.start_y);
    const len = Number(values.length);
    const wid = Number(values.width);

    if (
      sx < -STACK_LAYOUT_EPS ||
      sy < -STACK_LAYOUT_EPS ||
      sx + len > selectedStore.length + STACK_LAYOUT_EPS ||
      sy + wid > selectedStore.width + STACK_LAYOUT_EPS
    ) {
      notifications.show({
        title: 'Outside store floor',
        message: 'Position and size must stay within the store length and width.',
        color: 'red',
      });
      return;
    }

    const overlap = firstOverlappingStack(
      positionedStoreStacks,
      { start_x: sx, start_y: sy, length: len, width: wid },
      values.id
    );
    if (overlap) {
      notifications.show({
        title: 'Overlaps another stack',
        message: `Footprint crosses "${overlap.code}". Change position/size or adjust the other stack.`,
        color: 'red',
      });
      return;
    }

    upsertMutation.mutate(values);
  };

  if (isLoading || storesLoading || (shouldFetchFallbackStore && fallbackStoreLoading)) {
    return <LoadingState message="Loading stack layout..." />;
  }

  if (error) {
    return <ErrorState message="Failed to load stack layout" onRetry={() => refetch()} />;
  }

  return (
    <>
      {autoPrepare && (
        <Alert
          title="Prepare Stacking Space"
          color="blue"
          radius="md"
          style={{ marginTop: 8 }}
        >
          <Text size="sm">
            An incoming receipt order has been accepted. Use the layout editor below to allocate and
            adjust stacking space for the commodities. Click on empty areas to create new stacks
            or edit existing ones.
          </Text>
        </Alert>
      )}
      <Stack
        gap="xl"
        style={{
          minHeight: '100%',
          padding: '0.25rem',
        }}
      >
        <Stack
          gap="lg"
          style={{
            padding: '1.25rem',
            borderRadius: 24,
            background: 'linear-gradient(180deg, #edf4ff 0%, #e7f0ff 100%)',
            boxShadow: '0 18px 44px rgba(76, 106, 158, 0.12)',
          }}
        >
          <Group justify="space-between" align="flex-start">
            <SearchableSelect
              value={resolvedStoreId}
              onChange={setStoreId}
              data={storeOptions}
              leftSection={<IconBuildingWarehouse size={16} />}
              placeholder="Select store"
              w={320}
              radius="md"
              styles={{
                input: {
                  backgroundColor: '#dce8ff',
                  borderColor: '#dce8ff',
                  color: '#24344d',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                },
              }}
            />

            {autoPrepare && (
              <Card
                radius="md"
                padding="sm"
                style={{
                  background: '#e8f5e9',
                  border: '1px solid #c8e6c9',
                }}
              >
                <Group gap="xs">
                  <IconCalculator size={18} color="#2e7d32" />
                  <Text size="sm" fw={600} c="#2e7d32">
                    Space Preparation Mode
                  </Text>
                </Group>
                <Text size="xs" c="#558b2f" mt={4}>
                  Allocate stacks for the incoming receipt order
                </Text>
              </Card>
            )}

            <Group gap="sm">
              <Badge
                variant="light"
                radius="md"
                size="lg"
                color="blue"
                style={{ backgroundColor: '#dce8ff', color: '#1b4f9c' }}
              >
                Stack Board
              </Badge>
            </Group>
          </Group>

          {/* ── Receipt Authorization selector for storekeeper finish_stacking ── */}
          {isDriverArrivalStacking && (
            <Card
              radius="xl"
              padding="lg"
              style={{
                background: '#ffffff',
                border: '1px solid #dce5f5',
                boxShadow: '0 8px 20px rgba(56, 84, 128, 0.06)',
              }}
            >
              <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
                <Stack gap={4} style={{ flex: 1, minWidth: 280 }}>
                  <Text size="xs" fw={800} c="#42506a" tt="uppercase" style={{ letterSpacing: '0.12em' }}>
                    Receipt Authorization
                  </Text>
                  <SearchableSelect
                    placeholder={
                      driverArrivalRAsForStacking.length === 0
                        ? 'No active RA with Draft GRN for this truck'
                        : 'Receipt Authorization for this receipt'
                    }
                    data={driverArrivalRAsForStacking.map((ra) => ({
                      value: String(ra.id),
                      label: `${ra.reference_no} — ${ra.driver_name} (${ra.truck_plate_number}) · GRN: ${ra.grn_reference_no || `#${ra.grn_id}`}`,
                    }))}
                    value={selectedRAId}
                    onChange={() => undefined}
                    searchable
                    clearable={false}
                    disabled={driverArrivalRAsForStacking.length === 0}
                    styles={{
                      input: {
                        backgroundColor: '#eaf0ff',
                        borderColor: '#d5def2',
                        color: '#1f2a44',
                        fontWeight: 700,
                      },
                    }}
                  />
                  {driverArrivalRAsForStacking.length === 0 && (
                    <Text size="xs" c="dimmed">
                      This receipt is not ready for stacking yet. Go to{' '}
                      <Text
                        component="a"
                        href="/storekeeper/receipt-authorizations"
                        size="xs"
                        c="blue"
                      >
                        Receipt Authorizations
                      </Text>{' '}
                      to confirm driver delivery first.
                    </Text>
                  )}
                </Stack>
                <Button
                  color="green"
                  leftSection={<IconCheck size={16} />}
                  disabled={
                    !canPlaceDriverArrivalGoods || 
                    Object.values(placements).every(q => q === 0) || 
                    (selectedDriverArrivalRA && Object.values(placements).reduce((s, q) => s + q, 0) > Number(selectedDriverArrivalRA.my_inspection?.total_received ?? selectedDriverArrivalRA.authorized_quantity))
                  }
                  onClick={() => setFinishStackingModalOpen(true)}
                  radius="md"
                >
                  Finish Stacking
                </Button>
              </Group>
            </Card>
          )}

          {/* ── Placement progress panel ── */}
          {canPlaceDriverArrivalGoods && (() => {
            const selectedRA = selectedDriverArrivalRA;
            if (!selectedRA) return null;
            const primaryUnit = raPrimaryUnit(selectedRA);
            const totalToPlaceLine = Number(selectedRA.my_inspection?.total_received ?? selectedRA.authorized_quantity);
            const totalPlacedLine = Object.values(placements).reduce((s, q) => s + q, 0);
            const remainingLine = totalToPlaceLine - totalPlacedLine;
            const placedPct = totalToPlaceLine > 0 ? Math.min(100, (totalPlacedLine / totalToPlaceLine) * 100) : 0;
            const fmtPrimary = (lineQty: number) =>
              convertRaLineToInput(lineQty, selectedRA).toLocaleString(undefined, { maximumFractionDigits: 3 });
            return (
              <Card radius="xl" padding="lg" style={{ background: '#f0f7ff', border: '1px solid #bdd4f5' }}>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={700} c="#1d3354">Placement Progress</Text>
                    <Badge color={remainingLine === 0 ? 'green' : remainingLine < 0 ? 'red' : 'blue'} variant="light">
                      {remainingLine === 0 ? 'All placed ✓' : remainingLine < 0 ? `Over by ${fmtPrimary(Math.abs(remainingLine))} ${primaryUnit}` : `${fmtPrimary(remainingLine)} ${primaryUnit} remaining`}
                    </Badge>
                  </Group>
                  <Progress value={placedPct} color={remainingLine < 0 ? 'red' : remainingLine === 0 ? 'green' : 'blue'} size="md" radius="xl" />
                  <Group gap="xl">
                    <Text size="xs" c="dimmed">To place (received): <strong>{fmtPrimary(totalToPlaceLine)} {primaryUnit}</strong></Text>
                    <Text size="xs" c="dimmed">Placed: <strong>{fmtPrimary(totalPlacedLine)} {primaryUnit}</strong></Text>
                    <Text size="md" c="#1d3354">Remaining: <strong>{fmtPrimary(remainingLine)}</strong> <strong>{primaryUnit}</strong></Text>
                  </Group>
                  {Object.entries(placements).filter(([, q]) => q > 0).length > 0 ? (
                    <Stack gap={4}>
                      <Text size="xs" fw={700} c="#42506a" tt="uppercase">Assigned stacks:</Text>
                      {Object.entries(placements).filter(([, q]) => q > 0).map(([stackId, qty]) => {
                        const stack = storeStacks.find(s => String(s.id) === stackId);
                        const qtyLine = Number(qty);
                        return (
                          <Group key={stackId} gap="xs">
                            <Text size="xs" style={{ fontFamily: 'monospace' }}>{stack?.code || `Stack #${stackId}`}</Text>
                            <Text size="xs" c="blue" fw={600}>{fmtPrimary(qtyLine)} {primaryUnit}</Text>
                            <Button size="xs" variant="subtle" color="red" style={{ padding: '0 4px', height: 18 }} onClick={() => setPlacements(p => { const n = {...p}; delete n[stackId]; return n; })}>×</Button>
                          </Group>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Text size="xs" c="dimmed">Click on a stack in the layout below to assign goods to it.</Text>
                  )}
                </Stack>
              </Card>
            );
          })()}

          {stacksNeedingPlacement.length > 0 && selectedStore && (
            <Card
              radius="xl"
              padding="lg"
              style={{
                background: '#fff8e6',
                border: '1px solid #f5d78e',
              }}
            >
              <Stack gap="sm">
                <Text size="sm" fw={700} c="#7a5b00">
                  {stacksNeedingPlacement.length} stack(s) not visible on the floor plan
                </Text>
                <Text size="xs" c="dimmed">
                  These stacks have no position or coordinates outside this store (
                  {numberFormatter.format(selectedStore.length)} m ×{' '}
                  {numberFormatter.format(selectedStore.width)} m). Place them on the board below
                  or use Edit Layout.
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                  {stacksNeedingPlacement.map((stack) => {
                    const statusMeta = getStatusMeta(stack.stack_status);
                    const hasCoords =
                      stack.start_x != null &&
                      stack.start_y != null &&
                      !isStackWithinStoreFloor(
                        stack,
                        Number(selectedStore.length),
                        Number(selectedStore.width)
                      );
                    return (
                      <Card key={stack.id} padding="sm" withBorder radius="md">
                        <Group justify="space-between" wrap="nowrap" align="flex-start">
                          <div>
                            <Text size="sm" fw={700} style={{ fontFamily: 'monospace' }}>
                              {stack.code}
                            </Text>
                            <Badge size="xs" variant="light" color="orange" mt={4}>
                              {statusMeta.label}
                            </Badge>
                            <Text size="xs" c="dimmed" mt={4}>
                              {hasCoords
                                ? `Position X:${stack.start_x} Y:${stack.start_y} is outside the store`
                                : 'No floor position yet'}
                            </Text>
                          </div>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              setEditMode(true);
                              openEditor(stack);
                            }}
                          >
                            Place on floor
                          </Button>
                        </Group>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              </Stack>
            </Card>
          )}

          <Card
            radius="xl"
            padding="lg"
            style={{
              background: '#ffffff',
              border: '1px solid #dce5f5',
              boxShadow: '0 12px 28px rgba(56, 84, 128, 0.08)',
            }}
          >
            <Group justify="space-between" gap="md" wrap="wrap">
              <Group gap="xl">
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <Group key={key} gap={10}>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: meta.fill,
                        border: `1px solid ${meta.border}`,
                      }}
                    />
                    <Text fw={700} c="#40516e" tt="uppercase" size="sm">
                      {meta.label}
                    </Text>
                  </Group>
                ))}
              </Group>

              <Group gap="sm">
                <Group gap={6}>
                  <IconInfoCircle size={15} color="#64748b" />
                  <Text size="sm" c="#64748b" fw={600}>
                    {editMode
                      ? 'Drag on empty floor to draw a new stack (cannot overlap existing tiles); click a tile to edit'
                      : 'Hover or click stacks for details'}
                  </Text>
                </Group>
                <Button
                  radius="md"
                  color={editMode ? 'red' : 'blue'}
                  leftSection={editMode ? <IconX size={16} /> : <IconEdit size={16} />}
                  onClick={handleEditModeToggle}
                >
                  {editMode ? 'Exit Edit Mode' : 'Edit Layout'}
                </Button>
              </Group>
            </Group>
          </Card>

          {!selectedStore ? (
            <Text c="dimmed">Select a store to display its stacking board.</Text>
          ) : (
            <>
              <Card
                radius="xl"
                padding="lg"
                style={{
                  background: '#ffffff',
                  border: '1px solid #dce5f5',
                  boxShadow: '0 16px 36px rgba(56, 84, 128, 0.12)',
                }}
              >
                <div
                  style={{
                    overflowX: 'auto',
                    paddingBottom: 8,
                  }}
                >
                  <div
                    style={{
                      minWidth: boardWidth + 40,
                      padding: 20,
                      borderRadius: 20,
                      background:
                        'radial-gradient(circle at 1px 1px, rgba(88, 124, 189, 0.18) 1.2px, transparent 0) 0 0 / 18px 18px, #f8fbff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: 14,
                      }}
                    >
                      <Badge
                        radius="xl"
                        size="xl"
                        style={{
                          background: '#d9e8ff',
                          color: '#1b4f9c',
                          fontWeight: 800,
                          letterSpacing: '0.12em',
                        }}
                      >
                        STORE LENGTH: {numberFormatter.format(selectedStore.length)} METERS
                      </Badge>
                    </div>

                    <div
                      ref={boardRef}
                      onPointerDown={handleBoardPointerDown}
                      onPointerMove={handleBoardPointerMove}
                      onPointerUp={handleBoardPointerUp}
                      onPointerLeave={(e) => {
                        if (draftArea) {
                          handleBoardPointerUp(e);
                        }
                      }}
                      style={{
                        position: 'relative',
                        width: boardWidth,
                        height: boardHeight,
                        margin: '0 auto',
                        border: '2px solid #dce5f5',
                        borderRadius: 18,
                        background: 'rgba(255, 255, 255, 0.85)',
                        boxShadow: 'inset 0 0 0 1px rgba(222, 233, 248, 0.9)',
                        cursor: editMode ? 'crosshair' : 'default',
                        touchAction: 'none',
                      }}
                    >
                      {selectedStore.has_gangway && (
                        <>
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: boardHeight * 0.49,
                              height: Math.max((selectedStore.gangway_width || 1.5) * boardScale, 28),
                              transform: 'translateY(-50%)',
                              background: 'rgba(227, 237, 252, 0.92)',
                              color: '#9aa9c2',
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: '0.18em',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textTransform: 'uppercase',
                            }}
                          >
                            Cross Aisle
                          </div>
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: boardWidth * 0.26,
                              width: Math.max((selectedStore.gangway_length || 1.5) * boardScale * 0.45, 20),
                              transform: 'translateX(-50%)',
                              background: 'rgba(227, 237, 252, 0.92)',
                            }}
                          />
                        </>
                      )}

                      <div
                        style={{
                          position: 'absolute',
                          left: -36,
                          top: boardHeight / 2,
                          transform: 'translateY(-50%) rotate(-90deg)',
                          color: '#7a91b4',
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {numberFormatter.format(selectedStore.width)} meters
                      </div>

                      {boardStacks.map((stack) => {
                        const statusMeta = getStatusMeta(stack.stack_status);
                        const rawLeft = Number(stack.start_x ?? 0) * boardScale;
                        const rawTop = Number(stack.start_y ?? 0) * boardScale;
                        const left = clamp(rawLeft, 0, Math.max(boardWidth - 8, 0));
                        const top = clamp(rawTop, 0, Math.max(boardHeight - 8, 0));
                        const tileW = Math.max(Math.min(stack.length * boardScale, boardWidth - left), 8);
                        const tileH = Math.max(Math.min(stack.width * boardScale, boardHeight - top), 8);
                        const compactTile = tileW < 56 || tileH < 46;

                        return (
                          <Tooltip
                            key={stack.id}
                            label={`${stack.code} • ${stack.commodity_name || 'No commodity'} • ${numberFormatter.format(stack.quantity)} ${stack.unit_abbreviation || ''}`}
                            withArrow
                          >
                            <button
                              data-stack-tile="true"
                              type="button"
                              onClick={() => {
                                if (editMode) {
                                  openEditor(stack);
                                } else if (canPlaceDriverArrivalGoods) {
                                  setPlacementModalStack(stack);
                                }
                              }}
                              style={{
                                position: 'absolute',
                                left,
                                top,
                                width: tileW,
                                height: tileH,
                                zIndex: stack.id,
                                borderRadius: 10,
                                border: `2px solid ${statusMeta.border}`,
                                background: canPlaceDriverArrivalGoods && !editMode ? (placements[String(stack.id)] > 0 ? '#1fbe84' : statusMeta.fill) : statusMeta.fill,
                                color: statusMeta.color,
                                padding: compactTile ? 2 : '8px 10px',
                                textAlign: 'left',
                                boxShadow: '0 8px 18px rgba(51, 76, 117, 0.10)',
                                cursor: editMode ? 'pointer' : canPlaceDriverArrivalGoods ? 'pointer' : 'default',
                                opacity: editMode || stack.stack_status !== 'inactive' ? 1 : 0.92,
                              }}
                            >
                              <div style={{ fontSize: compactTile ? 0 : 11, fontWeight: 800, lineHeight: 1.05 }}>
                                {stack.code}
                              </div>
                              <div
                                style={{
                                  marginTop: compactTile ? 0 : 8,
                                  fontSize: compactTile ? 0 : 15,
                                  lineHeight: 1.05,
                                  fontWeight: 900,
                                  textTransform: 'uppercase',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {stack.commodity_code || stack.commodity_name || statusMeta.label}
                              </div>
                            </button>
                          </Tooltip>
                        );
                      })}

                      {draftPreview && (
                        <div
                          style={{
                            position: 'absolute',
                            left: draftPreview.left,
                            top: draftPreview.top,
                            width: Math.max(draftPreview.width, 1),
                            height: Math.max(draftPreview.height, 1),
                            borderRadius: 10,
                            border: '2px dashed #155aa8',
                            background: 'rgba(21, 90, 168, 0.16)',
                            boxShadow: '0 0 0 1px rgba(21, 90, 168, 0.08)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}

                      {boardStacks.length === 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 20,
                            border: '2px dashed #cfdbef',
                            borderRadius: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#7d8ea8',
                            fontWeight: 700,
                            textAlign: 'center',
                            padding: 16,
                          }}
                        >
                          {storeStacks.length === 0
                            ? 'No stacks for this store yet. Use Edit Layout to draw stacks.'
                            : 'No stacks on the floor plan yet — see the list above to place them.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
                  <Group align="center" gap="md">
                    <ThemeIcon size={42} radius="md" variant="light" color="blue">
                      <IconBuildingWarehouse size={22} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                        Total Storage Area
                      </Text>
                      <Title order={2} c="#1d3354">
                        {numberFormatter.format(totalArea)} m²
                      </Title>
                    </div>
                  </Group>
                </Card>

                <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
                  <Group align="center" gap="md">
                    <ThemeIcon size={42} radius="md" variant="light" color="blue">
                      <IconBox size={22} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                        Allocated Space
                      </Text>
                      <Title order={2} c="#1d57a8">
                        {numberFormatter.format(allocatedArea)} m²
                      </Title>
                    </div>
                  </Group>
                </Card>

                <Card radius="xl" padding="lg" style={{ background: '#ffffff', border: '1px solid #dce5f5' }}>
                  <Group align="center" gap="md">
                    <ThemeIcon size={42} radius="md" variant="light" color="gray">
                      <IconMapPin size={22} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase">
                        Reserved Area / Space
                      </Text>
                      <Title order={2} c="#44526b">
                        {numberFormatter.format(reservedArea)} m²
                      </Title>
                    </div>
                  </Group>
                </Card>
              </SimpleGrid>
            </>
          )}
        </Stack>
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setSelectedStack(null);
          setDraftArea(null);
        }}
        withCloseButton={false}
        centered
        radius="xl"
        padding={0}
        size={700}
        overlayProps={{ blur: 6, color: '#1d3557', opacity: 0.35 }}
        styles={{
          content: {
            backgroundColor: '#ffffff',
          },
          body: {
            padding: 0,
            overflowY: 'auto',
            maxHeight: 'calc(90vh - 2rem)',
          },
        }}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <div
            style={{
              background: 'linear-gradient(180deg, #0f4d98 0%, #155aa8 100%)',
              color: '#ffffff',
              padding: '1.5rem 1.75rem',
            }}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2} c="white">
                  Stack Configuration
                </Title>
                <Text c="rgba(255,255,255,0.72)" mt={4}>
                  Define operational parameters for this storage node.
                </Text>
              </div>
              <Button
                variant="subtle"
                color="gray"
                onClick={() => {
                  setModalOpened(false);
                  setSelectedStack(null);
                  setDraftArea(null);
                }}
                px={0}
              >
                <IconX size={22} color="#ffffff" />
              </Button>
            </Group>
          </div>

          <Stack gap="lg" p="xl">
            <Group grow align="flex-start">
              <TextInput
                label="Stack Code"
                placeholder="STK-015"
                styles={baseInputStyles}
                {...form.getInputProps('code')}
              />
              <SearchableSelect
                label="Stack Status"
                data={stackStatusOptions}
                styles={baseInputStyles}
                {...form.getInputProps('stack_status')}
              />
            </Group>

            <Stack gap={6}>
              {/* Stack is a physical space — commodity is assigned when goods arrive.
                  Show read-only info if the stack currently holds goods. */}
              {selectedStack && selectedStack.quantity > 0 && selectedStack.commodity_id ? (
                <Alert color="blue" variant="light" title="Current Contents">
                  <Text size="sm">
                    <strong>Commodity:</strong> {selectedStack.commodity_name || `ID: ${selectedStack.commodity_id}`}
                  </Text>
                  <Text size="sm">
                    <strong>Quantity:</strong> {selectedStack.quantity.toLocaleString()} {selectedStack.unit_abbreviation || ''}
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    A different commodity cannot be placed here until this stack is empty.
                    The same commodity type can be added.
                  </Text>
                </Alert>
              ) : selectedStack && selectedStack.quantity === 0 ? (
                <Alert color="green" variant="light" title="Stack is Empty">
                  <Text size="xs" c="dimmed">
                    This stack is empty. Any commodity can be placed here when goods arrive.
                  </Text>
                </Alert>
              ) : null}
            </Stack>

            <Divider
              label="Dimensions"
              labelPosition="left"
              styles={{
                label: {
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#1955a5',
                },
              }}
            />

            {selectedStore && stackDimHints && (
              <Alert color="gray" variant="light" title="Size limits for this store">
                <Text size="sm">
                  Store: {stackDimHints.storeLengthM} × {stackDimHints.storeWidthM} m floor,{' '}
                  {stackDimHints.storeHeightM} m high.
                </Text>
                <Text size="sm" mt={4}>
                  {formatStackFootprintHint(
                    stackDimHints.remainingFootprintSqm,
                    stackDimHints.maxLengthM,
                    stackDimHints.maxWidthM
                  )}
                </Text>
              </Alert>
            )}

            <Group grow align="flex-start">
              <NumberInput
                label="Length (m)"
                decimalScale={2}
                min={0}
                placeholder={stackDimHints ? `Max ${stackDimHints.maxLengthM} m` : undefined}
                description={stackLengthError ? undefined : dimensionValidLabel(stackLengthStatus)}
                error={stackLengthError}
                styles={{
                  ...baseInputStyles,
                  ...dimensionInputBorderStyle(stackLengthStatus),
                }}
                {...form.getInputProps('length')}
              />
              <NumberInput
                label="Width (m)"
                decimalScale={2}
                min={0}
                placeholder={stackDimHints ? `Max ${stackDimHints.maxWidthM} m` : undefined}
                description={stackWidthError ? undefined : dimensionValidLabel(stackWidthStatus)}
                error={stackWidthError}
                styles={{
                  ...baseInputStyles,
                  ...dimensionInputBorderStyle(stackWidthStatus),
                }}
                {...form.getInputProps('width')}
              />
              <NumberInput
                label="Height (m)"
                decimalScale={2}
                disabled
                description={selectedStore ? `Inherited from store — ${selectedStore.height} m` : undefined}
                styles={baseInputStyles}
                {...form.getInputProps('height')}
              />
            </Group>

            {selectedStore && stackVolumeM3 > 0 && (
              <SimpleGrid
                cols={{ base: 1, sm: 3 }}
                spacing="md"
                style={{ background: '#f0f5ff', borderRadius: 12, padding: '12px 16px' }}
              >
                <div>
                  <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase" mb={2}>
                    Volume
                  </Text>
                  <Text size="lg" fw={700} c="#1d3354">
                    {stackVolumeM3.toFixed(2)}{' '}
                    <Text span size="xs" c="dimmed">
                      m³
                    </Text>
                  </Text>
                </div>
                <div>
                  <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase" mb={2}>
                    Max capacity
                  </Text>
                  <Text size="lg" fw={700} c={stackMtExceedsStore ? 'red' : '#0d6e3f'}>
                    {stackMaxMt.toFixed(2)}{' '}
                    <Text span size="xs" c="dimmed">
                      MT
                    </Text>
                  </Text>
                  <Text size="xs" c="dimmed">System-calculated limit</Text>
                </div>
                <div>
                  <Text size="xs" fw={800} c="#5b6e8c" tt="uppercase" mb={2}>
                    Store MT budget
                  </Text>
                  <Text size="lg" fw={700} c="#1955a5">
                    {storeMtBudgetRemaining != null
                      ? `${storeMtBudgetRemaining.toFixed(2)} MT`
                      : '—'}
                  </Text>
                  <Text size="xs" c="dimmed">Remaining for all stacks</Text>
                </div>
              </SimpleGrid>
            )}

            {stackMtExceedsStore && (
              <Text size="sm" c="red">
                Stack capacity ({stackMaxMt.toFixed(2)} MT) exceeds store remaining budget (
                {storeMtBudgetRemaining?.toFixed(2)} MT).
              </Text>
            )}

            <Group grow align="flex-start">
              <NumberInput
                label="Start X"
                decimalScale={2}
                min={0}
                styles={baseInputStyles}
                {...form.getInputProps('start_x')}
              />
              <NumberInput
                label="Start Y"
                decimalScale={2}
                min={0}
                styles={baseInputStyles}
                {...form.getInputProps('start_y')}
              />
            </Group>

            <Group grow>
              <Button
                type="submit"
                radius="md"
                size="md"
                leftSection={<IconDeviceFloppy size={18} />}
                loading={upsertMutation.isPending}
                disabled={!stackConfigCanSave}
              >
                Save Configuration
              </Button>
              <Button
                variant="light"
                radius="md"
                size="md"
                onClick={() => {
                  setModalOpened(false);
                  setSelectedStack(null);
                  setDraftArea(null);
                }}
              >
                Cancel
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* ── Placement Modal — click a stack to assign quantity ── */}
      {canPlaceDriverArrivalGoods && placementModalStack && (() => {
        const selectedRA = selectedDriverArrivalRA;
        if (!selectedRA) return null;
        const uLine = raQuantityUnit(selectedRA);
        const primaryUnit = raPrimaryUnit(selectedRA);
        const useInputUnit = raUsesInputUnit(selectedRA);
        const totalToPlaceLine = Number(selectedRA.my_inspection?.total_received ?? selectedRA.authorized_quantity);
        const currentQtyLine = placements[String(placementModalStack.id)] || 0;
        const currentQtyPrimary = convertRaLineToInput(Number(currentQtyLine), selectedRA);

        // Check commodity compatibility
        const stackHasGoods = placementModalStack.quantity > 0 && placementModalStack.commodity_id;
        const stackCommodityName = (placementModalStack.commodity_name || '').trim().toLowerCase();
        const raCommodityName = (selectedRA.commodity_name || '').trim().toLowerCase();
        const incompatible = stackHasGoods && stackCommodityName && raCommodityName && stackCommodityName !== raCommodityName;

        return (
          <Modal
            key={placementModalStack.id}
            opened={!!placementModalStack}
            onClose={() => setPlacementModalStack(null)}
            title={<Text fw={700}>Place Goods — {placementModalStack.code}</Text>}
            centered
            size="sm"
          >
            <Stack gap="md">
              <Group gap="xl">
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">Stack</Text>
                  <Text size="sm" fw={600} style={{ fontFamily: 'monospace' }}>{placementModalStack.code}</Text>
                </Stack>
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">Dimensions</Text>
                  <Text size="sm">{placementModalStack.length}m × {placementModalStack.width}m × {placementModalStack.height}m</Text>
                </Stack>
              </Group>

              {stackHasGoods && (
                <Alert color={incompatible ? 'red' : 'blue'} variant="light" title={incompatible ? 'Different commodity' : 'Current contents'}>
                  {incompatible
                    ? `This stack holds ${placementModalStack.commodity_name}. You are placing ${selectedRA.commodity_name}. Cannot mix different commodities.`
                    : `${placementModalStack.commodity_name} — ${placementModalStack.quantity.toLocaleString()} ${placementModalStack.unit_abbreviation || ''} already here. Same commodity — allowed.`
                  }
                </Alert>
              )}

              {!incompatible && (
                <>
                  <NumberInput
                    label={`Quantity to place${primaryUnit ? ` (${primaryUnit})` : ''}`}
                    description={`Remaining to assign: ${convertRaLineToInput(totalToPlaceLine - Object.values(placements).reduce((s, q) => s + q, 0), selectedRA).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${primaryUnit}. Adjust any stack freely.`}
                    value={currentQtyPrimary || ''}
                    error={
                      !incompatible && totalToPlaceLine - Object.values(placements).reduce((s, q) => s + q, 0) < 0
                        ? 'Cannot exceed total received quantity'
                        : undefined
                    }
                    onChange={(val) => {
                      const rawPrimary = Number(val) || 0;
                      const lineQty = convertRaInputToLine(rawPrimary, selectedRA);
                      setPlacements((p) => ({
                        ...p,
                        [String(placementModalStack.id)]: lineQty,
                      }));
                    }}
                    decimalScale={3}
                  />
                  {useInputUnit && Number(currentQtyLine) > 0 && uLine ? (
                    <Text size="xs" c="dimmed">
                      = {Number(currentQtyLine).toLocaleString(undefined, { maximumFractionDigits: 3 })} {uLine} (system record)
                    </Text>
                  ) : null}
                </>
              )}

              <Group justify="flex-end">
                <Button
                  variant="light"
                  onClick={() => {
                    setPlacementModalStack(null);
                    if (!incompatible && canPlaceDriverArrivalGoods) {
                      const totalPlacedNow = Object.values(placements).reduce((s, q) => s + q, 0);
                      if (totalToPlaceLine - totalPlacedNow === 0) {
                        finishStackingMutation.mutate();
                      }
                    }
                  }}
                >
                  {incompatible ? 'Close' : 'Done'}
                </Button>
              </Group>
            </Stack>
          </Modal>
        );
      })()}

      {/* ── Finish Stacking confirmation modal ── */}
      <Modal
        opened={finishStackingModalOpen}
        onClose={() => setFinishStackingModalOpen(false)}
        title="Finish Stacking"
        centered
      >
        <Stack gap="md">
          {canPlaceDriverArrivalGoods && (() => {
            const ra = selectedDriverArrivalRA;
            return ra ? (
              <Alert color="blue" variant="light">
                <Text size="sm" fw={600}>{ra.reference_no}</Text>
                <Text size="sm">{ra.driver_name} — {ra.truck_plate_number}</Text>
                <Text size="sm">
                  Hub authorized: {raDisplayQty(ra).toLocaleString(undefined, { maximumFractionDigits: 3 })}{raDisplayUnit(ra) ? ` ${raDisplayUnit(ra)}` : ''}
                  {ra.my_inspection?.total_received != null && Number(ra.my_inspection.total_received) !== Number(ra.authorized_quantity) && (
                    <span>
                      {' '}· Received:{' '}
                      {Number((Number(ra.my_inspection.total_received) * raLineToInputMultiplier(ra)).toFixed(6)).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                      {raDisplayUnit(ra) ? ` ${raDisplayUnit(ra)}` : ''}
                    </span>
                  )}
                </Text>
                {ra.grn_reference_no && (
                  <Text size="sm">GRN: {ra.grn_reference_no}</Text>
                )}
              </Alert>
            ) : null;
          })()}
          <Text size="sm">
            Finishing stacking will confirm the linked GRN (Draft → Confirmed), update stack
            quantities, and close the Receipt Authorization. This action cannot be undone.
          </Text>
          <Text size="sm" c="dimmed">
            Make sure all goods have been placed into stacks before proceeding.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setFinishStackingModalOpen(false)}
              disabled={finishStackingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              color="green"
              leftSection={<IconCheck size={16} />}
              onClick={() => finishStackingMutation.mutate()}
              loading={finishStackingMutation.isPending}
            >
              Confirm — Finish Stacking
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
