import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { createWaybill } from '../../api/waybills';
import { notifications } from '@mantine/notifications';
import type { WaybillItem, WaybillTransport } from '../../types/waybill';

function WaybillCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state - Header
  const [referenceNo, setReferenceNo] = useState('');
  const [issuedOn, setIssuedOn] = useState<Date | null>(new Date());
  const [sourceLocationId, setSourceLocationId] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [dispatchId, setDispatchId] = useState('');

  // Form state - Transport
  const [transporterId, setTransporterId] = useState('');
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
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error?.message || 'Failed to create waybill',
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

  const handleItemChange = (index: number, field: keyof WaybillItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (!referenceNo || !issuedOn || !sourceLocationId || !destinationLocationId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required header fields',
        color: 'red',
      });
      return;
    }

    if (!transporterId || !vehiclePlateNo || !driverName || !driverPhone) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all transport details',
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

    const transport: WaybillTransport = {
      transporter_id: parseInt(transporterId),
      vehicle_plate_no: vehiclePlateNo,
      driver_name: driverName,
      driver_phone: driverPhone,
    };

    createMutation.mutate({
      reference_no: referenceNo,
      issued_on: issuedOn.toISOString().split('T')[0],
      source_location_id: parseInt(sourceLocationId),
      destination_location_id: parseInt(destinationLocationId),
      dispatch_id: dispatchId ? parseInt(dispatchId) : undefined,
      waybill_transport: transport,
      waybill_items: items,
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
            <TextInput
              label="Source Location ID"
              placeholder="Enter source location ID"
              value={sourceLocationId}
              onChange={(e) => setSourceLocationId(e.target.value)}
              required
            />
            <TextInput
              label="Destination Location ID"
              placeholder="Enter destination location ID"
              value={destinationLocationId}
              onChange={(e) => setDestinationLocationId(e.target.value)}
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
            <TextInput
              label="Transporter ID"
              placeholder="Enter transporter ID"
              value={transporterId}
              onChange={(e) => setTransporterId(e.target.value)}
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
                  <Table.Th>Commodity ID</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Unit ID</Table.Th>
                  <Table.Th style={{ width: 50 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <NumberInput
                        placeholder="Commodity ID"
                        value={item.commodity_id || ''}
                        onChange={(val) =>
                          handleItemChange(index, 'commodity_id', Number(val))
                        }
                        min={1}
                        hideControls
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
                      <NumberInput
                        placeholder="Unit ID"
                        value={item.unit_id || ''}
                        onChange={(val) => handleItemChange(index, 'unit_id', Number(val))}
                        min={1}
                        hideControls
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
