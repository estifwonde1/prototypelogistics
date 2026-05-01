import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Stack, Title, Text, Group, Select, Table } from '@mantine/core';
import { getBinCardReport } from '../../api/reports';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { getInventoryLots } from '../../api/referenceData';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { ExpiryBadge } from '../../components/common/ExpiryBadge';
import { UomConversionDisplay } from '../../components/common/UomConversionDisplay';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';

export default function BinCardReportPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [stackId, setStackId] = useState<string | null>(null);
  const [lotFilter, setLotFilter] = useState<string | null>(null);

  // Get active assignment context for filtering
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userStoreId = activeAssignment?.store?.id;
  const userHubId = activeAssignment?.hub?.id;
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const isStorekeeper = roleSlug === 'storekeeper';
  const isHubManager = roleSlug === 'hub_manager';

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', { 
      warehouse_id: isWarehouseManager ? userWarehouseId : undefined,
      hub_id: isHubManager ? userHubId : undefined 
    }],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) {
        return getStores({ warehouse_id: userWarehouseId });
      } else if (isHubManager && userHubId) {
        return getStores(); // Backend should handle hub-level filtering
      }
      return getStores();
    },
  });

  const { data: stacks } = useQuery({
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
        return getStacks(); // Backend should handle hub-level filtering
      }
      return getStacks();
    },
  });

  const { data: inventoryLots = [] } = useQuery({
    queryKey: ['reference-data', 'inventory_lots'],
    queryFn: () => getInventoryLots(),
  });

  const { data: entries, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'bin-card', storeId, stackId],
    queryFn: () =>
      getBinCardReport({
        store_id: storeId ? Number(storeId) : undefined,
        stack_id: stackId ? Number(stackId) : undefined,
      }),
  });

  const storeOptions = useMemo(
    () => stores?.map((s) => ({ value: String(s.id), label: s.name })) || [],
    [stores]
  );

  const stackOptions = useMemo(
    () =>
      stacks
        ?.filter((s) => !storeId || s.store_id?.toString() === storeId)
        .map((s) => ({ value: String(s.id), label: s.code })) || [],
    [stacks, storeId]
  );

  const lotOptions = useMemo(
    () =>
      inventoryLots.map((lot) => ({
        value: lot.id.toString(),
        label: lot.display_name || `${lot.batch_no} - Exp: ${new Date(lot.expiry_date).toLocaleDateString()}`,
      })),
    [inventoryLots]
  );

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (!lotFilter) return entries;
    return entries.filter((entry) => entry.inventory_lot_id?.toString() === lotFilter);
  }, [entries, lotFilter]);

  if (isLoading) return <LoadingState message="Loading bin card..." />;
  if (error) return <ErrorState message="Failed to load bin card" onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Bin Card Report</Title>
        <Text c="dimmed" size="sm">
          Stock movement per commodity and stack
        </Text>
      </div>

      <Group>
        <Select
          label="Store"
          placeholder="Select store"
          data={storeOptions}
          value={storeId}
          onChange={(value) => {
            setStoreId(value);
            setStackId(null);
          }}
          w={260}
          clearable
        />
        <Select
          label="Stack"
          placeholder="Select stack"
          data={stackOptions}
          value={stackId}
          onChange={setStackId}
          w={240}
          clearable
        />
        <Select
          label="Lot"
          placeholder="Filter by lot"
          data={lotOptions}
          value={lotFilter}
          onChange={setLotFilter}
          w={300}
          clearable
          searchable
        />
      </Group>

      <Table.ScrollContainer minWidth={1200}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>In</Table.Th>
              <Table.Th>Out</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Unit</Table.Th>
              <Table.Th>Reference</Table.Th>
              <Table.Th>Commodity</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Batch/Expiry</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredEntries?.map((e) => {
              const isIn = e.movement_type === 'inbound' || (!e.movement_type && e.destination_id && !e.source_id);
              const isOut = e.movement_type === 'outbound' || (!e.movement_type && e.source_id && !e.destination_id);
              const referenceLabel = [e.reference_type, e.reference_no].filter(Boolean).join(' • ') || '-';
              const locationLabel =
                (isIn
                  ? [e.destination_warehouse_name, e.destination_store_name, e.destination_stack_code]
                  : [e.source_warehouse_name, e.source_store_name, e.source_stack_code]
                )
                  .filter(Boolean)
                  .join(' / ') || '-';
              const unitLabel = e.unit_abbreviation || e.unit_name || e.unit_id || '-';
              return (
                <Table.Tr key={e.id}>
                  <Table.Td>{new Date(e.transaction_date).toLocaleDateString()}</Table.Td>
                  <Table.Td>{isIn ? e.quantity : '-'}</Table.Td>
                  <Table.Td>{isOut ? e.quantity : '-'}</Table.Td>
                  <Table.Td>
                    {e.quantity}
                    {e.entered_quantity && e.entered_unit_name && (
                      <Text size="xs" c="dimmed" mt={4}>
                        <UomConversionDisplay
                          enteredQuantity={e.entered_quantity}
                          enteredUnit={e.entered_unit_name}
                          baseQuantity={e.base_quantity || e.quantity}
                          baseUnit={e.base_unit_name || String(unitLabel)}
                        />
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{String(unitLabel)}</Table.Td>
                  <Table.Td>{referenceLabel}</Table.Td>
                  <Table.Td>{e.commodity_name || e.commodity_id || '-'}</Table.Td>
                  <Table.Td>{locationLabel}</Table.Td>
                  <Table.Td>
                    {e.batch_no || e.expiry_date ? (
                      <Stack gap="xs">
                        {e.batch_no && (
                          <Text size="sm" fw={500}>
                            {e.batch_no}
                          </Text>
                        )}
                        {e.expiry_date && <ExpiryBadge expiryDate={e.expiry_date} size="sm" />}
                      </Stack>
                    ) : (
                      <Text c="dimmed">-</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
