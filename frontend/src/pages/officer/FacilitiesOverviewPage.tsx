import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Card,
  Table,
  Badge,
  Group,
  Text,
  Loader,
  Center,
  Alert,
  ActionIcon,
  Progress,
  SimpleGrid,
  Tooltip,
  Divider,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconBuilding,
  IconBuildingWarehouse,
  IconChevronDown,
  IconChevronRight,
  IconBox,
  IconInfoCircle,
} from '@tabler/icons-react';
import { getHubs } from '../../api/hubs';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import type { Hub } from '../../types/hub';
import type { Warehouse } from '../../types/warehouse';
import type { Store } from '../../types/store';

// ── helpers ──────────────────────────────────────────────────────────────────
// usable_space = total volume of the store (set by model callback: l×w×h)
// available_space = what's still free (decremented as stock is added)
// used = usable - available
const storeUsed  = (s: Store) => s.usable_space - s.available_space;
const storeFree  = (s: Store) => s.available_space;
const storeTotal = (s: Store) => s.usable_space;

const sumUsed  = (ss: Store[]) => ss.reduce((a, s) => a + storeUsed(s),  0);
const sumFree  = (ss: Store[]) => ss.reduce((a, s) => a + storeFree(s),  0);
const sumTotal = (ss: Store[]) => ss.reduce((a, s) => a + storeTotal(s), 0);

const pct = (used: number, total: number) =>
  total > 0 ? (used / total) * 100 : 0;

const pctColor = (p: number) =>
  p > 90 ? 'red' : p > 70 ? 'orange' : p > 40 ? 'yellow' : 'green';

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

// ── Store detail row (inside expanded warehouse) ──────────────────────────────
function StoreRow({ store }: { store: Store }) {
  const used  = storeUsed(store);
  const free  = storeFree(store);
  const total = storeTotal(store);
  const p     = pct(used, total);

  return (
    <Table.Tr style={{ background: 'var(--mantine-color-gray-1)' }}>
      <Table.Td pl={72}>
        <Group gap={6}>
          <IconBox size={13} color="var(--mantine-color-gray-5)" />
          <Text size="xs" c="dimmed">{store.name}{store.code ? ` (${store.code})` : ''}</Text>
        </Group>
      </Table.Td>
      <Table.Td />
      <Table.Td />
      <Table.Td>
        <Text size="xs" c="dimmed">store</Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">—</Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs">{fmt(total)} m³</Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c={used > 0 ? 'blue' : 'dimmed'}>{used > 0 ? `${fmt(used)} m³` : '0'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs" fw={600} c="green">{fmt(free)} m³</Text>
      </Table.Td>
      <Table.Td>
        {total > 0 ? (
          <Group gap={4} wrap="nowrap">
            <Progress value={p} color={pctColor(p)} size="xs" style={{ flex: 1, minWidth: 50 }} />
            <Text size="xs" c={pctColor(p)}>{p.toFixed(0)}%</Text>
          </Group>
        ) : <Text size="xs" c="dimmed">—</Text>}
      </Table.Td>
    </Table.Tr>
  );
}

// ── Warehouse row (inside expanded hub) ──────────────────────────────────────
function WarehouseRow({ warehouse, stores }: { warehouse: Warehouse; stores: Store[] }) {
  const [open, setOpen] = useState(false);
  const whStores = stores.filter((s) => s.warehouse_id === warehouse.id);
  const total    = sumTotal(whStores);
  const used     = sumUsed(whStores);
  const free     = sumFree(whStores);
  const p        = pct(used, total);
  const capacityMt = warehouse.capacity?.total_storage_capacity_mt ?? 0;

  return (
    <>
      <Table.Tr
        style={{ background: 'var(--mantine-color-gray-0)', cursor: 'pointer' }}
        onClick={() => setOpen((o) => !o)}
      >
        <Table.Td pl={40}>
          <Group gap={6}>
            <ActionIcon variant="subtle" size="xs" color="gray">
              {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
            </ActionIcon>
            <IconBuildingWarehouse size={14} color="var(--mantine-color-cyan-6)" />
            <Text size="sm">{warehouse.name}</Text>
          </Group>
        </Table.Td>
        <Table.Td><Text size="sm" c="dimmed">{warehouse.code || '—'}</Text></Table.Td>
        <Table.Td><Text size="sm" c="dimmed">{warehouse.location_name || '—'}</Text></Table.Td>
        <Table.Td>
          <Badge variant="light" color="cyan" size="sm">{whStores.length} stores</Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{capacityMt > 0 ? `${fmt(capacityMt)} MT` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{total > 0 ? `${fmt(total)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c={used > 0 ? 'blue' : 'dimmed'}>{total > 0 ? (used > 0 ? `${fmt(used)} m³` : '0') : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={600} c="green">{total > 0 ? `${fmt(free)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          {total > 0 ? (
            <Group gap={6} wrap="nowrap">
              <Progress value={p} color={pctColor(p)} size="sm" style={{ flex: 1, minWidth: 60 }} />
              <Text size="xs" c={pctColor(p)}>{p.toFixed(0)}%</Text>
            </Group>
          ) : <Text size="sm" c="dimmed">—</Text>}
        </Table.Td>
      </Table.Tr>

      {open && whStores.map((s) => <StoreRow key={s.id} store={s} />)}
      {open && whStores.length === 0 && (
        <Table.Tr style={{ background: 'var(--mantine-color-gray-1)' }}>
          <Table.Td colSpan={9} pl={72}>
            <Text size="xs" c="dimmed">No stores configured in this warehouse</Text>
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

// ── Hub row ───────────────────────────────────────────────────────────────────
function HubRow({ hub, warehouses, stores }: { hub: Hub; warehouses: Warehouse[]; stores: Store[] }) {
  const [open, setOpen] = useState(false);
  const hubWarehouses = warehouses.filter((w) => w.hub_id === hub.id);
  const hubStores     = stores.filter((s) => hubWarehouses.some((w) => w.id === s.warehouse_id));
  const total         = sumTotal(hubStores);
  const used          = sumUsed(hubStores);
  const free          = sumFree(hubStores);
  const p             = pct(used, total);
  const capacityMt    = hub.capacity?.total_capacity_mt ?? 0;

  return (
    <>
      <Table.Tr style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <Table.Td>
          <Group gap={8}>
            <ActionIcon variant="subtle" size="xs" color="gray">
              {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </ActionIcon>
            <IconBuilding size={16} color="var(--mantine-color-blue-6)" />
            <Text fw={600} size="sm">{hub.name}</Text>
          </Group>
        </Table.Td>
        <Table.Td><Text size="sm">{hub.code || '—'}</Text></Table.Td>
        <Table.Td><Text size="sm">{hub.location_name || '—'}</Text></Table.Td>
        <Table.Td>
          <Badge variant="light" color="blue" size="sm">{hubWarehouses.length} warehouses</Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{capacityMt > 0 ? `${fmt(capacityMt)} MT` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={500}>{total > 0 ? `${fmt(total)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c={used > 0 ? 'blue' : 'dimmed'}>{total > 0 ? (used > 0 ? `${fmt(used)} m³` : '0') : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={600} c="green">{total > 0 ? `${fmt(free)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          {total > 0 ? (
            <Group gap={6} wrap="nowrap">
              <Progress value={p} color={pctColor(p)} size="sm" style={{ flex: 1, minWidth: 60 }} />
              <Text size="xs" c={pctColor(p)}>{p.toFixed(0)}%</Text>
            </Group>
          ) : <Text size="sm" c="dimmed">—</Text>}
        </Table.Td>
      </Table.Tr>

      {open && hubWarehouses.map((wh) => (
        <WarehouseRow key={wh.id} warehouse={wh} stores={stores} />
      ))}
      {open && hubWarehouses.length === 0 && (
        <Table.Tr style={{ background: 'var(--mantine-color-gray-0)' }}>
          <Table.Td colSpan={9} pl={40}>
            <Text size="sm" c="dimmed">No warehouses under this hub</Text>
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

// ── Standalone warehouse row ──────────────────────────────────────────────────
function StandaloneRow({ warehouse, stores }: { warehouse: Warehouse; stores: Store[] }) {
  const [open, setOpen] = useState(false);
  const whStores   = stores.filter((s) => s.warehouse_id === warehouse.id);
  const total      = sumTotal(whStores);
  const used       = sumUsed(whStores);
  const free       = sumFree(whStores);
  const p          = pct(used, total);
  const capacityMt = warehouse.capacity?.total_storage_capacity_mt ?? 0;

  return (
    <>
      <Table.Tr style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <Table.Td>
          <Group gap={8}>
            <ActionIcon variant="subtle" size="xs" color="gray">
              {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </ActionIcon>
            <IconBuildingWarehouse size={16} color="var(--mantine-color-cyan-6)" />
            <Text fw={600} size="sm">{warehouse.name}</Text>
            <Badge size="xs" variant="dot" color="gray">No hub</Badge>
          </Group>
        </Table.Td>
        <Table.Td><Text size="sm">{warehouse.code || '—'}</Text></Table.Td>
        <Table.Td><Text size="sm">{warehouse.location_name || '—'}</Text></Table.Td>
        <Table.Td>
          <Badge variant="light" color="cyan" size="sm">{whStores.length} stores</Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{capacityMt > 0 ? `${fmt(capacityMt)} MT` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={500}>{total > 0 ? `${fmt(total)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c={used > 0 ? 'blue' : 'dimmed'}>{total > 0 ? (used > 0 ? `${fmt(used)} m³` : '0') : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={600} c="green">{total > 0 ? `${fmt(free)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          {total > 0 ? (
            <Group gap={6} wrap="nowrap">
              <Progress value={p} color={pctColor(p)} size="sm" style={{ flex: 1, minWidth: 60 }} />
              <Text size="xs" c={pctColor(p)}>{p.toFixed(0)}%</Text>
            </Group>
          ) : <Text size="sm" c="dimmed">—</Text>}
        </Table.Td>
      </Table.Tr>

      {open && whStores.map((s) => <StoreRow key={s.id} store={s} />)}
      {open && whStores.length === 0 && (
        <Table.Tr style={{ background: 'var(--mantine-color-gray-0)' }}>
          <Table.Td colSpan={9} pl={40}>
            <Text size="xs" c="dimmed">No stores configured</Text>
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function FacilitiesOverviewPage() {
  const { data: hubs = [],       isLoading: l1, error: e1 } = useQuery({ queryKey: ['hubs'],       queryFn: getHubs });
  const { data: warehouses = [], isLoading: l2, error: e2 } = useQuery({ queryKey: ['warehouses'], queryFn: getWarehouses });
  const { data: stores = [],     isLoading: l3, error: e3 } = useQuery({ queryKey: ['stores'],     queryFn: getStores });

  if (l1 || l2 || l3) return <Center h={400}><Loader size="lg" /></Center>;
  if (e1 || e2 || e3) return (
    <Alert icon={<IconAlertCircle size={16} />} color="red">Failed to load facilities</Alert>
  );

  const standalone = (warehouses as Warehouse[]).filter((w) => !w.hub_id);

  // Summary numbers — all from real store data
  const allUsed  = sumUsed(stores as Store[]);
  const allFree  = sumFree(stores as Store[]);
  const allTotal = sumTotal(stores as Store[]);
  const allPct   = pct(allUsed, allTotal);

  // Total registered capacity in MT from warehouse capacity records
  const totalCapacityMt = (warehouses as Warehouse[]).reduce(
    (a, w) => a + (w.capacity?.total_storage_capacity_mt ?? 0), 0
  );

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Facilities Overview</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Click any row to expand. Use this to pick the right hub/warehouse when creating a receipt order.
        </Text>
      </div>

      <SimpleGrid cols={4}>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" mb={4}>Hubs</Text>
          <Text size="xl" fw={700}>{(hubs as Hub[]).length}</Text>
          <Text size="xs" c="dimmed">{(warehouses as Warehouse[]).length} warehouses total</Text>
        </Card>

        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group gap={4} mb={4}>
            <Text size="xs" c="dimmed" fw={500} tt="uppercase">Registered Capacity</Text>
            <Tooltip label="Total storage capacity in metric tons as entered in warehouse setup" withArrow>
              <IconInfoCircle size={13} color="var(--mantine-color-dimmed)" />
            </Tooltip>
          </Group>
          <Text size="xl" fw={700}>{fmt(totalCapacityMt)} MT</Text>
          <Text size="xs" c="dimmed">from warehouse records</Text>
        </Card>

        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group gap={4} mb={4}>
            <Text size="xs" c="dimmed" fw={500} tt="uppercase">Available Volume</Text>
            <Tooltip label="Sum of available_space across all stores. Decreases as stock is received." withArrow>
              <IconInfoCircle size={13} color="var(--mantine-color-dimmed)" />
            </Tooltip>
          </Group>
          <Text size="xl" fw={700} c="green">{fmt(allFree)} m³</Text>
          <Text size="xs" c="dimmed">of {fmt(allTotal)} m³ total</Text>
        </Card>

        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" mb={4}>Utilization</Text>
          <Text size="xl" fw={700} c={pctColor(allPct)}>{allPct.toFixed(1)}%</Text>
          <Text size="xs" c="dimmed">{fmt(allUsed)} m³ used</Text>
        </Card>
      </SimpleGrid>

      {allUsed === 0 && allTotal > 0 && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          All stores show 0 used space. This is expected if no GRNs have been confirmed yet — space is only decremented when stock is received into a store.
        </Alert>
      )}

      <Card shadow="sm" padding={0} radius="md" withBorder>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 220 }}>Name</Table.Th>
              <Table.Th>Code</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>
                <Tooltip label="For hubs: number of warehouses. For warehouses: number of stores." withArrow>
                  <Group gap={4}>Contents <IconInfoCircle size={13} /></Group>
                </Tooltip>
              </Table.Th>
              <Table.Th>
                <Tooltip label="Registered capacity in metric tons (from warehouse setup)" withArrow>
                  <Group gap={4}>Capacity (MT) <IconInfoCircle size={13} /></Group>
                </Tooltip>
              </Table.Th>
              <Table.Th>
                <Tooltip label="Total physical volume of all stores (length × width × height)" withArrow>
                  <Group gap={4}>Volume (m³) <IconInfoCircle size={13} /></Group>
                </Tooltip>
              </Table.Th>
              <Table.Th>
                <Tooltip label="Volume currently occupied by stock" withArrow>
                  <Group gap={4}>Used <IconInfoCircle size={13} /></Group>
                </Tooltip>
              </Table.Th>
              <Table.Th>
                <Tooltip label="Volume still available for incoming stock" withArrow>
                  <Group gap={4}>Free <IconInfoCircle size={13} /></Group>
                </Tooltip>
              </Table.Th>
              <Table.Th>Utilization</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(hubs as Hub[]).map((hub) => (
              <HubRow key={hub.id} hub={hub} warehouses={warehouses as Warehouse[]} stores={stores as Store[]} />
            ))}

            {standalone.length > 0 && (
              <Table.Tr>
                <Table.Td colSpan={9} py={4}>
                  <Divider label={<Text size="xs" c="dimmed" fw={600} tt="uppercase">Standalone Warehouses</Text>} labelPosition="left" />
                </Table.Td>
              </Table.Tr>
            )}

            {standalone.map((wh) => (
              <StandaloneRow key={wh.id} warehouse={wh} stores={stores as Store[]} />
            ))}

            {(hubs as Hub[]).length === 0 && standalone.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text ta="center" c="dimmed" py="xl">No facilities found</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}

export default FacilitiesOverviewPage;
