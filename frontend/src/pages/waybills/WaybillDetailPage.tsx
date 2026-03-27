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
  Grid,
  Modal,
  Badge,
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconTruck } from '@tabler/icons-react';
import { getWaybill, confirmWaybill } from '../../api/waybills';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { notifications } from '@mantine/notifications';
import { DocumentStatus } from '../../utils/constants';
import { useState } from 'react';
import type { ApiError } from '../../types/common';

function WaybillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const { data: waybill, isLoading, error, refetch } = useQuery({
    queryKey: ['waybill', id],
    queryFn: () => getWaybill(Number(id)),
    enabled: !!id,
  });

  const confirmMutation = useMutation({
    mutationFn: confirmWaybill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waybill', id] });
      queryClient.invalidateQueries({ queryKey: ['waybills'] });
      notifications.show({
        title: 'Success',
        message: 'Waybill confirmed successfully',
        color: 'green',
      });
      setConfirmModalOpen(false);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to confirm waybill',
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
    return <LoadingState message="Loading waybill details..." />;
  }

  if (error || !waybill) {
    return (
      <ErrorState
        message="Failed to load waybill details. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const isDraft = waybill.status === DocumentStatus.DRAFT;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/waybills')}
          >
            Back to Waybills
          </Button>
          <div>
            <Title order={2}>Waybill: {waybill.reference_no}</Title>
            <Text c="dimmed" size="sm">
              Transport Document Details
            </Text>
          </div>
        </Group>
        {isDraft && (
          <Button
            leftSection={<IconCheck size={16} />}
            color="green"
            onClick={() => setConfirmModalOpen(true)}
          >
            Confirm Waybill
          </Button>
        )}
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Header Information</Title>
            <StatusBadge status={waybill.status} />
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Reference Number
              </Text>
              <Text fw={600}>{waybill.reference_no}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Issued On
              </Text>
              <Text fw={600}>{new Date(waybill.issued_on).toLocaleDateString()}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Source Location
              </Text>
              <Text fw={600}>{waybill.source_location_name || `Location ${waybill.source_location_id}`}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Destination Location
              </Text>
              <Text fw={600}>{waybill.destination_location_name || `Location ${waybill.destination_location_id}`}</Text>
            </Grid.Col>
            {waybill.dispatch_id && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">
                  Dispatch ID
                </Text>
                <Text fw={600}>{waybill.dispatch_id}</Text>
              </Grid.Col>
            )}
          </Grid>
        </Stack>
      </Card>

      {waybill.waybill_transport && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group>
              <IconTruck size={24} />
              <Title order={4}>Transport Details</Title>
            </Group>

            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">
                  Transporter
                </Text>
                <Text fw={600}>Transporter {waybill.waybill_transport.transporter_id}</Text>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">
                  Vehicle Plate Number
                </Text>
                <Badge size="lg" variant="outline">
                  {waybill.waybill_transport.vehicle_plate_no}
                </Badge>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">
                  Driver Name
                </Text>
                <Text fw={600}>{waybill.waybill_transport.driver_name}</Text>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">
                  Driver Phone
                </Text>
                <Text fw={600}>{waybill.waybill_transport.driver_phone}</Text>
              </Grid.Col>
            </Grid>
          </Stack>
        </Card>
      )}

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Line Items</Title>

          {waybill.waybill_items && waybill.waybill_items.length > 0 ? (
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Unit</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {waybill.waybill_items.map((item, index) => (
                    <Table.Tr key={item.id || index}>
                      <Table.Td>{item.commodity_name || item.commodity_code || item.commodity_id}</Table.Td>
                      <Table.Td style={{ fontWeight: 600 }}>
                        {item.quantity.toLocaleString()}
                      </Table.Td>
                      <Table.Td>{item.unit_abbreviation || item.unit_name || item.unit_id}</Table.Td>
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

          {waybill.waybill_items && waybill.waybill_items.length > 0 && (
            <Group justify="flex-end">
              <Text size="sm" c="dimmed">
                Total Items:
              </Text>
              <Text fw={600}>{waybill.waybill_items.length}</Text>
              <Text size="sm" c="dimmed" ml="xl">
                Total Quantity:
              </Text>
              <Text fw={600}>
                {waybill.waybill_items
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
        title="Confirm Waybill"
      >
        <Text mb="md">
          Are you sure you want to confirm this waybill? This will finalize the transport
          document and cannot be undone.
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

export default WaybillDetailPage;
