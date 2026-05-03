import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Button,
  Group,
  Card,
  Table,
  Text,
  Badge,
  Select,
  SimpleGrid,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { getReceiptAuthorizations } from '../../api/receiptAuthorizations';
import type { ReceiptAuthorization } from '../../api/receiptAuthorizations';
import { useAuthStore } from '../../store/authStore';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

function statusColor(status: ReceiptAuthorization['status']) {
  switch (status) {
    case 'pending':  return 'yellow';
    case 'active':   return 'blue';
    case 'closed':   return 'green';
    case 'cancelled': return 'red';
    default:         return 'gray';
  }
}

export default function ReceiptAuthorizationListPage() {
  const navigate = useNavigate();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const userHubId = activeAssignment?.hub?.id;

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);

  const { data: ras = [], isLoading, error, refetch } = useQuery({
    queryKey: ['receipt_authorizations', { status: statusFilter, hub_id: userHubId }],
    queryFn: () => getReceiptAuthorizations(
      statusFilter
        ? { status: statusFilter as ReceiptAuthorization['status'] }
        : undefined
    ),
  });

  // Derive unique warehouses from the fetched RAs for the warehouse filter dropdown
  const warehouseOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const ra of ras) {
      if (!seen.has(ra.warehouse_id)) {
        seen.set(ra.warehouse_id, ra.warehouse_name || `Warehouse #${ra.warehouse_id}`);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({
      value: String(id),
      label: name,
    }));
  }, [ras]);

  // Apply client-side warehouse filter
  const filteredRas = useMemo(() => {
    if (!warehouseFilter) return ras;
    return ras.filter((ra) => String(ra.warehouse_id) === warehouseFilter);
  }, [ras, warehouseFilter]);

  // Summary counts (based on all fetched RAs, not the filtered subset)
  const pending = ras.filter((r) => r.status === 'pending').length;
  const active  = ras.filter((r) => r.status === 'active').length;
  const closed  = ras.filter((r) => r.status === 'closed').length;

  if (isLoading) return <LoadingState message="Loading Receipt Authorizations..." />;
  if (error) return <ErrorState message="Failed to load Receipt Authorizations." onRetry={refetch} />;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Receipt Authorizations</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/hub/receipt-authorizations/new')}
        >
          New Receipt Authorization
        </Button>
      </Group>

      {/* Summary counts */}
      <SimpleGrid cols={{ base: 3, sm: 3 }}>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="yellow">{pending}</Text>
          <Text size="sm" c="dimmed">Pending</Text>
        </Card>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="blue">{active}</Text>
          <Text size="sm" c="dimmed">Active</Text>
        </Card>
        <Card withBorder padding="sm" ta="center">
          <Text size="xl" fw={700} c="green">{closed}</Text>
          <Text size="sm" c="dimmed">Closed</Text>
        </Card>
      </SimpleGrid>

      {/* Filters */}
      <Group>
        <Select
          placeholder="All statuses"
          data={[
            { value: 'pending',   label: 'Pending' },
            { value: 'active',    label: 'Active' },
            { value: 'closed',    label: 'Closed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          w={180}
        />
        <Select
          placeholder="All warehouses"
          data={warehouseOptions}
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          clearable
          w={220}
          disabled={warehouseOptions.length === 0}
        />
      </Group>

      {/* Table */}
      {filteredRas.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No receipt authorizations found.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={700}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reference No</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Warehouse</Table.Th>
                <Table.Th>Store</Table.Th>
                <Table.Th>Authorized Qty</Table.Th>
                <Table.Th>Driver Name</Table.Th>
                <Table.Th>Truck Plate</Table.Th>
                <Table.Th>Created At</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredRas.map((ra) => (
                <Table.Tr
                  key={ra.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/hub/receipt-authorizations/${ra.id}`)}
                >
                  <Table.Td>
                    <Text size="sm" fw={500} style={{ fontFamily: 'monospace' }}>
                      {ra.reference_no}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(ra.status)} variant="light">
                      {ra.status.charAt(0).toUpperCase() + ra.status.slice(1)}
                    </Badge>
                  </Table.Td>
                  <Table.Td><Text size="sm">{ra.warehouse_name || `Warehouse #${ra.warehouse_id}`}</Text></Table.Td>
                  <Table.Td><Text size="sm">{ra.store_name || `Store #${ra.store_id}`}</Text></Table.Td>
                  <Table.Td><Text size="sm" fw={600}>{Number(ra.authorized_quantity).toLocaleString()}</Text></Table.Td>
                  <Table.Td><Text size="sm">{ra.driver_name}</Text></Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ fontFamily: 'monospace' }}>{ra.truck_plate_number}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{new Date(ra.created_at).toLocaleDateString()}</Text>
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
