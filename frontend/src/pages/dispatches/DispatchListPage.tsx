import { useQuery } from '@tanstack/react-query';
import { Stack, Title, Text, Table } from '@mantine/core';
import { getDispatches } from '../../api/dispatches';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

export default function DispatchListPage() {
  const { data: dispatches, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatches'],
    queryFn: getDispatches,
  });

  if (isLoading) return <LoadingState message="Loading dispatches..." />;
  if (error) return <ErrorState message="Failed to load dispatches" onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Dispatches</Title>
        <Text c="dimmed" size="sm">
          Outgoing dispatches linked to dispatch plan items
        </Text>
      </div>

      <Table.ScrollContainer minWidth={900}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Reference</Table.Th>
              <Table.Th>Driver</Table.Th>
              <Table.Th>Plate No</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Unit</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Created</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {dispatches?.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>{d.reference_no || '-'}</Table.Td>
                <Table.Td>{d.driver_name}</Table.Td>
                <Table.Td>{d.plate_no}</Table.Td>
                <Table.Td>{d.quantity}</Table.Td>
                <Table.Td>{d.unit_id}</Table.Td>
                <Table.Td>{d.dispatch_status}</Table.Td>
                <Table.Td>{new Date(d.created_at).toLocaleDateString()}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
