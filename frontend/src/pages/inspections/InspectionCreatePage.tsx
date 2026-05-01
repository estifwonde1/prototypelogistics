import { useState, useEffect, useRef } from 'react';
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
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { createInspection } from '../../api/inspections';
import { getWarehouses } from '../../api/warehouses';
import { getReceipts } from '../../api/receipts';
import { getWaybills } from '../../api/waybills';
import { getGrns } from '../../api/grns';
import { notifications } from '@mantine/notifications';
import { QualityStatus, PackagingCondition } from '../../utils/constants';
import { generateSourceDetailReference } from '../../utils/sourceDetailReference';
import type { InspectionItem } from '../../types/inspection';
import type { ApiError } from '../../types/common';
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';

function uniqueLineRefsForInspectionItems(list: InspectionItem[]): InspectionItem[] {
  const used = new Set<string>();
  return list.map((item) => {
    let ref = (item.line_reference_no || '').trim();
    if (!ref) ref = generateSourceDetailReference();
    while (used.has(ref)) ref = generateSourceDetailReference();
    used.add(ref);
    return { ...item, line_reference_no: ref, batch_no: ref };
  });
}

function InspectionCreatePage() {
  const sourceTypeOptions = [
    { value: 'Receipt', label: 'Receipt' },
    { value: 'Waybill', label: 'Waybill' },
    { value: 'Grn', label: 'GRN' },
  ];

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loggedInUserId = useAuthStore((s) => s.userId);
  const defaultedInspectorRef = useRef(false);

  // Form state
  const [referenceNo, setReferenceNo] = useState('');
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [inspectedOn, setInspectedOn] = useState<Date | null>(new Date());
  const [inspectorId, setInspectorId] = useState('');

  useEffect(() => {
    if (loggedInUserId != null && !defaultedInspectorRef.current) {
      setInspectorId(String(loggedInUserId));
      defaultedInspectorRef.current = true;
    }
  }, [loggedInUserId]);
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [items, setItems] = useState<InspectionItem[]>([
    {
      commodity_id: 0,
      quantity_received: 0,
      quantity_damaged: 0,
      quantity_lost: 0,
      quality_status: QualityStatus.GOOD,
      packaging_condition: PackagingCondition.INTACT,
      remarks: '',
      line_reference_no: '',
    },
  ]);

  // Get active assignment context for filtering
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
  const userHubId = activeAssignment?.hub?.id;
  const isHubManager = roleSlug === 'hub_manager';

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => {
      if (isHubManager && userHubId) {
        return getWarehouses({ hub_id: userHubId });
      }
      return getWarehouses();
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => getReceipts(),
  });

  const { data: waybills = [] } = useQuery({
    queryKey: ['waybills'],
    queryFn: () => getWaybills(),
  });

  const { data: grns = [] } = useQuery({
    queryKey: ['grns'],
    queryFn: () => getGrns(),
  });

  const createMutation = useMutation({
    mutationFn: createInspection,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      notifications.show({
        title: 'Success',
        message: 'Inspection created successfully',
        color: 'green',
      });
      navigate(`/inspections/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to create inspection',
        color: 'red',
      });
    },
  });

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        commodity_id: 0,
        quantity_received: 0,
        quantity_damaged: 0,
        quantity_lost: 0,
        quality_status: QualityStatus.GOOD,
        packaging_condition: PackagingCondition.INTACT,
        remarks: '',
        line_reference_no: '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof InspectionItem>(
    index: number,
    field: K,
    value: InspectionItem[K]
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (!referenceNo || !warehouseId || !inspectedOn) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }

    if (items.length === 0 || items.some((item) => !item.commodity_id || !item.quantity_received)) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please add at least one valid item with commodity and quantity received',
        color: 'red',
      });
      return;
    }

    if ((sourceType && !sourceId) || (!sourceType && sourceId)) {
      notifications.show({
        title: 'Validation Error',
        message: 'Source type and source ID must be provided together.',
        color: 'red',
      });
      return;
    }

    createMutation.mutate({
      reference_no: referenceNo,
      warehouse_id: parseInt(warehouseId),
      inspected_on: inspectedOn.toISOString().split('T')[0],
      inspector_id: inspectorId ? parseInt(inspectorId) : undefined,
      source_type: sourceType || undefined,
      source_id: sourceId ? parseInt(sourceId) : undefined,
      items: uniqueLineRefsForInspectionItems(items),
    });
  };

  const warehouseOptions = warehouses?.map((w) => ({
    value: w.id.toString(),
    label: `${w.name} (${w.code})`,
  }));

  const sourceOptions =
    sourceType === 'Receipt'
      ? receipts.map((receipt) => ({
          value: receipt.id.toString(),
          label: `${receipt.reference_no || 'Receipt'} (#${receipt.id})`,
        }))
      : sourceType === 'Waybill'
        ? waybills.map((waybill) => ({
            value: waybill.id.toString(),
            label: `${waybill.reference_no || 'Waybill'} (#${waybill.id})`,
          }))
        : sourceType === 'Grn'
          ? grns.map((grn) => ({
              value: grn.id.toString(),
              label: `${grn.reference_no || 'GRN'} (#${grn.id})`,
            }))
          : [];

  const qualityOptions = Object.entries(QualityStatus).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));

  const packagingOptions = Object.entries(PackagingCondition).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase(),
  }));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Create Inspection</Title>
          <Text c="dimmed" size="sm">
            Record quality inspection and assessment
          </Text>
        </div>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Header Information</Title>

          <Group grow>
            <TextInput
              label="Reference Number"
              placeholder="INS-2024-001"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              required
            />
            <Select
              label="Warehouse"
              placeholder="Select warehouse"
              data={warehouseOptions || []}
              value={warehouseId}
              onChange={setWarehouseId}
              searchable
              required
            />
          </Group>

          <Group grow>
            <DateInput
              label="Inspected On"
              placeholder="Select date"
              value={inspectedOn}
              onChange={(value) => setInspectedOn(value ? new Date(value) : null)}
              required
            />
            <TextInput
              label="Inspector (User ID)"
              placeholder="Enter inspector user ID"
              description="Defaults to the signed-in user; change if a different inspector applies."
              value={inspectorId}
              onChange={(e) => setInspectorId(e.target.value)}
            />
          </Group>

          <Group grow>
            <Select
              label="Source Type"
              placeholder="Select source type"
              data={sourceTypeOptions}
              value={sourceType}
              onChange={(value) => {
                setSourceType(value || '');
                setSourceId('');
              }}
              clearable
            />
            <Select
              label="Source Reference"
              placeholder={sourceType ? 'Select source reference' : 'Select source type first'}
              data={sourceOptions}
              value={sourceId || null}
              onChange={(value) => {
                const nextSourceId = value || '';
                setSourceId(nextSourceId);

                if (sourceType !== 'Grn' || !nextSourceId) return;

                const selectedGrn = grns.find((grn) => grn.id === Number(nextSourceId));
                if (!selectedGrn?.grn_items) return;

                setWarehouseId(String(selectedGrn.warehouse_id));
                setItems(
                  selectedGrn.grn_items.map((item) => ({
                    commodity_id: item.commodity_id,
                    quantity_received: item.quantity,
                    quantity_damaged: 0,
                    quantity_lost: 0,
                    quality_status: item.quality_status || QualityStatus.GOOD,
                    packaging_condition: PackagingCondition.INTACT,
                    remarks: '',
                    line_reference_no: item.line_reference_no || item.batch_no || '',
                  }))
                );
              }}
              searchable
              clearable
              disabled={!sourceType}
            />
          </Group>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Inspection Items</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={handleAddItem}
            >
              Add Item
            </Button>
          </Group>

          <Table.ScrollContainer minWidth={1320}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Commodity ID</Table.Th>
                  <Table.Th>Line ref / batch</Table.Th>
                  <Table.Th>Qty Received</Table.Th>
                  <Table.Th>Qty Damaged</Table.Th>
                  <Table.Th>Qty Lost</Table.Th>
                  <Table.Th>Quality</Table.Th>
                  <Table.Th>Packaging</Table.Th>
                  <Table.Th>Remarks</Table.Th>
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
                      <Group gap="xs" wrap="nowrap">
                        <TextInput
                          placeholder="Unique ref"
                          value={item.line_reference_no || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            handleItemChange(index, 'line_reference_no', v);
                            handleItemChange(index, 'batch_no', v);
                          }}
                          style={{ minWidth: 130 }}
                        />
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => {
                            const ref = generateSourceDetailReference();
                            handleItemChange(index, 'line_reference_no', ref);
                            handleItemChange(index, 'batch_no', ref);
                          }}
                        >
                          Gen
                        </Button>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Received"
                        value={item.quantity_received || ''}
                        onChange={(val) =>
                          handleItemChange(index, 'quantity_received', Number(val))
                        }
                        min={0}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Damaged"
                        value={item.quantity_damaged || ''}
                        onChange={(val) =>
                          handleItemChange(index, 'quantity_damaged', Number(val))
                        }
                        min={0}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Lost"
                        value={item.quantity_lost || ''}
                        onChange={(val) =>
                          handleItemChange(index, 'quantity_lost', Number(val))
                        }
                        min={0}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        placeholder="Quality"
                        data={qualityOptions}
                        value={item.quality_status}
                        onChange={(val) =>
                          handleItemChange(
                            index,
                            'quality_status',
                            val || QualityStatus.GOOD
                          )
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        placeholder="Packaging"
                        data={packagingOptions}
                        value={item.packaging_condition}
                        onChange={(val) =>
                          handleItemChange(
                            index,
                            'packaging_condition',
                            val || PackagingCondition.INTACT
                          )
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Textarea
                        placeholder="Remarks"
                        value={item.remarks || ''}
                        onChange={(e) =>
                          handleItemChange(index, 'remarks', e.target.value)
                        }
                        rows={1}
                        autosize
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
        <Button variant="default" onClick={() => navigate('/inspections')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={createMutation.isPending}>
          Create Inspection
        </Button>
      </Group>
    </Stack>
  );
}

export default InspectionCreatePage;


