import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Collapse, Divider, Group, SegmentedControl, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import {
  IconChevronDown,
  IconChevronRight,
  IconHistory,
  IconPackage,
  IconSearch,
  IconStack2,
} from '@tabler/icons-react';
import { getStockBalances } from '../../api/stockBalances';
import { getWarehouses } from '../../api/warehouses';
import { getStockCardReport } from '../../api/reports';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { ExpiryBadge } from '../../components/common/ExpiryBadge';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import type { StockBalance } from '../../types/stockBalance';
import type { BinCardEntry } from '../../types/reports';

type ViewMode = 'cards' | 'table';

interface BatchStock {
  key: string;
  commodityId: number;
  commodityName: string;
  batchNo: string;
  inventoryLotId?: number | null;
  expiryDate?: string | null;
  rows: StockBalance[];
  totals: Map<string, number>;
}

interface CommodityStock {
  commodityId: number;
  commodityName: string;
  batches: BatchStock[];
  totals: Map<string, number>;
}

function unitLabel(row?: Partial<StockBalance | BinCardEntry> | null) {
  return row?.entered_unit_abbreviation || row?.entered_unit_name || row?.unit_abbreviation || row?.unit_name || row?.base_unit_name || 'unit';
}

function balanceBatchKey(row: StockBalance) {
  if (row.inventory_lot_id) return `lot:${row.inventory_lot_id}`;
  const batch = row.lot_batch_no || row.batch_no || row.commodity_batch_no;
  return batch ? `batch:${batch}` : `no-batch:${row.commodity_id}:${row.unit_id}`;
}

function batchLabel(row: StockBalance) {
  return row.lot_batch_no || row.batch_no || row.commodity_batch_no || 'No batch recorded';
}

function expiryValue(row: StockBalance) {
  return row.lot_expiry_date || row.expiry_date || null;
}

function addTotal(map: Map<string, number>, unit: string, qty: number) {
  map.set(unit, (map.get(unit) ?? 0) + qty);
}

function formatTotals(map: Map<string, number>) {
  const parts = [...map.entries()].map(([unit, qty]) => `${Number(qty).toLocaleString()} ${unit}`);
  return parts.length ? parts.join(' / ') : '0';
}

function historyDirection(row: BinCardEntry) {
  if (row.source_id && row.destination_id) return 'transfer';
  if (row.destination_id) return 'in';
  if (row.source_id) return 'out';
  return 'move';
}

function referenceLabel(row: BinCardEntry) {
  const doc = row.reference_type?.replace('Cats::Warehouse::', '');
  return [doc, row.reference_no].filter(Boolean).join(' / ') || '-';
}

function txDisplayQty(row: BinCardEntry) {
  const qty = row.entered_quantity ?? row.quantity;
  const unit = row.entered_unit_name || row.unit_abbreviation || row.unit_name || row.base_unit_name || '';
  return `${Number(qty || 0).toLocaleString()} ${unit}`.trim();
}

function StockBalancePage() {
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [expandedCommodities, setExpandedCommodities] = useState<Set<number>>(new Set());
  const [selectedCommodityId, setSelectedCommodityId] = useState<number | null>(null);
  const [selectedBatchKey, setSelectedBatchKey] = useState<string | null>(null);

  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const persistedRole = useAuthStore((state) => state.role);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || persistedRole);
  const userHubId = activeAssignment?.hub?.id;
  const isHubManager = roleSlug === 'hub_manager';

  const { data: stockBalances = [], isLoading, error, refetch } = useQuery({
    queryKey: ['stockBalances', { warehouse_id: warehouseFilter ?? undefined }],
    queryFn: () => getStockBalances({ warehouse_id: warehouseFilter ? Number(warehouseFilter) : undefined }),
    refetchOnMount: 'always',
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => (isHubManager && userHubId ? getWarehouses({ hub_id: userHubId }) : getWarehouses()),
  });

  const filteredBalances = useMemo(() => {
    const term = search.trim().toLowerCase();
    return stockBalances.filter((balance) => {
      const exp = expiryValue(balance);
      const matchesExpiry =
        !showExpiringSoon ||
        (exp &&
          (() => {
            const expiry = new Date(exp);
            const today = new Date();
            const days = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return days >= 0 && days <= 30;
          })());

      const matchesSearch =
        !term ||
        [
          balance.commodity_name,
          balance.commodity_batch_no,
          balance.lot_batch_no,
          balance.batch_no,
          balance.warehouse_name,
          balance.store_name,
          balance.stack_code,
          balance.unit_name,
          balance.unit_abbreviation,
        ].some((value) => String(value ?? '').toLowerCase().includes(term));

      return matchesExpiry && matchesSearch;
    });
  }, [stockBalances, search, showExpiringSoon]);

  const commodityGroups = useMemo((): CommodityStock[] => {
    const byCommodity = new Map<number, StockBalance[]>();
    for (const row of filteredBalances) {
      if (!byCommodity.has(row.commodity_id)) byCommodity.set(row.commodity_id, []);
      byCommodity.get(row.commodity_id)!.push(row);
    }

    return [...byCommodity.entries()]
      .map(([commodityId, rows]) => {
        const byBatch = new Map<string, StockBalance[]>();
        const totals = new Map<string, number>();

        for (const row of rows) {
          const unit = unitLabel(row);
          addTotal(totals, unit, Number(row.entered_quantity ?? row.quantity || 0));
          const key = balanceBatchKey(row);
          if (!byBatch.has(key)) byBatch.set(key, []);
          byBatch.get(key)!.push(row);
        }

        const batches = [...byBatch.entries()]
          .map(([key, batchRows]) => {
            const row0 = batchRows[0];
            const batchTotals = new Map<string, number>();
            for (const row of batchRows) addTotal(batchTotals, unitLabel(row), Number(row.entered_quantity ?? row.quantity || 0));

            return {
              key,
              commodityId,
              commodityName: row0.commodity_name || `Commodity #${commodityId}`,
              batchNo: batchLabel(row0),
              inventoryLotId: row0.inventory_lot_id,
              expiryDate: expiryValue(row0),
              rows: batchRows,
              totals: batchTotals,
            };
          })
          .sort((a, b) => a.batchNo.localeCompare(b.batchNo));

        return {
          commodityId,
          commodityName: rows[0]?.commodity_name || `Commodity #${commodityId}`,
          batches,
          totals,
        };
      })
      .sort((a, b) => a.commodityName.localeCompare(b.commodityName));
  }, [filteredBalances]);

  const selectedCommodity = commodityGroups.find((group) => group.commodityId === selectedCommodityId) ?? null;
  const selectedBatch = selectedCommodity?.batches.find((batch) => batch.key === selectedBatchKey) ?? null;

  const { data: historyRows = [], isLoading: historyLoading } = useQuery({
    queryKey: [
      'reports',
      'stock-card',
      {
        commodity_id: selectedCommodityId,
        warehouse_id: warehouseFilter,
        inventory_lot_id: selectedBatch?.inventoryLotId,
        batch_no: selectedBatch && !selectedBatch.inventoryLotId ? selectedBatch.batchNo : undefined,
      },
    ],
    queryFn: () =>
      getStockCardReport({
        commodity_id: selectedCommodityId ?? undefined,
        warehouse_id: warehouseFilter ? Number(warehouseFilter) : undefined,
        inventory_lot_id: selectedBatch?.inventoryLotId ?? undefined,
        batch_no: selectedBatch && !selectedBatch.inventoryLotId && selectedBatch.batchNo !== 'No batch recorded' ? selectedBatch.batchNo : undefined,
      }),
    enabled: !!selectedCommodityId,
  });

  const historyWithBalance = useMemo(() => {
    let running = 0;
    return [...historyRows]
      .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime() || a.id - b.id)
      .map((row) => {
        const direction = historyDirection(row);
        const signed = direction === 'in' ? Number(row.base_quantity ?? row.quantity ?? 0) : direction === 'out' ? -Number(row.base_quantity ?? row.quantity ?? 0) : 0;
        running += signed;
        return { ...row, direction, running: Math.max(0, running) };
      });
  }, [historyRows]);

  const warehouseOptions = warehouses.map((warehouse) => ({
    value: String(warehouse.id),
    label: `${warehouse.name}${warehouse.code ? ` (${warehouse.code})` : ''}`,
  }));

  const stats = useMemo(() => {
    const commodityCount = commodityGroups.length;
    const batchCount = commodityGroups.reduce((sum, group) => sum + group.batches.length, 0);
    const unitTotals = new Map<string, number>();
    for (const group of commodityGroups) {
      for (const [unit, qty] of group.totals) addTotal(unitTotals, unit, qty);
    }
    return { commodityCount, batchCount, unitTotals };
  }, [commodityGroups]);

  if (isLoading) return <LoadingState message="Loading stock cards..." />;
  if (error) return <ErrorState message="Failed to load stock cards. Please try again." onRetry={() => refetch()} />;

  const renderRowsTable = (rows: StockBalance[]) => (
    <Table.ScrollContainer minWidth={1100}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Commodity</Table.Th>
            <Table.Th>Batch / expiry</Table.Th>
            <Table.Th>Warehouse</Table.Th>
            <Table.Th>Store</Table.Th>
            <Table.Th>Stack</Table.Th>
            <Table.Th style={{ textAlign: 'right' }}>Current quantity</Table.Th>
            <Table.Th>Unit</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>{row.commodity_name || row.commodity_id}</Table.Td>
              <Table.Td>
                <Stack gap={3}>
                  <Text size="sm" style={{ fontFamily: 'monospace' }}>{batchLabel(row)}</Text>
                  {expiryValue(row) ? <ExpiryBadge expiryDate={expiryValue(row)!} size="xs" /> : null}
                </Stack>
              </Table.Td>
              <Table.Td>{row.warehouse_name || row.warehouse_id}</Table.Td>
              <Table.Td>{row.store_name || row.store_id || '-'}</Table.Td>
              <Table.Td>{row.stack_code || row.stack_id || '-'}</Table.Td>
              <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>{Number(row.entered_quantity ?? row.quantity).toLocaleString()}</Table.Td>
              <Table.Td>{unitLabel(row)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );

  const renderHistoryPanel = () => {
    if (!selectedCommodity) return null;

    return (
      <Card withBorder padding="md" radius="md" bg="blue.0">
        <Group justify="space-between" mb="sm" align="flex-start">
          <div>
            <Title order={4}>
              History - {selectedCommodity.commodityName}
              {selectedBatch ? ` / ${selectedBatch.batchNo}` : ''}
            </Title>
            <Text size="sm" c="dimmed">
              Quantities use the unit recorded on each movement. Transfers are shown separately and do not change the commodity total.
            </Text>
          </div>
          <Button
            variant="default"
            size="xs"
            onClick={() => {
              setSelectedCommodityId(null);
              setSelectedBatchKey(null);
            }}
          >
            Close
          </Button>
        </Group>

        {historyLoading ? (
          <LoadingState message="Loading commodity history..." />
        ) : historyWithBalance.length === 0 ? (
          <Alert color="gray">No movement history found for this selection.</Alert>
        ) : (
          <Table.ScrollContainer minWidth={1100}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Batch</Table.Th>
                  <Table.Th>Movement</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>In</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Out</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Running base balance</Table.Th>
                  <Table.Th>Stack</Table.Th>
                  <Table.Th>Reference</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {historyWithBalance.map((row) => {
                  const dir = row.direction;
                  const stackLabel =
                    dir === 'in'
                      ? row.destination_stack_code || row.destination_id || '-'
                      : row.source_stack_code || row.source_id || '-';
                  return (
                    <Table.Tr key={row.id}>
                      <Table.Td>{new Date(row.transaction_date).toLocaleDateString()}</Table.Td>
                      <Table.Td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {row.batch_no || (row.inventory_lot_id ? `Lot #${row.inventory_lot_id}` : 'No batch recorded')}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={dir === 'in' ? 'green' : dir === 'out' ? 'red' : 'blue'} variant="light">
                          {dir === 'transfer' ? 'Transfer' : dir === 'in' ? 'In' : 'Out'}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)', fontWeight: 700 }}>
                        {dir === 'in' ? txDisplayQty(row) : '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-red-7)', fontWeight: 700 }}>
                        {dir === 'out' ? txDisplayQty(row) : '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {Number(row.running).toLocaleString()} {row.base_unit_name || row.unit_abbreviation || row.unit_name || ''}
                      </Table.Td>
                      <Table.Td>{stackLabel}</Table.Td>
                      <Table.Td style={{ fontFamily: 'monospace', fontSize: 12 }}>{referenceLabel(row)}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    );
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Stock Card</Title>
          <Text c="dimmed" size="sm">
            Commodity history by batch. Zero balances stay visible so past stock does not disappear.
          </Text>
        </div>
        <SegmentedControl
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
          data={[
            { label: 'Cards', value: 'cards' },
            { label: 'Table', value: 'table' },
          ]}
        />
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">Commodities</Text>
          <Text size="xl" fw={800}>{stats.commodityCount}</Text>
        </Card>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">Batches</Text>
          <Text size="xl" fw={800}>{stats.batchCount}</Text>
        </Card>
        <Card withBorder padding="md" radius="md">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">Current stock by unit</Text>
          <Text size="lg" fw={800}>{formatTotals(stats.unitTotals)}</Text>
          <Text size="xs" c="dimmed">Units are not mixed unless the ledger already stores a converted base quantity.</Text>
        </Card>
      </SimpleGrid>

      <Group>
        <TextInput
          placeholder="Search commodity, batch, warehouse, store, or stack"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          style={{ flex: 1, minWidth: 280 }}
        />
        <SearchableSelect
          placeholder="Filter by warehouse"
          data={warehouseOptions}
          value={warehouseFilter}
          onChange={(value) => {
            setWarehouseFilter(value);
            setSelectedCommodityId(null);
            setSelectedBatchKey(null);
          }}
          clearable
          searchable
          w={280}
        />
        <SegmentedControl
          value={showExpiringSoon ? 'expiring' : 'all'}
          onChange={(value) => setShowExpiringSoon(value === 'expiring')}
          data={[
            { label: 'All', value: 'all' },
            { label: 'Expiring soon', value: 'expiring' },
          ]}
        />
      </Group>

      {filteredBalances.length === 0 ? (
        <EmptyState title="No stock cards found" description="No commodity balances match the current filters." />
      ) : viewMode === 'table' ? (
        renderRowsTable(filteredBalances)
      ) : (
        <Stack gap="sm">
          {commodityGroups.map((commodity) => {
            const isExpanded = expandedCommodities.has(commodity.commodityId);
            return (
              <Card key={commodity.commodityId} withBorder padding="md" radius="md">
                <Group
                  justify="space-between"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setExpandedCommodities((prev) => {
                      const next = new Set(prev);
                      if (next.has(commodity.commodityId)) next.delete(commodity.commodityId);
                      else next.add(commodity.commodityId);
                      return next;
                    });
                  }}
                >
                  <Group gap="sm">
                    {isExpanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                    <IconPackage size={22} color="var(--mantine-color-orange-6)" />
                    <div>
                      <Text fw={800}>{commodity.commodityName}</Text>
                      <Text size="xs" c="dimmed">
                        {commodity.batches.length} batch{commodity.batches.length === 1 ? '' : 'es'}
                      </Text>
                    </div>
                  </Group>
                  <Badge size="lg" variant="light" color="blue">{formatTotals(commodity.totals)}</Badge>
                </Group>

                <Collapse in={isExpanded}>
                  <Divider my="sm" />
                  <Stack gap="xs">
                    {commodity.batches.map((batch) => {
                      const isSelectedHistory =
                        selectedCommodityId === commodity.commodityId && selectedBatchKey === batch.key;

                      return (
                        <Fragment key={batch.key}>
                          <Card withBorder padding="sm" radius="sm" bg="gray.0">
                            <Group justify="space-between">
                              <Group gap="sm">
                                <IconStack2 size={18} color="var(--mantine-color-blue-6)" />
                                <div>
                                  <Group gap="xs">
                                    <Text fw={700} style={{ fontFamily: 'monospace' }}>{batch.batchNo}</Text>
                                    {batch.expiryDate ? <ExpiryBadge expiryDate={batch.expiryDate} size="xs" /> : null}
                                  </Group>
                                  <Text size="xs" c="dimmed">
                                    {batch.rows.length} location row{batch.rows.length === 1 ? '' : 's'} - stacks:{' '}
                                    {batch.rows.map((row) => row.stack_code || `#${row.stack_id || '-'}`).join(', ')}
                                  </Text>
                                </div>
                              </Group>
                              <Group gap="sm">
                                <Badge variant="light" color={formatTotals(batch.totals).startsWith('0 ') ? 'gray' : 'green'}>
                                  {formatTotals(batch.totals)}
                                </Badge>
                                <Button
                                  size="xs"
                                  variant={isSelectedHistory ? 'filled' : 'subtle'}
                                  leftSection={<IconHistory size={14} />}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedCommodityId(commodity.commodityId);
                                    setSelectedBatchKey(batch.key);
                                  }}
                                >
                                  History
                                </Button>
                              </Group>
                            </Group>
                          </Card>
                          {isSelectedHistory ? renderHistoryPanel() : null}
                        </Fragment>
                      );
                    })}
                  </Stack>
                </Collapse>
              </Card>
            );
          })}
        </Stack>
      )}

    </Stack>
  );
}

export default StockBalancePage;
