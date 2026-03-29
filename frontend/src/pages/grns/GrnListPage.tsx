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
import { getGrns } from '../../api/grns';
import { getWarehouses } from '../../api/warehouses';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { DocumentStatus } from '../../utils/constants';

function GrnListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: grns, isLoading, error, refetch } = useQuery({
    queryKey: ['grns'],
    queryFn: getGrns,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const filteredGrns = grns?.filter((grn) => {
    const matchesSearch =
      grn.reference_no.toLowerCase().includes(search.toLowerCase()) ||
      grn.warehouse_id.toString().includes(search);
    const matchesStatus = !statusFilter || grn.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = Object.entries(DocumentStatus).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));

  if (isLoading) {
    return <LoadingState message="Loading GRNs..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load GRNs. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Goods Received Notes (GRNs)</Title>
          <Text c="dimmed" size="sm">
            Manage incoming goods and inventory receipts
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/grns/new')}
        >
          Create GRN
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

      {filteredGrns && filteredGrns.length === 0 ? (
        <EmptyState
          title="No GRNs found"
          description={
            search || statusFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first GRN'
          }
          action={
            !search && !statusFilter
              ? {
                  label: 'Create GRN',
                  onClick: () => navigate('/grns/new'),
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
                <Table.Th>Received On</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Received By</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredGrns?.map((grn) => {
                const warehouse = warehouses?.find((w) => w.id === grn.warehouse_id);
                return (
                  <Table.Tr
                    key={grn.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/grns/${grn.id}`)}
                  >
                    <Table.Td style={{ fontWeight: 600 }}>{grn.reference_no}</Table.Td>
                    <Table.Td>{warehouse?.name || `ID: ${grn.warehouse_id}`}</Table.Td>
                    <Table.Td>
                      {new Date(grn.received_on).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>
                      {grn.source_type
                        ? grn.source_reference
                          ? `${grn.source_type} (${grn.source_reference})`
                          : grn.source_type
                        : '-'}
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={grn.status} />
                    </Table.Td>
                    <Table.Td>{grn.received_by_name || '-'}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => navigate(`/grns/${grn.id}`)}
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

export default GrnListPage;
