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
  Grid,
  Modal,
} from '@mantine/core';
import { IconArrowLeft, IconCheck } from '@tabler/icons-react';
import { getGin, confirmGin } from '../../api/gins';
import { getWarehouses } from '../../api/warehouses';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { notifications } from '@mantine/notifications';
import { DocumentStatus } from '../../utils/constants';
import { useState } from 'react';

function GinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { data: gin, isLoading, error, refetch } = useQuery({
    queryKey: ['gin', id],
    queryFn: () => getGin(Number(id)),
    enabled: !!id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const confirmMutation = useMutation({
    mutationFn: confirmGin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gin', id] });
      queryClient.invalidateQueries({ queryKey: ['gins'] });
      queryClient.invalidateQueries({ queryKey: ['stockBalances'] });
      notifications.show({
        title: 'Success',
        message: 'GIN confirmed successfully',
        color: 'green',
      });
      setConfirmModalOpen(false);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to confirm GIN',
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
    return <LoadingState message="Loading GIN details..." />;
  }

  if (error || !gin) {
    return (
      <ErrorState
        message="Failed to load GIN details. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const warehouse = warehouses?.find((w) => w.id === gin.warehouse_id);
  const isDraft = gin.status === DocumentStatus.DRAFT;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/gins')}
          >
            Back to GINs
          </Button>
          <div>
            <Title order={2}>GIN: {gin.reference_no}</Title>
            <Text c="dimmed" size="sm">
              Goods Issue Note Details
            </Text>
          </div>
        </Group>
        {isDraft && (
          <Button
            leftSection={<IconCheck size={16} />}
            color="green"
            onClick={() => setConfirmModalOpen(true)}
          >
            Confirm GIN
          </Button>
        )}
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Header Information</Title>
            <StatusBadge status={gin.status} />
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Reference Number
              </Text>
              <Text fw={600}>{gin.reference_no}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Warehouse
              </Text>
              <Text fw={600}>{warehouse?.name || `ID: ${gin.warehouse_id}`}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Issued On
              </Text>
              <Text fw={600}>{new Date(gin.issued_on).toLocaleDateString()}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Issued By
              </Text>
              <Text fw={600}>{gin.issued_by_id || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Destination Type
              </Text>
              <Text fw={600}>{gin.destination_type || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Destination ID
              </Text>
              <Text fw={600}>{gin.destination_id || '-'}</Text>
            </Grid.Col>
            {gin.approved_by_id && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">
                  Approved By
                </Text>
                <Text fw={600}>{gin.approved_by_id}</Text>
              </Grid.Col>
            )}
          </Grid>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Line Items</Title>

          {gin.gin_items && gin.gin_items.length > 0 ? (
            <Table.ScrollContainer minWidth={800}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Commodity ID</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Unit ID</Table.Th>
                    <Table.Th>Store ID</Table.Th>
                    <Table.Th>Stack ID</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {gin.gin_items.map((item, index) => (
                    <Table.Tr key={item.id || index}>
                      <Table.Td>{item.commodity_id}</Table.Td>
                      <Table.Td style={{ fontWeight: 600 }}>
                        {item.quantity.toLocaleString()}
                      </Table.Td>
                      <Table.Td>{item.unit_id}</Table.Td>
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

          {gin.gin_items && gin.gin_items.length > 0 && (
            <Group justify="flex-end">
              <Text size="sm" c="dimmed">
                Total Items:
              </Text>
              <Text fw={600}>{gin.gin_items.length}</Text>
              <Text size="sm" c="dimmed" ml="xl">
                Total Quantity:
              </Text>
              <Text fw={600}>
                {gin.gin_items
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
        title="Confirm GIN"
      >
        <Text mb="md">
          Are you sure you want to confirm this GIN? This will update stock balances and
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

export default GinDetailPage;
