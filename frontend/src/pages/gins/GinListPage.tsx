import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  Table,
  ActionIcon,
  Text,
  Select,
} from '@mantine/core';
import { IconPlus, IconSearch, IconEye } from '@tabler/icons-react';
import { getGins } from '../../api/gins';
import { getWarehouses } from '../../api/warehouses';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { DocumentStatus } from '../../utils/constants';

function GinListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: gins, isLoading, error, refetch } = useQuery({
    queryKey: ['gins'],
    queryFn: () => getGins(),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
  });

  const filteredGins = gins?.filter((gin) => {
    const matchesSearch =
      gin.reference_no.toLowerCase().includes(search.toLowerCase()) ||
      gin.warehouse_id.toString().includes(search);
    const matchesStatus = !statusFilter || gin.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = Object.entries(DocumentStatus).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));

  if (isLoading) {
    return <LoadingState message="Loading GINs..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load GINs. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Goods Issue Notes (GINs)</Title>
          <Text c="dimmed" size="sm">
            Manage outgoing goods and inventory issues
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/gins/new')}
        >
          Create GIN
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by reference number..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="Filter by status"
          data={statusOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          style={{ width: 200 }}
        />
      </Group>

      {filteredGins && filteredGins.length === 0 ? (
        <EmptyState
          title="No GINs found"
          description={
            search || statusFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first GIN'
          }
          action={
            !search && !statusFilter
              ? {
                  label: 'Create GIN',
                  onClick: () => navigate('/gins/new'),
                }
              : undefined
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reference No</Table.Th>
                <Table.Th>Warehouse</Table.Th>
                <Table.Th>Issued On</Table.Th>
                <Table.Th>Destination</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Issued By</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredGins?.map((gin) => {
                const warehouse = warehouses?.find((w) => w.id === gin.warehouse_id);
                return (
                  <Table.Tr
                    key={gin.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/gins/${gin.id}`)}
                  >
                    <Table.Td style={{ fontWeight: 600 }}>{gin.reference_no}</Table.Td>
                    <Table.Td>{warehouse?.name || `ID: ${gin.warehouse_id}`}</Table.Td>
                    <Table.Td>
                      {new Date(gin.issued_on).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>
                      {gin.destination_type && gin.destination_id
                        ? `${gin.destination_type} (${gin.destination_id})`
                        : '-'}
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={gin.status} />
                    </Table.Td>
                    <Table.Td>{gin.issued_by_id || '-'}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => navigate(`/gins/${gin.id}`)}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
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

export default GinListPage;


