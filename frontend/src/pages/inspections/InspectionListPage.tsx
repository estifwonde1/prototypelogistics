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
import { getInspections } from '../../api/inspections';
import { getWarehouses } from '../../api/warehouses';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { DocumentStatus } from '../../utils/constants';

function InspectionListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: inspections, isLoading, error, refetch } = useQuery({
    queryKey: ['inspections'],
    queryFn: getInspections,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const filteredInspections = inspections?.filter((inspection) => {
    const matchesSearch =
      inspection.reference_no.toLowerCase().includes(search.toLowerCase()) ||
      inspection.warehouse_id.toString().includes(search);
    const matchesStatus = !statusFilter || inspection.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = Object.entries(DocumentStatus).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));

  if (isLoading) {
    return <LoadingState message="Loading inspections..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load inspections. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Inspections</Title>
          <Text c="dimmed" size="sm">
            Manage quality inspections and assessments
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/inspections/new')}
        >
          Create Inspection
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

      {filteredInspections && filteredInspections.length === 0 ? (
        <EmptyState
          title="No inspections found"
          description={
            search || statusFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first inspection'
          }
          action={
            !search && !statusFilter
              ? {
                  label: 'Create Inspection',
                  onClick: () => navigate('/inspections/new'),
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
                <Table.Th>Inspected On</Table.Th>
                <Table.Th>Inspector</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredInspections?.map((inspection) => {
                const warehouse = warehouses?.find((w) => w.id === inspection.warehouse_id);
                return (
                  <Table.Tr
                    key={inspection.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/inspections/${inspection.id}`)}
                  >
                    <Table.Td style={{ fontWeight: 600 }}>{inspection.reference_no}</Table.Td>
                    <Table.Td>{warehouse?.name || `ID: ${inspection.warehouse_id}`}</Table.Td>
                    <Table.Td>
                      {new Date(inspection.inspected_on).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>{inspection.inspector_id || '-'}</Table.Td>
                    <Table.Td>
                      {inspection.source_type && inspection.source_id
                        ? `${inspection.source_type} (${inspection.source_id})`
                        : '-'}
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={inspection.status} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => navigate(`/inspections/${inspection.id}`)}
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

export default InspectionListPage;
