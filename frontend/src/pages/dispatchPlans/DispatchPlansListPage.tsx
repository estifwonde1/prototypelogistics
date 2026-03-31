import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ActionIcon, Badge, Button, Group, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconEye, IconPlus, IconSearch } from '@tabler/icons-react';
import { getDispatchPlans } from '../../api/dispatchPlans';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { usePermission } from '../../hooks/usePermission';

export default function DispatchPlansListPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: plans, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch-plans'],
    queryFn: getDispatchPlans,
  });

  const filtered = plans?.filter((plan) => {
    const matchSearch =
      plan.reference_no.toLowerCase().includes(search.toLowerCase()) ||
      (plan.description || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || plan.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusOptions = Array.from(new Set((plans || []).map((p) => p.status)))
    .filter(Boolean)
    .map((status) => ({ value: status, label: status }));

  if (isLoading) return <LoadingState message="Loading dispatch plans..." />;
  if (error) return <ErrorState message="Failed to load dispatch plans" onRetry={() => refetch()} />;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Dispatch Plans</Title>
          <Text c="dimmed" size="sm">
            Planner workflow for source and destination authorization
          </Text>
        </div>
        {can('dispatch_plans', 'create') && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/dispatch-plans/new')}>
            Create Plan
          </Button>
        )}
      </Group>

      <Group>
        <TextInput
          placeholder="Search by reference or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<IconSearch size={16} />}
          style={{ flex: 1, maxWidth: 420 }}
        />
        <Select
          placeholder="Filter by status"
          data={statusOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          w={220}
        />
      </Group>

      {filtered && filtered.length === 0 ? (
        <EmptyState
          title="No dispatch plans found"
          description={search || statusFilter ? 'Try changing filters' : 'Create your first dispatch plan to begin'}
          action={
            !search && !statusFilter && can('dispatch_plans', 'create')
              ? { label: 'Create Plan', onClick: () => navigate('/dispatch-plans/new') }
              : undefined
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reference</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Prepared By</Table.Th>
                <Table.Th>Approved By</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered?.map((plan) => (
                <Table.Tr key={plan.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/dispatch-plans/${plan.id}`)}>
                  <Table.Td>{plan.reference_no}</Table.Td>
                  <Table.Td>{plan.description || '-'}</Table.Td>
                  <Table.Td>
                    <Badge variant="light">{plan.status}</Badge>
                  </Table.Td>
                  <Table.Td>{plan.prepared_by_id}</Table.Td>
                  <Table.Td>{plan.approved_by_id || '-'}</Table.Td>
                  <Table.Td>{new Date(plan.created_at).toLocaleDateString()}</Table.Td>
                  <Table.Td>
                    <Group justify="flex-end" onClick={(e) => e.stopPropagation()}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => navigate(`/dispatch-plans/${plan.id}`)}>
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
