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
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconTruck, IconX, IconDownload } from '@tabler/icons-react';
import { getGin, confirmGin, driverConfirmGin, cancelGin } from '../../api/gins';
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
import { useAuthStore } from '../../store/authStore';

function GinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const { can } = usePermission();

  const { data: gin, isLoading, error, refetch } = useQuery({
    queryKey: ['gin', id],
    queryFn: () => getGin(Number(id)),
    enabled: !!id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
  });

  const confirmMutation = useMutation({
    mutationFn: confirmGin,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['gin', id] }),
        queryClient.invalidateQueries({ queryKey: ['gins'] }),
        queryClient.invalidateQueries({ queryKey: ['stockBalances'] }),
        queryClient.invalidateQueries({ queryKey: ['reports', 'bin-card'] }),
        queryClient.invalidateQueries({ queryKey: ['stacks'] }),
      ]);
      notifications.show({
        title: 'Success',
        message: 'GIN confirmed successfully',
        color: 'green',
      });
      setConfirmModalOpen(false);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to confirm GIN',
        color: 'red',
      });
    },
  });

  const driverConfirmMutation = useMutation({
    mutationFn: driverConfirmGin,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gin', id] });
      notifications.show({
        title: 'Success',
        message: 'Driver confirmed quantities successfully',
        color: 'green',
      });
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to record driver confirmation',
        color: 'red',
      });
    },
  });

  const discardGinMutation = useMutation({
    mutationFn: cancelGin,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gin', id] });
      await queryClient.invalidateQueries({ queryKey: ['gins'] });
      notifications.show({
        title: 'Discarded',
        message: 'GIN has been discarded',
        color: 'orange',
      });
      setDiscardModalOpen(false);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to discard GIN',
        color: 'red',
      });
    },
  });

  const loggedInUserId = useAuthStore((s) => s.userId);

  const handleConfirm = () => {
    if (id) {
      confirmMutation.mutate(Number(id));
    }
  };

  const handleDriverConfirm = () => {
    if (id && loggedInUserId) {
      driverConfirmMutation.mutate(
        { id: Number(id), payload: { driver_confirmed_by_id: loggedInUserId } } as any,
        // using object config due to the way I exported it
      );
    }
  };

  const handleDiscard = () => {
    if (id) {
      discardGinMutation.mutate(Number(id));
    }
  };

  const handleDownload = () => {
    if (!gin) return;

    const items = gin.gin_items ?? [];
    const issuedDate = gin.issued_on ? new Date(gin.issued_on).toLocaleDateString('en-GB') : '___________';
    const warehouseName = warehouse?.name || String(gin.warehouse_id);

    const filledRows = items.map((item, idx) => `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${item.commodity_name || item.commodity_code || String(item.commodity_id)}</td>
        <td style="text-align:right">${Number(item.quantity).toLocaleString()}</td>
        <td style="text-align:center">${item.unit_abbreviation || item.unit_name || ''}</td>
        <td>${item.store_name || item.store_code || ''}</td>
        <td>${item.stack_name || item.stack_code || ''}</td>
        <td>${item.batch_no || ''}</td>
      </tr>`).join('');

    const emptyRowsCount = Math.max(0, 10 - items.length);
    const emptyRows = Array(emptyRowsCount).fill(0).map(() => `
      <tr>
        <td style="height:20px"></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>GIN ${gin.reference_no}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 16px 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .org-am { font-size: 12px; font-weight: bold; }
    .title-band { text-align: center; margin: 8px 0 4px; }
    .title-am { font-size: 13px; font-weight: bold; }
    .title-en { font-size: 13px; font-weight: bold; letter-spacing: 0.5px; }
    .date-line { text-align: right; font-size: 10px; margin-bottom: 6px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .meta-table td { padding: 2px 4px; font-size: 10px; vertical-align: bottom; }
    .meta-value { border-bottom: 1px solid #000; min-width: 120px; display: inline-block; padding: 0 4px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .items-table th, .items-table td { border: 1px solid #000; padding: 3px 4px; font-size: 10px; text-align: left; }
    .items-table th { background: #f0f0f0; text-align: center; font-size: 9px; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 12px; }
    .sig-block { flex: 1; margin: 0 8px; }
    .sig-block:first-child { margin-left: 0; }
    .sig-block:last-child { margin-right: 0; }
    .sig-line { border-bottom: 1px solid #000; margin-top: 18px; }
    .sig-sub { font-size: 9px; color: #555; margin-top: 2px; }
    .copy-footer { margin-top: 14px; font-size: 9px; border-top: 1px solid #ccc; padding-top: 4px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; }
    @media print { body { padding: 8px 12px; } @page { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="page-header">
    <div>
      <div class="org-am">The Federal Democratic Republic of Ethiopia</div>
      <div class="org-am">DISASTER RISK MANAGEMENT COMMISSION</div>
      <div style="height:4px"></div>
      <div class="org-am">በኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ</div>
      <div class="org-am">የአደጋ ስጋት አመራር ኮሚሽን</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px">No &nbsp;<strong>${gin.reference_no}</strong></div>
    </div>
  </div>

  <div class="title-band">
    <div class="title-am">የምግብና ምግብ ነክ ያልሆኑ ገቢ ደረሰኝ</div>
    <div class="title-en">FOOD &amp; NON FOOD ITEMS ISSUE RECEIPT</div>
  </div>
  <div class="date-line">ቀን፡ &nbsp;<strong>${issuedDate}</strong> &nbsp;&nbsp; Date:</div>

  <table class="meta-table">
    <tr>
      <td width="50%">
        <span style="font-size:10px">የተቀባይ ስም / <strong>Destination</strong>:</span><br/>
        &nbsp;<span class="meta-value">${gin.destination_name || gin.destination_type || ''}</span>
      </td>
      <td width="50%">
        <span style="font-size:10px">የተጫነበት መጋዘን / <strong>Warehouse</strong>:</span><br/>
        &nbsp;<span class="meta-value">${warehouseName}</span>
      </td>
    </tr>
    <tr>
      <td>
        <span style="font-size:10px">የአሽከርካሪው ስም / <strong>Driver Name</strong>:</span><br/>
        &nbsp;<span class="meta-value">${gin.driver_name || '___________'}</span>
      </td>
      <td>
        <span style="font-size:10px">የአጓጓዥ ስም / <strong>Transporter</strong>:</span><br/>
        &nbsp;<span class="meta-value">${gin.transporter_name || gin.transporter_id || '___________'}</span>
      </td>
    </tr>
    <tr>
      <td>
        <span style="font-size:10px">የመኪና ሰሌዳ ቁጥር / <strong>Truck Plate No</strong>:</span><br/>
        &nbsp;<span class="meta-value">${gin.truck_plate_number || '___________'}</span>
      </td>
      <td>
        <span style="font-size:10px">የአሽከርካሪ መታወቂያ / <strong>Driver ID No</strong>:</span><br/>
        &nbsp;<span class="meta-value">${gin.driver_id_number || '___________'}</span>
      </td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width:28px">ተ.ቁ<br/>Item</th>
        <th>የእቃ ዝርዝር<br/>Commodity Type</th>
        <th style="width:50px">መስፈሪያ<br/>Unit</th>
        <th style="width:70px">የተላከው መጠን<br/>Qty Issued</th>
        <th>ጎተራ<br/>Store</th>
        <th>ክምር<br/>Stack</th>
        <th>ባች<br/>Batch</th>
      </tr>
    </thead>
    <tbody>
      ${filledRows}
      ${emptyRows}
    </tbody>
  </table>

  <div style="font-size:10px; margin-top:8px;">
    ተጨማሪ መግለጫ / <strong>Additional Explanation</strong> <span style="border-bottom: 1px solid #000; padding: 0 40px;">${gin.status}</span>
  </div>

  <div class="sig-row">
    <div class="sig-block">
      <div style="font-size:10px">ያወጣው ስም / <strong>Issued by</strong><br/>${gin.issued_by_name || gin.issued_by_id || '___________'}</div>
      <div class="sig-line"></div>
      <div class="sig-sub">ፊርማ / Signature &nbsp;&nbsp;&nbsp; ቀን / Date</div>
    </div>
    <div style="width:40px"></div>
    <div class="sig-block">
      <div style="font-size:10px">የተረከበው ስም / <strong>Received by</strong><br/>${gin.driver_name || '___________'}</div>
      <div class="sig-line"></div>
      <div class="sig-sub">ፊርማ / Signature &nbsp;&nbsp;&nbsp; ቀን / Date</div>
    </div>
  </div>

  <div class="copy-footer">
    <span>Original: Finance / ዋናው፡ ለሂሳብ ክፍል</span>
    <span>2nd Copy: Driver / 2ኛው፡ ለአሽከርካሪ</span>
    <span>3rd Copy: Store man / 3ኛው፡ ለንብረት ኃላፊ</span>
  </div>
  <p style="margin-top:4px;font-size:9px;color:#aaa;text-align:right">
    Printed on ${new Date().toLocaleString()} &nbsp;|&nbsp; GIN ID: ${gin.id}
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
  const isConfirmed = gin.status === DocumentStatus.CONFIRMED;
  const canConfirmGin = can('gins', 'confirm');

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
          <>
            {canConfirmGin && (
              <Button
                leftSection={<IconCheck size={16} />}
                color="green"
                onClick={() => setConfirmModalOpen(true)}
                disabled={!gin.driver_confirmed_at}
                title={!gin.driver_confirmed_at ? "Driver must confirm before finalization" : ""}
              >
                Confirm GIN
              </Button>
            )}
            {canConfirmGin && !gin.driver_confirmed_at && (
              <Button
                leftSection={<IconTruck size={16} />}
                color="blue"
                onClick={handleDriverConfirm}
                loading={driverConfirmMutation.isPending}
              >
                Driver Confirm
              </Button>
            )}
            <Button
              leftSection={<IconX size={16} />}
              color="red"
              variant="outline"
              onClick={() => setDiscardModalOpen(true)}
              loading={discardGinMutation.isPending}
            >
              Discard
            </Button>
          </>
        )}
        {isConfirmed && (
          <Button
            leftSection={<IconDownload size={16} />}
            variant="light"
            onClick={handleDownload}
          >
            Download GIN
          </Button>
        )}
      </Group>

      {gin.dispatch_order_id && gin.dispatch_order && (
        <Card shadow="sm" padding="lg" radius="md" withBorder bg="blue.0">
          <Group justify="space-between">
            <div>
              <Text fw={600} size="sm" c="blue.9">
                Generated from Dispatch Order
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                Order DO-{gin.dispatch_order.id} • {gin.dispatch_order.destination_type}: {gin.dispatch_order.destination_name}
              </Text>
            </div>
            <Button
              variant="light"
              size="sm"
              onClick={() => navigate(`/officer/dispatch-orders/${gin.dispatch_order_id}`)}
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
              <Text fw={600}>{gin.issued_by_name || gin.issued_by_id || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Destination
              </Text>
              <Text fw={600}>{gin.destination_name || gin.destination_type || '-'}</Text>
            </Grid.Col>
            {gin.approved_by_id && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">
                  Approved By
                </Text>
                <Text fw={600}>{gin.approved_by_name || gin.approved_by_id}</Text>
              </Grid.Col>
            )}
          </Grid>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Transporter & Driver Details</Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Transporter
              </Text>
              <Text fw={600}>{gin.transporter_name || gin.transporter_id || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Truck Plate Number
              </Text>
              <Text fw={600}>{gin.truck_plate_number || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Driver Name
              </Text>
              <Text fw={600}>{gin.driver_name || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Driver ID Number
              </Text>
              <Text fw={600}>{gin.driver_id_number || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Driver Phone
              </Text>
              <Text fw={600}>{gin.driver_phone || '-'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="sm" c="dimmed">
                Driver Confirmed At
              </Text>
              {gin.driver_confirmed_at ? (
                <Text fw={600} c="green">
                  {new Date(gin.driver_confirmed_at).toLocaleString()}
                </Text>
              ) : (
                <Text fw={600} c="orange">
                  Pending
                </Text>
              )}
            </Grid.Col>
            {gin.driver_confirmed_by_name && (
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text size="sm" c="dimmed">
                  Driver Confirmation Recorded By
                </Text>
                <Text fw={600}>{gin.driver_confirmed_by_name}</Text>
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
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Unit</Table.Th>
                    <Table.Th>Store</Table.Th>
                    <Table.Th>Stack</Table.Th>
                    <Table.Th>Batch/Expiry</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {gin.gin_items.map((item, index) => (
                    <Table.Tr key={item.id || index}>
                      <Table.Td>{item.commodity_name || item.commodity_code || item.commodity_id}</Table.Td>
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

      <Modal
        opened={discardModalOpen}
        onClose={() => setDiscardModalOpen(false)}
        title="Discard GIN"
      >
        <Text mb="md">
          Are you sure you want to discard this GIN? This action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDiscardModalOpen(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDiscard} loading={discardGinMutation.isPending}>
            Discard
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

export default GinDetailPage;

