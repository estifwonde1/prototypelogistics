import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Group,
  Card,
  Badge,
  Button,
  Table,
  Collapse,
  Alert,
  Select,
  Divider,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconArrowLeft, IconPackage } from '@tabler/icons-react';
import { getBinCardReport, type BinCardFilters } from '../../api/reports';
import { getStockBalances } from '../../api/stockBalances';
import { getStores } from '../../api/stores';
import { LoadingState } from '../../components/common/LoadingState';
import { ExpiryBadge } from '../../components/common/ExpiryBadge';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import type { StockBalance } from '../../types/stockBalance';

// ── Types ─────────────────────────────────────────────────────────────────

interface CommodityGroup {
  commodity_id: number;
  commodity_name: string;
  total_quantity: number;
  unit_name: string;
  batches: BatchGroup[];
}

interface BatchGroup {
  /** Stable key for grouping / React list keys */
  groupKey: string;
  batch_no: string;
  commodity_id: number;
  commodity_name: string;
  quantity: number;
  unit_name: string;
  expiry_date?: string | null;
  stacks: StockBalance[];
  inventory_lot_ids: number[];
}

function balanceRowGroupKey(r: StockBalance): string {
  if (r.inventory_lot_id != null && r.inventory_lot_id > 0) {
    return `lot:${r.inventory_lot_id}`;
  }
  const lbn = r.lot_batch_no?.trim();
  if (lbn) return `lbn:${lbn}`;
  const bn = r.batch_no?.trim();
  if (bn) return `bn:${bn}`;
  const cbn = r.commodity_batch_no?.trim();
  if (cbn) return `cbn:${cbn}`;
  return `orphan:${r.commodity_id}`;
}

function batchNoFromGroupKey(groupKey: string): string | undefined {
  if (groupKey.startsWith('lbn:')) return groupKey.slice(4);
  if (groupKey.startsWith('bn:')) return groupKey.slice(3);
  if (groupKey.startsWith('cbn:')) return groupKey.slice(4);
  return undefined;
}

function buildBinCardFiltersForBatch(batch: BatchGroup, storeId: string): BinCardFilters {
  const stackIds = [
    ...new Set(
      batch.stacks
        .map((s) => s.stack_id)
        .filter((id): id is number => typeof id === 'number' && id > 0)
    ),
  ];
  const lotIdsFromRows = [
    ...new Set(
      batch.stacks
        .map((s) => s.inventory_lot_id)
        .filter((id): id is number => typeof id === 'number' && id > 0)
    ),
  ];
  const hasNullLotRow = batch.stacks.some((s) => s.inventory_lot_id == null);
  const singularLotId = lotIdsFromRows.length === 1 ? lotIdsFromRows[0] : undefined;
  const orphanKey = batch.groupKey.startsWith('orphan:');
  const includeNull = hasNullLotRow && stackIds.length > 0;
  const omitLot = orphanKey && stackIds.length > 0;

  const first = batch.stacks[0];
  const reportBatchNo =
    first?.lot_batch_no?.trim() ||
    first?.batch_no?.trim() ||
    first?.commodity_batch_no?.trim() ||
    batchNoFromGroupKey(batch.groupKey);

  const filters: BinCardFilters = {
    store_id: Number(storeId),
    commodity_id: batch.commodity_id,
    ...(stackIds.length ? { stack_ids: stackIds } : {}),
    ...(includeNull ? { include_null_inventory_lot: true } : {}),
    ...(omitLot ? { omit_lot_filter: true } : {}),
  };

  if (singularLotId) {
    filters.inventory_lot_id = singularLotId;
  } else if (!omitLot && reportBatchNo) {
    filters.batch_no = reportBatchNo;
  }

  return filters;
}

// ── Main component ────────────────────────────────────────────────────────

export default function BinCardReportPage() {
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const persistedRole = useAuthStore((state) => state.role);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || persistedRole);
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userStoreId = activeAssignment?.store?.id;
  const isStorekeeper = roleSlug === 'storekeeper';
  const isWarehouseManager = roleSlug === 'warehouse_manager';

  const warehouseIdForStoreList =
    isWarehouseManager || (isStorekeeper && userWarehouseId) ? userWarehouseId : undefined;

  const [storeId, setStoreId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<BatchGroup | null>(null);
  const [expandedCommodities, setExpandedCommodities] = useState<Set<number>>(new Set());

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', { warehouse_id: warehouseIdForStoreList }],
    queryFn: () => getStores(warehouseIdForStoreList ? { warehouse_id: warehouseIdForStoreList } : undefined),
  });

  // Auto-select store: explicit assignment store, else sole store in scope
  useEffect(() => {
    if (!isStorekeeper || storeId) return;
    if (userStoreId) {
      setStoreId(String(userStoreId));
      return;
    }
    if (stores.length === 1) {
      setStoreId(String(stores[0].id));
    }
  }, [isStorekeeper, userStoreId, storeId, stores]);

  // Fetch stock balances for the selected store
  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ['stock_balances', { store_id: storeId }],
    queryFn: () => getStockBalances({ store_id: storeId ? Number(storeId) : undefined }),
    enabled: !!storeId,
  });

  // Fetch transaction history for selected batch
  const binCardFilterKey = useMemo(
    () =>
      selectedBatch && storeId
        ? JSON.stringify(buildBinCardFiltersForBatch(selectedBatch, storeId))
        : '',
    [selectedBatch, storeId]
  );

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['reports', 'bin-card', binCardFilterKey],
    queryFn: () => getBinCardReport(buildBinCardFiltersForBatch(selectedBatch!, storeId!)),
    enabled: !!selectedBatch && !!storeId,
    select: (data) =>
      [...data].sort(
        (a: { transaction_date: string }, b: { transaction_date: string }) =>
          new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
      ),
  });

  // Group balances by commodity → batch (lot-aware keys)
  const commodityGroups = useMemo((): CommodityGroup[] => {
    if (!balances.length) return [];

    const byComm = new Map<number, StockBalance[]>();
    balances.forEach((b) => {
      if (!byComm.has(b.commodity_id)) byComm.set(b.commodity_id, []);
      byComm.get(b.commodity_id)!.push(b);
    });

    return Array.from(byComm.entries()).map(([cid, rows]) => {
      const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
      const first = rows[0];

      const byBatch = new Map<string, StockBalance[]>();
      rows.forEach((r) => {
        const gk = balanceRowGroupKey(r);
        if (!byBatch.has(gk)) byBatch.set(gk, []);
        byBatch.get(gk)!.push(r);
      });

      const batches: BatchGroup[] = Array.from(byBatch.entries()).map(([groupKey, brows]) => {
        const row0 = brows[0];
        const displayBatch =
          row0.lot_batch_no?.trim() ||
          row0.batch_no?.trim() ||
          row0.commodity_batch_no?.trim() ||
          batchNoFromGroupKey(groupKey) ||
          (groupKey.startsWith('orphan:') ? 'No lot on balance' : groupKey);

        const inventory_lot_ids = [
          ...new Set(
            brows
              .map((b) => b.inventory_lot_id)
              .filter((id): id is number => typeof id === 'number' && id > 0)
          ),
        ];

        return {
          groupKey,
          batch_no: displayBatch,
          commodity_id: cid,
          commodity_name: first.commodity_name || `Commodity #${cid}`,
          quantity: brows.reduce((s, r) => s + r.quantity, 0),
          unit_name: first.unit_abbreviation || first.unit_name || '',
          expiry_date: brows[0]?.lot_expiry_date ?? brows[0]?.expiry_date,
          stacks: brows,
          inventory_lot_ids,
        };
      });

      return {
        commodity_id: cid,
        commodity_name: first.commodity_name || `Commodity #${cid}`,
        total_quantity: totalQty,
        unit_name: first.unit_abbreviation || first.unit_name || '',
        batches,
      };
    }).sort((a, b) => a.commodity_name.localeCompare(b.commodity_name));
  }, [balances]);

  /** Stacks that physically hold more than one lot/batch row for this commodity (e.g. after mixing transfers). */
  const multiBatchStacksHint = useMemo(() => {
    const byCommodity = new Map<
      number,
      Map<number, { stack_code?: string | null; batches: Set<string> }>
    >();

    for (const row of balances) {
      const sid = row.stack_id;
      if (sid == null || sid <= 0) continue;
      const lotPart =
        row.lot_batch_no?.trim() ||
        row.batch_no?.trim() ||
        row.commodity_batch_no?.trim() ||
        (row.inventory_lot_id ? `Lot #${row.inventory_lot_id}` : null);
      const label = lotPart ?? 'No batch on record';

      if (!byCommodity.has(row.commodity_id)) byCommodity.set(row.commodity_id, new Map());
      const m = byCommodity.get(row.commodity_id)!;
      const cur = m.get(sid) ?? { stack_code: row.stack_code, batches: new Set<string>() };
      cur.stack_code = cur.stack_code || row.stack_code;
      cur.batches.add(label);
      m.set(sid, cur);
    }

    const result = new Map<number, Array<{ stack_id: number; stack_code?: string | null; batch_labels: string[] }>>();
    for (const [cid, stacks] of byCommodity) {
      const multi = [...stacks.entries()]
        .filter(([, v]) => v.batches.size > 1)
        .map(([stack_id, v]) => ({
          stack_id,
          stack_code: v.stack_code,
          batch_labels: [...v.batches],
        }))
        .sort((a, b) => String(a.stack_code).localeCompare(String(b.stack_code)));
      if (multi.length) result.set(cid, multi);
    }

    return result;
  }, [balances]);

  // Calculate running balance for transaction history
  const txWithBalance = useMemo(() => {
    let running = 0;
    const rows: any[] = [];
    for (const t of transactions) {
      const isIn = t.movement_type === 'inbound' || (!t.movement_type && t.destination_id && !t.source_id);
      const qty = Number(t.quantity) || 0;
      running = isIn ? running + qty : running - qty;
      rows.push({ ...t, isIn, running });
    }
    return rows;
  }, [transactions]);

  const storeOptions = stores.map((s) => ({ value: String(s.id), label: s.name }));

  // ── Batch history view ──
  if (selectedBatch) {
    return (
      <Stack gap="md">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => setSelectedBatch(null)}
          >
            Back to {selectedBatch.commodity_name}
          </Button>
          <div>
            <Title order={3}>Bin Card — {selectedBatch.commodity_name}</Title>
            <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>
              Batch: {selectedBatch.batch_no}
              {selectedBatch.expiry_date && ` · Expires: ${new Date(selectedBatch.expiry_date).toLocaleDateString()}`}
            </Text>
          </div>
        </Group>

        {(() => {
          const multi = multiBatchStacksHint.get(selectedBatch.commodity_id);
          if (!multi?.length) return null;
          return (
            <Alert color="teal" variant="light" title="Same commodity, multiple batches in one stack">
              <Text size="sm" mb="xs">
                The stacks below hold this commodity under more than one lot or batch at the same location. Use{' '}
                <strong>Quantity by stack</strong> to see each batch line; open other batch cards for the same stacks to
                review their separate movement history.
              </Text>
              <Stack gap={4}>
                {multi.map((m) => (
                  <Text key={m.stack_id} size="sm">
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {m.stack_code || `Stack #${m.stack_id}`}
                    </span>
                    {' — '}
                    {m.batch_labels.join(' · ')}
                  </Text>
                ))}
              </Stack>
            </Alert>
          );
        })()}

        <Card withBorder padding="md">
          <Group gap="xl">
            <Stack gap={0}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Current Balance</Text>
              <Text size="xl" fw={700} c="blue">{selectedBatch.quantity.toLocaleString()} {selectedBatch.unit_name}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Stacks</Text>
              <Text size="sm" fw={600}>{selectedBatch.stacks.map(s => s.stack_code || `Stack #${s.stack_id}`).join(', ')}</Text>
            </Stack>
            {selectedBatch.expiry_date && (
              <Stack gap={0}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Expiry</Text>
                <ExpiryBadge expiryDate={selectedBatch.expiry_date} size="sm" />
              </Stack>
            )}
          </Group>
        </Card>

        <div>
          <Title order={5} mb="xs">Quantity by stack</Title>
          <Table.ScrollContainer minWidth={520}>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Stack</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Quantity</Table.Th>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th>Lot / batch</Table.Th>
                  <Table.Th>Expiry</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedBatch.stacks.map((row) => {
                  const lotLabel =
                    row.lot_batch_no?.trim() ||
                    row.batch_no?.trim() ||
                    row.commodity_batch_no?.trim() ||
                    (row.inventory_lot_id ? `Lot #${row.inventory_lot_id}` : '—');
                  const exp = row.lot_expiry_date || row.expiry_date;
                  const multiOnStack = multiBatchStacksHint
                    .get(selectedBatch.commodity_id)
                    ?.find((m) => m.stack_id === row.stack_id);
                  return (
                    <Table.Tr key={`${row.stack_id}-${row.id}`}>
                      <Table.Td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                        <Group gap={6} wrap="nowrap">
                          <span>{row.stack_code || `Stack #${row.stack_id}`}</span>
                          {multiOnStack ? (
                            <Badge size="xs" variant="light" color="teal">
                              + other batch
                            </Badge>
                          ) : null}
                        </Group>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {Number(row.quantity).toLocaleString()}
                      </Table.Td>
                      <Table.Td>{row.unit_abbreviation || row.unit_name || selectedBatch.unit_name}</Table.Td>
                      <Table.Td style={{ fontFamily: 'monospace', fontSize: 12 }}>{lotLabel}</Table.Td>
                      <Table.Td>
                        {exp ? <ExpiryBadge expiryDate={exp} size="xs" /> : '—'}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </div>

        {txLoading ? (
          <LoadingState message="Loading transaction history..." />
        ) : txWithBalance.length === 0 ? (
          <Alert color="blue">No transaction history found for this batch.</Alert>
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>In</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Out</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Balance</Table.Th>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th>Reference</Table.Th>
                  <Table.Th>Stack</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {txWithBalance.map((t: any, idx: number) => {
                  const refLabel = [
                    t.reference_type?.replace('Cats::Warehouse::', ''),
                    t.reference_no
                  ].filter(Boolean).join(' • ') || '—';
                  const stackLabel = t.isIn
                    ? (t.destination_stack_code || `Stack #${t.destination_id}`)
                    : (t.source_stack_code || `Stack #${t.source_id}`);
                  return (
                    <Table.Tr key={idx}>
                      <Table.Td>{new Date(t.transaction_date).toLocaleDateString()}</Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: 'green', fontWeight: t.isIn ? 700 : undefined }}>
                        {t.isIn ? `+${Number(t.quantity).toLocaleString()}` : '—'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: 'red', fontWeight: !t.isIn ? 700 : undefined }}>
                        {!t.isIn ? `-${Number(t.quantity).toLocaleString()}` : '—'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {t.running.toLocaleString()}
                      </Table.Td>
                      <Table.Td>{t.unit_abbreviation || t.unit_name || '—'}</Table.Td>
                      <Table.Td style={{ fontFamily: 'monospace', fontSize: 12 }}>{refLabel}</Table.Td>
                      <Table.Td style={{ fontFamily: 'monospace', fontSize: 12 }}>{stackLabel}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    );
  }

  // ── Main commodity list view ──
  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Bin Card</Title>
        <Text c="dimmed" size="sm">
          Commodity stock by batch — click a batch to see its full movement history
        </Text>
      </div>

      <Select
        label="Store"
        description={
          isStorekeeper
            ? 'Pick which store’s stock to view. Each batch links to full in/out history (GRN, GIN, transfers, etc.).'
            : undefined
        }
        placeholder={storeOptions.length ? 'Select a store' : 'No stores available'}
        data={storeOptions}
        value={storeId}
        onChange={setStoreId}
        w={360}
        clearable={!isStorekeeper || storeOptions.length > 1}
        disabled={!storeOptions.length}
        searchable={storeOptions.length > 8}
      />

      {!storeId && (
        <Alert color="blue" title="Choose a store">
          {isStorekeeper && storeOptions.length === 0
            ? 'No stores are available for your login in this warehouse. A warehouse manager needs to assign you to at least one store.'
            : 'Use the store dropdown above, then open a commodity and a batch to see movement history (receipts, issues, adjustments) like a classic bin card.'}
        </Alert>
      )}

      {storeId && balancesLoading && <LoadingState message="Loading stock..." />}

      {storeId && !balancesLoading && commodityGroups.length === 0 && (
        <Alert color="gray">No stock found in this store.</Alert>
      )}

      {commodityGroups.map((comm) => {
        const isExpanded = expandedCommodities.has(comm.commodity_id);
        return (
          <Card key={comm.commodity_id} withBorder padding="md" radius="md">
            {/* Commodity header — clickable to expand */}
            <Group
              justify="space-between"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setExpandedCommodities(prev => {
                  const next = new Set(prev);
                  if (next.has(comm.commodity_id)) next.delete(comm.commodity_id);
                  else next.add(comm.commodity_id);
                  return next;
                });
              }}
            >
              <Group gap="sm">
                {isExpanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                <IconPackage size={20} color="var(--mantine-color-blue-6)" />
                <div>
                  <Text fw={700} size="lg">{comm.commodity_name}</Text>
                  <Text size="xs" c="dimmed">{comm.batches.length} batch{comm.batches.length !== 1 ? 'es' : ''}</Text>
                </div>
              </Group>
              <Badge size="lg" variant="light" color="blue">
                {comm.total_quantity.toLocaleString()} {comm.unit_name}
              </Badge>
            </Group>

            {/* Batch list — shown when expanded */}
            <Collapse in={isExpanded}>
              <Divider my="sm" />
              {multiBatchStacksHint.get(comm.commodity_id)?.length ? (
                <Alert color="teal" variant="light" mb="sm" title="Multi-batch stacks for this commodity">
                  <Text size="sm">
                    At least one stack holds more than one batch of {comm.commodity_name}. Open each batch&apos;s Bin Card for
                    full traceability; totals here are broken out by batch.
                  </Text>
                  <Text size="xs" c="dimmed" mt="xs">
                    {multiBatchStacksHint
                      .get(comm.commodity_id)!
                      .map(
                        (m) =>
                          `${m.stack_code || `#${m.stack_id}`}: ${m.batch_labels.join('; ')}`
                      )
                      .join(' · ')}
                  </Text>
                </Alert>
              ) : null}
              <Stack gap="xs">
                {comm.batches.map((batch) => {
                  const multiStacks = multiBatchStacksHint.get(comm.commodity_id) ?? [];
                  const batchTouchesMixedStack = batch.stacks.some((row) =>
                    multiStacks.some((m) => m.stack_id === row.stack_id),
                  );

                  return (
                  <Card
                    key={batch.groupKey}
                    withBorder
                    padding="sm"
                    radius="sm"
                    style={{ cursor: 'pointer', background: 'var(--mantine-color-gray-0)' }}
                    onClick={() => setSelectedBatch(batch)}
                  >
                    <Group justify="space-between">
                      <div>
                        <Group gap="xs">
                          <Text size="sm" fw={600} style={{ fontFamily: 'monospace' }}>
                            {batch.batch_no}
                          </Text>
                          {batchTouchesMixedStack ? (
                            <Badge size="xs" variant="outline" color="teal">
                              Shared stack — other batches present
                            </Badge>
                          ) : null}
                          {batch.expiry_date && (
                            <ExpiryBadge expiryDate={batch.expiry_date} size="xs" />
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          Stacks: {batch.stacks.map(s => s.stack_code || `#${s.stack_id}`).join(', ')}
                        </Text>
                      </div>
                      <Group gap="sm">
                        <Badge variant="light" color="green">
                          {batch.quantity.toLocaleString()} {batch.unit_name}
                        </Badge>
                        <Button size="xs" variant="subtle" rightSection={<IconChevronRight size={12} />}>
                          History
                        </Button>
                      </Group>
                    </Group>
                  </Card>
                  );
                })}
              </Stack>
            </Collapse>
          </Card>
        );
      })}
    </Stack>
  );
}
