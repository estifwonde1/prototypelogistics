import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Stack, Title, Button, Group, Card, Text, Badge, SimpleGrid, Divider, Alert, NumberInput, Textarea } from '@mantine/core';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { IconArrowLeft, IconCheck, IconAlertCircle, IconTruckDelivery, IconExternalLink } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getDispatchOrderAuthorization } from '../../api/dispatchOrderAuthorizations';
import { createGin, driverConfirmGin } from '../../api/gins';
import { getStacks } from '../../api/stacks';
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
  const [qtyLoaded, setQtyLoaded] = useState<number | string>('');
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

  const { data: da, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch_order_authorizations', id],
    queryFn: () => getDispatchOrderAuthorization(Number(id)),
    enabled: !!id,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: stacks = [] } = useQuery({
    queryKey: ['stacks', { store_id: storeId }],
    queryFn: () => getStacks({ store_id: storeId }),
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
      if (!selectedStackId) throw new Error('Please select a stack');
      if (!qtyLoaded || Number(qtyLoaded) <= 0) throw new Error('Invalid quantity');

      return createGin({
        warehouse_id: warehouseId,
        issued_on: new Date().toISOString().split('T')[0],
        issued_by_id: userId ?? 0,
        dispatch_order_authorization_id: da.id,
        reference_no: `GIN-DA${da.id}-${Date.now()}`,
        status: 'draft',
        destination_type: 'Dispatch',
        destination_id: da.dispatch_order_id,
        transporter_id: da.transporter_id,
        truck_plate_number: da.truck_plate_number,
        driver_name: da.driver_name,
        driver_id_number: da.driver_id_number,
        items: [{
          commodity_id: da.commodity_id,
          quantity: Number(qtyLoaded),
          unit_id: da.authorized_quantity_input_unit_id || 1,
          store_id: storeId,
          stack_id: Number(selectedStackId),
          remarks: remarks || undefined,
        }],
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

  const numberOfBags = useMemo(() => {
    if (!qtyLoaded || !commodity?.package_size) return null;
    return Math.ceil(Number(qtyLoaded) / commodity.package_size);
  }, [qtyLoaded, commodity]);

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

  const stackOptions = stacks
  .filter((s)=> s.commodity_id === da.commodity_id)
  .map((s) => ({
    value: String(s.id),
    label: `${s.code} (Bal: ${s.quantity ?? '0'} ${s.unit_abbreviation ?? ''})`
  }));

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
            <DetailField label="Authorized quantity" value={`${da.authorized_quantity}`} />
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

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <SearchableSelect
                  label="Pick from Stack"
                  data={stackOptions}
                  value={selectedStackId}
                  onChange={setSelectedStackId}
                  required
                />
                
                <Stack gap={4}>
                  <NumberInput
                    label="Quantity Loaded"
                    placeholder="Enter quantity"
                    value={qtyLoaded}
                    onChange={setQtyLoaded}
                    min={0.001}
                    decimalScale={3}
                    required
                  />
                  {numberOfBags !== null && (
                    <Text size="xs" c="blue" fw={600}>
                      Calculated Bags/Packages: {numberOfBags}
                    </Text>
                  )}
                </Stack>
              </SimpleGrid>

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
                  disabled={!qtyLoaded || !selectedStackId}
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
