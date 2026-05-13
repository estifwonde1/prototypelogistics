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
import { getBinCardReport } from '../../api/reports';
import { getStockBalances } from '../../api/stockBalances';
import { getStores } from '../../api/stores';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
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
  batch_no: string;
  commodity_id: number;
  commodity_name: string;
  quantity: number;
  unit_name: string;
  expiry_date?: string | null;
  stacks: StockBalance[];
}

// ── Main component ────────────────────────────────────────────────────────

export default function BinCardReportPage() {
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userStoreId = activeAssignment?.store?.id;
  const isStorekeeper = roleSlug === 'storekeeper';
  const isWarehouseManager = roleSlug === 'warehouse_manager';

  const [storeId, setStoreId] = useState<string | null>(null);
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityGroup | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<BatchGroup | null>(null);
  const [expandedCommodities, setExpandedCommodities] = useState<Set<number>>(new Set());

  // Auto-select storekeeper's store
  useEffect(() => {
    if (isStorekeeper && userStoreId && !storeId) {
      setStoreId(String(userStoreId));
    }
  }, [isStorekeeper, userStoreId, storeId]);

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', { warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
    queryFn: () => getStores({ warehouse_id: isWarehouseManager ? userWarehouseId : undefined }),
  });

  // Fetch stock balances for the selected store
  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ['stock_balances', { store_id: storeId }],
    queryFn: () => getStockBalances({ store_id: storeId ? Number(storeId) : undefined }),
    enabled: !!storeId,
  });

  // Fetch transaction history for selected batch
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['reports', 'bin-card', storeId, selectedBatch?.commodity_id, selectedBatch?.batch_no],
    queryFn: () => getBinCardReport({
      store_id: storeId ? Number(storeId) : undefined,
    }),
    enabled: !!selectedBatch && !!storeId,
    select: (data) => {
      // Filter to this commodity only
      const filtered = data.filter((e: any) =>
        e.commodity_id === selectedBatch?.commodity_id
      );
      // Sort by date ascending for running balance
      return filtered.sort((a: any, b: any) =>
        new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
      );
    },
  });

  // Group balances by commodity → batch
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

      // Group by batch_no within this commodity
      const byBatch = new Map<string, StockBalance[]>();
      rows.forEach((r) => {
        const key = r.commodity_batch_no || r.lot_batch_no || `batch-${cid}`;
        if (!byBatch.has(key)) byBatch.set(key, []);
        byBatch.get(key)!.push(r);
      });

      const batches: BatchGroup[] = Array.from(byBatch.entries()).map(([bno, brows]) => ({
        batch_no: bno,
        commodity_id: cid,
        commodity_name: first.commodity_name || `Commodity #${cid}`,
        quantity: brows.reduce((s, r) => s + r.quantity, 0),
        unit_name: first.unit_abbreviation || first.unit_name || '',
        expiry_date: brows[0]?.lot_expiry_date,
        stacks: brows,
      }));

      return {
        commodity_id: cid,
        commodity_name: first.commodity_name || `Commodity #${cid}`,
        total_quantity: totalQty,
        unit_name: first.unit_abbreviation || first.unit_name || '',
        batches,
      };
    }).sort((a, b) => a.commodity_name.localeCompare(b.commodity_name));
  }, [balances]);

  // Calculate running balance for transaction history
  const txWithBalance = useMemo(() => {
    let running = 0;
    return transactions.map((t: any) => {
      const isIn = t.movement_type === 'inbound' || (!t.movement_type && t.destination_id && !t.source_id);
      const qty = Number(t.quantity) || 0;
      running = isIn ? running + qty : running - qty;
      return { ...t, isIn, running };
    });
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

      {!isStorekeeper && (
        <Select
          label="Store"
          placeholder="Select a store"
          data={storeOptions}
          value={storeId}
          onChange={setStoreId}
          w={300}
          clearable
        />
      )}

      {!storeId && (
        <Alert color="blue">Select a store to view its bin card.</Alert>
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
              <Stack gap="xs">
                {comm.batches.map((batch) => (
                  <Card
                    key={batch.batch_no}
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
                ))}
              </Stack>
            </Collapse>
          </Card>
        );
      })}
    </Stack>
  );
}
