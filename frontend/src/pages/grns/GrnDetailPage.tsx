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
} from '@mantine/core';
import { IconArrowLeft, IconCheck } from '@tabler/icons-react';
import { getGrn, confirmGrn } from '../../api/grns';
import { getWarehouses } from '../../api/warehouses';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ExpiryBadge } from '../../components/common/ExpiryBadge';
import { UomConversionDisplay } from '../../components/common/UomConversionDisplay';
import { notifications } from '@mantine/notifications';
import { DocumentStatus } from '../../utils/constants';
import { useState } from 'react';
import type { ApiError } from '../../types/common';
import { usePermission } from '../../hooks/usePermission';

function GrnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { can } = usePermission();

  const { data: grn, isLoading, error, refetch } = useQuery({
    queryKey: ['grn', id],
    queryFn: () => getGrn(Number(id)),
    enabled: !!id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
  });

  const confirmMutation = useMutation({
    mutationFn: confirmGrn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['grn', id] }),
        queryClient.invalidateQueries({ queryKey: ['grns'] }),
        queryClient.invalidateQueries({ queryKey: ['stockBalances'] }),
        queryClient.invalidateQueries({ queryKey: ['reports', 'bin-card'] }),
        queryClient.invalidateQueries({ queryKey: ['stacks'] }),
      ]);
      notifications.show({
        title: 'Success',
        message: 'GRN confirmed successfully',
        color: 'green',
      });
      setConfirmModalOpen(false);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to confirm GRN',
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

  const warehouse = warehouses?.find(
    (w) => Number(w.id) === Number(grn.warehouse_id)
  );
  const warehouseLabel =
    grn.warehouse_name?.trim() ||
    warehouse?.name?.trim() ||
    (grn.warehouse_code ? `${grn.warehouse_code}` : null) ||
    `ID: ${grn.warehouse_id}`;

  const isDraft = grn.status === DocumentStatus.DRAFT;
  const warehouseInScope = warehouses?.some(
    (w) => Number(w.id) === Number(grn.warehouse_id)
  );
  /** Prefer server flag; fallback if older API omitted it (scoped user can see this warehouse). */
  const canConfirm =
    isDraft &&
    can('grns', 'confirm') &&
    (grn.can_confirm === true ||
      (grn.can_confirm === undefined && Boolean(warehouseInScope)));

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
        {isDraft && canConfirm && (
          <Button
            leftSection={<IconCheck size={16} />}
            color="green"
            onClick={() => setConfirmModalOpen(true)}
          >
            Confirm GRN
          </Button>
        )}
      </Group>

      {grn.receipt_order_id && grn.receipt_order && (
        <Card shadow="sm" padding="lg" radius="md" withBorder bg="blue.0">
          <Group justify="space-between">
            <div>
              <Text fw={600} size="sm" c="blue.9">
                Generated from Receipt Order
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                Order RO-{grn.receipt_order.id} • {grn.receipt_order.source_type}: {grn.receipt_order.source_name}
              </Text>
            </div>
            <Button
              variant="light"
              size="sm"
              onClick={() => navigate(`/officer/receipt-orders/${grn.receipt_order_id}`)}
            >
              View Order
            </Button>
          </Group>
        </Card>
      )}

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
              <Text fw={600}>{warehouseLabel}</Text>
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
              <Text fw={600}>{grn.received_by_name || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Source Type
              </Text>
              <Text fw={600}>{grn.source_type || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Source Reference
              </Text>
              <Text fw={600}>{grn.source_reference || grn.source_id || '-'}</Text>
            </Grid.Col>
            {grn.approved_by_id && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">
                  Approved By
                </Text>
                <Text fw={600}>{grn.approved_by_name || grn.approved_by_id}</Text>
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
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Line ref / batch</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Unit</Table.Th>
                    <Table.Th>Quality Status</Table.Th>
                    <Table.Th>Store</Table.Th>
                    <Table.Th>Stack</Table.Th>
                    <Table.Th>Batch/Expiry</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {grn.grn_items.map((item, index) => (
                    <Table.Tr key={item.id || index}>
                      <Table.Td>{item.commodity_name || item.commodity_code || item.commodity_id}</Table.Td>
                      <Table.Td style={{ fontWeight: 600 }}>
                        {item.line_reference_no || item.batch_no || '—'}
                      </Table.Td>
                      <Table.Td style={{ fontWeight: 600 }}>
                        {item.quantity.toLocaleString()}
                        {item.entered_quantity && item.entered_unit_name && (
                          <Text size="xs" c="dimmed" mt={4}>
                            <UomConversionDisplay
                              enteredQuantity={item.entered_quantity}
                              enteredUnit={item.entered_unit_name}
                              baseQuantity={item.base_quantity || item.quantity}
                              baseUnit={item.base_unit_name || item.unit_abbreviation || item.unit_name || ''}
                            />
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{item.unit_abbreviation || item.unit_name || item.unit_id}</Table.Td>
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
                      <Table.Td>{item.store_name || item.store_code || item.store_id || '-'}</Table.Td>
                      <Table.Td>{item.stack_name || item.stack_code || item.stack_id || '-'}</Table.Td>
                      <Table.Td>
                        {item.batch_no || item.expiry_date ? (
                          <Stack gap="xs">
                            {item.batch_no && (
                              <Text size="sm" fw={500}>
                                {item.batch_no}
                              </Text>
                            )}
                            {item.expiry_date && <ExpiryBadge expiryDate={item.expiry_date} size="sm" />}
                          </Stack>
                        ) : (
                          <Text c="dimmed">-</Text>
                        )}
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

      {canConfirm ? (
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
      ) : null}
    </Stack>
  );
}

export default GrnDetailPage;

