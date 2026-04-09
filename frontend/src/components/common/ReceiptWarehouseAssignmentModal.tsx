import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import type { ReceiptOrder } from '../../api/receiptOrders';
import type { Store } from '../../types/store';
import type { Warehouse } from '../../types/warehouse';
import type { UnitReference, UomConversion } from '../../types/referenceData';

interface AssignmentPayloadRow {
  receipt_order_line_id: number;
  warehouse_id: number;
  quantity: number;
}

interface ReceiptWarehouseAssignmentModalProps {
  opened: boolean;
  onClose: () => void;
  receiptOrder: ReceiptOrder;
  warehouses: Warehouse[];
  stores: Store[];
  units: UnitReference[];
  uomConversions: UomConversion[];
  onSubmit: (payload: { assignments: AssignmentPayloadRow[] }) => void;
  loading?: boolean;
}

interface DraftRow {
  clientId: string;
  receipt_order_line_id: number | null;
  warehouse_id: number | null;
  quantity: number | null;
  unit_id: number | null;
}

interface RowValidation {
  convertedQuantity: number | null;
  error: string | null;
}

interface RowPreview {
  lineRemainingBeforeRow: number | null;
  warehouseSpaceBeforeRow: number | null;
}

const EPSILON = 0.000001;

function makeClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function orderLines(receiptOrder: ReceiptOrder) {
  return receiptOrder.receipt_order_lines ?? receiptOrder.lines ?? [];
}

function findDirectedMultiplier(
  fromUnitId: number,
  toUnitId: number,
  commodityId: number,
  conversions: UomConversion[]
): number | null {
  if (fromUnitId === toUnitId) return 1;

  const visited = new Set<number>();

  function dfs(currentUnitId: number): number | null {
    if (currentUnitId === toUnitId) return 1;
    if (visited.has(currentUnitId)) return null;
    visited.add(currentUnitId);

    const outgoing = conversions.filter((conversion) => {
      if (!conversion.active) return false;
      if (conversion.from_unit_id !== currentUnitId) return false;
      return conversion.commodity_id == null || conversion.commodity_id === commodityId;
    });

    for (const edge of outgoing) {
      const tail = dfs(edge.to_unit_id);
      if (tail != null) return Number(edge.multiplier) * tail;
    }

    return null;
  }

  return dfs(fromUnitId);
}

function ReceiptWarehouseAssignmentModal({
  opened,
  onClose,
  receiptOrder,
  warehouses,
  stores,
  units,
  uomConversions,
  onSubmit,
  loading = false,
}: ReceiptWarehouseAssignmentModalProps) {
  const lines = useMemo(() => orderLines(receiptOrder), [receiptOrder]);

  const assignedByLine = useMemo(() => {
    const result: Record<number, number> = {};
    (receiptOrder.assignments ?? []).forEach((assignment) => {
      const lineId = assignment.receipt_order_line_id;
      if (lineId == null) return;
      result[lineId] = (result[lineId] || 0) + Number(assignment.quantity ?? 0);
    });
    return result;
  }, [receiptOrder.assignments]);

  const warehouseSpaceByWarehouseId = useMemo(() => {
    const result: Record<number, number> = {};
    stores.forEach((store) => {
      result[store.warehouse_id] = (result[store.warehouse_id] || 0) + Number(store.available_space || 0);
    });
    return result;
  }, [stores]);

  const lineMeta = useMemo(() => {
    return lines.map((line) => {
      const lineId = Number(line.id);
      const ordered = Number(line.quantity ?? 0);
      const assigned = assignedByLine[lineId] || 0;
      const remaining = Math.max(0, ordered - assigned);
      return {
        lineId,
        commodityId: line.commodity_id,
        commodityName: line.commodity_name || `Commodity #${line.commodity_id}`,
        unitId: line.unit_id,
        unitName: line.unit_name || `Unit #${line.unit_id}`,
        ordered,
        assigned,
        remaining,
      };
    });
  }, [assignedByLine, lines]);

  const initialLineId = lineMeta[0]?.lineId ?? null;
  const initialUnitId = lineMeta[0]?.unitId ?? null;

  const [rows, setRows] = useState<DraftRow[]>([
    {
      clientId: makeClientId(),
      receipt_order_line_id: initialLineId,
      warehouse_id: null,
      quantity: null,
      unit_id: initialUnitId,
    },
  ]);

  useEffect(() => {
    if (!opened) return;
    setRows([
      {
        clientId: makeClientId(),
        receipt_order_line_id: initialLineId,
        warehouse_id: null,
        quantity: null,
        unit_id: initialUnitId,
      },
    ]);
  }, [initialLineId, initialUnitId, opened]);

  const lineMap = useMemo(() => {
    const result = new Map<number, (typeof lineMeta)[number]>();
    lineMeta.forEach((line) => result.set(line.lineId, line));
    return result;
  }, [lineMeta]);

  const rowComputation = useMemo(() => {
    const pendingByLine: Record<number, number> = {};
    const pendingByWarehouse: Record<number, number> = {};
    const next: Record<string, RowValidation> = {};
    const previews: Record<string, RowPreview> = {};

    rows.forEach((row) => {
      const lineId = row.receipt_order_line_id;
      const warehouseId = row.warehouse_id;
      const quantity = Number(row.quantity ?? 0);
      const unitId = row.unit_id;

      if (lineId == null) {
        next[row.clientId] = { convertedQuantity: null, error: 'Select a commodity' };
        return;
      }

      const line = lineMap.get(lineId);
      if (!line) {
        next[row.clientId] = { convertedQuantity: null, error: 'Invalid commodity line' };
        return;
      }

      if (warehouseId == null) {
        next[row.clientId] = { convertedQuantity: null, error: 'Select a warehouse' };
        return;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        next[row.clientId] = { convertedQuantity: null, error: 'Enter a quantity greater than zero' };
        return;
      }

      if (unitId == null) {
        next[row.clientId] = { convertedQuantity: null, error: 'Select a unit' };
        return;
      }

      const multiplier = findDirectedMultiplier(unitId, line.unitId, line.commodityId, uomConversions);
      if (multiplier == null) {
        next[row.clientId] = {
          convertedQuantity: null,
          error: 'Unit must match the order unit or be a smaller convertible unit',
        };
        return;
      }

      const convertedQuantity = Number((quantity * multiplier).toFixed(6));
      const alreadyPending = pendingByLine[lineId] || 0;
      const remainingBeforeRow = Math.max(0, line.remaining - alreadyPending);
      const warehouseBaseSpace =
        warehouseId != null && Number.isFinite(warehouseSpaceByWarehouseId[warehouseId])
          ? warehouseSpaceByWarehouseId[warehouseId]
          : null;
      const warehouseAlreadyPending = warehouseId != null ? pendingByWarehouse[warehouseId] || 0 : 0;
      const warehouseSpaceBeforeRow =
        warehouseBaseSpace != null ? Math.max(0, warehouseBaseSpace - warehouseAlreadyPending) : null;

      previews[row.clientId] = {
        lineRemainingBeforeRow: remainingBeforeRow,
        warehouseSpaceBeforeRow,
      };

      if (convertedQuantity - remainingBeforeRow > EPSILON) {
        next[row.clientId] = {
          convertedQuantity,
          error: `Exceeds remaining quantity (${remainingBeforeRow.toLocaleString()} ${line.unitName})`,
        };
        return;
      }

      pendingByLine[lineId] = alreadyPending + convertedQuantity;
      if (warehouseId != null) {
        pendingByWarehouse[warehouseId] = warehouseAlreadyPending + convertedQuantity;
      }
      next[row.clientId] = { convertedQuantity, error: null };
    });

    return { validations: next, previews };
  }, [lineMap, rows, uomConversions, warehouseSpaceByWarehouseId]);

  const validations = rowComputation.validations;
  const rowPreviews = rowComputation.previews;
  const pendingAssignedByLine = useMemo(() => {
    const result: Record<number, number> = {};
    rows.forEach((row) => {
      const lineId = row.receipt_order_line_id;
      const converted = validations[row.clientId]?.convertedQuantity;
      if (lineId == null || converted == null) return;
      result[lineId] = (result[lineId] || 0) + converted;
    });
    return result;
  }, [rows, validations]);

  const allowedUnitsByRow = useMemo(() => {
    const result: Record<string, { value: string; label: string }[]> = {};

    rows.forEach((row) => {
      if (row.receipt_order_line_id == null) {
        result[row.clientId] = [];
        return;
      }

      const line = lineMap.get(row.receipt_order_line_id);
      if (!line) {
        result[row.clientId] = [];
        return;
      }

      result[row.clientId] = units
        .filter((unit) => findDirectedMultiplier(unit.id, line.unitId, line.commodityId, uomConversions) != null)
        .map((unit) => ({
          value: String(unit.id),
          label: unit.abbreviation ? `${unit.name} (${unit.abbreviation})` : unit.name,
        }));
    });

    return result;
  }, [lineMap, rows, units, uomConversions]);

  const fullyAssigned = lineMeta.every((line) => line.remaining <= EPSILON);
  const fullyAllocatedInDraft = lineMeta.every((line) => {
    const pending = pendingAssignedByLine[line.lineId] || 0;
    return line.remaining - pending <= EPSILON;
  });
  const hasWarehouses = warehouses.length > 0;
  const hasRowErrors = rows.some((row) => validations[row.clientId]?.error);
  const canSubmit = !loading && !fullyAssigned && hasWarehouses && rows.length > 0 && !hasRowErrors;

  const updateRow = (clientId: string, updater: (row: DraftRow) => DraftRow) => {
    setRows((currentRows) => currentRows.map((row) => (row.clientId === clientId ? updater(row) : row)));
  };

  const addRow = () => {
    const fallbackLine = lineMeta.find((line) => line.remaining > EPSILON) ?? lineMeta[0];
    setRows((currentRows) => [
      ...currentRows,
      {
        clientId: makeClientId(),
        receipt_order_line_id: fallbackLine?.lineId ?? null,
        warehouse_id: null,
        quantity: null,
        unit_id: fallbackLine?.unitId ?? null,
      },
    ]);
  };

  const removeRow = (clientId: string) => {
    setRows((currentRows) => currentRows.filter((row) => row.clientId !== clientId));
  };

  const submit = () => {
    if (!canSubmit) return;

    onSubmit({
      assignments: rows.map((row) => ({
        receipt_order_line_id: Number(row.receipt_order_line_id),
        warehouse_id: Number(row.warehouse_id),
        quantity: Number(validations[row.clientId]?.convertedQuantity ?? 0),
      })),
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Assign Warehouse" size="xl" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Assign commodities across warehouses under this hub. Smaller units are converted into the receipt-order unit
          before validation and submission.
        </Text>

        <Table.ScrollContainer minWidth={720}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Commodity</Table.Th>
                <Table.Th>Ordered</Table.Th>
                <Table.Th>Assigned</Table.Th>
                <Table.Th>Remaining</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lineMeta.map((line) => (
                <Table.Tr key={line.lineId}>
                  <Table.Td>{line.commodityName}</Table.Td>
                  <Table.Td>{line.ordered.toLocaleString()} {line.unitName}</Table.Td>
                  <Table.Td>{line.assigned.toLocaleString()} {line.unitName}</Table.Td>
                  <Table.Td>
                    <Badge color={line.remaining > EPSILON ? 'blue' : 'green'}>
                      {line.remaining.toLocaleString()} {line.unitName}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {!hasWarehouses ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            No warehouses are configured under this hub yet.
          </Alert>
        ) : null}

        {fullyAssigned ? (
          <Alert color="green" icon={<IconAlertCircle size={16} />}>
            All commodities on this receipt order have already been fully assigned.
          </Alert>
        ) : null}

        {!fullyAssigned && fullyAllocatedInDraft ? (
          <Alert color="blue" icon={<IconAlertCircle size={16} />}>
            All remaining commodity quantities are already allocated in the current rows. Submit these assignments or
            adjust an existing row instead of adding another one.
          </Alert>
        ) : null}

        <Stack gap="sm">
          {rows.map((row, index) => {
            const line = row.receipt_order_line_id != null ? lineMap.get(row.receipt_order_line_id) : null;
            const validation = validations[row.clientId];
            const unitOptions = allowedUnitsByRow[row.clientId] || [];
            const selectedUnit = units.find((unit) => unit.id === row.unit_id);
            const preview = rowPreviews[row.clientId];
            const rowRemainingPreview =
              line && validation?.convertedQuantity != null
                ? Math.max(0, (preview?.lineRemainingBeforeRow ?? line.remaining) - validation.convertedQuantity)
                : null;
            const warehouseOptionsForRow = warehouses.map((warehouse) => {
              const pendingBeforeThisRow =
                row.warehouse_id != null && warehouse.id === row.warehouse_id
                  ? preview?.warehouseSpaceBeforeRow
                  : Number.isFinite(warehouseSpaceByWarehouseId[warehouse.id])
                    ? warehouseSpaceByWarehouseId[warehouse.id]
                    : null;
              const spaceLabel =
                pendingBeforeThisRow != null
                  ? `${pendingBeforeThisRow.toLocaleString()} available`
                  : warehouse.capacity?.usable_storage_capacity_mt != null
                    ? `${Number(warehouse.capacity.usable_storage_capacity_mt).toLocaleString()} usable cap.`
                    : 'Available space unknown';
              return {
                value: String(warehouse.id),
                label: `${warehouse.name} - ${spaceLabel}`,
              };
            });
            const lineOptionsForRow = lineMeta.map((lineOption) => {
              const remainingForOption =
                row.receipt_order_line_id != null && lineOption.lineId === row.receipt_order_line_id
                  ? preview?.lineRemainingBeforeRow ?? lineOption.remaining
                  : lineOption.remaining;
              return {
                value: String(lineOption.lineId),
                label: `${lineOption.commodityName} - Remaining: ${remainingForOption.toLocaleString()} ${lineOption.unitName}`,
              };
            });

            return (
              <Stack key={row.clientId} gap="xs" p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}>
                <Group justify="space-between">
                  <Text fw={600}>Assignment Row {index + 1}</Text>
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => removeRow(row.clientId)}
                    disabled={rows.length === 1}
                  >
                    Remove
                  </Button>
                </Group>

                <Group grow align="flex-start">
                  <Select
                    label="Select Warehouse"
                    placeholder="Choose warehouse"
                    data={warehouseOptionsForRow}
                    value={row.warehouse_id != null ? String(row.warehouse_id) : null}
                    onChange={(value) =>
                      updateRow(row.clientId, (currentRow) => ({
                        ...currentRow,
                        warehouse_id: value ? Number(value) : null,
                      }))
                    }
                    searchable
                  />
                  <Select
                    label="Commodity"
                    placeholder="Choose commodity"
                    data={lineOptionsForRow}
                    value={row.receipt_order_line_id != null ? String(row.receipt_order_line_id) : null}
                    onChange={(value) =>
                      updateRow(row.clientId, (currentRow) => {
                        const nextLine = value ? lineMap.get(Number(value)) : null;
                        const currentUnitStillValid =
                          nextLine && currentRow.unit_id != null
                            ? findDirectedMultiplier(currentRow.unit_id, nextLine.unitId, nextLine.commodityId, uomConversions) != null
                            : false;
                        return {
                          ...currentRow,
                          receipt_order_line_id: value ? Number(value) : null,
                          unit_id: currentUnitStillValid ? currentRow.unit_id : nextLine?.unitId ?? null,
                        };
                      })
                    }
                    searchable
                  />
                </Group>

                <Group grow align="flex-start">
                  <NumberInput
                    label="Quantity"
                    placeholder="Enter quantity"
                    value={row.quantity ?? undefined}
                    onChange={(value) =>
                      updateRow(row.clientId, (currentRow) => ({
                        ...currentRow,
                        quantity: typeof value === 'number' ? value : Number(value || 0),
                      }))
                    }
                    min={0}
                    allowDecimal
                    decimalScale={3}
                  />
                  <Select
                    label="Unit"
                    placeholder="Select unit"
                    data={unitOptions}
                    value={row.unit_id != null ? String(row.unit_id) : null}
                    onChange={(value) =>
                      updateRow(row.clientId, (currentRow) => ({
                        ...currentRow,
                        unit_id: value ? Number(value) : null,
                      }))
                    }
                    searchable
                  />
                </Group>

                {line && validation?.convertedQuantity != null ? (
                  <Group gap="xs">
                    <ThemeIcon variant="light" size="sm" color="blue">
                      <IconAlertCircle size={14} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed">
                      {Number(row.quantity || 0).toLocaleString()} {selectedUnit?.abbreviation || selectedUnit?.name || 'units'} ={' '}
                      {validation.convertedQuantity.toLocaleString()} {line.unitName}
                      {rowRemainingPreview != null ? `, remaining after this row: ${rowRemainingPreview.toLocaleString()} ${line.unitName}` : ''}
                    </Text>
                  </Group>
                ) : null}

                {validation?.error ? (
                  <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                    {validation.error}
                  </Alert>
                ) : null}
              </Stack>
            );
          })}
        </Stack>

        <Group justify="space-between">
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={addRow}
            disabled={!hasWarehouses || fullyAssigned || fullyAllocatedInDraft}
          >
            Add Row
          </Button>
          <Group>
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={loading} disabled={!canSubmit}>
              Assign
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ReceiptWarehouseAssignmentModal;
