import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Stack,
  Title,
  Text,
  Group,
  TextInput,
  Table,
  Select,
  Card,
  SimpleGrid,
  SegmentedControl,
} from '@mantine/core';
import { IconSearch, IconPackage, IconBuilding, IconBox } from '@tabler/icons-react';
import { getStockBalances } from '../../api/stockBalances';
import { getWarehouses } from '../../api/warehouses';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

type GroupByOption = 'none' | 'warehouse' | 'commodity';

function StockBalancePage() {
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');

  const { data: stockBalances, isLoading, error, refetch } = useQuery({
    queryKey: ['stockBalances'],
    queryFn: getStockBalances,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (!stockBalances) return { totalQuantity: 0, warehouseCount: 0, commodityCount: 0 };

    const totalQuantity = stockBalances.reduce((sum, balance) => sum + balance.quantity, 0);
    const uniqueWarehouses = new Set(stockBalances.map((b) => b.warehouse_id));
    const uniqueCommodities = new Set(stockBalances.map((b) => b.commodity_id));

    return {
      totalQuantity,
      warehouseCount: uniqueWarehouses.size,
      commodityCount: uniqueCommodities.size,
    };
  }, [stockBalances]);

  // Filter stock balances
  const filteredBalances = useMemo(() => {
    if (!stockBalances) return [];

    return stockBalances.filter((balance) => {
      const matchesWarehouse = !warehouseFilter || balance.warehouse_id.toString() === warehouseFilter;
      const matchesSearch =
        search === '' ||
        balance.commodity_id.toString().includes(search) ||
        balance.warehouse_id.toString().includes(search);
      return matchesWarehouse && matchesSearch;
    });
  }, [stockBalances, warehouseFilter, search]);

  // Group stock balances
  const groupedBalances = useMemo(() => {
    if (groupBy === 'none') return null;

    const groups = new Map<number, typeof filteredBalances>();

    filteredBalances.forEach((balance) => {
      const key = groupBy === 'warehouse' ? balance.warehouse_id : balance.commodity_id;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(balance);
    });

    return groups;
  }, [filteredBalances, groupBy]);

  const warehouseOptions = warehouses?.map((warehouse) => ({
    value: warehouse.id.toString(),
    label: `${warehouse.name} (${warehouse.code})`,
  }));

  if (isLoading) {
    return <LoadingState message="Loading stock balances..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load stock balances. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const renderTable = (balances: typeof filteredBalances, title?: string) => (
    <div>
      {title && (
        <Title order={4} mb="sm">
          {title}
        </Title>
      )}
      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Warehouse ID</Table.Th>
              <Table.Th>Store ID</Table.Th>
              <Table.Th>Stack ID</Table.Th>
              <Table.Th>Commodity ID</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Unit ID</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {balances.map((balance) => (
              <Table.Tr key={balance.id}>
                <Table.Td>{balance.warehouse_id}</Table.Td>
                <Table.Td>{balance.store_id || '-'}</Table.Td>
                <Table.Td>{balance.stack_id || '-'}</Table.Td>
                <Table.Td>{balance.commodity_id}</Table.Td>
                <Table.Td style={{ fontWeight: 600 }}>{balance.quantity.toLocaleString()}</Table.Td>
                <Table.Td>{balance.unit_id}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </div>
  );

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Stock Balances</Title>
          <Text c="dimmed" size="sm">
            View current inventory levels across warehouses
          </Text>
        </div>
      </Group>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <IconPackage size={32} color="var(--mantine-color-blue-6)" />
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Stock
              </Text>
              <Text size="xl" fw={700}>
                {stats.totalQuantity.toLocaleString()}
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <IconBuilding size={32} color="var(--mantine-color-green-6)" />
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Warehouses
              </Text>
              <Text size="xl" fw={700}>
                {stats.warehouseCount}
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <IconBox size={32} color="var(--mantine-color-orange-6)" />
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Commodities
              </Text>
              <Text size="xl" fw={700}>
                {stats.commodityCount}
              </Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Filters */}
      <Group>
        <TextInput
          placeholder="Search by commodity or warehouse ID..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="Filter by warehouse"
          data={warehouseOptions || []}
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          clearable
          style={{ width: 250 }}
        />
      </Group>

      {/* Group By Control */}
      <Group>
        <Text size="sm" fw={500}>
          Group by:
        </Text>
        <SegmentedControl
          value={groupBy}
          onChange={(value) => setGroupBy(value as GroupByOption)}
          data={[
            { label: 'None', value: 'none' },
            { label: 'Warehouse', value: 'warehouse' },
            { label: 'Commodity', value: 'commodity' },
          ]}
        />
      </Group>

      {/* Data Display */}
      {filteredBalances.length === 0 ? (
        <EmptyState
          title="No stock balances found"
          description={
            search || warehouseFilter
              ? 'Try adjusting your filters'
              : 'No stock balances available'
          }
        />
      ) : groupedBalances ? (
        <Stack gap="xl">
          {Array.from(groupedBalances.entries()).map(([key, balances]) => {
            const warehouse = warehouses?.find((w) => w.id === key);
            const title =
              groupBy === 'warehouse'
                ? warehouse
                  ? `${warehouse.name} (${warehouse.code})`
                  : `Warehouse ID: ${key}`
                : `Commodity ID: ${key}`;
            const totalQty = balances.reduce((sum, b) => sum + b.quantity, 0);
            return (
              <Card key={key} shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Title order={4}>{title}</Title>
                  <Text size="sm" c="dimmed">
                    Total: {totalQty.toLocaleString()} units
                  </Text>
                </Group>
                {renderTable(balances)}
              </Card>
            );
          })}
        </Stack>
      ) : (
        renderTable(filteredBalances)
      )}
    </Stack>
  );
}

export default StockBalancePage;
