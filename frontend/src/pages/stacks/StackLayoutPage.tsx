import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
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
import { getStores } from '../../api/stores';
import { getCommodityReferences, getUnitReferences } from '../../api/referenceData';
import { getCommodityDefinitions } from '../../api/commodityDefinitions';
import type { CommodityDefinition } from '../../api/commodityDefinitions';
import { getReceiptAuthorizations } from '../../api/receiptAuthorizations';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { finishStacking } from '../../api/receiptOrders';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import type { Stack as StackType } from '../../types/stack';

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
    height: 3,
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
  const [storeId, setStoreId] = useState<string | null>(searchParams.get('store_id'));
  const [editMode, setEditMode] = useState(searchParams.get('mode') === 'create');
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedStack, setSelectedStack] = useState<StackType | null>(null);
  const [draftArea, setDraftArea] = useState<DraftArea | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // ── Receipt Authorization selector state (storekeeper stacking flow) ──
  const [selectedRAId, setSelectedRAId] = useState<string | null>(
    searchParams.get('receipt_authorization_id')
  );
  const [finishStackingModalOpen, setFinishStackingModalOpen] = useState(false);

  const autoPrepare = searchParams.get('auto_prepare') === 'true';

  // Get active assignment context for filtering
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userStoreId = activeAssignment?.store?.id;
  const userHubId = activeAssignment?.hub?.id;
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const isStorekeeper = roleSlug === 'storekeeper';
  const isHubManager = roleSlug === 'hub_manager';

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['stores', { 
      warehouse_id: isWarehouseManager ? userWarehouseId : undefined,
      hub_id: isHubManager ? userHubId : undefined 
    }],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) {
        return getStores({ warehouse_id: userWarehouseId });
      } else if (isHubManager && userHubId) {
        // For hub managers, get stores from warehouses in their hub
        return getStores(); // Backend should handle hub-level filtering
      }
      return getStores();
    },
  });

  const { data: stacks, isLoading, error, refetch } = useQuery({
    queryKey: ['stacks', { 
      warehouse_id: isWarehouseManager ? userWarehouseId : undefined,
      store_id: isStorekeeper ? userStoreId : undefined,
      hub_id: isHubManager ? userHubId : undefined 
    }],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) {
        return getStacks({ warehouse_id: userWarehouseId });
      } else if (isStorekeeper && userStoreId) {
        return getStacks({ store_id: userStoreId });
      } else if (isHubManager && userHubId) {
        // For hub managers, get stacks from warehouses in their hub
        return getStacks(); // Backend should handle hub-level filtering
      }
      return getStacks();
    },
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

  // ── Active RAs with Draft GRN for the storekeeper's store (for finish_stacking) ──
  const { data: activeRAsForStacking = [] } = useQuery({
    queryKey: ['receipt_authorizations', { store_id: userStoreId, status: 'active' }],
    queryFn: () => getReceiptAuthorizations({ store_id: userStoreId, status: 'active' }),
    enabled: isStorekeeper && !!userStoreId,
    select: (data: ReceiptAuthorization[]) =>
      data.filter((ra) => ra.driver_confirmed_at && ra.grn_id && ra.grn_status === 'draft'),
  });

  // ── Finish Stacking mutation ──
  const finishStackingMutation = useMutation({
    mutationFn: () => {
      if (!selectedRAId) throw new Error('No Receipt Authorization selected');
      const selectedRA = activeRAsForStacking.find((ra) => String(ra.id) === selectedRAId);
      if (!selectedRA) throw new Error('Receipt Authorization not found');

      // Build placements from the current store's active stacks
      const placements = storeStacks
        .filter((s) => s.quantity > 0)
        .map((s) => ({ stack_id: s.id, quantity: s.quantity }));

      return finishStacking(selectedRA.receipt_order_id, placements, selectedRA.id);
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

  const resolvedStoreId = storeId || (isStorekeeper && userStoreId ? String(userStoreId) : (stores && stores.length > 0 ? String(stores[0].id) : null));

  const selectedStore = useMemo(
    () => stores?.find((store) => String(store.id) === resolvedStoreId) || null,
    [resolvedStoreId, stores]
  );

  const storeStacks = useMemo(() => {
    return stacks?.filter((stack) => String(stack.store_id) === resolvedStoreId) || [];
  }, [resolvedStoreId, stacks]);

  const form = useForm<StackFormValues>({
    initialValues: createInitialValues(storeId),
    validate: {
      code: (value) => (!value ? 'Stack code is required' : null),
      stack_status: (value) => (!value ? 'Stack status is required' : null),
      commodity_definition_id: (value, values) =>
        values.stack_status !== 'empty' && !value ? 'Select a commodity' : null,
      commodity_id: (value, values) =>
        values.stack_status !== 'empty' && !value ? 'Select a batch' : null,
      length: (value) => (value <= 0 ? 'Length must be greater than 0' : null),
      width: (value) => (value <= 0 ? 'Width must be greater than 0' : null),
      height: (value) => (value <= 0 ? 'Height must be greater than 0' : null),
      start_x: (value) => (value < 0 ? 'X position cannot be negative' : null),
      start_y: (value) => (value < 0 ? 'Y position cannot be negative' : null),
      quantity: (value) => (value < 0 ? 'Quantity cannot be negative' : null),
      unit_id: (value, values) =>
        values.stack_status !== 'empty' && !value ? 'Unit is required' : null,
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
      const resolvedCommId = Number(values.commodity_id) || 0;

      const payload: Partial<StackType> = {
        code: values.code,
        stack_status: values.stack_status,
        commodity_id: resolvedCommId,
        length: values.length,
        width: values.width,
        height: values.height,
        start_x: values.start_x,
        start_y: values.start_y,
        quantity: values.quantity,
        unit_id: Number(values.unit_id || 0),
        store_id: Number(values.store_id),
        reference: values.reference,
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

  const storeOptions =
    stores?.map((store) => ({
      value: String(store.id),
      label: `${store.name} (${store.code})`,
    })) || [];

  const totalArea = selectedStore?.usable_space || (selectedStore ? selectedStore.length * selectedStore.width : 0);
  const allocatedArea = storeStacks
    .filter((stack) => !['empty', 'inactive'].includes(stack.stack_status))
    .reduce((sum, stack) => sum + stack.length * stack.width, 0);
  const reservedArea = storeStacks
    .filter((stack) => stack.stack_status === 'reserved')
    .reduce((sum, stack) => sum + stack.length * stack.width, 0);

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
        height: stack.height,
        start_x: stack.start_x,
        start_y: stack.start_y,
        quantity: stack.quantity,
        unit_id: String(stack.unit_id || ''),
        store_id: String(stack.store_id),
        reference: stack.reference || '',
      });
    } else {
      setSelectedStack(null);
      form.setValues(createInitialValues(resolvedStoreId));
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

    const overlap = firstOverlappingStack(storeStacks, { start_x: startX, start_y: startY, length, width });
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

    // Clear draft area first to prevent re-triggering
    setDraftArea(null);
    
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
      storeStacks,
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

  if (isLoading || storesLoading) {
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
            <Select
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
          {isStorekeeper && (
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
                  <Select
                    placeholder={
                      activeRAsForStacking.length === 0
                        ? 'No active RAs with Draft GRN for your store'
                        : 'Select the RA you are stacking for'
                    }
                    data={activeRAsForStacking.map((ra) => ({
                      value: String(ra.id),
                      label: `${ra.reference_no} — ${ra.driver_name} (${ra.truck_plate_number}) · GRN: ${ra.grn_reference_no || `#${ra.grn_id}`}`,
                    }))}
                    value={selectedRAId}
                    onChange={setSelectedRAId}
                    searchable
                    clearable
                    disabled={activeRAsForStacking.length === 0}
                    styles={{
                      input: {
                        backgroundColor: '#eaf0ff',
                        borderColor: '#d5def2',
                        color: '#1f2a44',
                        fontWeight: 700,
                      },
                    }}
                  />
                  {activeRAsForStacking.length === 0 && (
                    <Text size="xs" c="dimmed">
                      Active RAs appear here after Driver Confirmation. Go to{' '}
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
                  disabled={!selectedRAId}
                  onClick={() => setFinishStackingModalOpen(true)}
                  radius="md"
                >
                  Finish Stacking
                </Button>
              </Group>
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

                      {storeStacks.map((stack) => {
                        const statusMeta = getStatusMeta(stack.stack_status);
                        const tileW = Math.max(stack.length * boardScale, 56);
                        const tileH = Math.max(stack.width * boardScale, 52);
                        const maxLeft = Math.max(0, boardWidth - tileW);
                        const maxTop = Math.max(0, boardHeight - tileH);
                        const left = clamp(Number(stack.start_x ?? 0) * boardScale, 0, maxLeft);
                        const top = clamp(Number(stack.start_y ?? 0) * boardScale, 0, maxTop);

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
                                background: statusMeta.fill,
                                color: statusMeta.color,
                                padding: '8px 10px',
                                textAlign: 'left',
                                boxShadow: '0 8px 18px rgba(51, 76, 117, 0.10)',
                                cursor: editMode ? 'pointer' : 'default',
                                opacity: editMode || stack.stack_status !== 'inactive' ? 1 : 0.92,
                              }}
                            >
                              <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.05 }}>
                                {stack.code}
                              </div>
                              <div
                                style={{
                                  marginTop: 8,
                                  fontSize: 15,
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

                      {storeStacks.length === 0 && (
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
                          }}
                        >
                          No stacks positioned for this store yet.
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
            overflow: 'hidden',
            backgroundColor: '#ffffff',
          },
          body: {
            padding: 0,
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
              <Select
                label="Stack Status"
                data={stackStatusOptions}
                styles={baseInputStyles}
                {...form.getInputProps('stack_status')}
              />
            </Group>

            <Stack gap={6}>
              <Group grow align="flex-start">
                <Select
                  label="Commodity"
                  description="Same list as Officer → Commodities (admin definitions)"
                  placeholder="Select commodity"
                  data={definitionSelectOptions}
                  searchable
                  styles={baseInputStyles}
                  {...form.getInputProps('commodity_definition_id')}
                  onChange={(value) => {
                    form.setValues({
                      ...form.values,
                      commodity_definition_id: value || '',
                      commodity_id: '',
                      commodity_name: '',
                      reference: '',
                      unit_id: '',
                    });
                  }}
                  style={{ flex: 2 }}
                />
                <Select
                  key={`batch-${form.values.commodity_definition_id}-${form.values.commodity_id}`}
                  label="Batch / Reference"
                  description="Batches created on Officer → Commodities for this name"
                  placeholder={
                    form.values.commodity_definition_id
                      ? 'Choose batch'
                      : 'Select a commodity first'
                  }
                  data={batchSelectOptions}
                  searchable
                  clearable
                  disabled={!form.values.commodity_definition_id}
                  nothingFoundMessage={
                    form.values.commodity_definition_id
                      ? 'No batches yet — create them under Officer → Commodities'
                      : 'Select a commodity first'
                  }
                  {...form.getInputProps('commodity_id')}
                  onChange={(value) => {
                    const row = commodities.find((c) => String(c.id) === value);
                    form.setValues({
                      ...form.values,
                      commodity_id: value || '',
                      commodity_name: row?.name || form.values.commodity_name,
                      reference: (row?.batch_no || '').trim(),
                      unit_id: row?.unit_id != null ? String(row.unit_id) : form.values.unit_id,
                    });
                  }}
                  style={{ flex: 1 }}
                />
              </Group>
              <Text size="xs" c="dimmed">
                Pick the officer commodity, then the batch row. Quantity, unit, and dimensions stay manual.
              </Text>
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

            <Group grow align="flex-start">
              <NumberInput
                label="Length (m)"
                decimalScale={2}
                min={0}
                styles={baseInputStyles}
                {...form.getInputProps('length')}
              />
              <NumberInput
                label="Width (m)"
                decimalScale={2}
                min={0}
                styles={baseInputStyles}
                {...form.getInputProps('width')}
              />
              <NumberInput
                label="Height (m)"
                decimalScale={2}
                min={0}
                styles={baseInputStyles}
                {...form.getInputProps('height')}
              />
            </Group>

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

            <Group grow align="flex-start">
              <NumberInput
                label="Quantity"
                decimalScale={2}
                min={0}
                styles={baseInputStyles}
                {...form.getInputProps('quantity')}
              />
              <Select
                label="Unit"
                placeholder="Select unit"
                data={unitOptions}
                searchable
                styles={baseInputStyles}
                {...form.getInputProps('unit_id')}
              />
            </Group>

            <Group grow>
              <Button
                type="submit"
                radius="md"
                size="md"
                leftSection={<IconDeviceFloppy size={18} />}
                loading={upsertMutation.isPending}
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

      {/* ── Finish Stacking confirmation modal ── */}
      <Modal
        opened={finishStackingModalOpen}
        onClose={() => setFinishStackingModalOpen(false)}
        title="Finish Stacking"
        centered
      >
        <Stack gap="md">
          {selectedRAId && (() => {
            const ra = activeRAsForStacking.find((r) => String(r.id) === selectedRAId);
            return ra ? (
              <Alert color="blue" variant="light">
                <Text size="sm" fw={600}>{ra.reference_no}</Text>
                <Text size="sm">{ra.driver_name} — {ra.truck_plate_number}</Text>
                <Text size="sm">Authorized Qty: {Number(ra.authorized_quantity).toLocaleString()}</Text>
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
