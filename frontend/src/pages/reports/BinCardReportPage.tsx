import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Stack, Title, Text, Group, Select, Table } from '@mantine/core';
import { getBinCardReport } from '../../api/reports';
import { getStores } from '../../api/stores';
import { getStacks } from '../../api/stacks';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

export default function BinCardReportPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [stackId, setStackId] = useState<string | null>(null);

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const { data: stacks } = useQuery({
    queryKey: ['stacks'],
    queryFn: getStacks,
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
      </Group>

      <Table.ScrollContainer minWidth={900}>
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
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {entries?.map((e) => {
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
                  <Table.Td>{e.quantity}</Table.Td>
                  <Table.Td>{String(unitLabel)}</Table.Td>
                  <Table.Td>{referenceLabel}</Table.Td>
                  <Table.Td>{e.commodity_name || e.commodity_id || '-'}</Table.Td>
                  <Table.Td>{locationLabel}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
