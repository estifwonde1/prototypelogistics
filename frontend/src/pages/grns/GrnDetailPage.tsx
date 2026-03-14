import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Button,
  Group,
  Card,
  Table,
  Text,
  Badge,
  Grid,
  Modal,
} from '@mantine/core';
import { IconArrowLeft, IconCheck } from '@tabler/icons-react';
import { getGrn, confirmGrn } from '../../api/grns';
import { getWarehouses } from '../../api/warehouses';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { notifications } from '@mantine/notifications';
import { DocumentStatus } from '../../utils/constants';
import { useState } from 'react';

function GrnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { data: grn, isLoading, error, refetch } = useQuery({
    queryKey: ['grn', id],
    queryFn: () => getGrn(Number(id)),
    enabled: !!id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const confirmMutation = useMutation({
    mutationFn: confirmGrn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grn', id] });
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalances'] });
      notifications.show({
        title: 'Success',
        message: 'GRN confirmed successfully',
        color: 'green',
      });
      setConfirmModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to confirm GRN',
        color: 'red',
      });
    },
  });

  const handleConfirm = () => {
    if (id) {
      confirmMutation.mutate(Number(id));
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading GRN details..." />;
  }

  if (error || !grn) {
    return (
      <ErrorState
        message="Failed to load GRN details. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const warehouse = warehouses?.find((w) => w.id === grn.warehouse_id);
  const isDraft = grn.status === DocumentStatus.DRAFT;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/grns')}
          >
            Back to GRNs
          </Button>
          <div>
            <Title order={2}>GRN: {grn.reference_no}</Title>
            <Text c="dimmed" size="sm">
              Goods Received Note Details
            </Text>
          </div>
        </Group>
        {isDraft && (
          <Button
            leftSection={<IconCheck size={16} />}
            color="green"
            onClick={() => setConfirmModalOpen(true)}
          >
            Confirm GRN
          </Button>
        )}
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Header Information</Title>
            <StatusBadge status={grn.status} />
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Reference Number
              </Text>
              <Text fw={600}>{grn.reference_no}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Warehouse
              </Text>
              <Text fw={600}>{warehouse?.name || `ID: ${grn.warehouse_id}`}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Received On
              </Text>
              <Text fw={600}>{new Date(grn.received_on).toLocaleDateString()}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Received By
              </Text>
              <Text fw={600}>{grn.received_by_id || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Source Type
              </Text>
              <Text fw={600}>{grn.source_type || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Source ID
              </Text>
              <Text fw={600}>{grn.source_id || '-'}</Text>
            </Grid.Col>
            {grn.approved_by_id && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">
                  Approved By
                </Text>
                <Text fw={600}>{grn.approved_by_id}</Text>
              </Grid.Col>
            )}
          </Grid>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Line Items</Title>

          {grn.grn_items && grn.grn_items.length > 0 ? (
            <Table.ScrollContainer minWidth={800}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Commodity ID</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Unit ID</Table.Th>
                    <Table.Th>Quality Status</Table.Th>
                    <Table.Th>Store ID</Table.Th>
                    <Table.Th>Stack ID</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {grn.grn_items.map((item, index) => (
                    <Table.Tr key={item.id || index}>
                      <Table.Td>{item.commodity_id}</Table.Td>
                      <Table.Td style={{ fontWeight: 600 }}>
                        {item.quantity.toLocaleString()}
                      </Table.Td>
                      <Table.Td>{item.unit_id}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            item.quality_status === 'good'
                              ? 'green'
                              : item.quality_status === 'fair'
                              ? 'yellow'
                              : 'red'
                          }
                          variant="light"
                        >
                          {item.quality_status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{item.store_id || '-'}</Table.Td>
                      <Table.Td>{item.stack_id || '-'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              No items found
            </Text>
          )}

          {grn.grn_items && grn.grn_items.length > 0 && (
            <Group justify="flex-end">
              <Text size="sm" c="dimmed">
                Total Items:
              </Text>
              <Text fw={600}>{grn.grn_items.length}</Text>
              <Text size="sm" c="dimmed" ml="xl">
                Total Quantity:
              </Text>
              <Text fw={600}>
                {grn.grn_items
                  .reduce((sum, item) => sum + item.quantity, 0)
                  .toLocaleString()}
              </Text>
            </Group>
          )}
        </Stack>
      </Card>

      <Modal
        opened={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm GRN"
      >
        <Text mb="md">
          Are you sure you want to confirm this GRN? This will update stock balances and
          cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmModalOpen(false)}>
            Cancel
          </Button>
          <Button color="green" onClick={handleConfirm} loading={confirmMutation.isPending}>
            Confirm
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

export default GrnDetailPage;
