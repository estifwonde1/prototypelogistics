import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  Card,
  Table,
  ActionIcon,
  Text,
  NumberInput,
  Textarea,
  SimpleGrid,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import {
  createDispatchOrder,
  type DispatchOrderLine,
} from '../../api/dispatchOrders';
import { getWarehouses } from '../../api/warehouses';
import {
  getCommodityReferences,
  getUnitReferences,
} from '../../api/referenceData';
import { getStockBalances } from '../../api/stockBalances';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import type { ApiError } from '../../types/common';

const createEmptyItem = (): DispatchOrderLine => ({
  commodity_id: 0,
  quantity: 0,
  unit_id: 0,
  notes: '',
});

export default function DispatchAuthorizationFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const userHubId = activeAssignment?.hub?.id;
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((state) => state.role));
  const isHubManager = roleSlug === 'hub_manager';
  const isWarehouseManager = roleSlug === 'warehouse_manager';

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [destinationType, setDestinationType] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [expectedPickupDate, setExpectedPickupDate] = useState<Date | null>(new Date());
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DispatchOrderLine[]>([createEmptyItem()]);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => getWarehouses({ hub_id: isHubManager ? userHubId : undefined }),
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: getUnitReferences,
  });

  const { data: allStockBalances = [] } = useQuery({
    queryKey: ['stock_balances'],
    queryFn: () => getStockBalances({}),
  });

  const stockWarehouseId = warehouseId ? Number(warehouseId) : null;

  const availableByCommodityId = useMemo(() => {
    const map = new Map<number, { quantity: number; unitLabel?: string }>();
    if (!stockWarehouseId) return map;
    allStockBalances
      .filter((balance) => balance.warehouse_id === stockWarehouseId)
      .forEach((balance) => {
        const existing = map.get(balance.commodity_id);
        const nextQuantity = (existing?.quantity || 0) + (balance.quantity || 0);
        const unitLabel = existing?.unitLabel || balance.unit_abbreviation || balance.unit_name || undefined;
        map.set(balance.commodity_id, { quantity: nextQuantity, unitLabel });
      });
    return map;
  }, [allStockBalances, stockWarehouseId]);

  const warehouseOptions = useMemo(
    () =>
      (warehouses ?? []).map((w) => ({
        value: w.id.toString(),
        label: w.name,
      })),
    [warehouses]
  );

  const commodityOptions = useMemo(
    () =>
      commodities.map((c) => {
        const name = c.name ?? `Commodity #${c.id}`;
        const label = c.batch_no ? `${name} — ${c.batch_no}` : name;
        return { value: c.id.toString(), label };
      }),
    [commodities]
  );

  const commodityLabelById = useMemo(() => {
    const map = new Map<number, string>();
    commodities.forEach((c) => {
      const name = c.name ?? `Commodity #${c.id}`;
      map.set(c.id, c.batch_no ? `${name} — ${c.batch_no}` : name);
    });
    return map;
  }, [commodities]);

  const unitOptions = useMemo(
    () =>
      units.map((u) => ({
        value: u.id.toString(),
        label: u.name,
      })),
    [units]
  );

  const destinationTypeOptions = [
    { value: 'Hub', label: 'Hub' },
    { value: 'Warehouse', label: 'Warehouse' },
    { value: 'Beneficiary', label: 'Beneficiary' },
  ];

  const createMutation = useMutation({
    mutationFn: createDispatchOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({
        title: 'Success',
        message: 'Dispatch Authorization created successfully',
        color: 'green',
      });
      const basePath = isHubManager ? '/hub/dispatch-authorizations' : '/warehouse/dispatch-authorizations';
      navigate(`${basePath}/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create Dispatch Authorization',
        color: 'red',
      });
    },
  });

  const handleAddItem = () => {
    setItems((current) => [...current, createEmptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof DispatchOrderLine>(
    index: number,
    field: K,
    value: DispatchOrderLine[K]
  ) => {
    setItems((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      if (field === 'commodity_id' && value) {
        const commodity = commodities.find((c) => c.id === value);
        if (commodity && commodity.unit_id) {
          next[index].unit_id = commodity.unit_id;
        }
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!warehouseId || !destinationType || !destinationName || !expectedPickupDate) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }

    if (items.length === 0 || items.some((item) => !item.commodity_id || !item.quantity)) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please add at least one valid item',
        color: 'red',
      });
      return;
    }

    if (stockWarehouseId) {
      const insufficient = items.find((item) => {
        const available = availableByCommodityId.get(item.commodity_id)?.quantity ?? 0;
        return item.quantity > available;
      });
      if (insufficient) {
        const label = commodityLabelById.get(insufficient.commodity_id) || 'selected commodity';
        notifications.show({
          title: 'Validation Error',
          message: `Quantity exceeds available stock for ${label}.`,
          color: 'red',
        });
        return;
      }
    }

    const dateStr = expectedPickupDate instanceof Date
      ? expectedPickupDate.toISOString().split('T')[0]
      : expectedPickupDate;

    const payload = {
      source_warehouse_id: Number(warehouseId),
      hub_id: userHubId ?? undefined,
      destination_type: destinationType,
      destination_name: destinationName,
      expected_pickup_date: dateStr,
      notes,
      lines: items,
    };

    createMutation.mutate(payload);
  };

  const isLoading = createMutation.isPending;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Create Dispatch Authorization</Title>
        <Text c="dimmed" size="sm">
          Create a new dispatch authorization to send commodities from your warehouse
        </Text>
      </div>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <div>
            <Text size="sm" fw={600} mb="md">
              Order Details
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <SearchableSelect
                label="Source Warehouse"
                placeholder="Select warehouse"
                data={warehouseOptions}
                value={warehouseId}
                onChange={setWarehouseId}
                required
              />
              <SearchableSelect
                label="Destination Type"
                placeholder="Select destination type"
                data={destinationTypeOptions}
                value={destinationType}
                onChange={(val) => setDestinationType(val || '')}
                required
              />
              <TextInput
                label="Destination Name"
                placeholder="Enter destination name"
                value={destinationName}
                onChange={(e) => setDestinationName(e.target.value)}
                required
              />
              <DateInput
                label="Expected Dispatch Date"
                placeholder="Select date"
                value={expectedPickupDate}
                onChange={(val: string | null) => setExpectedPickupDate(val ? new Date(val) : null)}
                required
              />
            </SimpleGrid>
            <Textarea
              label="Notes"
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              mt="md"
              rows={3}
            />
          </div>

          <div>
            <Group justify="space-between" mb="md">
              <Text size="sm" fw={600}>
                Dispatch Items
              </Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={handleAddItem}
              >
                Add Item
              </Button>
            </Group>

            <Table.ScrollContainer minWidth={600}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Unit</Table.Th>
                    <Table.Th>Notes</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((item, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <SearchableSelect
                          placeholder="Select commodity"
                          data={commodityOptions}
                          value={item.commodity_id?.toString()}
                          onChange={(val) => handleItemChange(index, 'commodity_id', parseInt(val || '0'))}
                          searchable
                        />
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          <NumberInput
                            placeholder="0"
                            value={item.quantity}
                            onChange={(val) => handleItemChange(index, 'quantity', Number(val) || 0)}
                          />
                          {stockWarehouseId && item.commodity_id
                            ? (() => {
                                const availableEntry = availableByCommodityId.get(item.commodity_id);
                                const available = availableEntry?.quantity ?? 0;
                                const isOver = item.quantity > available;
                                return (
                                  <Text size="xs" c={isOver ? 'red' : 'dimmed'}>
                                    Available: {available.toFixed(2)} {availableEntry?.unitLabel || ''}
                                  </Text>
                                );
                              })()
                            : null}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <SearchableSelect
                          placeholder="Select unit"
                          data={unitOptions}
                          value={item.unit_id?.toString()}
                          onChange={(val) => handleItemChange(index, 'unit_id', parseInt(val || '0'))}
                          searchable
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          placeholder="Notes"
                          value={item.notes}
                          onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon color="red" variant="subtle" onClick={() => handleRemoveItem(index)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </div>

          <Group justify="flex-end" mt="xl">
            <Button variant="light" onClick={() => navigate(isHubManager ? '/hub/dispatch-authorizations' : '/warehouse/dispatch-authorizations')}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isLoading}>
              Save as Draft
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
