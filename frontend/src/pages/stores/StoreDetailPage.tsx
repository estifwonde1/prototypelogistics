import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Button,
  Group,
  Card,
  Text,
  Grid,
  Badge,
  SimpleGrid,
  RingProgress,
  Tooltip,
  Table,
  ThemeIcon,
  Divider,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconInfoCircle,
  IconBox,
  IconRuler,
  IconUsers,
  IconStack2,
} from '@tabler/icons-react';
import { getStore } from '../../api/stores';
import { getWarehouses } from '../../api/warehouses';
import { getStacks } from '../../api/stacks';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { usePermission } from '../../hooks/usePermission';
import { allocatedStoreMt, storeUsableVolumeM3 } from '../../utils/capacityCalculator';

// ── helpers ──────────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <Text size="sm" c="dimmed">{label}</Text>
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <Text fw={500}>{value ?? '-'}</Text>
      </Grid.Col>
    </>
  );
}

function SectionCard({ title, icon, children }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card withBorder padding="lg" radius="md">
      <Group mb="md" gap="xs">
        <ThemeIcon variant="light" size="md">{icon}</ThemeIcon>
        <Title order={4}>{title}</Title>
      </Group>
      <Divider mb="md" />
      {children}
    </Card>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermission();
  const canEdit = can('stores', 'update');

  const { data: store, isLoading, error, refetch } = useQuery({
    queryKey: ['stores', id],
    queryFn: () => getStore(Number(id)),
    enabled: !!id,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
    enabled: !!store,
  });

  const { data: stacks = [] } = useQuery({
    queryKey: ['stacks', { store_id: Number(id) }],
    queryFn: () => getStacks({ store_id: Number(id) }),
    enabled: !!id,
  });

  if (isLoading) return <LoadingState message="Loading store details..." />;
  if (error || !store) return <ErrorState message="Failed to load store." onRetry={() => refetch()} />;

  const warehouse = warehouses.find((w) => w.id === store.warehouse_id);

  // ── Capacity calculations ─────────────────────────────────────────────────

  const storeArea = store.length * store.width;
  const gangwayArea = store.has_gangway
    ? (store.gangway_length ?? 0) * (store.gangway_width ?? 0)
    : 0;
  const netArea = Math.max(storeArea - gangwayArea, 0);

  const floorAreaM2 = netArea;

  const warehouseUsableVolume = Number(warehouse?.capacity?.usable_volume_m3) || 0;
  const warehouseUsableMt = Number(warehouse?.capacity?.usable_storage_capacity_mt) || 0;
  const storeVolumeM3 = storeUsableVolumeM3(
    store.length,
    store.width,
    store.height,
    gangwayArea
  );
  const proRataMt =
    allocatedStoreMt(storeVolumeM3, warehouseUsableVolume, warehouseUsableMt) ??
    (store.allocated_capacity_mt != null ? Number(store.allocated_capacity_mt) : null);

  // Stack-level area breakdown
  // Allocated = stacks that are active or reserved (footprint l×w)
  // Reserved  = stacks with stack_status === 'Reserved' (placeholder stacks)
  const allocatedArea = stacks
    .filter((s) => s.stack_status === 'active')
    .reduce((sum, s) => sum + s.length * s.width, 0);

  const reservedArea = stacks
    .filter((s) => s.stack_status === 'Reserved')
    .reduce((sum, s) => sum + s.length * s.width, 0);

  const totalAllocatedAndReserved = allocatedArea + reservedArea;

  const availableFromCapacity = Math.max(floorAreaM2 - totalAllocatedAndReserved, 0);

  const occupancyPct = floorAreaM2 > 0
    ? Math.min((totalAllocatedAndReserved / floorAreaM2) * 100, 100)
    : 0;

  const occupancyColor =
    occupancyPct >= 90 ? 'red' : occupancyPct >= 70 ? 'orange' : 'teal';

  return (
    <Stack gap="md">
      {/* ── Header ── */}
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/stores')}
          >
            Back to Stores
          </Button>
          <div>
            <Title order={2}>{store.name}</Title>
            <Text c="dimmed" size="sm">{store.code}</Text>
          </div>
          <Badge color={store.temporary ? 'yellow' : 'blue'} variant="light">
            {store.temporary ? 'Temporary' : 'Permanent'}
          </Badge>
        </Group>
        {canEdit && (
          <Button
            leftSection={<IconEdit size={16} />}
            variant="light"
            onClick={() => navigate(`/stores/${id}/edit`)}
          >
            Edit Store
          </Button>
        )}
      </Group>

      {/* ── Basic Information ── */}
      <SectionCard title="Basic Information" icon={<IconBox size={16} />}>
        <Grid gutter="xs">
          <DetailRow label="Code" value={store.code} />
          <DetailRow label="Name" value={store.name} />
          <DetailRow
            label="Warehouse"
            value={
              warehouse ? (
                <Text
                  fw={500}
                  style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--mantine-color-blue-6)' }}
                  onClick={() => navigate(`/warehouses/${store.warehouse_id}`)}
                >
                  {warehouse.name} ({warehouse.code})
                </Text>
              ) : `ID: ${store.warehouse_id}`
            }
          />
          <DetailRow label="Type" value={store.temporary ? 'Temporary' : 'Permanent'} />
          <DetailRow
            label="Has Gangway"
            value={store.has_gangway ? 'Yes' : 'No'}
          />
          {store.has_gangway && (
            <>
              <DetailRow
                label="Gangway Length"
                value={store.gangway_length ? `${store.gangway_length} m` : '-'}
              />
              <DetailRow
                label="Gangway Width"
                value={store.gangway_width ? `${store.gangway_width} m` : '-'}
              />
            </>
          )}
        </Grid>
      </SectionCard>

      {/* ── Dimensions ── */}
      <SectionCard title="Dimensions" icon={<IconRuler size={16} />}>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Length</Text>
            <Text size="xl" fw={700}>{store.length} <Text span size="sm" c="dimmed">m</Text></Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Width</Text>
            <Text size="xl" fw={700}>{store.width} <Text span size="sm" c="dimmed">m</Text></Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Height</Text>
            <Text size="xl" fw={700}>{store.height} <Text span size="sm" c="dimmed">m</Text></Text>
          </div>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Floor Area</Text>
            <Text size="xl" fw={700}>{storeArea.toFixed(2)} <Text span size="sm" c="dimmed">m²</Text></Text>
          </div>
        </SimpleGrid>
      </SectionCard>

      {/* ── Capacity ── */}
      <SectionCard title="Capacity" icon={<IconStack2 size={16} />}>
        <Group align="flex-start" gap="xl" wrap="wrap">

          {/* Ring chart */}
          <Stack align="center" gap={4}>
            <RingProgress
              size={140}
              thickness={14}
              roundCaps
              sections={[{ value: occupancyPct, color: occupancyColor }]}
              label={
                <Stack gap={0} align="center">
                  <Text fw={700} size="lg">{occupancyPct.toFixed(0)}%</Text>
                  <Text size="xs" c="dimmed">occupied</Text>
                </Stack>
              }
            />
            <Text size="xs" c="dimmed">of floor area</Text>
          </Stack>

          {/* Capacity breakdown */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" style={{ flex: 1 }}>

            <Card withBorder padding="sm" radius="sm">
              <Group gap={4} mb={4}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Floor Area</Text>
                <Tooltip
                  label={`Net store floor (${netArea.toFixed(1)} m²). Warehouse usable % applies at warehouse level only.`}
                  multiline w={260} withArrow
                >
                  <IconInfoCircle size={13} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
                </Tooltip>
              </Group>
              <Text size="xl" fw={700}>{floorAreaM2.toFixed(2)} <Text span size="sm" c="dimmed">m²</Text></Text>
              <Text size="xs" c="dimmed">Net floor (gangway excluded)</Text>
            </Card>

            {proRataMt !== null && (
              <Card withBorder padding="sm" radius="sm">
                <Group gap={4} mb={4}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Est. Capacity</Text>
                  <Tooltip
                    label={`Pro-rata share of warehouse usable MT capacity.\nStore volume (${storeVolumeM3.toFixed(1)} m³) ÷ Warehouse usable (${warehouseUsableVolume.toFixed(1)} m³) × ${warehouseUsableMt.toFixed(1)} MT`}
                    multiline w={280} withArrow
                  >
                    <IconInfoCircle size={13} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
                  </Tooltip>
                </Group>
                <Text size="xl" fw={700}>{proRataMt.toFixed(2)} <Text span size="sm" c="dimmed">MT</Text></Text>
                <Text size="xs" c="dimmed">Pro-rata warehouse share</Text>
              </Card>
            )}

            <Card withBorder padding="sm" radius="sm" bg="blue.0">
              <Group gap={4} mb={4}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Allocated Area</Text>
                <Tooltip label="Floor area occupied by active stacks (goods present)" multiline w={220} withArrow>
                  <IconInfoCircle size={13} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
                </Tooltip>
              </Group>
              <Text size="xl" fw={700} c="blue">{allocatedArea.toFixed(2)} <Text span size="sm" c="dimmed">m²</Text></Text>
              <Text size="xs" c="dimmed">{stacks.filter((s) => s.stack_status === 'active').length} active stack(s)</Text>
            </Card>

            <Card withBorder padding="sm" radius="sm" bg="orange.0">
              <Group gap={4} mb={4}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Reserved Area</Text>
                <Tooltip label="Floor area held by reservation placeholder stacks" multiline w={220} withArrow>
                  <IconInfoCircle size={13} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
                </Tooltip>
              </Group>
              <Text size="xl" fw={700} c="orange">{reservedArea.toFixed(2)} <Text span size="sm" c="dimmed">m²</Text></Text>
              <Text size="xs" c="dimmed">{stacks.filter((s) => s.stack_status === 'Reserved').length} reserved stack(s)</Text>
            </Card>

            <Card withBorder padding="sm" radius="sm" bg="teal.0">
              <Group gap={4} mb={4}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Available Area</Text>
                <Tooltip
                  label={`Floor area (${floorAreaM2.toFixed(1)} m²) − Allocated (${allocatedArea.toFixed(1)} m²) − Reserved (${reservedArea.toFixed(1)} m²)`}
                  multiline w={280} withArrow
                >
                  <IconInfoCircle size={13} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
                </Tooltip>
              </Group>
              <Text size="xl" fw={700} c="teal">{availableFromCapacity.toFixed(2)} <Text span size="sm" c="dimmed">m²</Text></Text>
              <Text size="xs" c="dimmed">Free for new stock</Text>
            </Card>

          </SimpleGrid>
        </Group>
      </SectionCard>

      {/* ── Stacks ── */}
      <SectionCard title={`Stacks (${stacks.length})`} icon={<IconStack2 size={16} />}>
        {stacks.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">No stacks in this store</Text>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Dimensions (L×W×H)</Table.Th>
                  <Table.Th>Footprint (m²)</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {stacks.map((stack) => (
                  <Table.Tr
                    key={stack.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/stacks/${stack.id}/edit`)}
                  >
                    <Table.Td fw={500}>{stack.code || `#${stack.id}`}</Table.Td>
                    <Table.Td>{stack.length}×{stack.width}×{stack.height} m</Table.Td>
                    <Table.Td>{(stack.length * stack.width).toFixed(2)} m²</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          stack.stack_status === 'active' ? 'teal'
                          : stack.stack_status === 'empty' ? 'gray'
                          : 'orange'
                        }
                        variant="light"
                      >
                        {stack.stack_status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{stack.commodity_name || stack.commodity_code || '-'}</Table.Td>
                    <Table.Td>
                      {stack.quantity > 0
                        ? `${stack.quantity} ${stack.unit_abbreviation || stack.unit_name || ''}`
                        : '-'}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      {/* ── Assigned Storekeepers ── */}
      {store.assigned_storekeepers && store.assigned_storekeepers.length > 0 && (
        <SectionCard title="Assigned Storekeepers" icon={<IconUsers size={16} />}>
          <Group gap="sm" wrap="wrap">
            {store.assigned_storekeepers.map((sk) => (
              <Badge key={sk.id} variant="light" color="blue" size="lg">
                {sk.name}
              </Badge>
            ))}
          </Group>
        </SectionCard>
      )}
    </Stack>
  );
}

export default StoreDetailPage;
