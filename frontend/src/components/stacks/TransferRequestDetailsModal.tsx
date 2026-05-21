import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Loader,
  Center,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { getTransferRequest, type TransferRequest } from '../../api/transferRequests';

interface TransferRequestDetailsModalProps {
  requestId: number | null;
  opened: boolean;
  onClose: () => void;
  /** Fallback while loading */
  preview?: TransferRequest | null;
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatQty = (value: number, unit: string) =>
  `${numberFormatter.format(value)} ${unit}`;

export default function TransferRequestDetailsModal({
  requestId,
  opened,
  onClose,
  preview,
}: TransferRequestDetailsModalProps) {
  const { data: request, isLoading, error } = useQuery({
    queryKey: ['transfer_request', requestId],
    queryFn: () => getTransferRequest(requestId!),
    enabled: opened && requestId != null,
  });

  const detail = request ?? preview;
  const unitAbbr = detail?.unit.abbreviation ?? '';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Transfer request details"
      size="lg"
      radius="xl"
      centered
    >
      {isLoading && !detail && (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}
      {error && !detail && (
        <Alert color="red" title="Could not load details">
          Failed to load transfer request. Try again.
        </Alert>
      )}
      {detail && (
        <Stack gap="md">
          <Group gap="xs">
            <Badge variant="light">{detail.status}</Badge>
            {detail.status === 'Pending' && (detail.fulfilled_quantity ?? 0) > 0 && (
              <Badge variant="light" color="blue">
                Partial
              </Badge>
            )}
          </Group>

          <Alert variant="light" color="blue" title="Quantity summary">
            <Stack gap={4}>
              <Text size="sm">
                <strong>Requested:</strong> {formatQty(detail.quantity, unitAbbr)}
              </Text>
              <Text size="sm">
                <strong>Transferred:</strong>{' '}
                {formatQty(detail.fulfilled_quantity ?? 0, unitAbbr)}
              </Text>
              <Text size="sm">
                <strong>Rejected:</strong> {formatQty(detail.rejected_quantity ?? 0, unitAbbr)}
              </Text>
              {(detail.remaining_quantity ?? 0) > 0.001 && (
                <Text size="sm" fw={600}>
                  <strong>Still open:</strong>{' '}
                  {formatQty(detail.remaining_quantity ?? 0, unitAbbr)}
                </Text>
              )}
            </Stack>
          </Alert>

          <Alert variant="light" color="gray" title="Route">
            <Stack gap={4}>
              <Text size="sm">
                <strong>From:</strong> {detail.source_store.name} · Stack{' '}
                <strong>{detail.source_stack.code}</strong>
              </Text>
              <Text size="sm">
                <strong>To store:</strong> {detail.destination_store.name}
              </Text>
              <Text size="sm">
                <strong>Commodity:</strong> {detail.commodity.name}
              </Text>
              <Text size="sm">
                <strong>Reason:</strong> {detail.reason}
              </Text>
              <Text size="xs" c="dimmed">
                Requested by {detail.requested_by.name} on{' '}
                {new Date(detail.created_at).toLocaleString()}
              </Text>
            </Stack>
          </Alert>

          {(detail.rejected_quantity ?? 0) > 0 && (
            <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
              Rejected quantity was released back to source stack{' '}
              <strong>{detail.source_stack.code}</strong> (available for other transfers).
            </Alert>
          )}

          {detail.allocations && detail.allocations.length > 0 ? (
            <Stack gap="xs">
              <Text fw={700} size="sm">
                Allocation history
              </Text>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>When</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Qty</Table.Th>
                    <Table.Th>Destination stack</Table.Th>
                    <Table.Th>By</Table.Th>
                    <Table.Th>Notes</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {detail.allocations.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td>
                        <Text size="xs">{new Date(row.created_at).toLocaleString()}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          color={row.action === 'fulfillment' ? 'green' : 'red'}
                          variant="light"
                        >
                          {row.action === 'fulfillment' ? 'Transferred' : 'Rejected'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatQty(row.quantity, unitAbbr)}</Text>
                        {row.released_to_source_stack && (
                          <Text size="xs" c="dimmed">
                            → back to {row.source_stack?.code ?? detail.source_stack.code}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {row.action === 'fulfillment' && row.destination_stack ? (
                          <Text size="sm">
                            {row.destination_stack.code}
                            {row.destination_stack.store_name
                              ? ` (${row.destination_stack.store_name})`
                              : ''}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{row.reviewed_by?.name ?? '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" lineClamp={2}>
                          {row.notes || '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No transfers or rejections recorded yet.
            </Text>
          )}

          {detail.review_notes && (
            <Text size="sm" c="dimmed">
              <strong>Latest review notes:</strong> {detail.review_notes}
            </Text>
          )}
        </Stack>
      )}
    </Modal>
  );
}
