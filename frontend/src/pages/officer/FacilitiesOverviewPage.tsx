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
  Collapse,
  ActionIcon,
  Progress,
  SimpleGrid,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconBuilding,
  IconBuildingWarehouse,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { getHubs } from '../../api/hubs';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import type { Hub } from '../../types/hub';
import type { Warehouse } from '../../types/warehouse';
import type { Store } from '../../types/store';

function usedSpace(stores: Store[]) {
  return stores.reduce((sum, s) => sum + (s.usable_space - s.available_space), 0);
}

function freeSpace(stores: Store[]) {
  return stores.reduce((sum, s) => sum + s.available_space, 0);
}

function totalSpace(stores: Store[]) {
  return stores.reduce((sum, s) => sum + s.usable_space, 0);
}

function utilPct(used: number, total: number) {
  return total > 0 ? (used / total) * 100 : 0;
}

function utilColor(pct: number) {
  if (pct > 90) return 'red';
  if (pct > 70) return 'yellow';
  return 'green';
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// ── Warehouse sub-row ────────────────────────────────────────────────────────
function WarehouseRow({ warehouse, stores }: { warehouse: Warehouse; stores: Store[] }) {
  const whStores = stores.filter((s) => s.warehouse_id === warehouse.id);
  const total = totalSpace(whStores);
  const used = usedSpace(whStores);
  const free = freeSpace(whStores);
  const pct = utilPct(used, total);

  // fall back to capacity record if no stores yet
  const capacityMt = warehouse.capacity?.total_storage_capacity_mt ?? 0;

  return (
    <Table.Tr style={{ background: 'var(--mantine-color-gray-0)' }}>
      <Table.Td pl={40}>
        <Group gap={6}>
          <IconBuildingWarehouse size={14} color="var(--mantine-color-cyan-6)" />
          <Text size="sm">{warehouse.name}</Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">{warehouse.code || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">{warehouse.location_name || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{whStores.length}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{capacityMt > 0 ? `${fmt(capacityMt)} MT` : '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{total > 0 ? `${fmt(total)} m³` : '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="blue">{total > 0 ? `${fmt(used)} m³` : '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={600} c="green">{total > 0 ? `${fmt(free)} m³` : '—'}</Text>
      </Table.Td>
      <Table.Td>
        {total > 0 ? (
          <Group gap={6} wrap="nowrap">
            <Progress value={pct} color={utilColor(pct)} size="sm" style={{ flex: 1, minWidth: 60 }} />
            <Badge size="xs" color={utilColor(pct)} variant="light">{pct.toFixed(1)}%</Badge>
          </Group>
        ) : (
          <Text size="sm" c="dimmed">—</Text>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

// ── Hub row (expandable) ─────────────────────────────────────────────────────
function HubRow({
  hub,
  warehouses,
  stores,
}: {
  hub: Hub;
  warehouses: Warehouse[];
  stores: Store[];
}) {
  const [open, setOpen] = useState(false);
  const hubWarehouses = warehouses.filter((w) => w.hub_id === hub.id);

  // aggregate from stores under this hub's warehouses
  const hubStores = stores.filter((s) =>
    hubWarehouses.some((w) => w.id === s.warehouse_id)
  );
  const total = totalSpace(hubStores);
  const used = usedSpace(hubStores);
  const free = freeSpace(hubStores);
  const pct = utilPct(used, total);

  const capacityMt = hub.capacity?.total_capacity_mt ?? 0;

  return (
    <>
      <Table.Tr
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen((o) => !o)}
      >
        <Table.Td>
          <Group gap={6}>
            <ActionIcon variant="subtle" size="xs" color="gray">
              {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </ActionIcon>
            <IconBuilding size={16} color="var(--mantine-color-blue-6)" />
            <Text fw={600} size="sm">{hub.name}</Text>
          </Group>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{hub.code || '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{hub.location_name || '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Badge variant="light" color="blue" size="sm">{hubWarehouses.length}</Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{capacityMt > 0 ? `${fmt(capacityMt)} MT` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{total > 0 ? `${fmt(total)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="blue">{total > 0 ? `${fmt(used)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={600} c="green">{total > 0 ? `${fmt(free)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          {total > 0 ? (
            <Group gap={6} wrap="nowrap">
              <Progress value={pct} color={utilColor(pct)} size="sm" style={{ flex: 1, minWidth: 60 }} />
              <Badge size="xs" color={utilColor(pct)} variant="light">{pct.toFixed(1)}%</Badge>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">—</Text>
          )}
        </Table.Td>
      </Table.Tr>

      {open &&
        hubWarehouses.map((wh) => (
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

// ── Standalone warehouse row (expandable) ────────────────────────────────────
function StandaloneWarehouseRow({
  warehouse,
  stores,
}: {
  warehouse: Warehouse;
  stores: Store[];
}) {
  const [open, setOpen] = useState(false);
  const whStores = stores.filter((s) => s.warehouse_id === warehouse.id);
  const total = totalSpace(whStores);
  const used = usedSpace(whStores);
  const free = freeSpace(whStores);
  const pct = utilPct(used, total);
  const capacityMt = warehouse.capacity?.total_storage_capacity_mt ?? 0;

  return (
    <>
      <Table.Tr
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen((o) => !o)}
      >
        <Table.Td>
          <Group gap={6}>
            <ActionIcon variant="subtle" size="xs" color="gray">
              {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </ActionIcon>
            <IconBuildingWarehouse size={16} color="var(--mantine-color-cyan-6)" />
            <Text fw={600} size="sm">{warehouse.name}</Text>
            <Badge size="xs" variant="outline" color="cyan">Standalone</Badge>
          </Group>
        </Table.Td>
        <Table.Td><Text size="sm">{warehouse.code || '—'}</Text></Table.Td>
        <Table.Td><Text size="sm">{warehouse.location_name || '—'}</Text></Table.Td>
        <Table.Td><Text size="sm" c="dimmed">—</Text></Table.Td>
        <Table.Td>
          <Text size="sm">{capacityMt > 0 ? `${fmt(capacityMt)} MT` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{total > 0 ? `${fmt(total)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="blue">{total > 0 ? `${fmt(used)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={600} c="green">{total > 0 ? `${fmt(free)} m³` : '—'}</Text>
        </Table.Td>
        <Table.Td>
          {total > 0 ? (
            <Group gap={6} wrap="nowrap">
              <Progress value={pct} color={utilColor(pct)} size="sm" style={{ flex: 1, minWidth: 60 }} />
              <Badge size="xs" color={utilColor(pct)} variant="light">{pct.toFixed(1)}%</Badge>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">—</Text>
          )}
        </Table.Td>
      </Table.Tr>

      {open &&
        whStores.map((store) => (
          <Table.Tr key={store.id} style={{ background: 'var(--mantine-color-gray-0)' }}>
            <Table.Td pl={40} colSpan={3}>
              <Text size="sm">{store.name} {store.code ? `(${store.code})` : ''}</Text>
            </Table.Td>
            <Table.Td />
            <Table.Td />
            <Table.Td>
              <Text size="sm">{fmt(store.usable_space)} m³</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="blue">{fmt(store.usable_space - store.available_space)} m³</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={600} c="green">{fmt(store.available_space)} m³</Text>
            </Table.Td>
            <Table.Td />
          </Table.Tr>
        ))}

      {open && whStores.length === 0 && (
        <Table.Tr style={{ background: 'var(--mantine-color-gray-0)' }}>
          <Table.Td colSpan={9} pl={40}>
            <Text size="sm" c="dimmed">No stores configured</Text>
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
function FacilitiesOverviewPage() {
  const { data: hubs = [], isLoading: hubsLoading, error: hubsError } = useQuery({
    queryKey: ['hubs'],
    queryFn: getHubs,
  });

  const { data: warehouses = [], isLoading: warehousesLoading, error: warehousesError } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const { data: stores = [], isLoading: storesLoading, error: storesError } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
  });

  const isLoading = hubsLoading || warehousesLoading || storesLoading;
  const error = hubsError || warehousesError || storesError;

  const standaloneWarehouses = warehouses.filter((w: Warehouse) => !w.hub_id);

  const totalFree = freeSpace(stores);
  const totalUsed = usedSpace(stores);
  const totalVol = totalSpace(stores);
  const totalCapacityMt = warehouses.reduce(
    (sum: number, w: Warehouse) => sum + (w.capacity?.total_storage_capacity_mt ?? 0),
    0
  );

  if (isLoading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
        Failed to load facilities data
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Title order={2}>Facilities Overview</Title>
      <Text c="dimmed" size="sm">
        Click a hub or warehouse to expand and see individual stores. Use this to choose the right destination for a receipt order.
      </Text>

      <SimpleGrid cols={4}>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase">Hubs</Text>
          <Text size="xl" fw={700}>{hubs.length}</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase">Total Capacity</Text>
          <Text size="xl" fw={700}>{fmt(totalCapacityMt)} MT</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase">Free Space</Text>
          <Text size="xl" fw={700} c="green">{fmt(totalFree)} m³</Text>
        </Card>
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase">Utilization</Text>
          <Text size="xl" fw={700} c={utilColor(utilPct(totalUsed, totalVol))}>
            {utilPct(totalUsed, totalVol).toFixed(1)}%
          </Text>
        </Card>
      </SimpleGrid>

      <Card shadow="sm" padding={0} radius="md" withBorder>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Code</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Warehouses</Table.Th>
              <Table.Th>Capacity (MT)</Table.Th>
              <Table.Th>Total Volume</Table.Th>
              <Table.Th>Used</Table.Th>
              <Table.Th>Free</Table.Th>
              <Table.Th>Utilization</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {hubs.map((hub: Hub) => (
              <HubRow key={hub.id} hub={hub} warehouses={warehouses} stores={stores} />
            ))}

            {standaloneWarehouses.length > 0 && (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text size="xs" fw={600} c="dimmed" tt="uppercase" p="xs">
                    Standalone Warehouses (no hub)
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}

            {standaloneWarehouses.map((wh: Warehouse) => (
              <StandaloneWarehouseRow key={wh.id} warehouse={wh} stores={stores} />
            ))}

            {hubs.length === 0 && standaloneWarehouses.length === 0 && (
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
