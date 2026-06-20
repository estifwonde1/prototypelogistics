/**
 * DAListPage — Dispatch Authorization list
 *
 * Shared by Hub Manager (/hub/dispatch-authorizations) and
 * Independent Warehouse Manager (/warehouse/dispatch-authorizations).
 */
import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stack, Title, Text, Table, Badge, Card, SimpleGrid, Button, Group,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import {
  getDispatchOrderAuthorizations,
} from '../../api/dispatchOrderAuthorizations';
import type { DispatchOrderAuthorization } from '../../api/dispatchOrderAuthorizations';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

function statusColor(status: DispatchOrderAuthorization['status']) {
  switch (status) {
    case 'draft':     return 'yellow';
    case 'confirmed': return 'blue';
    case 'cancelled': return 'red';
    default:          return 'gray';
  }
}

export default function DAListPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug  = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((s) => s.role));
  const isHubManager       = roleSlug === 'hub_manager';
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const userHubId      = activeAssignment?.hub?.id;
  const userWarehouseId = activeAssignment?.warehouse?.id;

  const basePath = location.pathname.startsWith('/warehouse')
    ? '/warehouse/dispatch-authorizations'
    : '/hub/dispatch-authorizations';

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: daos = [], isLoading, error, refetch } = useQuery({
    queryKey: [
      'dispatch_order_authorizations',
      {
        hub_id:       isHubManager ? userHubId : undefined,
        warehouse_id: isWarehouseManager ? userWarehouseId : undefined,
      },
    ],
    queryFn: () =>
      isHubManager && userHubId
        ? getDispatchOrderAuthorizations({ hub_id: userHubId })
        : isWarehouseManager && userWarehouseId
          ? getDispatchOrderAuthorizations({ warehouse_id: userWarehouseId })
          : getDispatchOrderAuthorizations({}),
  });

  const filtered = useMemo(() => {
    if (!statusFilter) return daos;
    return daos.filter((d) => d.status === statusFilter);
  }, [daos, statusFilter]);

  const draftCount     = daos.filter((d) => d.status === 'draft').length;
  const confirmedCount = daos.filter((d) => d.status === 'confirmed').length;
  const cancelledCount = daos.filter((d) => d.status === 'cancelled').length;

  if (isLoading) return <LoadingState message="Loading Dispatch Authorizations…" />;
  if (error)     return <ErrorState message="Failed to load Dispatch Authorizations." onRetry={refetch} />;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Dispatch Authorization</Title>
        <Text c="dimmed" size="sm">
          {isHubManager
            ? "Create and manage dispatch authorizations for your hub's warehouses."
            : 'Create and manage dispatch authorizations from your warehouse.'}
        </Text>
      </div>

      <SimpleGrid cols={{ base: 3, sm: 3 }}>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="yellow">{draftCount}</Text>
          <Text size="sm" c="dimmed">Draft</Text>
        </Card>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="blue">{confirmedCount}</Text>
          <Text size="sm" c="dimmed">Confirmed</Text>
        </Card>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="red">{cancelledCount}</Text>
          <Text size="sm" c="dimmed">Cancelled</Text>
        </Card>
      </SimpleGrid>

      <Group justify="space-between">
        <SearchableSelect
          placeholder="All statuses"
          data={[
            { value: 'draft',     label: 'Draft' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          w={200}
        />
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate(`${basePath}/new`)}
        >
          Create Dispatch Authorization
        </Button>
      </Group>

      {filtered.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No dispatch authorizations found.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={800}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reference</Table.Th>
                <Table.Th>Dispatch Order</Table.Th>
                <Table.Th>Warehouse</Table.Th>
                <Table.Th>Commodity</Table.Th>
                <Table.Th>Authorized Qty</Table.Th>
                <Table.Th>Transporter</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((dao) => (
                <Table.Tr
                  key={dao.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`${basePath}/${dao.id}`)}
                >
                  <Table.Td>
                    <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
                      {dao.reference_no || `DA-${dao.id}`}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{dao.dispatch_order_reference_no || `DO-${dao.dispatch_order_id}`}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{dao.warehouse_name || `Warehouse #${dao.warehouse_id}`}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{dao.commodity_name || '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {Number(dao.authorized_quantity_input ?? dao.authorized_quantity).toLocaleString()}
                      {dao.authorized_quantity_input_unit_abbreviation
                        ? ` ${dao.authorized_quantity_input_unit_abbreviation}`
                        : ''}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{dao.transporter_name || '—'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(dao.status)} variant="light" size="sm">
                      {dao.status.charAt(0).toUpperCase() + dao.status.slice(1)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{new Date(dao.created_at).toLocaleDateString()}</Text>
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
