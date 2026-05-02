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
  Divider,
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconDownload } from '@tabler/icons-react';
import { getGrn, confirmGrn } from '../../api/grns';
import { getWarehouses } from '../../api/warehouses';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ExpiryBadge } from '../../components/common/ExpiryBadge';
import { UomConversionDisplay } from '../../components/common/UomConversionDisplay';
import { notifications } from '@mantine/notifications';
import { DocumentStatus } from '../../utils/constants';
import { useRef, useState } from 'react';
import type { ApiError } from '../../types/common';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';

function GrnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { can } = usePermission();
  const printRef = useRef<HTMLDivElement>(null);
  const currentUser = useAuthStore((s) => s.userId);

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

  const handleDownload = () => {
    if (!grn) return;

    // Build a self-contained printable HTML document
    const items = grn.grn_items ?? [];
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);

    const itemRows = items
      .map(
        (item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${item.commodity_name || item.commodity_code || item.commodity_id}</td>
          <td>${item.line_reference_no || item.batch_no || '—'}</td>
          <td style="text-align:right">${item.quantity.toLocaleString()}</td>
          <td>${item.unit_abbreviation || item.unit_name || ''}</td>
          <td>${item.quality_status || ''}</td>
          <td>${item.store_name || item.store_id || '—'}</td>
          <td>${item.stack_code || item.stack_name || item.stack_id || '—'}</td>
        </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>GRN ${grn.reference_no}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .header-left h1 { font-size: 22px; }
    .header-left p { color: #555; font-size: 11px; margin-top: 2px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;
             background: ${grn.status === 'confirmed' ? '#d3f9d8' : '#fff3bf'}; 
             color: ${grn.status === 'confirmed' ? '#2b8a3e' : '#e67700'}; border: 1px solid currentColor; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .meta-item label { font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700; }
    .meta-item p { font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f1f3f5; text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; border: 1px solid #dee2e6; }
    td { padding: 6px 8px; border: 1px solid #dee2e6; vertical-align: top; }
    tr:nth-child(even) td { background: #f8f9fa; }
    .total-row td { font-weight: 700; background: #e9ecef; }
    .footer { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
    .sig-box { border-top: 1px solid #333; padding-top: 6px; font-size: 11px; color: #555; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Goods Received Note</h1>
      <p>CATS Warehouse Management System</p>
    </div>
    <div>
      <div style="font-size:18px;font-weight:700">${grn.reference_no}</div>
      <div style="margin-top:4px"><span class="badge">${grn.status.toUpperCase()}</span></div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><label>Warehouse</label><p>${grn.warehouse_name || grn.warehouse_id}</p></div>
    <div class="meta-item"><label>Received On</label><p>${new Date(grn.received_on).toLocaleDateString()}</p></div>
    <div class="meta-item"><label>Received By</label><p>${grn.received_by_name || '—'}</p></div>
    <div class="meta-item"><label>Source Type</label><p>${grn.source_type || '—'}</p></div>
    <div class="meta-item"><label>Source Reference</label><p>${grn.source_reference || grn.source_id || '—'}</p></div>
    ${grn.receipt_order_id ? `<div class="meta-item"><label>Receipt Order</label><p>RO-${grn.receipt_order_id}</p></div>` : '<div></div>'}
    ${grn.approved_by_name ? `<div class="meta-item"><label>Approved By</label><p>${grn.approved_by_name}</p></div>` : ''}
  </div>

  <h2>Line Items</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Commodity</th><th>Batch / Ref</th>
        <th style="text-align:right">Quantity</th><th>Unit</th>
        <th>Quality</th><th>Store</th><th>Stack</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="total-row">
        <td colspan="3" style="text-align:right">TOTAL</td>
        <td style="text-align:right">${totalQty.toLocaleString()}</td>
        <td colspan="4"></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div class="sig-box">Prepared By<br/><br/><br/>Name &amp; Signature</div>
    <div class="sig-box">Received By<br/><br/><br/>Name &amp; Signature</div>
    <div class="sig-box">Approved By<br/><br/><br/>Name &amp; Signature</div>
  </div>

  <p style="margin-top:24px;font-size:10px;color:#aaa">
    Printed on ${new Date().toLocaleString()} &nbsp;|&nbsp; GRN ID: ${grn.id}
  </p>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        win.print();
        URL.revokeObjectURL(url);
      });
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
  const canConfirm =
    isDraft &&
    can('grns', 'confirm') &&
    (grn.can_confirm === true ||
      (grn.can_confirm === undefined && Boolean(warehouseInScope)));

  const totalQuantity = (grn.grn_items ?? []).reduce((s, i) => s + i.quantity, 0);

  return (
    <Stack gap="md" ref={printRef}>
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
        <Group gap="sm">
          {isDraft && canConfirm && (
            <Button
              leftSection={<IconCheck size={16} />}
              color="green"
              onClick={() => setConfirmModalOpen(true)}
              loading={confirmMutation.isPending}
            >
              Confirm GRN
            </Button>
          )}
          <Button
            leftSection={<IconDownload size={16} />}
            variant="light"
            onClick={handleDownload}
          >
            Download GRN
          </Button>
        </Group>
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
              onClick={() => navigate(`/receipt-orders/${grn.receipt_order_id}`)}
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
              <Text size="sm" c="dimmed">Reference Number</Text>
              <Text fw={600}>{grn.reference_no}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">Warehouse</Text>
              <Text fw={600}>{warehouseLabel}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">Received On</Text>
              <Text fw={600}>{new Date(grn.received_on).toLocaleDateString()}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">Received By</Text>
              <Text fw={600}>{grn.received_by_name || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">Source Type</Text>
              <Text fw={600}>{grn.source_type || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">Source Reference</Text>
              <Text fw={600}>{grn.source_reference || grn.source_id || '-'}</Text>
            </Grid.Col>
            {grn.receipt_order_id && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">Receipt Order</Text>
                <Text fw={600}>RO-{grn.receipt_order_id}</Text>
              </Grid.Col>
            )}
            {grn.approved_by_id && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">Approved By</Text>
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
                    <Table.Th>#</Table.Th>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Line ref / batch</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Unit</Table.Th>
                    <Table.Th>Quality Status</Table.Th>
                    <Table.Th>Store</Table.Th>
                    <Table.Th>Stack</Table.Th>
                    <Table.Th>Expiry</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {grn.grn_items.map((item, index) => (
                    <Table.Tr key={item.id || index}>
                      <Table.Td c="dimmed">{index + 1}</Table.Td>
                      <Table.Td fw={600}>
                        {item.commodity_name || item.commodity_code || item.commodity_id}
                      </Table.Td>
                      <Table.Td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {item.line_reference_no || item.batch_no || '—'}
                      </Table.Td>
                      <Table.Td fw={700}>
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
                        {item.expiry_date ? (
                          <ExpiryBadge expiryDate={item.expiry_date} size="sm" />
                        ) : (
                          <Text c="dimmed" size="sm">-</Text>
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
            <>
              <Divider />
              <Group justify="flex-end" gap="xl">
                <Text size="sm" c="dimmed">Total Items: <Text span fw={700} c="dark">{grn.grn_items.length}</Text></Text>
                <Text size="sm" c="dimmed">Total Quantity: <Text span fw={700} c="dark">{totalQuantity.toLocaleString()}</Text></Text>
              </Group>
            </>
          )}
        </Stack>
      </Card>

      {/* Signature section — visible on screen and in print */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Grid>
          {(['Prepared By', 'Received By', 'Approved By'] as const).map((label) => (
            <Grid.Col key={label} span={{ base: 12, sm: 4 }}>
              <Stack gap="xs">
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">{label}</Text>
                <div style={{ borderBottom: '1px solid #ced4da', height: 40 }} />
                <Text size="xs" c="dimmed">Name &amp; Signature</Text>
              </Stack>
            </Grid.Col>
          ))}
        </Grid>
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
