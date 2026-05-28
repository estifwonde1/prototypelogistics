import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Button,
  Group,
  Card,
  Table,
  Text,
  SimpleGrid,
  Alert,
  Divider,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconTruck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate, useParams } from 'react-router-dom';
import {
  confirmDispatchOrderAuthorization,
  getDispatchOrderAuthorization,
} from '../../api/dispatchOrderAuthorizations';
import { getDispatchOrder } from '../../api/dispatchOrders';
import { getWaybills } from '../../api/waybills';
import { postPrintableWaybill } from '../../api/printables';
import type { ApiError } from '../../types/common';
import { formatDestinationAllocations } from '../../utils/dispatchAllocations';
import { getDispatchOrderReference } from '../../utils/dispatchOrderReference';
import {
  type DispatchAuthorizationBasePath,
  dispatchAuthorizationListPath,
} from '../../utils/dispatchAuthorizationPaths';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';

type WaybillPrintable = {
  reference_no?: string;
  issued_on?: string;
  plan_reference?: string;
  dispatch_reference?: string;
  authorization_reference?: string;
  transporter_name?: string;
  driver_name?: string;
  vehicle_plate_no?: string;
  source_location_name?: string;
  destination_location_name?: string;
  items?: { commodity_name?: string; quantity?: number; unit_name?: string }[];
};

export default function DispatchAuthorizationDetailPage({
  basePath,
}: {
  basePath: DispatchAuthorizationBasePath;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authId = Number(id);

  const { data: auth, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_order_authorizations', authId],
    queryFn: () => getDispatchOrderAuthorization(authId),
    enabled: Number.isFinite(authId) && authId > 0,
  });

  const { data: order } = useQuery({
    queryKey: ['dispatch_orders', auth?.dispatch_order_id],
    queryFn: () => getDispatchOrder(auth!.dispatch_order_id),
    enabled: !!auth?.dispatch_order_id,
  });

  const { data: waybills } = useQuery({
    queryKey: ['waybills', { dispatch_order_authorization_id: authId }],
    queryFn: () => getWaybills({ dispatch_order_authorization_id: authId }),
    enabled: !!auth && String(auth.status).toLowerCase() !== 'draft',
  });

  const { data: printableWaybill } = useQuery({
    queryKey: ['printable_waybill', waybills?.[0]?.id],
    queryFn: () => postPrintableWaybill({ waybill_id: waybills![0].id }),
    enabled: !!waybills?.[0]?.id,
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmDispatchOrderAuthorization(authId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations', authId] });
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders', 'awaiting_authorization'] });
      notifications.show({
        title: 'Confirmed',
        message: 'Waybill generated. Storekeepers can now pick up stock.',
        color: 'green',
      });
      refetch();
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
          'Confirm failed',
        color: 'red',
      });
    },
  });

  if (!Number.isFinite(authId) || authId <= 0) {
    return <Text c="red">Invalid authorization id</Text>;
  }

  if (isLoading) return <LoadingState message="Loading authorization..." />;
  if (error || !auth) {
    return <ErrorState message="Failed to load authorization" onRetry={refetch} />;
  }

  const isDraft = String(auth.status).toLowerCase() === 'draft';
  const canConfirm =
    isDraft &&
    !!auth.driver_name?.trim() &&
    !!auth.driver_id_number?.trim() &&
    !!auth.truck_plate_number?.trim();

  const wb = printableWaybill as WaybillPrintable | undefined;
  const dispatchRef = order ? getDispatchOrderReference(order) : '—';

  const linesAtWarehouse = (order?.dispatch_order_lines ?? []).filter((line) =>
    (line.source_allocations ?? []).some(
      (s) => Number(s.warehouse_id) === Number(auth.warehouse_id)
    )
  );

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>
          Authorization {auth.reference_no || `#${auth.id}`}
        </Title>
        <Button variant="light" onClick={() => navigate(dispatchAuthorizationListPath(basePath))}>
          Back
        </Button>
      </Group>

      <Card withBorder padding="lg">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase">
              Dispatch order
            </Text>
            <Text fw={600}>{dispatchRef}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase">
              Warehouse
            </Text>
            <Text fw={600}>{auth.warehouse?.label ?? `WH-${auth.warehouse_id}`}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase">
              Status
            </Text>
            <StatusBadge status={auth.status_label ?? auth.status} />
          </div>
        </SimpleGrid>
      </Card>

      {order && linesAtWarehouse.length > 0 && (
        <Card withBorder padding="lg">
          <Title order={5} mb="sm">
            Order lines at this warehouse
          </Title>
          {linesAtWarehouse.map((line) => (
            <Group key={line.id ?? line.commodity_id} gap="md" mb="xs">
              <Text size="sm" fw={500}>
                {line.commodity_name}
              </Text>
              <Text size="sm" c="dimmed">
                → {formatDestinationAllocations(line)}
              </Text>
            </Group>
          ))}
        </Card>
      )}

      <Card withBorder padding="lg">
        <Title order={5} mb="sm">
          Transport
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Text size="sm">
            <strong>Transporter:</strong> {auth.transporter_name || auth.transporter_id || '—'}
          </Text>
          <Text size="sm">
            <strong>Driver:</strong> {auth.driver_name || '—'}
          </Text>
          <Text size="sm">
            <strong>License:</strong> {auth.driver_id_number || '—'}
          </Text>
          <Text size="sm">
            <strong>Plate:</strong> {auth.truck_plate_number || '—'}
          </Text>
          <Text size="sm">
            <strong>Authorized qty:</strong> {auth.authorized_quantity}
          </Text>
        </SimpleGrid>
      </Card>

      {isDraft && (
        <>
          {!canConfirm && (
            <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
              Driver name, license, and truck plate must be set on the authorization before
              confirming. Edit the draft from the form if any field is missing.
            </Alert>
          )}
          <Button
            leftSection={<IconCheck size={16} />}
            loading={confirmMutation.isPending}
            disabled={!canConfirm}
            onClick={() => confirmMutation.mutate()}
          >
            Confirm authorization (generate waybill)
          </Button>
        </>
      )}

      {!isDraft && (
        <Alert color="blue" icon={<IconTruck size={16} />}>
          Storekeepers assigned to the stores below will see this authorization under{' '}
          <strong>Outbound Dispatches</strong>.
        </Alert>
      )}

      <Card withBorder padding="lg">
        <Title order={5} mb="sm">
          Store splits
        </Title>
        <Table.ScrollContainer minWidth={480}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Store</Table.Th>
                <Table.Th>Commodity</Table.Th>
                <Table.Th>Authorized</Table.Th>
                <Table.Th>Remaining</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(auth.dispatch_order_authorization_stores ?? []).map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>{s.store_name ?? s.store_id}</Table.Td>
                  <Table.Td>{s.commodity_name ?? s.commodity_id}</Table.Td>
                  <Table.Td>{s.authorized_quantity}</Table.Td>
                  <Table.Td>{s.remaining_quantity}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      {wb && (
        <Card withBorder padding="lg">
          <Title order={5} mb="sm">
            Waybill
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Text size="sm">
              <strong>Reference:</strong> {wb.reference_no || '—'}
            </Text>
            <Text size="sm">
              <strong>Issued:</strong> {wb.issued_on || '—'}
            </Text>
            <Text size="sm">
              <strong>From:</strong> {wb.source_location_name || '—'}
            </Text>
            <Text size="sm">
              <strong>To:</strong> {wb.destination_location_name || '—'}
            </Text>
            <Text size="sm">
              <strong>Driver:</strong> {wb.driver_name || auth.driver_name || '—'}
            </Text>
            <Text size="sm">
              <strong>Vehicle:</strong> {wb.vehicle_plate_no || auth.truck_plate_number || '—'}
            </Text>
          </SimpleGrid>
          {wb.items && wb.items.length > 0 && (
            <>
              <Divider my="sm" />
              {wb.items.map((item, idx) => (
                <Text key={idx} size="sm">
                  {item.commodity_name}: {item.quantity} {item.unit_name}
                </Text>
              ))}
            </>
          )}
        </Card>
      )}
    </Stack>
  );
}
