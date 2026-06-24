import { useMemo, useState } from 'react';
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
  Badge,
} from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { IconPlus, IconSearch, IconEye } from '@tabler/icons-react';
import { getDispatchOrders } from '../../api/dispatchOrders';
import type { DispatchOrder } from '../../api/dispatchOrders';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

function DispatchPlanListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: plans, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_orders', 'dispatch_plans'],
    queryFn: () => getDispatchOrders({}),
  });

  const dispatchPlans = useMemo(() => {
    const planRows = (plans ?? []).filter(
      (order) =>
        order.fdp_id ||
        order.response_plan_ref ||
        (order.lines ?? []).some((line) => line.fdp_id)
    );

    const uniquePlans = new Map<string, DispatchOrder>();
    planRows.forEach((plan) => {
      const planRef = plan.response_plan_ref?.trim().toLowerCase();
      const key = planRef || `id:${plan.id}`;
      if (!uniquePlans.has(key)) {
        uniquePlans.set(key, plan);
      }
    });

    return Array.from(uniquePlans.values());
  }, [plans]);

  const fdpLabelForPlan = (plan: DispatchOrder) => {
    const lineFdpIds = new Set(
      (plan.lines ?? [])
        .map((line) => line.fdp_id)
        .filter((id): id is number => id != null)
    );
    if (lineFdpIds.size > 1) return 'Multiple FDPs';
    if (lineFdpIds.size === 1) {
      const line = plan.lines?.find((l) => l.fdp_id != null);
      return line?.fdp_name || plan.fdp_name || '—';
    }
    return plan.fdp_name || plan.destination_name || '—';
  };

  const sourceLabelForPlan = (plan: DispatchOrder) => {
    const sourceNames = new Set<string>();

    (plan.lines ?? []).forEach((line) => {
      const sourceName = line.source_name || line.hub_name || line.warehouse_name;
      if (sourceName) sourceNames.add(sourceName);
    });

    // Fallbacks for legacy/aggregated fields
    if (sourceNames.size === 0 && plan.source_warehouse_name) {
      sourceNames.add(plan.source_warehouse_name);
    }

    return Array.from(sourceNames).join(', ') || '—';
  };

  const filteredPlans = dispatchPlans.filter((plan) => {
    const matchesSearch =
      plan.id.toString().includes(search) ||
      (plan.response_plan_ref ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (plan.fdp_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (plan.destination_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Confirmed', label: 'Confirmed' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Completed', label: 'Completed' },
  ];

  if (isLoading) {
    return <LoadingState message="Loading Dispatch Plans..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load Dispatch Plans. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Dispatch Plan</Title>
          <Text c="dimmed" size="sm">
            Create and manage humanitarian dispatch plans to FDPs
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/officer/dispatch-plan/new')}
        >
          Create Dispatch Plan
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by plan ref, FDP, or destination..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <SearchableSelect
          placeholder="Filter by status"
          data={statusOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          style={{ width: 200 }}
        />
      </Group>

      {filteredPlans.length === 0 ? (
        <EmptyState
          title="No Dispatch Plans found"
          description={
            search || statusFilter
              ? 'Try adjusting your filters'
              : 'Get started by creating your first Dispatch Plan'
          }
          action={
            !search && !statusFilter
              ? {
                  label: 'Create Dispatch Plan',
                  onClick: () => navigate('/officer/dispatch-plan/new'),
                }
              : undefined
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Plan Ref</Table.Th>
                <Table.Th>Response Type</Table.Th>
                <Table.Th>FDP</Table.Th>
                <Table.Th>Lines</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Expected Date</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredPlans.map((plan) => {
                return (
                  <Table.Tr
                    key={plan.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/officer/dispatch-plan/${plan.id}`)}
                  >
                    <Table.Td style={{ fontWeight: 600 }}>
                      {plan.response_plan_ref || plan.reference_no || `DP-${plan.id}`}
                    </Table.Td>
                    <Table.Td>{plan.response_type || '—'}</Table.Td>
                    <Table.Td>{fdpLabelForPlan(plan)}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {plan.lines?.length ?? 0}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{sourceLabelForPlan(plan)}</Table.Td>
                    <Table.Td>
                      <StatusBadge status={plan.status} />
                    </Table.Td>
                    <Table.Td>
                      {plan.expected_pickup_date
                        ? new Date(plan.expected_pickup_date).toLocaleDateString()
                        : '—'}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => navigate(`/officer/dispatch-plan/${plan.id}`)}
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

export default DispatchPlanListPage;
