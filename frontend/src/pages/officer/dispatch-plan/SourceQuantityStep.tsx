import { useMemo } from 'react';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
  Radio,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import type { StockBalance } from '../../../types/stockBalance';
import type { Warehouse } from '../../../types/warehouse';
import type { UnitReference, UomConversion } from '../../../types/referenceData';
import type { CommodityLineDraft, SourceAllocationDraft, SourceFacilityType } from './types';
import { convertQuantityToTargetUnit } from '../../../utils/uomConversions';

export interface SourceOption {
  key: string;
  sourceType: SourceFacilityType;
  warehouseId: number;
  warehouseName: string;
  hubId?: number | null;
  hubName?: string | null;
  availableQty: number;
  unitLabel?: string;
  unitId?: number;
  label: string;
}

interface SourceQuantityStepProps {
  value: CommodityLineDraft;
  stockBalances: StockBalance[];
  warehouses: Warehouse[];
  units: UnitReference[];
  uomConversions: UomConversion[];
  onChange: (patch: Partial<CommodityLineDraft>) => void;
}

function toQuantity(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildSourceOptions(
  stockBalances: StockBalance[],
  warehouses: Warehouse[],
  sourceType: SourceFacilityType | null
): SourceOption[] {
  if (!sourceType) return [];

  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
  const byWarehouse = new Map<number, { quantity: number; unitLabel?: string; unitId?: number }>();

  stockBalances.forEach((balance) => {
    const existing = byWarehouse.get(balance.warehouse_id);
    const nextQty = (existing?.quantity ?? 0) + toQuantity(balance.quantity);
    const unitLabel = existing?.unitLabel || balance.unit_abbreviation || balance.unit_name || undefined;
    const unitId = existing?.unitId ?? balance.unit_id ?? undefined;
    byWarehouse.set(balance.warehouse_id, { quantity: nextQty, unitLabel, unitId });
  });

  if (sourceType === 'independent') {
    return Array.from(byWarehouse.entries())
      .map(([warehouseId, info]) => {
        const warehouse = warehouseById.get(warehouseId);
        if (!warehouse || warehouse.hub_id) return null;
        if (info.quantity <= 0) return null;
        return {
          key: `wh-${warehouseId}`,
          sourceType: 'independent' as const,
          warehouseId,
          warehouseName: warehouse.name,
          hubId: null,
          hubName: null,
          availableQty: info.quantity,
          unitLabel: info.unitLabel,
          unitId: info.unitId,
          label: `${warehouse.name} — Available: ${info.quantity.toFixed(2)} ${info.unitLabel ?? ''}`,
        };
      })
      .filter((opt): opt is SourceOption => opt !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const byHub = new Map<
    number,
    { quantity: number; unitLabel?: string; unitId?: number; hubName: string; warehouseId: number; warehouseName: string }
  >();

  Array.from(byWarehouse.entries()).forEach(([warehouseId, info]) => {
    const warehouse = warehouseById.get(warehouseId);
    if (!warehouse?.hub_id || info.quantity <= 0) return;

    const existing = byHub.get(warehouse.hub_id);
    const nextQty = (existing?.quantity ?? 0) + info.quantity;
    const pickWarehouse = !existing || info.quantity > (byWarehouse.get(existing.warehouseId)?.quantity ?? 0);
    byHub.set(warehouse.hub_id, {
      quantity: nextQty,
      unitLabel: info.unitLabel || existing?.unitLabel,
      unitId: info.unitId ?? existing?.unitId,
      hubName: warehouse.hub_name ?? `Hub #${warehouse.hub_id}`,
      warehouseId: pickWarehouse ? warehouseId : existing!.warehouseId,
      warehouseName: pickWarehouse ? warehouse.name : existing!.warehouseName,
    });
  });

  return Array.from(byHub.entries())
    .map(([hubId, info]) => ({
      key: `hub-${hubId}`,
      sourceType: 'hub' as const,
      warehouseId: info.warehouseId,
      warehouseName: info.warehouseName,
      hubId,
      hubName: info.hubName,
      availableQty: info.quantity,
      unitLabel: info.unitLabel,
      unitId: info.unitId,
      label: `${info.hubName} — Available: ${info.quantity.toFixed(2)} ${info.unitLabel ?? ''}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function allocatedQuantity(allocations: SourceAllocationDraft[], sourceKey: string): number {
  return allocations
    .filter((allocation) => allocation.sourceKey === sourceKey)
    .reduce((sum, allocation) => sum + allocation.quantity, 0);
}

function remainingAvailable(
  option: SourceOption,
  allocations: SourceAllocationDraft[]
): number {
  return Math.max(0, option.availableQty - allocatedQuantity(allocations, option.key));
}

function sourceLabel(allocation: SourceAllocationDraft): string {
  return allocation.sourceType === 'hub'
    ? allocation.hubName || allocation.warehouseName
    : allocation.warehouseName;
}

function resetPendingSource(): Partial<CommodityLineDraft> {
  return {
    sourceType: null,
    sourceKey: null,
    warehouseId: null,
    warehouseName: '',
    hubId: null,
    hubName: null,
    quantity: 0,
    availableQty: 0,
  };
}

export function SourceQuantityStep({ value, stockBalances, warehouses, units, uomConversions, onChange }: SourceQuantityStepProps) {
  const baseSourceOptions = useMemo(
    () => buildSourceOptions(stockBalances, warehouses, value.sourceType),
    [stockBalances, warehouses, value.sourceType]
  );

  const sourceUnitId = baseSourceOptions[0]?.unitId ?? null;

  const conversionFactor = useMemo(() => {
    if (!sourceUnitId || !value.unitId || sourceUnitId === value.unitId) return null;
    const commodityId = value.commodityBatchIds[0] ?? 0;
    return convertQuantityToTargetUnit(1, sourceUnitId, value.unitId, commodityId, uomConversions);
  }, [sourceUnitId, value.unitId, value.commodityBatchIds, uomConversions]);

  const sourceOptions = useMemo(
    () =>
      baseSourceOptions
        .map((option) => {
          const remaining = remainingAvailable(option, value.sourceAllocations);
          const converted = conversionFactor != null ? remaining * conversionFactor : remaining;
          const displayUnit = value.unitLabel ?? option.unitLabel ?? '';
          return {
            ...option,
            remainingQty: converted,
            unitLabel: displayUnit || option.unitLabel,
            label: `${option.sourceType === 'hub' ? option.hubName : option.warehouseName} — Available: ${converted.toFixed(2)} ${displayUnit}`,
          };
        })
        .filter((option) => option.remainingQty > 0),
    [baseSourceOptions, value.sourceAllocations, conversionFactor, value.unitLabel]
  );

  const selectedSource = sourceOptions.find((opt) => opt.key === value.sourceKey);
  const totalAllocated = value.sourceAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  const unitLabel = value.unitLabel ?? value.sourceAllocations[0]?.unitLabel ?? '';

  const unitOptions = useMemo(
    () =>
      units.map((u) => ({
        value: u.id.toString(),
        label: u.name,
      })),
    [units]
  );

  const handleUnitChange = (unitId: string | null) => {
    const unit = units.find((u) => u.id.toString() === unitId);
    onChange({
      unitId: unit ? unit.id : 0,
      unitLabel: unit ? (unit.abbreviation || unit.name) : undefined,
    });
  };

  const selectedUnitId = value.unitId ? value.unitId.toString() : null;

  const handleSourceTypeChange = (type: string) => {
    onChange({
      sourceType: type as SourceFacilityType,
      sourceKey: null,
      warehouseId: null,
      warehouseName: '',
      hubId: null,
      hubName: null,
      quantity: 0,
      availableQty: 0,
    });
  };

  const handleSourceChange = (sourceKey: string) => {
    const source = sourceOptions.find((opt) => opt.key === sourceKey);
    if (!source) return;
    onChange({
      sourceKey,
      warehouseId: source.warehouseId,
      warehouseName: source.warehouseName,
      hubId: source.hubId,
      hubName: source.hubName,
      availableQty: source.remainingQty,
      unitLabel: source.unitLabel,
      quantity: 0,
    });
  };

  const handleAddSource = () => {
    if (!value.sourceType || !value.sourceKey || !value.warehouseId) {
      notifications.show({ title: 'Validation', message: 'Select a source facility', color: 'red' });
      return;
    }
    if (!value.quantity || value.quantity <= 0) {
      notifications.show({ title: 'Validation', message: 'Enter a valid quantity', color: 'red' });
      return;
    }
    if (value.sourceAllocations.some((allocation) => allocation.sourceKey === value.sourceKey)) {
      notifications.show({
        title: 'Validation',
        message: 'This source is already added. Remove it first to change the quantity.',
        color: 'red',
      });
      return;
    }
    const remaining = selectedSource?.remainingQty ?? value.availableQty;
    if (value.quantity > remaining) {
      notifications.show({ title: 'Validation', message: 'Quantity exceeds available stock', color: 'red' });
      return;
    }

    const allocation: SourceAllocationDraft = {
      id: crypto.randomUUID(),
      sourceType: value.sourceType,
      sourceKey: value.sourceKey,
      warehouseId: value.warehouseId,
      warehouseName: value.warehouseName,
      hubId: value.hubId,
      hubName: value.hubName,
      quantity: value.quantity,
      availableQty: remaining,
      unitLabel: value.unitLabel,
    };

    onChange({
      sourceAllocations: [...value.sourceAllocations, allocation],
      ...resetPendingSource(),
    });
  };

  const handleRemoveAllocation = (id: string) => {
    onChange({
      sourceAllocations: value.sourceAllocations.filter((allocation) => allocation.id !== id),
    });
  };

  return (
    <Stack gap="md">
      {value.commodityLabel && (
        <Group justify="space-between">
          <Text size="sm" fw={600}>
            {value.commodityLabel}
          </Text>
          {totalAllocated > 0 && (
            <Badge variant="light" color="blue" size="lg">
              Total: {totalAllocated.toLocaleString()} {unitLabel}
            </Badge>
          )}
        </Group>
      )}

      {value.sourceAllocations.length > 0 && (
        <>
          <Text size="sm" fw={600}>
            Added Sources
          </Text>
          <Table.ScrollContainer minWidth={500}>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Quantity</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {value.sourceAllocations.map((allocation) => (
                  <Table.Tr key={allocation.id}>
                    <Table.Td>{sourceLabel(allocation)}</Table.Td>
                    <Table.Td>{allocation.sourceType === 'hub' ? 'Hub' : 'Independent'}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {allocation.quantity.toLocaleString()} {allocation.unitLabel ?? ''}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => handleRemoveAllocation(allocation.id)}
                      >
                        Remove
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Divider label="Add another source" labelPosition="center" />
        </>
      )}

      <div>
        <Text size="sm" fw={600} mb="xs">
          Source Facility Type
        </Text>
        <Radio.Group
          key={`source-type-${value.sourceAllocations.length}-${value.sourceType ?? 'unset'}`}
          value={value.sourceType ?? ''}
          onChange={handleSourceTypeChange}
        >
          <Group grow>
            <Radio value="hub" label="Hub" />
            <Radio value="independent" label="Independent Warehouse" />
          </Group>
        </Radio.Group>
      </div>

      {value.sourceType && (
        <>
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Select Source
            </Text>
            <Badge variant="light" color="blue">
              {sourceOptions.length} option{sourceOptions.length === 1 ? '' : 's'}
            </Badge>
          </Group>

          {sourceOptions.length === 0 ? (
            <Alert color="yellow" title="No stock available">
              No {value.sourceType === 'hub' ? 'hubs' : 'independent warehouses'} with remaining
              stock for this commodity.
            </Alert>
          ) : (
            <Radio.Group
              key={`source-list-${value.sourceType}-${value.sourceAllocations.length}`}
              value={value.sourceKey ?? ''}
              onChange={handleSourceChange}
            >
              <Stack gap="xs">
                {sourceOptions.map((opt) => (
                  <Radio key={opt.key} value={opt.key} label={opt.label} />
                ))}
              </Stack>
            </Radio.Group>
          )}
        </>
      )}

      {value.sourceKey && (
        <Group align="flex-end" wrap="nowrap">
          <NumberInput
            label="Dispatch Quantity"
            placeholder="Enter quantity"
            value={value.quantity}
            onChange={(val) => onChange({ quantity: Number(val) || 0 })}
            min={0}
            style={{ flex: 1 }}
            description={
              selectedSource
                ? `Available: ${selectedSource.remainingQty.toFixed(2)} ${selectedSource.unitLabel ?? ''}`
                : undefined
            }
            error={
              selectedSource && value.quantity > selectedSource.remainingQty
                ? 'Quantity exceeds available stock'
                : undefined
            }
            required
          />
          <SearchableSelect
            label="Unit"
            placeholder="Select unit"
            data={unitOptions}
            value={selectedUnitId}
            onChange={handleUnitChange}
            searchable
            required
            style={{ minWidth: 140 }}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={handleAddSource}>
            Add Source
          </Button>
        </Group>
      )}

      {value.sourceAllocations.length === 0 && (
        <Text size="xs" c="dimmed">
          Add one or more sources with quantities. For example, dispatch 2 tools from one hub and 2 from another.
        </Text>
      )}
    </Stack>
  );
}
