import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  Select,
  Card,
  Table,
  ActionIcon,
  Text,
  NumberInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { createWaybill } from '../../api/waybills';
import {
  getCommodityReferences,
  getTransporterReferences,
  getUnitReferences,
} from '../../api/referenceData';
import { getWarehouses } from '../../api/warehouses';
import { notifications } from '@mantine/notifications';
import type { WaybillItem, WaybillTransport } from '../../types/waybill';
import { DocumentStatus } from '../../utils/constants';
import type { ApiError } from '../../types/common';

function WaybillCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state - Header
  const [referenceNo, setReferenceNo] = useState('');
  const [issuedOn, setIssuedOn] = useState<Date | null>(new Date());
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string | null>(null);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string | null>(null);
  const [dispatchId, setDispatchId] = useState('');

  // Form state - Transport
  const [transporterId, setTransporterId] = useState<string | null>(null);
  const [vehiclePlateNo, setVehiclePlateNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');

  // Form state - Items
  const [items, setItems] = useState<WaybillItem[]>([
    {
      commodity_id: 0,
      quantity: 0,
      unit_id: 0,
    },
  ]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
  });

  const { data: transporters = [] } = useQuery({
    queryKey: ['reference_data', 'transporters'],
    queryFn: getTransporterReferences,
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['reference-data', 'units'],
    queryFn: getUnitReferences,
  });

  const transporterOptions = transporters.map((t) => ({
    value: String(t.id),
    label: t.code ? `${t.code} — ${t.name}` : t.name,
  }));

  const commodityOptions = commodities.map((c) => ({
    value: String(c.id),
    label: c.code ? `${c.name} (${c.code})` : c.name,
  }));

  const unitOptions = units.map((u) => ({
    value: String(u.id),
    label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name,
  }));

  const availableWarehouses = warehouses
    .filter((warehouse) => warehouse.location_id)
    .map((warehouse) => ({
      warehouse,
      value: String(warehouse.id),
      label: `${warehouse.code} - ${warehouse.name}`,
    }));

  const sourceWarehouseOptions = availableWarehouses
    .filter((option) => option.value !== destinationWarehouseId)
    .map(({ value, label }) => ({ value, label }));

  const destinationWarehouseOptions = availableWarehouses
    .filter((option) => option.value !== sourceWarehouseId)
    .map(({ value, label }) => ({ value, label }));

  const sourceWarehouse = warehouses.find((warehouse) => String(warehouse.id) === sourceWarehouseId);
  const destinationWarehouse = warehouses.find(
    (warehouse) => String(warehouse.id) === destinationWarehouseId
  );

  const createMutation = useMutation({
    mutationFn: createWaybill,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['waybills'] });
      notifications.show({
        title: 'Success',
        message: 'Waybill created successfully',
        color: 'green',
      });
      navigate(`/waybills/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create waybill',
        color: 'red',
      });
    },
  });

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        commodity_id: 0,
        quantity: 0,
        unit_id: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof WaybillItem>(
    index: number,
    field: K,
    value: WaybillItem[K]
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleCommoditySelect = (index: number, commodityIdStr: string | null) => {
    const id = commodityIdStr ? parseInt(commodityIdStr, 10) : 0;
    const commodity = commodities.find((c) => c.id === id);
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      commodity_id: id,
      unit_id: commodity?.unit_id ?? 0,
    };
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (!referenceNo || !issuedOn || !sourceWarehouseId || !destinationWarehouseId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required header fields',
        color: 'red',
      });
      return;
    }

    if (!transporterId || !vehiclePlateNo.trim() || !driverName.trim() || !driverPhone.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all transport details',
        color: 'red',
      });
      return;
    }

    if (
      items.length === 0 ||
      items.some((item) => !item.commodity_id || !item.unit_id || !item.quantity)
    ) {
      notifications.show({
        title: 'Validation Error',
        message: 'Each line item needs a commodity, unit, and quantity.',
        color: 'red',
      });
      return;
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Destination warehouse must differ from source warehouse.',
        color: 'red',
      });
      return;
    }

    if (!sourceWarehouse?.location_id || !destinationWarehouse?.location_id) {
      notifications.show({
        title: 'Validation Error',
        message: 'Selected warehouses must have valid locations before creating a waybill.',
        color: 'red',
      });
      return;
    }

    const transport: WaybillTransport = {
      transporter_id: parseInt(transporterId, 10),
      vehicle_plate_no: vehiclePlateNo,
      driver_name: driverName,
      driver_phone: driverPhone,
    };

    createMutation.mutate({
      reference_no: referenceNo,
      issued_on: issuedOn.toISOString().split('T')[0],
      source_location_id: sourceWarehouse.location_id,
      destination_location_id: destinationWarehouse.location_id,
      dispatch_id: dispatchId ? parseInt(dispatchId) : undefined,
      status: DocumentStatus.DRAFT,
      transport,
      items,
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Create Waybill</Title>
          <Text c="dimmed" size="sm">
            Create transport document for shipment
          </Text>
        </div>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Header Information</Title>

          <Group grow>
            <TextInput
              label="Reference Number"
              placeholder="WB-2024-001"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              required
            />
            <DateInput
              label="Issued On"
              placeholder="Select date"
              value={issuedOn}
              onChange={(value) => setIssuedOn(value ? new Date(value) : null)}
              required
            />
          </Group>

          <Group grow>
            <Select
              label="Source Warehouse"
              placeholder="Select source warehouse"
              data={sourceWarehouseOptions}
              value={sourceWarehouseId}
              onChange={setSourceWarehouseId}
              searchable
              required
            />
            <Select
              label="Destination Warehouse"
              placeholder="Select destination warehouse"
              data={destinationWarehouseOptions}
              value={destinationWarehouseId}
              onChange={setDestinationWarehouseId}
              searchable
              required
            />
          </Group>

          <TextInput
            label="Dispatch ID (Optional)"
            placeholder="Enter dispatch ID"
            value={dispatchId}
            onChange={(e) => setDispatchId(e.target.value)}
          />
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Transport Details</Title>

          <Group grow>
            <Select
              label="Transporter"
              placeholder="Select transporter"
              data={transporterOptions}
              value={transporterId}
              onChange={setTransporterId}
              searchable
              required
            />
            <TextInput
              label="Vehicle Plate Number"
              placeholder="e.g., ABC-1234"
              value={vehiclePlateNo}
              onChange={(e) => setVehiclePlateNo(e.target.value)}
              required
            />
          </Group>

          <Group grow>
            <TextInput
              label="Driver Name"
              placeholder="Enter driver name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              required
            />
            <TextInput
              label="Driver Phone"
              placeholder="Enter driver phone"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              required
            />
          </Group>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Line Items</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={handleAddItem}
            >
              Add Item
            </Button>
          </Group>

          <Table.ScrollContainer minWidth={600}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Commodity</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th style={{ width: 50 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Select
                        placeholder="Select commodity"
                        data={commodityOptions}
                        value={item.commodity_id ? String(item.commodity_id) : null}
                        onChange={(value) => handleCommoditySelect(index, value)}
                        searchable
                        clearable
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Quantity"
                        value={item.quantity || ''}
                        onChange={(val) => handleItemChange(index, 'quantity', Number(val))}
                        min={0}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        placeholder="Unit"
                        data={unitOptions}
                        value={item.unit_id ? String(item.unit_id) : null}
                        onChange={(value) =>
                          handleItemChange(index, 'unit_id', value ? parseInt(value, 10) : 0)
                        }
                        searchable
                        clearable
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => handleRemoveItem(index)}
                        disabled={items.length === 1}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button variant="default" onClick={() => navigate('/waybills')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={createMutation.isPending}>
          Create Waybill
        </Button>
      </Group>
    </Stack>
  );
}

export default WaybillCreatePage;
