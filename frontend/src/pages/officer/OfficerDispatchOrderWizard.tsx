import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Button,
  Group,
  Select,
  Card,
  Table,
  ActionIcon,
  Text,
  NumberInput,
  Textarea,
  SimpleGrid,
  Alert,
  Divider,
  Stepper,
  Badge,
  Loader,
  Center,
  SegmentedControl,
} from '@mantine/core';
import { IconTrash, IconPlus, IconAlertCircle, IconPencil } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  createDispatchOrderV2,
  getDispatchOrder,
  updateDispatchOrderV2,
} from '../../api/dispatchOrders';
import {
  getDestinationsLookup,
  getWarehousesForCommodityLookup,
} from '../../api/dispatchLookups';
import { getUnitReferences } from '../../api/referenceData';
import { getCommodityDefinitions, type CommodityDefinition } from '../../api/commodityDefinitions';
import type { ApiError } from '../../types/common';
import type {
  CreateDispatchOrderV2LinePayload,
  DispatchOrderLineV2,
  LookupOption,
} from '../../types/dispatchV2';
import { getHubs } from '../../api/hubs';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug, ROLES } from '../../contracts/warehouse';
import {
  formatDestinationAllocations,
  formatSourceAllocations,
} from '../../utils/dispatchAllocations';

type DestKind = 'all' | 'warehouse' | 'fdp';

function isWarehouseLocationType(locationType?: string | null): boolean {
  return locationType?.toLowerCase() === 'warehouse';
}

function isFdpLocationType(locationType?: string | null): boolean {
  return locationType?.toLowerCase() === 'fdp';
}

function dedupeSelectOptions<T extends { value: string }>(options: T[]): T[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

type SelectItem = { value: string; label: string };
type SelectGroup = { group: string; items: SelectItem[] };
type SelectData = SelectItem[] | SelectGroup[];

function isSelectGroups(data: SelectData): data is SelectGroup[] {
  return data.length > 0 && 'group' in data[0];
}

function filterSelectDataForRow(
  data: SelectData,
  selectedElsewhere: Set<string>,
  currentValue: string | null
): SelectData {
  const allow = (value: string) => value === currentValue || !selectedElsewhere.has(value);
  const filterItems = (items: SelectItem[]) => items.filter((i) => allow(i.value));

  if (!data.length) return data;
  if (isSelectGroups(data)) {
    return data
      .map((g) => ({ group: g.group, items: filterItems(g.items) }))
      .filter((g) => g.items.length > 0);
  }
  return filterItems(data);
}

function flattenSelectData(data: SelectData): SelectItem[] {
  if (!data.length) return [];
  if (isSelectGroups(data)) return data.flatMap((g) => g.items);
  return data;
}

function findSelectLabel(data: SelectData, value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return flattenSelectData(data).find((o) => o.value === value)?.label;
}

function filterSelectDataBySearch(data: SelectData, search: string): SelectData {
  const needle = search.trim().toLowerCase();
  if (!needle) return data;

  const filterItems = (items: SelectItem[]) =>
    items.filter(
      (i) => i.label.toLowerCase().includes(needle) || i.value.toLowerCase().includes(needle)
    );

  if (isSelectGroups(data)) {
    return data
      .map((g) => ({ group: g.group, items: filterItems(g.items) }))
      .filter((g) => g.items.length > 0);
  }
  return filterItems(data);
}

const WIZARD_CACHE_KEY = 'officer_dispatch_order_wizard_v1';

type WizardCache = {
  description: string;
  lines: LineForm[];
  wizardStep: number;
  categoryGroup: 'food' | 'nonfood' | '';
  draftLine: LineForm;
  destHubId: string | null;
  destSearchByRow: Record<string, string>;
  destKind: DestKind;
};

function readWizardCache(): WizardCache | null {
  try {
    const raw = sessionStorage.getItem(WIZARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WizardCache & { destSearch?: string };
    if (!parsed.destSearchByRow) {
      parsed.destSearchByRow = {};
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeWizardCache(cache: WizardCache) {
  sessionStorage.setItem(WIZARD_CACHE_KEY, JSON.stringify(cache));
}

function clearWizardCache() {
  sessionStorage.removeItem(WIZARD_CACHE_KEY);
}

type SourceAlloc = { warehouse_id: number; quantity: number; unit_id: number; clientKey: string };
type DestAlloc = {
  destination_location_id: number;
  quantity: number;
  unit_id: number;
  clientKey: string;
  destination_label?: string;
};

type LineForm = Omit<
  CreateDispatchOrderV2LinePayload,
  'source_allocations' | 'destination_allocations'
> & {
  clientKey: string;
  commodity_definition_id: number;
  commodity_definition_name?: string;
  source_allocations: SourceAlloc[];
  destination_allocations: DestAlloc[];
};

function normalizeCommodityGroup(groupName: string | null | undefined): 'food' | 'nonfood' | null {
  const g = (groupName || '').toUpperCase().replace(/[\s-]/g, '');
  if (g.includes('NONFOOD') || g === 'NONFOOD') return 'nonfood';
  if (g.includes('FOOD')) return 'food';
  return null;
}

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Empty field shows placeholder; stored value 0 means "not entered yet". */
function parseQuantityInput(value: string | number | null | undefined): number {
  if (value === '' || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function quantityInputValue(qty: number): number | '' {
  return qty === 0 ? '' : qty;
}

const emptyLine = (): LineForm => ({
  clientKey: newKey(),
  commodity_definition_id: 0,
  commodity_id: 0,
  quantity: 0,
  unit_id: 0,
  packaging_unit_id: undefined,
  packaging_size: undefined,
  remarks: '',
  source_allocations: [],
  destination_allocations: [],
});

function cloneLineForm(line: LineForm): LineForm {
  return {
    ...line,
    source_allocations: line.source_allocations.map((s) => ({ ...s })),
    destination_allocations: line.destination_allocations.map((d) => ({ ...d })),
  };
}

function OfficerDispatchOrderWizard() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cachedWizard = !isEdit ? readWizardCache() : null;

  const [description, setDescription] = useState(cachedWizard?.description ?? '');
  const [lines, setLines] = useState<LineForm[]>(cachedWizard?.lines ?? []);

  const [wizardStep, setWizardStep] = useState(cachedWizard?.wizardStep ?? 0);
  const [categoryGroup, setCategoryGroup] = useState<'food' | 'nonfood' | ''>(
    cachedWizard?.categoryGroup ?? ''
  );
  const [draftLine, setDraftLine] = useState<LineForm>(cachedWizard?.draftLine ?? emptyLine());
  const [destHubId, setDestHubId] = useState<string | null>(cachedWizard?.destHubId ?? null);
  const [destSearchByRow, setDestSearchByRow] = useState<Record<string, string>>(
    cachedWizard?.destSearchByRow ?? {}
  );
  const [destKind, setDestKind] = useState<DestKind>(cachedWizard?.destKind ?? 'all');
  const [editingLineClientKey, setEditingLineClientKey] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(
    !isEdit &&
      ((cachedWizard?.lines ?? []).length === 0 || (cachedWizard?.wizardStep ?? 0) > 0)
  );

  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(
    activeAssignment?.role_name || useAuthStore((state) => state.role)
  );
  const isFederalFullAccess =
    roleSlug === ROLES.FEDERAL_OFFICER || roleSlug === ROLES.OFFICER;

  const { data: commodityDefinitions = [] } = useQuery({
    queryKey: ['commodity-definitions'],
    queryFn: getCommodityDefinitions,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: getUnitReferences,
  });

  const { data: hubs = [] } = useQuery({
    queryKey: ['hubs'],
    queryFn: getHubs,
    enabled: isFederalFullAccess,
  });

  const { data: destLookup, isFetching: destLoading, isError: destLookupError } = useQuery({
    queryKey: ['dispatch_lookup', 'dest', destHubId, destKind],
    queryFn: () =>
      getDestinationsLookup({
        per_page: 100,
        page: 1,
        hub_id: destHubId ? Number(destHubId) : undefined,
        destination_kind: destKind,
      }),
    enabled: wizardStep >= 3,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: stockWarehouses, isFetching: stockLoading, isError: stockLookupError } = useQuery({
    queryKey: ['dispatch_lookup', 'stock', draftLine.commodity_definition_id, draftLine.unit_id],
    queryFn: () =>
      getWarehousesForCommodityLookup({
        commodity_definition_id: draftLine.commodity_definition_id,
        unit_id: draftLine.unit_id || undefined,
      }),
    enabled: draftLine.commodity_definition_id > 0 && wizardStep >= 2,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: existing } = useQuery({
    queryKey: ['dispatch_orders', id],
    queryFn: () => getDispatchOrder(Number(id)),
    enabled: isEdit,
  });

  const orderIsDraft =
    !isEdit || String(existing?.status ?? '').toLowerCase() === 'draft';
  const canModifyLines = orderIsDraft;
  const isEditingLine = editingLineClientKey != null;
  const showOrderInProgress =
    !isEdit &&
    (lines.length > 0 || description.trim().length > 0);

  useEffect(() => {
    if (isEdit) return;
    writeWizardCache({
      description,
      lines,
      wizardStep,
      categoryGroup,
      draftLine,
      destHubId,
      destSearchByRow,
      destKind,
    });
  }, [
    isEdit,
    description,
    lines,
    wizardStep,
    categoryGroup,
    draftLine,
    destHubId,
    destSearchByRow,
    destKind,
  ]);

  useEffect(() => {
    if (!isEdit || !existing || commodityDefinitions.length === 0) return;
    setDescription(existing.description || existing.notes || '');
    const raw = existing.dispatch_order_lines || [];
    if (raw.length === 0) return;
    setLines(
      raw.map((l: DispatchOrderLineV2) => {
        const def = commodityDefinitions.find(
          (d) => d.name.toLowerCase() === (l.commodity_name || '').toLowerCase()
        );
        return {
          clientKey: newKey(),
          commodity_definition_id: def?.id ?? 0,
          commodity_definition_name: def?.name ?? l.commodity_name,
          commodity_id: l.commodity_id,
          quantity: l.quantity,
          unit_id: l.unit_id,
          packaging_unit_id: l.packaging_unit_id ?? undefined,
          packaging_size: l.packaging_size ?? undefined,
          remarks: l.remarks || '',
          source_allocations: (l.source_allocations || []).map((s) => ({
            warehouse_id: s.warehouse_id,
            quantity: s.quantity,
            unit_id: s.unit_id,
            clientKey: newKey(),
          })),
          destination_allocations: (l.destination_allocations || []).map((d) => ({
            destination_location_id: d.destination_location_id,
            quantity: d.quantity,
            unit_id: d.unit_id,
            destination_label: d.destination_label,
            clientKey: newKey(),
          })),
        };
      })
    );
  }, [isEdit, existing, commodityDefinitions]);

  const filteredDefinitions = useMemo(() => {
    if (!categoryGroup) return commodityDefinitions;
    return commodityDefinitions.filter((d) => normalizeCommodityGroup(d.group_name) === categoryGroup);
  }, [commodityDefinitions, categoryGroup]);

  const commodityOptions = useMemo(
    () =>
      filteredDefinitions.map((d: CommodityDefinition) => ({
        value: String(d.id),
        label: d.commodity_code ? `${d.name} (${d.commodity_code})` : d.name,
      })),
    [filteredDefinitions]
  );

  const noStockAvailable =
    draftLine.commodity_definition_id > 0 &&
    wizardStep >= 2 &&
    !stockLoading &&
    stockWarehouses != null &&
    (stockWarehouses.items.length === 0 ||
      stockWarehouses.meta?.has_inventory_lots === false);

  useEffect(() => {
    const defaultUnit = stockWarehouses?.meta?.unit_id;
    if (!defaultUnit || draftLine.unit_id) return;
    setDraftLine((p) => ({ ...p, unit_id: Number(defaultUnit) }));
  }, [stockWarehouses?.meta?.unit_id, draftLine.unit_id]);

  const unitOptions = useMemo(
    () => units.map((u) => ({ value: String(u.id), label: u.abbreviation || u.name })),
    [units]
  );

  const hubOptions = useMemo(
    () => hubs.map((h) => ({ value: String(h.id), label: h.name })),
    [hubs]
  );

  const destinationOptions = useMemo(() => {
    const items = destLookup?.items ?? [];
    const formatItem = (i: LookupOption) => ({
      value: String(i.id),
      label: `${i.label}${i.location_type ? ` [${i.location_type}]` : ''}`,
    });

    if (destKind !== 'all') {
      return dedupeSelectOptions(items.map(formatItem));
    }

    const warehouseItems = dedupeSelectOptions(
      items.filter((i) => isWarehouseLocationType(i.location_type)).map(formatItem)
    );
    const warehouseValues = new Set(warehouseItems.map((o) => o.value));
    const fdpItems = dedupeSelectOptions(
      items
        .filter((i) => isFdpLocationType(i.location_type))
        .map(formatItem)
        .filter((o) => !warehouseValues.has(o.value))
    );

    if (warehouseItems.length === 0 && fdpItems.length === 0) {
      return [];
    }

    const grouped: { group: string; items: { value: string; label: string }[] }[] = [];
    if (warehouseItems.length > 0) {
      grouped.push({ group: 'Warehouses', items: warehouseItems });
    }
    if (fdpItems.length > 0) {
      grouped.push({ group: 'FDPs', items: fdpItems });
    }
    return grouped;
  }, [destLookup, destKind]);

  const warehouseStockById = useMemo(() => {
    const map = new Map<number, LookupOption>();
    stockWarehouses?.items.forEach((w) => map.set(w.id, w));
    return map;
  }, [stockWarehouses]);

  const warehouseOptions = useMemo(
    () =>
      stockWarehouses?.items.map((w) => ({
        value: String(w.id),
        label: `${w.label} — avail: ${w.meta?.available_quantity ?? 0}`,
      })) ?? [],
    [stockWarehouses]
  );

  const maxQtyForWarehouse = (warehouseId: number) =>
    warehouseStockById.get(warehouseId)?.meta?.available_quantity ?? undefined;

  const totalAvailable = useMemo(() => {
    const fromMeta = stockWarehouses?.meta?.total_available_quantity;
    if (fromMeta != null && !Number.isNaN(Number(fromMeta))) {
      return Number(fromMeta);
    }
    return (
      stockWarehouses?.items.reduce((sum, w) => sum + (w.meta?.available_quantity ?? 0), 0) ?? 0
    );
  }, [stockWarehouses]);

  const unitLabel = useMemo(() => {
    const abbr = stockWarehouses?.meta?.unit_abbreviation;
    if (abbr) return abbr;
    const uid = draftLine.unit_id || stockWarehouses?.meta?.unit_id;
    const u = units.find((x) => x.id === uid);
    return u?.abbreviation || u?.name || '';
  }, [stockWarehouses, draftLine.unit_id, units]);

  const sourceAllocSum = useMemo(
    () => draftLine.source_allocations.reduce((a, r) => a + Number(r.quantity || 0), 0),
    [draftLine.source_allocations]
  );

  const destAllocSum = useMemo(
    () => draftLine.destination_allocations.reduce((a, r) => a + Number(r.quantity || 0), 0),
    [draftLine.destination_allocations]
  );

  const remainingDestQty = useMemo(
    () => Math.max(0, draftLine.quantity - destAllocSum),
    [draftLine.quantity, destAllocSum]
  );

  const allDestinationOptionValues = useMemo(() => {
    return new Set(flattenSelectData(destinationOptions).map((o) => o.value));
  }, [destinationOptions]);

  const selectedDestinationIds = useMemo(
    () =>
      new Set(
        draftLine.destination_allocations
          .map((d) => d.destination_location_id)
          .filter((id) => id > 0)
          .map(String)
      ),
    [draftLine.destination_allocations]
  );

  const unusedDestinationCount = useMemo(() => {
    let unused = 0;
    allDestinationOptionValues.forEach((value) => {
      if (!selectedDestinationIds.has(value)) unused += 1;
    });
    return unused;
  }, [allDestinationOptionValues, selectedDestinationIds]);

  const destinationsFullyDistributed =
    draftLine.quantity > 0 && Math.abs(destAllocSum - draftLine.quantity) <= 0.001;

  const destinationsStepValid = useMemo(() => {
    if (draftLine.destination_allocations.length === 0) return false;
    return draftLine.destination_allocations.every(
      (row) => row.destination_location_id > 0 && row.quantity > 0
    );
  }, [draftLine.destination_allocations]);

  const canAddDestinationRow =
    draftLine.quantity > 0 &&
    !destinationsFullyDistributed &&
    unusedDestinationCount > 0;

  const canAddLineToOrder =
    destinationsStepValid && destinationsFullyDistributed && draftLine.quantity > 0;

  const selectedCommodityName =
    draftLine.commodity_definition_name ||
    commodityDefinitions.find((d) => d.id === draftLine.commodity_definition_id)?.name ||
    'Selected commodity';

  const goBackToCommodity = () => {
    setWizardStep(1);
    setDraftLine((p) => ({
      ...p,
      quantity: 0,
      source_allocations: [],
      destination_allocations: [],
    }));
  };

  const getWarehouseOptionsForRow = (rowIndex: number) => {
    const currentId = draftLine.source_allocations[rowIndex]?.warehouse_id;
    const currentValue = currentId ? String(currentId) : null;
    const selectedElsewhere = new Set(
      draftLine.source_allocations
        .filter((_, i) => i !== rowIndex)
        .map((r) => r.warehouse_id)
        .filter((id) => id > 0)
        .map(String)
    );
    return warehouseOptions.filter(
      (o) => o.value === currentValue || !selectedElsewhere.has(o.value)
    );
  };

  const getDestinationOptionsForRow = (rowIndex: number) => {
    const row = draftLine.destination_allocations[rowIndex];
    const currentId = row?.destination_location_id;
    const currentValue = currentId ? String(currentId) : null;
    const selectedElsewhere = new Set(
      draftLine.destination_allocations
        .filter((_, i) => i !== rowIndex)
        .map((r) => r.destination_location_id)
        .filter((id) => id > 0)
        .map(String)
    );
    const scoped = filterSelectDataForRow(destinationOptions, selectedElsewhere, currentValue);
    const rowSearch = row?.clientKey ? destSearchByRow[row.clientKey] ?? '' : '';
    return filterSelectDataBySearch(scoped, rowSearch);
  };

  const maxQtyForDestRow = (rowIndex: number) => {
    const otherSum = draftLine.destination_allocations
      .filter((_, i) => i !== rowIndex)
      .reduce((a, r) => a + Number(r.quantity || 0), 0);
    return Math.max(0, draftLine.quantity - otherSum);
  };

  const setDestRowSearch = (clientKey: string, search: string) => {
    setDestSearchByRow((prev) => ({ ...prev, [clientKey]: search }));
  };

  const clearDestRowSearch = (clientKey: string) => {
    setDestSearchByRow((prev) => {
      const next = { ...prev };
      delete next[clientKey];
      return next;
    });
  };

  const handleDestFilterChange = (patch: { destKind?: DestKind; destHubId?: string | null }) => {
    if (patch.destKind != null) setDestKind(patch.destKind);
    if (patch.destHubId !== undefined) setDestHubId(patch.destHubId);
    setDestSearchByRow({});
  };

  useEffect(() => {
    if (wizardStep < 3 || !destinationOptions.length) return;

    const validIds = new Set(flattenSelectData(destinationOptions).map((o) => o.value));
    setDraftLine((prev) => {
      let changed = false;
      const next = prev.destination_allocations.map((row) => {
        if (row.destination_location_id <= 0) return row;
        if (validIds.has(String(row.destination_location_id))) return row;
        changed = true;
        return { ...row, destination_location_id: 0, quantity: 0 };
      });
      if (!changed) return prev;
      return { ...prev, destination_allocations: next };
    });
  }, [destinationOptions, wizardStep]);

  const handleWizardStepClick = (step: number) => {
    if (isEditingLine || step <= wizardStep) setWizardStep(step);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payloadLines: CreateDispatchOrderV2LinePayload[] = lines.map((l) => ({
        commodity_definition_id: l.commodity_definition_id,
        quantity: l.quantity,
        unit_id: l.unit_id,
        packaging_unit_id: l.packaging_unit_id ?? null,
        packaging_size: l.packaging_size ?? null,
        remarks: l.remarks,
        source_allocations: l.source_allocations.map(({ warehouse_id, quantity, unit_id }) => ({
          warehouse_id,
          quantity,
          unit_id,
        })),
        destination_allocations: l.destination_allocations.map(
          ({ destination_location_id, quantity, unit_id }) => ({
            destination_location_id,
            quantity,
            unit_id,
          })
        ),
      }));
      const body = {
        description: description || undefined,
        lines: payloadLines,
      };
      if (isEdit) {
        return updateDispatchOrderV2(Number(id), { description: body.description, lines: body.lines });
      }
      return createDispatchOrderV2(body);
    },
    onSuccess: (data) => {
      if (!isEdit) clearWizardCache();
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({ title: 'Saved', message: 'Dispatch order saved', color: 'green' });
      navigate(`/officer/dispatch-orders/${data.id}`);
    },
    onError: (error: unknown) => {
      const apiErr = isAxiosError<ApiError>(error) ? error.response?.data?.error : undefined;
      notifications.show({
        title: apiErr?.code === 'INSUFFICIENT_STOCK' ? 'Insufficient stock' : 'Error',
        message: apiErr?.message || 'Failed to save',
        color: 'red',
      });
    },
  });

  const resetDraft = () => {
    setDraftLine(emptyLine());
    setCategoryGroup('');
    setWizardStep(0);
    setDestSearchByRow({});
  };

  const cancelLineEdit = () => {
    setEditingLineClientKey(null);
    resetDraft();
    setIsWizardOpen(false);
  };

  const startEditLine = (line: LineForm) => {
    const def = commodityDefinitions.find((d) => d.id === line.commodity_definition_id);
    const group = normalizeCommodityGroup(def?.group_name);
    setEditingLineClientKey(line.clientKey);
    setDraftLine(cloneLineForm(line));
    setCategoryGroup(group || '');
    setWizardStep(3);
    setDestSearchByRow({});
    setIsWizardOpen(true);
  };

  const deleteLine = (lineIdx: number) => {
    const line = lines[lineIdx];
    setLines((p) => p.filter((_, i) => i !== lineIdx));
    if (line && editingLineClientKey === line.clientKey) {
      setEditingLineClientKey(null);
      resetDraft();
    }
  };

  const commitDraftLine = () => {
    if (!draftLine.commodity_definition_id || !draftLine.unit_id || draftLine.quantity <= 0) {
      notifications.show({ title: 'Incomplete line', message: 'Set commodity, unit, and line quantity', color: 'red' });
      return;
    }
    if (noStockAvailable) {
      notifications.show({
        title: 'Commodity unavailable',
        message: 'This commodity has no available stock in your jurisdiction. Choose another commodity.',
        color: 'red',
      });
      return;
    }
    if (draftLine.quantity > totalAvailable + 0.001) {
      notifications.show({
        title: 'Quantity too high',
        message: `Line quantity cannot exceed total available (${totalAvailable} ${unitLabel})`,
        color: 'red',
      });
      return;
    }
    if (draftLine.source_allocations.length === 0 || draftLine.destination_allocations.length === 0) {
      notifications.show({
        title: 'Incomplete line',
        message: 'Add at least one source and one destination allocation',
        color: 'red',
      });
      return;
    }
    const sourceWarehouseIds = draftLine.source_allocations
      .map((s) => s.warehouse_id)
      .filter((id) => id > 0);
    if (new Set(sourceWarehouseIds).size !== sourceWarehouseIds.length) {
      notifications.show({
        title: 'Duplicate source',
        message: 'Each source warehouse can only be selected once',
        color: 'red',
      });
      return;
    }
    const destLocationIds = draftLine.destination_allocations
      .map((d) => d.destination_location_id)
      .filter((id) => id > 0);
    if (new Set(destLocationIds).size !== destLocationIds.length) {
      notifications.show({
        title: 'Duplicate destination',
        message: 'Each destination can only be selected once',
        color: 'red',
      });
      return;
    }
    const incompleteDest = draftLine.destination_allocations.some(
      (row) => row.destination_location_id <= 0 || row.quantity <= 0
    );
    if (incompleteDest) {
      notifications.show({
        title: 'Incomplete destinations',
        message: 'Select a destination and enter a quantity for each row',
        color: 'red',
      });
      return;
    }
    const srcSum = draftLine.source_allocations.reduce((a, r) => a + Number(r.quantity || 0), 0);
    const destSum = draftLine.destination_allocations.reduce((a, r) => a + Number(r.quantity || 0), 0);
    if (Math.abs(srcSum - draftLine.quantity) > 0.001 || Math.abs(destSum - draftLine.quantity) > 0.001) {
      notifications.show({
        title: 'Allocation mismatch',
        message: 'Source and destination totals must match the line quantity',
        color: 'red',
      });
      return;
    }
    for (const src of draftLine.source_allocations) {
      const max = maxQtyForWarehouse(src.warehouse_id);
      if (max != null && src.quantity > max + 0.001) {
        notifications.show({
          title: 'Over allocation',
          message: `Quantity exceeds available stock (${max}) for selected warehouse`,
          color: 'red',
        });
        return;
      }
    }
    const def = commodityDefinitions.find((d) => d.id === draftLine.commodity_definition_id);
    if (editingLineClientKey) {
      setLines((p) =>
        p.map((line) =>
          line.clientKey === editingLineClientKey
            ? {
                ...draftLine,
                clientKey: editingLineClientKey,
                commodity_definition_name: def?.name,
              }
            : line
        )
      );
      setEditingLineClientKey(null);
      resetDraft();
      setIsWizardOpen(false);
      notifications.show({
        title: 'Line updated',
        message: 'Commodity line updated on this order',
        color: 'green',
      });
      return;
    }
    setLines((p) => [
      ...p,
      {
        ...draftLine,
        clientKey: newKey(),
        commodity_definition_name: def?.name,
      },
    ]);
    resetDraft();
    setIsWizardOpen(false);
    notifications.show({ title: 'Line added', message: 'Commodity line added to order', color: 'green' });
  };

  const updateDraftSource = (j: number, patch: Partial<SourceAlloc>) => {
    setDraftLine((prev) => {
      const next = [...prev.source_allocations];
      next[j] = { ...next[j], ...patch };
      return { ...prev, source_allocations: next };
    });
  };

  const updateDraftDest = (j: number, patch: Partial<DestAlloc>) => {
    setDraftLine((prev) => {
      const next = [...prev.destination_allocations];
      next[j] = { ...next[j], ...patch };
      return { ...prev, destination_allocations: next };
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>{isEdit ? 'Edit dispatch order' : 'New dispatch order'}</Title>
          {isEdit && existing && (
            <Text size="sm" c="dimmed">
              Dispatch reference: <strong>{existing.reference_no || `DO-${existing.id}`}</strong>
            </Text>
          )}
          {!isEdit && (
            <Text size="sm" c="dimmed">
              A dispatch reference (e.g. DO-4) is assigned automatically when you save the draft.
            </Text>
          )}
        </div>
        <Button variant="light" onClick={() => navigate('/officer/dispatch-orders')}>
          Back to list
        </Button>
      </Group>

      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
        Add commodities from the admin catalog (Food / Non-food). The system assigns a dispatch
        reference (DO-…) when you save the draft. Stock per warehouse combines all batches for that
        commodity; quantities cannot exceed availability.
      </Alert>

      <Card withBorder padding="lg">
        <Stack gap="md">
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={2}
          />
        </Stack>
      </Card>

      {/* Order summary — visible once reference or lines exist */}
      {showOrderInProgress && (
        <Card withBorder padding="md" bg="var(--mantine-color-gray-0)">
          <Text fw={600} mb="xs">
            Order in progress
          </Text>
          <Text size="sm" c="dimmed">
            Add one or more commodity lines below. When finished, click{' '}
            <strong>{isEdit ? 'Save draft' : 'Create draft'}</strong> to save the order. You can edit or
            remove lines before saving.
          </Text>
          {description.trim() && (
            <Text size="sm" mt={4}>
              Description: {description.trim()}
            </Text>
          )}
          <Text size="sm" mt="sm">
            Lines added: <strong>{lines.length}</strong>
          </Text>
        </Card>
      )}

      {/* Committed commodity lines */}
      {lines.map((line, lineIdx) => {
        const commodityLabel =
          line.commodity_definition_name ||
          commodityDefinitions.find((d) => d.id === line.commodity_definition_id)?.name ||
          `Commodity ${line.commodity_id}`;
        return (
          <Card key={line.clientKey} withBorder padding="md">
            <Group justify="space-between">
              <Group gap="xs">
                <Badge variant="light">Line {lineIdx + 1}</Badge>
                <Text fw={600}>{commodityLabel}</Text>
                <Text size="sm" c="dimmed">
                  Qty {line.quantity}
                  {line.unit_id ? ` · unit #${line.unit_id}` : ''}
                </Text>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>
                Sources: {formatSourceAllocations(line)}
              </Text>
              <Text size="xs" c="dimmed">
                Destinations: {formatDestinationAllocations(line)}
              </Text>
              {canModifyLines && (
                <Group gap="xs">
                  <ActionIcon
                    color="blue"
                    variant="light"
                    title="Edit line"
                    onClick={() => startEditLine(line)}
                  >
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon
                    color="red"
                    variant="light"
                    title="Remove line"
                    onClick={() => deleteLine(lineIdx)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              )}
            </Group>
          </Card>
        );
      })}

      {/*
       * Action bar shown when the wizard is closed:
       * - "Add commodity line" opens the wizard for a new line
       * - "Create draft" / "Save draft" submits the order
       * Create draft is enabled as soon as there is at least one line and a dispatch reference.
       */}
      {!isWizardOpen && (
        <Group mt="xs">
          {canModifyLines && (
            <Button
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                resetDraft();
                setIsWizardOpen(true);
              }}
            >
              Add commodity line
            </Button>
          )}
          <Button
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            disabled={lines.length === 0 || saveMutation.isPending}
          >
            {isEdit ? 'Save draft' : 'Create draft'}
          </Button>
        </Group>
      )}

      {/* Commodity line wizard — open when adding a new line or editing an existing one */}
      {isWizardOpen && (
        <Card withBorder padding="lg">
          <Group justify="space-between" mb="md">
            <Text fw={600}>{isEditingLine ? 'Edit commodity line' : 'Add commodity line'}</Text>
            {(isEditingLine || lines.length > 0) && (
              <Button
                variant="subtle"
                size="xs"
                color={isEditingLine ? 'red' : 'gray'}
                onClick={() => {
                  if (isEditingLine) setEditingLineClientKey(null);
                  resetDraft();
                  setIsWizardOpen(false);
                }}
              >
                {isEditingLine ? 'Cancel edit' : 'Cancel'}
              </Button>
            )}
          </Group>

          <Stepper active={wizardStep} onStepClick={handleWizardStepClick} allowNextStepsSelect={false}>
            {/* Step 0 — Category */}
            <Stepper.Step label="Category" description="Food or non-food">
              <Select
                label="Commodity category"
                placeholder="Select group"
                data={[
                  { value: 'food', label: 'Food' },
                  { value: 'nonfood', label: 'Non-food' },
                ]}
                value={categoryGroup || null}
                onChange={(v) => {
                  setCategoryGroup((v as 'food' | 'nonfood') || '');
                  setDraftLine((p) => ({ ...p, commodity_definition_id: 0, commodity_id: 0 }));
                }}
                mt="md"
              />
              <Group mt="md">
                <Button onClick={() => setWizardStep(1)} disabled={!categoryGroup}>
                  Next
                </Button>
              </Group>
            </Stepper.Step>

            {/* Step 1 — Commodity */}
            <Stepper.Step label="Commodity" description="Admin catalog">
              <Select
                label="Commodity"
                description="From Setup → Commodities (not individual batches)"
                searchable
                data={commodityOptions}
                value={
                  draftLine.commodity_definition_id
                    ? String(draftLine.commodity_definition_id)
                    : null
                }
                onChange={(v) => {
                  const defId = Number(v);
                  const def = commodityDefinitions.find((x) => x.id === defId);
                  setDraftLine((p) => ({
                    ...p,
                    commodity_definition_id: defId,
                    commodity_id: 0,
                    unit_id: 0,
                    source_allocations: [],
                    commodity_definition_name: def?.name,
                  }));
                }}
                mt="md"
              />
              <Group mt="md">
                <Button variant="light" onClick={() => setWizardStep(0)}>
                  Back
                </Button>
                <Button
                  onClick={() => setWizardStep(2)}
                  disabled={!draftLine.commodity_definition_id}
                >
                  Next
                </Button>
              </Group>
            </Stepper.Step>

            {/* Step 2 — Sources */}
            <Stepper.Step label="Sources" description="Warehouses & qty">
              {stockLoading && draftLine.commodity_definition_id > 0 ? (
                <Center py="xl" mt="md">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed" ml="sm">
                    Loading availability for {selectedCommodityName}…
                  </Text>
                </Center>
              ) : stockLookupError ? (
                <Stack gap="md" mt="md">
                  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" title="Could not load stock">
                    <Text size="sm">
                      Warehouse availability could not be loaded. Check your connection and try again.
                    </Text>
                  </Alert>
                  <Button variant="light" onClick={() => setWizardStep(1)}>
                    Back
                  </Button>
                </Stack>
              ) : noStockAvailable ? (
                <Stack gap="md" mt="md">
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="red"
                    variant="light"
                    title="Commodity unavailable"
                  >
                    <Text size="sm">
                      <strong>{selectedCommodityName}</strong> has no available stock in warehouses
                      within your jurisdiction
                      {stockWarehouses?.meta?.has_inventory_lots === false
                        ? ' (no received inventory linked to this catalog item yet).'
                        : '.'}{' '}
                      Choose another commodity or confirm stock has been received.
                    </Text>
                  </Alert>
                  <Group>
                    <Button variant="light" onClick={() => setWizardStep(1)}>
                      Back
                    </Button>
                    <Button onClick={goBackToCommodity}>Choose another commodity</Button>
                  </Group>
                </Stack>
              ) : (
                <Stack gap="md" mt="md">
                  <Select
                    label="Unit"
                    description="All quantities below use this unit"
                    data={unitOptions}
                    value={draftLine.unit_id ? String(draftLine.unit_id) : null}
                    onChange={(v) =>
                      setDraftLine((p) => ({
                        ...p,
                        unit_id: Number(v),
                        source_allocations: [],
                        quantity: 0,
                      }))
                    }
                  />

                  <Card withBorder padding="md" bg="var(--mantine-color-blue-light)">
                    <Text size="sm" c="dimmed">
                      Total available in your jurisdiction
                    </Text>
                    <Text size="xl" fw={700}>
                      {totalAvailable.toLocaleString(undefined, { maximumFractionDigits: 3 })}{' '}
                      {unitLabel || 'units'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Combined across all batches and warehouses you can access
                    </Text>
                  </Card>

                  <NumberInput
                    label="Line quantity"
                    description="Total amount to dispatch on this line (cannot exceed available total)"
                    min={0}
                    max={totalAvailable > 0 ? totalAvailable : undefined}
                    placeholder="0"
                    value={quantityInputValue(draftLine.quantity)}
                    onChange={(v) =>
                      setDraftLine((p) => ({ ...p, quantity: parseQuantityInput(v) }))
                    }
                    disabled={!draftLine.unit_id}
                  />

                  <Text size="sm" c="dimmed">
                    Source allocated: <strong>{sourceAllocSum}</strong> / Line quantity:{' '}
                    <strong>{draftLine.quantity}</strong> {unitLabel}
                  </Text>

                  <Divider label="Allocate from warehouses" labelPosition="center" />

                  <Table.ScrollContainer minWidth={480}>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Warehouse</Table.Th>
                        <Table.Th>Qty</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {draftLine.source_allocations.map((row, j) => (
                        <Table.Tr key={row.clientKey}>
                          <Table.Td>
                            <Select
                              searchable
                              data={getWarehouseOptionsForRow(j)}
                              value={row.warehouse_id ? String(row.warehouse_id) : null}
                              onChange={(v) => {
                                const wid = Number(v);
                                const whMax = maxQtyForWarehouse(wid);
                                const lineQty = draftLine.quantity;
                                const defaultQty =
                                  lineQty > 0
                                    ? whMax != null
                                      ? Math.min(lineQty, whMax)
                                      : lineQty
                                    : 0;
                                updateDraftSource(j, {
                                  warehouse_id: wid,
                                  unit_id: draftLine.unit_id,
                                  quantity: defaultQty,
                                });
                              }}
                            />
                          </Table.Td>
                          <Table.Td>
                            <NumberInput
                              min={0}
                              max={
                                row.warehouse_id
                                  ? maxQtyForWarehouse(row.warehouse_id)
                                  : undefined
                              }
                              placeholder="0"
                              value={quantityInputValue(row.quantity)}
                              onChange={(v) =>
                                updateDraftSource(j, { quantity: parseQuantityInput(v) })
                              }
                              disabled={draftLine.quantity <= 0}
                            />
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon
                              color="red"
                              variant="light"
                              onClick={() =>
                                setDraftLine((p) => ({
                                  ...p,
                                  source_allocations: p.source_allocations.filter(
                                    (_, k) => k !== j
                                  ),
                                }))
                              }
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                  </Table.ScrollContainer>

                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPlus size={14} />}
                    disabled={draftLine.quantity <= 0}
                    onClick={() =>
                      setDraftLine((p) => ({
                        ...p,
                        source_allocations: [
                          ...p.source_allocations,
                          {
                            warehouse_id: 0,
                            quantity: 0,
                            unit_id: p.unit_id || 0,
                            clientKey: newKey(),
                          },
                        ],
                      }))
                    }
                  >
                    Add source warehouse
                  </Button>

                  <Group mt="md">
                    <Button variant="light" onClick={() => setWizardStep(1)}>
                      Back
                    </Button>
                    <Button
                      onClick={() => {
                        if (draftLine.quantity > totalAvailable + 0.001) {
                          notifications.show({
                            title: 'Quantity too high',
                            message: `Line quantity cannot exceed ${totalAvailable} ${unitLabel}`,
                            color: 'red',
                          });
                          return;
                        }
                        const srcSum = draftLine.source_allocations.reduce(
                          (a, r) => a + Number(r.quantity || 0),
                          0
                        );
                        if (Math.abs(srcSum - draftLine.quantity) > 0.001) {
                          notifications.show({
                            title: 'Allocation mismatch',
                            message: 'Source warehouse totals must equal the line quantity',
                            color: 'red',
                          });
                          return;
                        }
                        setWizardStep(3);
                      }}
                      disabled={
                        draftLine.quantity <= 0 ||
                        draftLine.source_allocations.length === 0 ||
                        Math.abs(sourceAllocSum - draftLine.quantity) > 0.001
                      }
                    >
                      Next
                    </Button>
                  </Group>
                </Stack>
              )}
            </Stepper.Step>

            {/* Step 3 — Destinations */}
            <Stepper.Step label="Destinations" description="Where stock goes">
              {isFederalFullAccess && (
                <Select
                  mt="md"
                  label="Filter by hub (optional)"
                  description="Narrow warehouse destinations; FDPs remain available"
                  placeholder="All hubs"
                  clearable
                  searchable
                  data={hubOptions}
                  value={destHubId}
                  onChange={(v) => handleDestFilterChange({ destHubId: v })}
                />
              )}
              <SegmentedControl
                mt="md"
                value={destKind}
                onChange={(v) => handleDestFilterChange({ destKind: v as DestKind })}
                data={[
                  { value: 'all', label: 'All' },
                  { value: 'warehouse', label: 'Warehouses only' },
                  { value: 'fdp', label: 'FDPs only' },
                ]}
              />

              {destLookupError && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mt="md" title="Could not load destinations">
                  Destination options could not be loaded. Check your connection and try again.
                </Alert>
              )}

              <Card withBorder padding="md" mt="md" bg="var(--mantine-color-blue-light)">
                <Text size="sm" c="dimmed">
                  Line quantity
                </Text>
                <Text fw={600}>
                  {draftLine.quantity} {unitLabel}
                </Text>
                <Text size="sm" mt="xs">
                  Distributed: <strong>{destAllocSum}</strong> / {draftLine.quantity} {unitLabel}
                  {' · '}
                  Remaining: <strong>{remainingDestQty}</strong> {unitLabel}
                </Text>
              </Card>

              <Text size="sm" c="dimmed" mt="md">
                Select each destination, then enter how much goes there. Each row must be a different
                location; quantities must sum to the line total.
                {destLookup?.meta?.total_count != null
                  ? ` (${destLookup.meta.total_count} destinations available)`
                  : ''}
              </Text>

              <Table.ScrollContainer minWidth={480}>
              <Table mt="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Destination</Table.Th>
                    <Table.Th>Qty</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {draftLine.destination_allocations.map((row, j) => (
                    <Table.Tr key={row.clientKey}>
                      <Table.Td>
                        <Select
                          key={`${row.clientKey}-${destKind}-${destHubId ?? 'all'}`}
                          searchable
                          data={getDestinationOptionsForRow(j)}
                          nothingFoundMessage={
                            destLoading ? 'Loading…' : 'No destinations in your scope'
                          }
                          searchValue={destSearchByRow[row.clientKey] ?? ''}
                          onSearchChange={(search) => setDestRowSearch(row.clientKey, search)}
                          value={
                            row.destination_location_id
                              ? String(row.destination_location_id)
                              : null
                          }
                          onChange={(v) => {
                            clearDestRowSearch(row.clientKey);
                            const rowOptions = getDestinationOptionsForRow(j);
                            updateDraftDest(j, {
                              destination_location_id: Number(v),
                              unit_id: draftLine.unit_id,
                              destination_label: findSelectLabel(rowOptions, v),
                            });
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          max={maxQtyForDestRow(j) > 0 ? maxQtyForDestRow(j) : undefined}
                          placeholder="0"
                          disabled={!row.destination_location_id}
                          value={quantityInputValue(row.quantity)}
                          onChange={(v) =>
                            updateDraftDest(j, { quantity: parseQuantityInput(v) })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => {
                            clearDestRowSearch(row.clientKey);
                            setDraftLine((p) => ({
                              ...p,
                              destination_allocations: p.destination_allocations.filter(
                                (_, k) => k !== j
                              ),
                            }));
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              </Table.ScrollContainer>

              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                mt="xs"
                disabled={!canAddDestinationRow}
                onClick={() =>
                  setDraftLine((p) => ({
                    ...p,
                    destination_allocations: [
                      ...p.destination_allocations,
                      {
                        destination_location_id: 0,
                        quantity: 0,
                        unit_id: p.unit_id || 0,
                        clientKey: newKey(),
                      },
                    ],
                  }))
                }
              >
                Add destination
              </Button>

              <Group mt="md">
                <Button variant="light" onClick={() => setWizardStep(2)}>
                  Back
                </Button>
                <Button onClick={commitDraftLine} disabled={!canAddLineToOrder}>
                  {isEditingLine ? 'Update line' : 'Add line to order'}
                </Button>
              </Group>
            </Stepper.Step>
          </Stepper>
        </Card>
      )}
    </Stack>
  );
}

export default OfficerDispatchOrderWizard;
