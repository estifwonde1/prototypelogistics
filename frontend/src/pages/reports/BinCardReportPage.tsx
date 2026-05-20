import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack as MantineStack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconArchive,
  IconBox,
  IconChevronDown,
  IconChevronRight,
  IconHistory,
  IconPackage,
  IconSearch,
} from '@tabler/icons-react';
import { getBinCardReport } from '../../api/reports';
import { getStacks } from '../../api/stacks';
import { getStores } from '../../api/stores';
import { LoadingState } from '../../components/common/LoadingState';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import type { BinCardEntry } from '../../types/reports';
import type { Stack } from '../../types/stack';

interface CycleRow extends BinCardEntry {
  direction: 'in' | 'out' | 'move';
  signedBase: number;
  signedQuantity: number;
  runningBase: number;
}

interface BinCycle {
  id: string;
  status: 'current' | 'archived';
  commodityId?: number | null;
  commodityName: string;
  openedAt: string;
  closedAt?: string;
  rows: CycleRow[];
  balances: Map<string, number>;
  batches: Set<string>;
}

function unitLabel(row?: Partial<BinCardEntry> | null) {
  return row?.entered_unit_name || row?.unit_abbreviation || row?.unit_name || row?.base_unit_name || 'unit';
}

function batchLabel(row: BinCardEntry) {
  return row.batch_no?.trim() || (row.inventory_lot_id ? `Lot #${row.inventory_lot_id}` : 'No batch recorded');
}

function txDateValue(row: BinCardEntry) {
  return new Date(row.transaction_date || row.created_at || '').getTime() || 0;
}

function stackDirection(row: BinCardEntry, stackId: number): 'in' | 'out' | 'move' {
  if (row.destination_id === stackId && row.source_id !== stackId) return 'in';
  if (row.source_id === stackId && row.destination_id !== stackId) return 'out';
  return 'move';
}

function referenceLabel(row: BinCardEntry) {
  const doc = row.reference_type?.replace('Cats::Warehouse::', '');
  return [doc, row.reference_no].filter(Boolean).join(' / ') || '-';
}

function displayQty(row: BinCardEntry) {
  const qty = row.entered_quantity ?? row.quantity;
  return `${Number(qty || 0).toLocaleString()} ${unitLabel(row)}`;
}

function buildCycles(transactions: BinCardEntry[], stackId: number): BinCycle[] {
  const sorted = [...transactions].sort((a, b) => txDateValue(a) - txDateValue(b) || a.id - b.id);
  const cycles: BinCycle[] = [];
  let current: BinCycle | null = null;
  let runningBase = 0;

  for (const tx of sorted) {
    const direction = stackDirection(tx, stackId);
    if (direction === 'move') continue;

    const baseQty = Number(tx.base_quantity ?? tx.quantity ?? 0);
    const signedBase = direction === 'in' ? baseQty : -baseQty;
    const signedQuantity = direction === 'in' ? Number(tx.entered_quantity ?? tx.quantity ?? 0) : -Number(tx.entered_quantity ?? tx.quantity ?? 0);

    if (!current && direction === 'in') {
      current = {
        id: `cycle-${cycles.length + 1}`,
        status: 'current',
        commodityId: tx.commodity_id,
        commodityName: tx.commodity_name || 'Unknown commodity',
        openedAt: tx.transaction_date,
        rows: [],
        balances: new Map(),
        batches: new Set(),
      };
      runningBase = 0;
    }

    if (!current) {
      current = {
        id: `cycle-${cycles.length + 1}`,
        status: 'archived',
        commodityId: tx.commodity_id,
        commodityName: tx.commodity_name || 'Previous stock',
        openedAt: tx.transaction_date,
        rows: [],
        balances: new Map(),
        batches: new Set(),
      };
      runningBase = 0;
    }

    runningBase += signedBase;
    const row: CycleRow = { ...tx, direction, signedBase, signedQuantity, runningBase: Math.max(0, runningBase) };
    current.rows.push(row);
    current.batches.add(batchLabel(tx));

    const key = unitLabel(tx);
    current.balances.set(key, (current.balances.get(key) ?? 0) + signedQuantity);

    if (runningBase <= 0.0001) {
      current.status = 'archived';
      current.closedAt = tx.transaction_date;
      cycles.push(current);
      current = null;
      runningBase = 0;
    }
  }

  if (current) cycles.push(current);
  return cycles.reverse();
}

export default function BinCardReportPage() {
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const persistedRole = useAuthStore((state) => state.role);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || persistedRole);
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userStoreId = activeAssignment?.store?.id;
  const isStorekeeper = roleSlug === 'storekeeper';
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const warehouseIdForStoreList = isWarehouseManager || (isStorekeeper && userWarehouseId) ? userWarehouseId : undefined;

  const [storeId, setStoreId] = useState<string | null>(null);
  const [selectedStackId, setSelectedStackId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', { warehouse_id: warehouseIdForStoreList }],
    queryFn: () => getStores(warehouseIdForStoreList ? { warehouse_id: warehouseIdForStoreList } : undefined),
  });

  useEffect(() => {
    if (storeId) return;
    if (isStorekeeper && userStoreId) {
      setStoreId(String(userStoreId));
      return;
    }
    if (stores.length === 1) setStoreId(String(stores[0].id));
  }, [isStorekeeper, userStoreId, storeId, stores]);

  const { data: stacks = [], isLoading: stacksLoading } = useQuery({
    queryKey: ['stacks', { store_id: storeId }],
    queryFn: () => getStacks({ store_id: Number(storeId) }),
    enabled: !!storeId,
  });

  const { data: allStoreTransactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['reports', 'bin-card', { store_id: storeId }],
    queryFn: () => getBinCardReport({ store_id: Number(storeId) }),
    enabled: !!storeId,
  });

  const txByStack = useMemo(() => {
    const map = new Map<number, BinCardEntry[]>();
    for (const tx of allStoreTransactions) {
      [tx.source_id, tx.destination_id].forEach((id) => {
        if (!id) return;
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(tx);
      });
    }
    return map;
  }, [allStoreTransactions]);

  const filteredStacks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return stacks;
    return stacks.filter((stack) =>
      [
        stack.code,
        stack.commodity_name,
        stack.stack_status,
        stack.store_name,
      ].some((v) => String(v ?? '').toLowerCase().includes(term))
    );
  }, [stacks, search]);

  const storeOptions = stores.map((s) => ({ value: String(s.id), label: s.name }));

  function cyclesFor(stack: Stack) {
    return buildCycles(txByStack.get(stack.id) ?? [], stack.id);
  }

  function renderCycleTable(cycle: BinCycle, stackId: number) {
    const rows = [...cycle.rows].sort((a, b) => txDateValue(a) - txDateValue(b) || a.id - b.id);
    return (
      <Table.ScrollContainer minWidth={920}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Batch</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>In</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Out</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Cycle balance</Table.Th>
              <Table.Th>Reference</Table.Th>
              <Table.Th>Counter stack</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => {
              const counterStack =
                row.direction === 'in'
                  ? row.source_stack_code || (row.source_id ? `Stack #${row.source_id}` : '-')
                  : row.destination_stack_code || (row.destination_id ? `Stack #${row.destination_id}` : '-');
              return (
                <Table.Tr key={row.id}>
                  <Table.Td>{new Date(row.transaction_date).toLocaleDateString()}</Table.Td>
                  <Table.Td style={{ fontFamily: 'monospace', fontSize: 12 }}>{batchLabel(row)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)', fontWeight: 700 }}>
                    {row.direction === 'in' ? displayQty(row) : '-'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-red-7)', fontWeight: 700 }}>
                    {row.direction === 'out' ? displayQty(row) : '-'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {Number(row.runningBase).toLocaleString()} {row.base_unit_name || unitLabel(row)}
                  </Table.Td>
                  <Table.Td style={{ fontFamily: 'monospace', fontSize: 12 }}>{referenceLabel(row)}</Table.Td>
                  <Table.Td>{counterStack === `Stack #${stackId}` ? '-' : counterStack}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    );
  }

  return (
    <MantineStack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Bin Card</Title>
          <Text c="dimmed" size="sm">
            Stack history with current and archived cycles. When a stack becomes empty, its cycle is archived.
          </Text>
        </div>
      </Group>

      <Group align="flex-end">
        <Select
          label="Store"
          placeholder={storeOptions.length ? 'Select a store' : 'No stores available'}
          data={storeOptions}
          value={storeId}
          onChange={(value) => {
            setStoreId(value);
            setSelectedStackId(null);
            setExpanded(new Set());
          }}
          w={360}
          clearable={!isStorekeeper || storeOptions.length > 1}
          searchable={storeOptions.length > 8}
          disabled={!storeOptions.length}
        />
        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder="Search stack, commodity, or status"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          style={{ flex: 1, minWidth: 260 }}
        />
      </Group>

      {!storeId && (
        <Alert color="blue" title="Choose a store">
          Select a store to see every physical stack and its current or archived bin-card history.
        </Alert>
      )}

      {storeId && (stacksLoading || txLoading) && <LoadingState message="Loading stack history..." />}

      {storeId && !stacksLoading && !txLoading && filteredStacks.length === 0 && (
        <Alert color="gray">No stacks found for this store.</Alert>
      )}

      {filteredStacks.map((stack) => {
        const cycles = cyclesFor(stack);
        const currentCycle = cycles.find((cycle) => cycle.status === 'current');
        const archivedCycles = cycles.filter((cycle) => cycle.status === 'archived');
        const isExpanded = expanded.has(stack.id) || selectedStackId === stack.id;
        const isEmpty = !currentCycle;

        return (
          <Card key={stack.id} withBorder padding="md" radius="md">
            <Group
              justify="space-between"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(stack.id)) next.delete(stack.id);
                  else next.add(stack.id);
                  return next;
                });
                setSelectedStackId(stack.id);
              }}
            >
              <Group gap="sm">
                {isExpanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                <IconBox size={22} color={isEmpty ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-blue-6)'} />
                <div>
                  <Group gap="xs">
                    <Text fw={700}>{stack.code || `Stack #${stack.id}`}</Text>
                    <Badge color={isEmpty ? 'gray' : 'green'} variant="light">
                      {isEmpty ? 'Empty' : 'Current'}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {isEmpty
                      ? 'Ready for any commodity'
                      : `${currentCycle.commodityName} - ${currentCycle.batches.size} batch${currentCycle.batches.size === 1 ? '' : 'es'}`}
                  </Text>
                </div>
              </Group>
              <Group gap="xs">
                {!isEmpty && (
                  <Badge size="lg" variant="light" color="blue">
                    {[...currentCycle.balances.entries()]
                      .map(([unit, qty]) => `${Math.max(0, qty).toLocaleString()} ${unit}`)
                      .join(' / ')}
                  </Badge>
                )}
                {archivedCycles.length > 0 && (
                  <Badge variant="light" color="gray" leftSection={<IconArchive size={12} />}>
                    {archivedCycles.length} archived
                  </Badge>
                )}
              </Group>
            </Group>

            <Collapse in={isExpanded}>
              <Divider my="sm" />
              {cycles.length === 0 ? (
                <Alert color="gray">This stack has no recorded movement yet.</Alert>
              ) : (
                <Tabs defaultValue={currentCycle ? 'current' : 'archive'}>
                  <Tabs.List>
                    <Tabs.Tab value="current" leftSection={<IconPackage size={14} />}>
                      Current cycle
                    </Tabs.Tab>
                    <Tabs.Tab value="archive" leftSection={<IconHistory size={14} />}>
                      Archive ({archivedCycles.length})
                    </Tabs.Tab>
                  </Tabs.List>

                  <Tabs.Panel value="current" pt="md">
                    {currentCycle ? (
                      <MantineStack gap="sm">
                        <SimpleGrid cols={{ base: 1, sm: 3 }}>
                          <Card withBorder padding="sm" radius="sm">
                            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Commodity</Text>
                            <Text fw={700}>{currentCycle.commodityName}</Text>
                          </Card>
                          <Card withBorder padding="sm" radius="sm">
                            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Batches</Text>
                            <Text size="sm">{[...currentCycle.batches].join(', ')}</Text>
                          </Card>
                          <Card withBorder padding="sm" radius="sm">
                            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Opened</Text>
                            <Text size="sm">{new Date(currentCycle.openedAt).toLocaleDateString()}</Text>
                          </Card>
                        </SimpleGrid>
                        {renderCycleTable(currentCycle, stack.id)}
                      </MantineStack>
                    ) : (
                      <Alert color="green" title="Stack is empty">
                        The last cycle has been archived. This stack can now receive any commodity.
                      </Alert>
                    )}
                  </Tabs.Panel>

                  <Tabs.Panel value="archive" pt="md">
                    {archivedCycles.length === 0 ? (
                      <Alert color="gray">No archived cycles yet.</Alert>
                    ) : (
                      <MantineStack gap="md">
                        {archivedCycles.map((cycle, index) => (
                          <Card key={cycle.id} withBorder padding="sm" radius="sm">
                            <Group justify="space-between" mb="sm">
                              <div>
                                <Text fw={700}>
                                  {cycle.commodityName} cycle #{archivedCycles.length - index}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {new Date(cycle.openedAt).toLocaleDateString()} - {cycle.closedAt ? new Date(cycle.closedAt).toLocaleDateString() : 'open'}
                                </Text>
                              </div>
                              <Badge variant="light" color="gray">
                                Archived
                              </Badge>
                            </Group>
                            {renderCycleTable(cycle, stack.id)}
                          </Card>
                        ))}
                      </MantineStack>
                    )}
                  </Tabs.Panel>
                </Tabs>
              )}
            </Collapse>
          </Card>
        );
      })}
    </MantineStack>
  );
}
