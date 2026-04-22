import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
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
  Alert,
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { getInspection, confirmInspection } from '../../api/inspections';
import { getWarehouses } from '../../api/warehouses';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { notifications } from '@mantine/notifications';
import { DocumentStatus } from '../../utils/constants';
import { useState, useMemo } from 'react';
import type { ApiError } from '../../types/common';

function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { data: inspection, isLoading, error, refetch } = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => getInspection(Number(id)),
    enabled: !!id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const confirmMutation = useMutation({
    mutationFn: confirmInspection,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inspection', id] }),
        queryClient.invalidateQueries({ queryKey: ['inspections'] }),
        queryClient.invalidateQueries({ queryKey: ['stockBalances'] }),
        queryClient.invalidateQueries({ queryKey: ['reports', 'bin-card'] }),
        queryClient.invalidateQueries({ queryKey: ['stacks'] }),
      ]);
      notifications.show({
        title: 'Success',
        message: 'Inspection confirmed successfully',
        color: 'green',
      });
      setConfirmModalOpen(false);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to confirm inspection',
        color: 'red',
      });
    },
  });

  const handleConfirm = () => {
    if (id) {
      confirmMutation.mutate(Number(id));
    }
  };

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!inspection?.inspection_items) return null;

    const totalReceived = inspection.inspection_items.reduce(
      (sum, item) => sum + item.quantity_received,
      0
    );
    const totalDamaged = inspection.inspection_items.reduce(
      (sum, item) => sum + (item.quantity_damaged || 0),
      0
    );
    const totalLost = inspection.inspection_items.reduce(
      (sum, item) => sum + (item.quantity_lost || 0),
      0
    );
    const totalGood = totalReceived - totalDamaged - totalLost;

    return {
      totalReceived,
      totalDamaged,
      totalLost,
      totalGood,
      damageRate: totalReceived > 0 ? ((totalDamaged / totalReceived) * 100).toFixed(1) : '0',
      lossRate: totalReceived > 0 ? ((totalLost / totalReceived) * 100).toFixed(1) : '0',
    };
  }, [inspection]);

  if (isLoading) {
    return <LoadingState message="Loading inspection details..." />;
  }

  if (error || !inspection) {
    return (
      <ErrorState
        message="Failed to load inspection details. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const warehouse = warehouses?.find((w) => w.id === inspection.warehouse_id);
  const isDraft = inspection.status === DocumentStatus.DRAFT;
  const hasDamageOrLoss = summary && (summary.totalDamaged > 0 || summary.totalLost > 0);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/inspections')}
          >
            Back to Inspections
          </Button>
          <div>
            <Title order={2}>Inspection: {inspection.reference_no}</Title>
            <Text c="dimmed" size="sm">
              Quality Inspection Details
            </Text>
          </div>
        </Group>
        {isDraft && (
          <Button
            leftSection={<IconCheck size={16} />}
            color="green"
            onClick={() => setConfirmModalOpen(true)}
          >
            Confirm Inspection
          </Button>
        )}
      </Group>

      {hasDamageOrLoss && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Quality Issues Detected"
          color="orange"
        >
          This inspection has recorded damaged or lost items. Damage rate: {summary.damageRate}%,
          Loss rate: {summary.lossRate}%
        </Alert>
      )}

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Header Information</Title>
            <StatusBadge status={inspection.status} />
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Reference Number
              </Text>
              <Text fw={600}>{inspection.reference_no}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Warehouse
              </Text>
              <Text fw={600}>{warehouse?.name || `ID: ${inspection.warehouse_id}`}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Inspected On
              </Text>
              <Text fw={600}>{new Date(inspection.inspected_on).toLocaleDateString()}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Inspector
              </Text>
              <Text fw={600}>{inspection.inspector_id || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Source Type
              </Text>
              <Text fw={600}>{inspection.source_type || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Source ID
              </Text>
              <Text fw={600}>{inspection.source_id || '-'}</Text>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {summary && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={4}>Summary</Title>
            <Grid>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Text size="sm" c="dimmed">
                  Total Received
                </Text>
                <Text size="xl" fw={700}>
                  {summary.totalReceived.toLocaleString()}
                </Text>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Text size="sm" c="dimmed">
                  Good Condition
                </Text>
                <Text size="xl" fw={700} c="green">
                  {summary.totalGood.toLocaleString()}
                </Text>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Text size="sm" c="dimmed">
                  Damaged
                </Text>
                <Text size="xl" fw={700} c="orange">
                  {summary.totalDamaged.toLocaleString()}
                </Text>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Text size="sm" c="dimmed">
                  Lost
                </Text>
                <Text size="xl" fw={700} c="red">
                  {summary.totalLost.toLocaleString()}
                </Text>
              </Grid.Col>
            </Grid>
          </Stack>
        </Card>
      )}

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Inspection Items</Title>

          {inspection.inspection_items && inspection.inspection_items.length > 0 ? (
            <Table.ScrollContainer minWidth={1120}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Line ref / batch</Table.Th>
                    <Table.Th>Qty Received</Table.Th>
                    <Table.Th>Qty Damaged</Table.Th>
                    <Table.Th>Qty Lost</Table.Th>
                    <Table.Th>Quality Status</Table.Th>
                    <Table.Th>Packaging</Table.Th>
                    <Table.Th>Remarks</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {inspection.inspection_items.map((item, index) => (
                    <Table.Tr key={item.id || index}>
                      <Table.Td>{item.commodity_name || item.commodity_code || item.commodity_id}</Table.Td>
                      <Table.Td style={{ fontWeight: 600 }}>
                        {item.line_reference_no || item.batch_no || '—'}
                      </Table.Td>
                      <Table.Td style={{ fontWeight: 600 }}>
                        {item.quantity_received.toLocaleString()}
                      </Table.Td>
                      <Table.Td>
                        <Text c={item.quantity_damaged ? 'orange' : undefined}>
                          {item.quantity_damaged?.toLocaleString() || 0}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text c={item.quantity_lost ? 'red' : undefined}>
                          {item.quantity_lost?.toLocaleString() || 0}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            item.quality_status === 'good'
                              ? 'green'
                              : item.quality_status === 'fair'
                              ? 'yellow'
                              : item.quality_status === 'poor'
                              ? 'orange'
                              : 'red'
                          }
                          variant="light"
                        >
                          {item.quality_status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            item.packaging_condition === 'intact'
                              ? 'green'
                              : item.packaging_condition === 'torn'
                              ? 'yellow'
                              : 'orange'
                          }
                          variant="light"
                        >
                          {item.packaging_condition}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {item.remarks || '-'}
                        </Text>
                      </Table.Td>
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
        </Stack>
      </Card>

      <Modal
        opened={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Inspection"
      >
        <Text mb="md">
          Are you sure you want to confirm this inspection? This action cannot be undone.
        </Text>
        {hasDamageOrLoss && (
          <Alert icon={<IconAlertTriangle size={16} />} color="orange" mb="md">
            This inspection contains damaged or lost items. Please verify all quantities before
            confirming.
          </Alert>
        )}
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

export default InspectionDetailPage;
