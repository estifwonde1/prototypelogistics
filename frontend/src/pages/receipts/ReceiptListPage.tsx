import { useQuery } from '@tanstack/react-query';
import { Stack, Title, Text, Table } from '@mantine/core';
import { getReceipts } from '../../api/receipts';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

export default function ReceiptListPage() {
  const { data: receipts, isLoading, error, refetch } = useQuery({
    queryKey: ['receipts'],
    queryFn: getReceipts,
  });

  if (isLoading) return <LoadingState message="Loading receipts..." />;
  if (error) return <ErrorState message="Failed to load receipts" onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Receipts</Title>
        <Text c="dimmed" size="sm">
          Incoming receipts linked to dispatch authorizations
        </Text>
      </div>

      <Table.ScrollContainer minWidth={900}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Reference</Table.Th>
              <Table.Th>Commodity</Table.Th>
              <Table.Th>Commodity Status</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Unit</Table.Th>
              <Table.Th>Created</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {receipts?.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.reference_no || '-'}</Table.Td>
                <Table.Td>{r.commodity_name || r.commodity_code || '-'}</Table.Td>
                <Table.Td>{r.commodity_status}</Table.Td>
                <Table.Td>{r.quantity}</Table.Td>
                <Table.Td>{r.unit_abbreviation || r.unit_name || r.unit_id}</Table.Td>
                <Table.Td>{new Date(r.created_at).toLocaleDateString()}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
