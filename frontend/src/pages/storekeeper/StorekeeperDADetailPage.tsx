import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Stack, Title, Button, Group, Card, Text, Badge, SimpleGrid, Divider, Alert, NumberInput, Textarea, ActionIcon } from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { IconArrowLeft, IconCheck, IconAlertCircle, IconTruckDelivery, IconExternalLink, IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getDispatchOrderAuthorization } from '../../api/dispatchOrderAuthorizations';
import { createGin, driverConfirmGin } from '../../api/gins';
import { getStockBalances } from '../../api/stockBalances';
import { getCommodityReferences } from '../../api/referenceData';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuthStore } from '../../store/authStore';
import type { ApiError } from '../../types/common';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={500} tt="uppercase">{label}</Text>
      <Text size="sm">{value ?? '—'}</Text>
    </Stack>
  );
}

export default function StorekeeperDADetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeAssignment = useAuthStore((s) => s.activeAssignment);
  const userId = useAuthStore((s) => s.userId);
  const storeId = activeAssignment?.store?.id;

  const [showRecordingForm, setShowRecordingForm] = useState(false);
  
  interface LoadingLine {
    id: string;
    stackId: string | null;
    inventoryLotId: string | null;
    quantity: number | string;
  }
  const [loadingLines, setLoadingLines] = useState<LoadingLine[]>([
    { id: crypto.randomUUID(), stackId: null, inventoryLotId: null, quantity: '' }
  ]);
  
  const [remarks, setRemarks] = useState('');

  const { data: da, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_order_authorizations', id],
    queryFn: () => getDispatchOrderAuthorization(Number(id)),
    enabled: !!id,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: stockBalances = [] } = useQuery({
    queryKey: ['stock_balances', { store_id: storeId }],
    queryFn: () => getStockBalances({ store_id: storeId }),
    enabled: !!storeId,
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ['commodities'],
    queryFn: getCommodityReferences,
  });

  const recordLoadingMutation = useMutation({
    mutationFn: () => {
      if (!da) throw new Error('No DA loaded');
      const warehouseId = activeAssignment?.warehouse?.id ?? da.warehouse_id;
      if (!warehouseId) throw new Error('Cannot determine warehouse');
      const totalLoaded = loadingLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
      if (totalLoaded <= 0) throw new Error('Total quantity must be greater than zero');
      const maxQty = da.authorized_quantity_input != null && da.authorized_quantity_input > 0 ? da.authorized_quantity_input : da.authorized_quantity;
      if (totalLoaded > maxQty) throw new Error(`Cannot exceed authorized quantity of ${maxQty}`);

      const items = loadingLines.map((line) => {
        if (!line.inventoryLotId) throw new Error('Please select a batch for all lines');
        if (!line.quantity || Number(line.quantity) <= 0) throw new Error('Invalid quantity on a line');
        
        // Find ANY stock balance row for this lot to get the commodity_id and stack
        // lotValue is the lotKey which may be the inventory_lot_id or 'no-lot-{commodity_id}'
        const isRealLot = !line.inventoryLotId?.startsWith('no-lot-');
        const sb = isRealLot
          ? stockBalances.find(s => String(s.inventory_lot_id) === line.inventoryLotId)
          : stockBalances.find(s => !s.inventory_lot_id && String(s.commodity_id) === line.inventoryLotId?.replace('no-lot-', ''));
        const batchCommodityId = sb ? sb.commodity_id : da.commodity_id;
        
        return {
          commodity_id: batchCommodityId,
          quantity: Number(line.quantity),
          unit_id: da.authorized_quantity_input_unit_id || 1,
          store_id: storeId,
          stack_id: sb?.stack_id ? Number(sb.stack_id) : undefined,
          inventory_lot_id: isRealLot && line.inventoryLotId ? Number(line.inventoryLotId) : undefined,
          remarks: remarks || undefined,
        };
      });

      return createGin({
        warehouse_id: warehouseId,
        issued_on: new Date().toISOString().split('T')[0],
        issued_by_id: userId ?? 0,
        dispatch_order_authorization_id: da.id,
        reference_no: `GIN-DA${da.id}-${Date.now()}`,
        status: 'draft',
        truck_plate_number: da.truck_plate_number,
        transporter_id: da.transporter_id,
        driver_name: da.driver_name,
        driver_id_number: da.driver_id_number,
        items,
      } as any);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['dispatch_order_authorizations', id] });
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations'] });
      notifications.show({
        title: 'Loading recorded',
        message: 'Loading saved. You can now confirm driver delivery.',
        color: 'green',
      });
      setShowRecordingForm(false);
      refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
        (err instanceof Error ? err.message : 'Failed to save loading.');
      notifications.show({ title: 'Error', message: msg, color: 'red', autoClose: 8000 });
    },
  });

  const driverConfirmMutation = useMutation({
    mutationFn: (ginId: number) => driverConfirmGin(ginId, { driver_confirmed_by_id: userId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_order_authorizations'] });
      notifications.show({
        title: 'Driver Confirmed',
        message: 'Driver delivery confirmed. Stock has been deducted.',
        color: 'green',
      });
      refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
        'Failed to confirm driver delivery.';
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    },
  });

  const commodity = useMemo(() => {
    return commodities.find(c => c.id === da?.commodity_id);
  }, [commodities, da?.commodity_id]);

  const totalQtyLoaded = useMemo(() => {
    return loadingLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  }, [loadingLines]);

  const numberOfBags = useMemo(() => {
    if (totalQtyLoaded <= 0 || !commodity?.package_size) return null;
    return Math.ceil(totalQtyLoaded / commodity.package_size);
  }, [totalQtyLoaded, commodity]);

  const batchOptions = useMemo(() => {
    // Filter to only rows that belong to the same commodity category as the DA
    // Falls back to matching by commodity_id if category_id not yet loaded
    const relevant = stockBalances.filter((sb) => {
      if (da?.commodity_category_id && sb.commodity_category_id) {
        return sb.commodity_category_id === da.commodity_category_id;
      }
      // Fallback: match by the exact commodity_id on the DA
      return sb.commodity_id === da?.commodity_id;
    });

    // Group by inventory_lot_id (each unique batch), and SUM the quantities
    // across all stack rows that belong to the same lot
    const lotMap: Record<string, {
      lotId: string;
      batchStr: string;
      expiryRaw: string | null;
      totalQty: number;
      unit: string;
      stackIds: Set<string>;
    }> = {};

    relevant.forEach((sb) => {
      const lotKey = String(sb.inventory_lot_id || `no-lot-${sb.commodity_id}`);
      const qty = sb.base_quantity != null ? Number(sb.base_quantity) : Number(sb.quantity || 0);

      if (!lotMap[lotKey]) {
        lotMap[lotKey] = {
          lotId: lotKey, // use lotKey as value — always unique, never empty string
          batchStr: sb.lot_batch_no || sb.batch_no || sb.commodity_batch_no || 'No batch #',
          expiryRaw: sb.lot_expiry_date || sb.expiry_date || null,
          totalQty: 0,
          unit: sb.base_unit_name || sb.unit_abbreviation || 'mt',
          stackIds: new Set(),
        };
      }
      lotMap[lotKey].totalQty += qty;
      if (sb.stack_id) lotMap[lotKey].stackIds.add(String(sb.stack_id));
    });

    // Only show lots with positive total quantity
    return Object.values(lotMap)
      .filter(lot => lot.totalQty > 0)
      .sort((a, b) => {
        // Sort expiring soonest first
        if (a.expiryRaw && b.expiryRaw) return a.expiryRaw.localeCompare(b.expiryRaw);
        if (a.expiryRaw) return -1;
        if (b.expiryRaw) return 1;
        return a.batchStr.localeCompare(b.batchStr);
      })
      .map((lot) => {
        const expiryStr = lot.expiryRaw
          ? ` — Exp: ${new Date(lot.expiryRaw).toLocaleDateString()}`
          : '';
        const balStr = `${lot.totalQty.toLocaleString()} ${lot.unit}`;
        return {
          value: lot.lotId,
          label: `${lot.batchStr}${expiryStr} (Bal: ${balStr})`,
        };
      });
  }, [stockBalances, da?.commodity_category_id, da?.commodity_id]);

  if (isLoading) return <LoadingState message="Loading Dispatch Authorization..." />;
  if (error || !da) return <ErrorState message="Failed to load Dispatch Authorization." onRetry={refetch} />;

  const myGin = da.my_gin;
  const isDraftGin = myGin?.status?.toLowerCase() === 'draft';
  const isConfirmedGin = myGin?.status?.toLowerCase() === 'confirmed';

  // Debug logging
  console.log('[DEBUG] DA Detail Page State:', {
    daId: da.id,
    hasMyGin: !!myGin,
    myGinStatus: myGin?.status,
    myGinStatusLower: myGin?.status?.toLowerCase(),
    isDraftGin,
    isConfirmedGin,
    myGinId: myGin?.id,
    myGinIssuedById: myGin?.issued_by_id,
    currentUserId: userId,
    myGinDispatchAuthId: (myGin as any)?.dispatch_order_authorization_id
  });


  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap">
        <Group>
          <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Title order={2}>Record Loading</Title>
        </Group>
      </Group>

      {isDraftGin && (
        <Alert icon={<IconTruckDelivery size={16} />} color="blue" variant="light" title="Action Required">
          Loading recorded. Confirm driver delivery to finalize and deduct stock.
        </Alert>
      )}

      <Card withBorder padding="lg">
        <Stack gap="md">
          <Title order={4}>Truck Details</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <DetailField label="Reference" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{da.reference_no}</Text>} />
            <DetailField label="Date" value={formatDate(da.created_at)} />
            <DetailField label="Authorized quantity" value={
              da.authorized_quantity_input != null && da.authorized_quantity_input > 0
                ? `${da.authorized_quantity_input} ${da.authorized_quantity_input_unit_abbreviation || da.authorized_quantity_input_unit_name || ''}`
                : `${da.authorized_quantity} ${da.authorized_quantity_input_unit_abbreviation || da.authorized_quantity_input_unit_name || 'mt'}`
            } />
            <DetailField label="Commodity" value={da.commodity_name || '—'} />
          </SimpleGrid>

          <Divider label="Vehicle & Driver" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <DetailField label="Driver Name" value={da.driver_name} />
            <DetailField label="Driver ID" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{da.driver_id_number}</Text>} />
            <DetailField label="Plate Number" value={<Text size="sm" style={{ fontFamily: 'monospace' }}>{da.truck_plate_number}</Text>} />
          </SimpleGrid>
        </Stack>
      </Card>

      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>Record Loading</Title>
            {!myGin && (
              <Button
                size="sm"
                onClick={() => setShowRecordingForm((v) => !v)}
                variant={showRecordingForm ? 'light' : 'filled'}
              >
                {showRecordingForm ? 'Cancel' : 'Pick from Stack'}
              </Button>
            )}
          </Group>

          {myGin ? (
            <Group gap="md" align="center">
              <Badge color="green" variant="light" leftSection={<IconCheck size={12} />} size="md">
                Loading recorded
              </Badge>
              <Text size="sm" c="dimmed">
                You loaded {myGin.gin_items?.[0]?.quantity} from Stack #{myGin.gin_items?.[0]?.stack_id}
              </Text>
            </Group>
          ) : showRecordingForm ? (
            <Stack gap="md" mt="xs">
              <Divider label="Select stack and enter loaded quantity" labelPosition="left" />

              <Divider label="Select batches and enter loaded quantities" labelPosition="left" />

              <Stack gap="sm">
                {loadingLines.map((line, index) => (
                  <Group key={line.id} align="flex-start" wrap="nowrap">
                    <SearchableSelect
                      placeholder="Select a batch..."
                      data={batchOptions}
                      value={line.inventoryLotId || null}
                      onChange={(val) => {
                        const newLines = [...loadingLines];
                        newLines[index].inventoryLotId = val || null;
                        newLines[index].stackId = val || null; // keep in sync so validation passes
                        setLoadingLines(newLines);
                      }}
                      style={{ flex: 1 }}
                      required
                    />
                    
                    <NumberInput
                      placeholder={`Qty (${da.authorized_quantity_input_unit_abbreviation || ''})`}
                      value={line.quantity}
                      onChange={(val) => {
                        const newLines = [...loadingLines];
                        newLines[index].quantity = val;
                        setLoadingLines(newLines);
                      }}
                      min={0.001}
                      decimalScale={3}
                      style={{ width: 140 }}
                      required
                    />
                    
                    <ActionIcon 
                      color="red" 
                      variant="subtle" 
                      onClick={() => {
                        if (loadingLines.length > 1) {
                          setLoadingLines(loadingLines.filter(l => l.id !== line.id));
                        } else {
                          setLoadingLines([{ id: crypto.randomUUID(), stackId: null, inventoryLotId: null, quantity: '' }]);
                        }
                      }}
                      style={{ marginTop: 4 }}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                ))}
                
                <Group justify="space-between" align="flex-end" mt="xs">
                  <Button 
                    variant="subtle" 
                    size="xs" 
                    leftSection={<IconPlus size={14} />}
                    onClick={() => setLoadingLines([...loadingLines, { id: crypto.randomUUID(), stackId: null, inventoryLotId: null, quantity: '' }])}
                  >
                    Add another batch
                  </Button>
                  <Stack gap={0} align="flex-end">
                    <Text size="sm" fw={600}>Total: {totalQtyLoaded} / {da.authorized_quantity_input != null && da.authorized_quantity_input > 0 ? da.authorized_quantity_input : da.authorized_quantity} {da.authorized_quantity_input_unit_abbreviation || ''}</Text>
                    {numberOfBags !== null && (
                      <Text size="xs" c="blue" fw={600}>
                        Calculated Bags/Packages: {numberOfBags}
                      </Text>
                    )}
                  </Stack>
                </Group>
                {totalQtyLoaded > (da.authorized_quantity_input != null && da.authorized_quantity_input > 0 ? da.authorized_quantity_input : da.authorized_quantity) && (
                  <Text size="sm" c="red" ta="right">Total exceeds authorized quantity!</Text>
                )}
              </Stack>

              <Textarea
                label="Remarks (optional)"
                placeholder="Any notes about the loading..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />

              <Group justify="flex-end">
                <Button variant="light" onClick={() => setShowRecordingForm(false)}>Cancel</Button>
                <Button
                  onClick={() => recordLoadingMutation.mutate()}
                  loading={recordLoadingMutation.isPending}
                  disabled={totalQtyLoaded <= 0 || loadingLines.some(l => !l.stackId || !l.quantity) || totalQtyLoaded > (da.authorized_quantity_input != null && da.authorized_quantity_input > 0 ? da.authorized_quantity_input : da.authorized_quantity)}
                >
                  Save Loading
                </Button>
              </Group>
            </Stack>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="gray" variant="light">
              Click "Pick from Stack" to record what is being loaded onto the truck.
            </Alert>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>Driver Confirmation</Title>
            <Badge
              color={isConfirmedGin ? 'green' : isDraftGin ? 'blue' : 'yellow'}
              variant="light"
              size="md"
            >
              {isConfirmedGin ? 'Confirmed' : isDraftGin ? 'Ready to Confirm' : 'Pending Loading'}
            </Badge>
          </Group>
          
          {isConfirmedGin ? (
            <Text size="sm" c="dimmed">Driver confirmed. Stock has been deducted.</Text>
          ) : isDraftGin ? (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Loading recorded. Confirm driver delivery to finalize and deduct stock from your bin cards.
              </Text>
              <Group justify="flex-end">
                <Button
                  color="green"
                  leftSection={<IconTruckDelivery size={16} />}
                  onClick={() => driverConfirmMutation.mutate(myGin.id)}
                  loading={driverConfirmMutation.isPending}
                >
                  Driver Confirmed Delivery
                </Button>
              </Group>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              Record the loading first, then confirm driver delivery.
            </Text>
          )}
        </Stack>
      </Card>

      {myGin && (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={4}>Goods Issue Note (GIN)</Title>
            <Stack gap="md">
              <Group>
                <Text size="sm" style={{ fontFamily: 'monospace' }} fw={600}>
                  {myGin.reference_no}
                </Text>
                <Badge color={isConfirmedGin ? 'green' : 'blue'} variant="light">
                  {isConfirmedGin ? 'Confirmed' : 'Draft'}
                </Badge>
              </Group>
              <Group>
                <Button
                  variant="filled"
                  color="cyan"
                  size="md"
                  rightSection={<IconExternalLink size={16} />}
                  onClick={() => navigate(`/gins/${myGin.id}?returnTo=/storekeeper/dispatch-authorizations/${da.id}`)}
                >
                  View Printable GIN
                </Button>
              </Group>
            </Stack>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
