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
import { getWaybills } from '../../api/waybills';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { DocumentStatus } from '../../utils/constants';

function WaybillListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: waybills, isLoading, error, refetch } = useQuery({
    queryKey: ['waybills'],
    queryFn: getWaybills,
  });

  const filteredWaybills = waybills?.filter((waybill) => {
    const matchesSearch =
      waybill.reference_no.toLowerCase().includes(search.toLowerCase()) ||
      waybill.source_location_id.toString().includes(search) ||
      waybill.destination_location_id.toString().includes(search);
    const matchesStatus = !statusFilter || waybill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = Object.entries(DocumentStatus).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));

  if (isLoading) {
    return <LoadingState message="Loading waybills..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load waybills. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Waybills</Title>
          <Text c="dimmed" size="sm">
            Manage transport documents and shipments
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/waybills/new')}
        >
          Create Waybill
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by reference number or location..."
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

      {filteredWaybills && filteredWaybills.length === 0 ? (
        <EmptyState
          title="No waybills found"
          description={
            search || statusFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first waybill'
          }
          action={
            !search && !statusFilter
              ? {
                  label: 'Create Waybill',
                  onClick: () => navigate('/waybills/new'),
                }
              : undefined
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={1000}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reference No</Table.Th>
                <Table.Th>Source Location</Table.Th>
                <Table.Th>Destination Location</Table.Th>
                <Table.Th>Issued On</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Transporter</Table.Th>
                <Table.Th>Vehicle</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredWaybills?.map((waybill) => (
                <Table.Tr
                  key={waybill.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/waybills/${waybill.id}`)}
                >
                  <Table.Td style={{ fontWeight: 600 }}>{waybill.reference_no}</Table.Td>
                  <Table.Td>Location {waybill.source_location_id}</Table.Td>
                  <Table.Td>Location {waybill.destination_location_id}</Table.Td>
                  <Table.Td>
                    {new Date(waybill.issued_on).toLocaleDateString()}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={waybill.status} />
                  </Table.Td>
                  <Table.Td>
                    {waybill.waybill_transport?.transporter_id
                      ? `Transporter ${waybill.waybill_transport.transporter_id}`
                      : '-'}
                  </Table.Td>
                  <Table.Td>
                    {waybill.waybill_transport?.vehicle_plate_no || '-'}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => navigate(`/waybills/${waybill.id}`)}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}

export default WaybillListPage;
