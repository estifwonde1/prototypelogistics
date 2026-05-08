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

    const items = grn.grn_items ?? [];
    const receivedDate = grn.received_on ? new Date(grn.received_on).toLocaleDateString('en-GB') : '___________';

    // RA-linked fields (populated when GRN was created via Receipt Authorization flow)
    const transporterName = grn.ra_transporter_name || grn.source_reference || '___________';
    const vehicleNo       = grn.ra_truck_plate_number || '___________';
    const waybillNo       = grn.ra_waybill_number || String(grn.source_reference || '') || '___________';
    const driverName      = grn.ra_driver_name || '___________';
    const supplierDonor   = grn.receipt_order?.source_name || grn.source_type || '___________';
    const warehouseName   = grn.warehouse_name || String(grn.warehouse_id);
    const warehouseNo     = grn.warehouse_code || String(grn.warehouse_id);
    const receivedBy      = grn.received_by_name || 'Store Keeper';
    const approvedBy      = grn.approved_by_name || '___________';

    // Build item rows — 8 empty rows minimum to match the form layout
    const MIN_ROWS = 8;
    const filledRows = items.map((item, idx) => `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td></td>
        <td>${item.commodity_name || item.commodity_code || String(item.commodity_id)}<br/>
            <span style="font-size:9px;color:#555">${item.line_reference_no || item.batch_no || ''}</span></td>
        <td style="text-align:center">${item.unit_abbreviation || item.unit_name || ''}</td>
        <td style="text-align:right">${item.quantity.toLocaleString()}</td>
        <td style="text-align:right">${item.quantity.toLocaleString()}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>`).join('');

    const emptyRows = Array.from({ length: Math.max(0, MIN_ROWS - items.length) })
      .map(() => `<tr>
        <td>&nbsp;</td><td></td><td></td><td></td>
        <td></td><td></td><td></td><td></td>
        <td></td><td></td><td></td>
      </tr>`).join('');

    // Quality grade from first item
    const qualityGrade = items[0]?.quality_status
      ? items[0].quality_status.charAt(0).toUpperCase() + items[0].quality_status.slice(1)
      : '___________';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>GRN ${grn.reference_no}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 16px 20px; }

    /* ── Page header ── */
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .org-am { font-size: 12px; font-weight: bold; }
    .org-en { font-size: 11px; font-weight: bold; }
    .doc-no { font-size: 11px; }
    .doc-no span { font-weight: bold; }

    /* ── Title band ── */
    .title-band { text-align: center; margin: 8px 0 4px; }
    .title-am { font-size: 13px; font-weight: bold; }
    .title-en { font-size: 13px; font-weight: bold; letter-spacing: 0.5px; }
    .date-line { text-align: right; font-size: 10px; margin-bottom: 6px; }

    /* ── Meta fields ── */
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .meta-table td { padding: 2px 4px; font-size: 10px; vertical-align: bottom; }
    .meta-label-am { color: #333; }
    .meta-label-en { font-weight: bold; }
    .meta-value { border-bottom: 1px solid #000; min-width: 120px; display: inline-block; padding: 0 4px; }

    /* ── Source checkboxes ── */
    .source-row { display: flex; gap: 12px; font-size: 10px; margin: 4px 0 6px; flex-wrap: wrap; }
    .source-item { display: flex; align-items: center; gap: 3px; }
    .cb { width: 10px; height: 10px; border: 1px solid #000; display: inline-block; }

    /* ── Items table ── */
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .items-table th, .items-table td {
      border: 1px solid #000; padding: 3px 4px; font-size: 10px; text-align: left;
    }
    .items-table th { background: #f0f0f0; text-align: center; font-size: 9px; }
    .items-table .num { text-align: center; }
    .items-table .right { text-align: right; }

    /* ── Additional explanation ── */
    .additional { font-size: 10px; margin: 4px 0; }

    /* ── Quality ── */
    .quality { font-size: 10px; margin: 4px 0; }

    /* ── Signatures ── */
    .sig-section { margin-top: 16px; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 12px; }
    .sig-block { flex: 1; margin: 0 8px; }
    .sig-block:first-child { margin-left: 0; }
    .sig-block:last-child { margin-right: 0; }
    .sig-label-am { font-size: 10px; color: #333; }
    .sig-label-en { font-size: 10px; font-weight: bold; }
    .sig-name { font-size: 10px; margin-top: 2px; }
    .sig-line { border-bottom: 1px solid #000; margin-top: 18px; }
    .sig-sub { font-size: 9px; color: #555; margin-top: 2px; }

    /* ── Copy footer ── */
    .copy-footer { margin-top: 14px; font-size: 9px; border-top: 1px solid #ccc; padding-top: 4px;
                   display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; }

    @media print {
      body { padding: 8px 12px; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>

  <!-- ── Page header ── -->
  <div class="page-header">
    <div>
      <div class="org-am">The Federal Democratic Republic of Ethiopia</div>
      <div class="org-am">DISASTER RISK MANAGEMENT COMMISSION</div>
      <div style="height:4px"></div>
      <div class="org-am">በኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ</div>
      <div class="org-am">የአደጋ ስጋት አመራር ኮሚሽን</div>
    </div>
    <div style="text-align:right">
      <div class="doc-no">No &nbsp;<span>${grn.reference_no}</span></div>
    </div>
  </div>

  <!-- ── Title ── -->
  <div class="title-band">
    <div class="title-am">የምግብና ምግብ ነክ ያልሆኑ ገቢ ደረሰኝ</div>
    <div class="title-en">FOOD &amp; NON FOOD ITEMS RECEIVING RECEIPT</div>
  </div>
  <div class="date-line">ቀን፡ &nbsp;<span style="font-weight:bold">${receivedDate}</span> &nbsp;&nbsp; Date:</div>

  <!-- ── Meta fields ── -->
  <table class="meta-table">
    <tr>
      <td width="50%">
        <span class="meta-label-am">የሻጭ ነጋዴ/በጎ አድራጊ ስም፡</span><br/>
        <span class="meta-label-en">Supplier/Donor</span>
        &nbsp;<span class="meta-value">${supplierDonor}</span>
      </td>
      <td width="50%">
        <span class="meta-label-am">ላኪው፡</span><br/>
        <span class="meta-label-en">Shipped by</span>
        &nbsp;<span class="meta-value">${supplierDonor}</span>
      </td>
    </tr>
    <tr>
      <td>
        <span class="meta-label-am">ያጓጓዘው ስም፡</span><br/>
        <span class="meta-label-en">Transported by</span>
        &nbsp;<span class="meta-value">${transporterName}</span>
      </td>
      <td>
        <span class="meta-label-am">የማጓጓዣው ቁጥር፡</span><br/>
        <span class="meta-label-en">Vehicle/Wagon/Flight No</span>
        &nbsp;<span class="meta-value">${vehicleNo}</span>
      </td>
    </tr>
    <tr>
      <td>
        <span class="meta-label-am">መጋዘኑ የሚገኝበት ስፍራ፡</span><br/>
        <span class="meta-label-en">Location of Warehouse</span>
        &nbsp;<span class="meta-value">${warehouseName}</span>
      </td>
      <td>
        <span class="meta-label-am">የመጋዘን ቁጥር፡</span><br/>
        <span class="meta-label-en">W.H.No</span>
        &nbsp;<span class="meta-value">${warehouseNo}</span>
      </td>
    </tr>
    <tr>
      <td>
        <span class="meta-label-am">የመላኪያ ሰ/ቁ፡</span><br/>
        <span class="meta-label-en">W.Bil/D.O.No.</span>
        &nbsp;<span class="meta-value">${waybillNo}</span>
      </td>
      <td>
        <span class="meta-label-am">የፋክቱር ቁጥር፡</span><br/>
        <span class="meta-label-en">Invoice No.</span>
        &nbsp;<span class="meta-value">___________</span>
      </td>
    </tr>
    <tr>
      <td>
        <span class="meta-label-am">ያዘዘው ክፍል፡</span><br/>
        <span class="meta-label-en">Requested by</span>
        &nbsp;<span class="meta-value">${receivedBy}</span>
      </td>
      <td>
        <span class="meta-label-am">የምድር ሚዛን ቲኬት ቁጥር፡</span><br/>
        <span class="meta-label-en">Weight Bridge Ticket No.</span>
        &nbsp;<span class="meta-value">___________</span>
      </td>
    </tr>
  </table>

  <!-- ── Source checkboxes ── -->
  <div class="source-row">
    <span style="font-weight:bold;font-size:10px">የገቢው ምንጭ / Source</span>
    <span class="source-item"><span class="cb"></span> በግዢ / Purchase</span>
    <span class="source-item"><span class="cb"></span> በብድር / Loan</span>
    <span class="source-item"><span class="cb"></span> ተመላሽ / Return</span>
    <span class="source-item"><span class="cb"></span> በአደራ / Custody</span>
    <span class="source-item"><span class="cb"></span> በዕርዳታ / Aid</span>
    <span class="source-item"><span class="cb"></span> በሌላ / Other</span>
    <span class="source-item"><span class="cb"></span> በዝውውር / Transfer</span>
    <span class="source-item"><span class="cb"></span> ፍሳሽ/ትርፍ / Surplus</span>
    <span class="source-item"><span class="cb"></span> በልውውጥ / Exchange</span>
  </div>

  <!-- ── Items table ── -->
  <table class="items-table">
    <thead>
      <tr>
        <th rowspan="2" style="width:28px">ተ.ቁ<br/>Item</th>
        <th rowspan="2">የመለያ ቁጥር<br/>Part No.</th>
        <th rowspan="2">የዕቃ ዝርዝር<br/>Commodity Type</th>
        <th rowspan="2" style="width:36px">መስፈሪያ<br/>Unit</th>
        <th rowspan="2" style="width:60px">የተላከው<br/>Qty Delivered</th>
        <th rowspan="2" style="width:60px">የተረከበው<br/>Qty Accepted</th>
        <th colspan="4">ያንዱ ዋጋ / Unit Price</th>
        <th rowspan="2">ጠቅላላ ዋጋ<br/>Total Price</th>
      </tr>
      <tr>
        <th>በአሀዝ</th><th>በፊደል</th><th></th><th></th>
      </tr>
    </thead>
    <tbody>
      ${filledRows}
      ${emptyRows}
    </tbody>
  </table>

  <!-- ── Additional explanation ── -->
  <div class="additional">
    <strong>ተጨማሪ መግለጫ፡- Additional Explanation</strong> &nbsp;
    የመያዣው ዓይነት / Container Type: _____________________ &nbsp;&nbsp;
    የመያዣው ቁጥር / Number of Containers: _____________________ &nbsp;&nbsp;
    በግሮስ / Gross: _____________________ &nbsp;&nbsp;
    በንጥር / Net: _____________________
  </div>

  <!-- ── Quality ── -->
  <div class="quality">
    <strong>የጥራት ሁኔታ መግለጫ / Quality condition:</strong> &nbsp;
    <span style="border-bottom:1px solid #000;padding:0 40px">${qualityGrade}</span>
  </div>

  <!-- ── Signatures ── -->
  <div class="sig-section">
    <div class="sig-row">
      <div class="sig-block">
        <div class="sig-label-am">ያዘጋጁ ስም</div>
        <div class="sig-label-en">Prepared by</div>
        <div class="sig-name">${receivedBy}</div>
        <div class="sig-line"></div>
        <div class="sig-sub">ፊርማ / Signature &nbsp;&nbsp;&nbsp; ቀን / Date</div>
      </div>
    </div>

    <div class="sig-row" style="margin-top:20px">
      <div class="sig-block">
        <div class="sig-label-am">የአስረካቢው ስም</div>
        <div class="sig-label-en">Delivered by</div>
        <div class="sig-name">${driverName}</div>
        <div class="sig-line"></div>
        <div class="sig-sub">ፊርማ / Signature &nbsp;&nbsp;&nbsp; ቀን / Date</div>
      </div>
      <div style="width:40px"></div>
      <div class="sig-block">
        <div class="sig-label-am">የተረካቢው ስም</div>
        <div class="sig-label-en">Recipient</div>
        <div class="sig-name">${receivedBy}</div>
        <div class="sig-line"></div>
        <div class="sig-sub">ፊርማ / Signature &nbsp;&nbsp;&nbsp; ቀን / Date</div>
      </div>
    </div>
  </div>

  <!-- ── Copy footer ── -->
  <div class="copy-footer">
    <span>Original: Finance / ዋናው፡ ለሂሳብ ክፍል</span>
    <span>2nd Copy: Deliverer / 2ኛው: ለአስረካቢ</span>
    <span>3rd Copy: Procurement / 3ኛው: ለዕቃ ግዢ</span>
    <span>4th Copy: Registration / 4ኛው: ለክምችት ን/ምዝገባ</span>
    <span>5th Copy: Store man / 5ኛው: ለመጋዘን ኃላፊው</span>
    <span>6th Copy: Clerk / 6ኛው: ለፀሐፊ</span>
  </div>

  <p style="margin-top:8px;font-size:9px;color:#aaa;text-align:right">
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
