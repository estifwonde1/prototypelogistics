import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  Stack,
  Title,
  Button,
  Group,
  Select,
  Card,
  Table,
  ActionIcon,
  Text,
  NumberInput,
  Textarea,
  SimpleGrid,
  Badge,
  Divider,
  Alert,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconTrash, IconPlus, IconInfoCircle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  createReceiptOrder,
  getReceiptOrder,
  updateReceiptOrder,
  deleteReceiptOrder,
} from "../../api/receiptOrders";
import { getWarehouses } from "../../api/warehouses";
import { getHubs } from "../../api/hubs";
import { getCommodityReferences, getUnitReferences } from "../../api/referenceData";
import type { ReceiptOrderLine } from "../../api/receiptOrders";
import type { ApiError } from "../../types/common";

// ── Types ──────────────────────────────────────────────────────────────────

type DestinationKind = "hub" | "warehouse";

interface DestinationLine {
  id: string;
  kind: DestinationKind | "";
  hub_id: string | null;
  warehouse_id: string | null;
  quantity: number;
  notes: string;
}

const createEmptyDestination = (): DestinationLine => ({
  id: Math.random().toString(36).slice(2),
  kind: "",
  hub_id: null,
  warehouse_id: null,
  quantity: 0,
  notes: "",
});

// ── Component ──────────────────────────────────────────────────────────────

function ReceiptOrderFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Commodity & batch selection ──
  const [selectedCommodityId, setSelectedCommodityId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // ── Auto-filled from batch ──
  const [unitId, setUnitId] = useState<string | null>(null);
  const [packagingUnitId, setPackagingUnitId] = useState<string | null>(null);
  const [packagingSize, setPackagingSize] = useState<number | null>(null);
  const [batchQuantity, setBatchQuantity] = useState<number>(0);

  // ── Order header ──
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | null>(new Date());
  const [notes, setNotes] = useState("");

  // ── Destination lines ──
  const [destinations, setDestinations] = useState<DestinationLine[]>([createEmptyDestination()]);

  // ── Edit hydration guard ──
  const hydratedRef = useRef<string | null>(null);

  // ── Data queries ──
  const { data: commodities = [] } = useQuery({
    queryKey: ["reference-data", "commodities"],
    queryFn: () => getCommodityReferences(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ["reference-data", "units"],
    queryFn: () => getUnitReferences(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => getWarehouses(),
  });

  const { data: hubs } = useQuery({
    queryKey: ["hubs"],
    queryFn: () => getHubs(),
  });

  const {
    data: existingOrder,
    isLoading: orderLoading,
    isError: orderError,
    refetch: refetchOrder,
  } = useQuery({
    queryKey: ["receipt_orders", id],
    queryFn: () => getReceiptOrder(Number(id)),
    enabled: isEdit,
  });

  const isDraftOrder =
    existingOrder != null &&
    String(existingOrder.status).toLowerCase() === "draft";
  const fieldsEditable = !isEdit || (isDraftOrder && !orderLoading);

  // ── Derived: unique commodity names ──
  const commodityNameOptions = useMemo(() => {
    const seen = new Set<string>();
    return commodities
      .filter((c) => {
        const key = c.name || `Commodity #${c.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((c) => ({ value: String(c.id), label: c.name || `Commodity #${c.id}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [commodities]);

  // ── Derived: batches for selected commodity ──
  const batchOptions = useMemo(() => {
    if (!selectedCommodityId) return [];
    const selectedName = commodities.find((c) => String(c.id) === selectedCommodityId)?.name;
    if (!selectedName) return [];
    return commodities
      .filter((c) => c.name === selectedName && c.batch_no)
      .map((c) => ({
        value: String(c.id),
        label: c.batch_no || `Batch #${c.id}`,
      }));
  }, [commodities, selectedCommodityId]);

  // ── Derived: remaining quantity ──
  const totalAssigned = destinations.reduce((sum, d) => sum + (d.quantity || 0), 0);
  const remaining = batchQuantity - totalAssigned;

  // ── Hub / warehouse options ──
  const hubOptions = useMemo(
    () => (hubs ?? []).map((h) => ({ value: String(h.id), label: h.name })),
    [hubs]
  );

  const standaloneWarehouseOptions = useMemo(
    () =>
      (warehouses ?? [])
        .filter((w) => w.hub_id == null)
        .map((w) => ({ value: String(w.id), label: w.name })),
    [warehouses]
  );



  // ── Handlers: commodity selection ──
  const handleCommoditySelect = useCallback(
    (val: string | null) => {
      setSelectedCommodityId(val);
      setSelectedBatchId(null);
      setUnitId(null);
      setPackagingUnitId(null);
      setPackagingSize(null);
      setBatchQuantity(0);
    },
    []
  );

  // ── Handlers: batch selection — auto-fill unit/packaging ──
  const handleBatchSelect = useCallback(
    (val: string | null) => {
      setSelectedBatchId(val);
      if (!val) {
        setUnitId(null);
        setPackagingUnitId(null);
        setPackagingSize(null);
        setBatchQuantity(0);
        return;
      }
      const batch = commodities.find((c) => String(c.id) === val);
      if (batch) {
        setUnitId(batch.unit_id ? String(batch.unit_id) : null);
        setPackagingUnitId(batch.package_unit_id ? String(batch.package_unit_id) : null);
        setPackagingSize(batch.package_size ?? null);
        setBatchQuantity(batch.quantity ?? 0);
      }
    },
    [commodities]
  );

  // ── Handlers: destination lines ──
  const handleAddDestination = () => {
    setDestinations((prev) => [...prev, createEmptyDestination()]);
  };

  const handleRemoveDestination = (lineId: string) => {
    setDestinations((prev) => prev.filter((d) => d.id !== lineId));
  };

  const handleDestinationChange = <K extends keyof DestinationLine>(
    lineId: string,
    field: K,
    value: DestinationLine[K]
  ) => {
    setDestinations((prev) =>
      prev.map((d) => {
        if (d.id !== lineId) return d;
        const updated = { ...d, [field]: value };
        // Reset destination selection when kind changes
        if (field === "kind") {
          updated.hub_id = null;
          updated.warehouse_id = null;
        }
        return updated;
      })
    );
  };

  // ── Hydrate edit form ──
  useEffect(() => {
    if (!isEdit || !existingOrder) return;
    const key = `${id}:${existingOrder.updated_at ?? existingOrder.id}`;
    if (hydratedRef.current === key) return;
    hydratedRef.current = key;

    const dateRaw = existingOrder.expected_delivery_date || existingOrder.received_date;
    setExpectedDeliveryDate(dateRaw ? new Date(dateRaw) : null);
    setNotes(existingOrder.notes ?? existingOrder.description ?? "");

    const rawLines = existingOrder.lines ?? existingOrder.receipt_order_lines ?? [];
    if (rawLines.length > 0) {
      const first = rawLines[0];
      setSelectedCommodityId(first.commodity_id ? String(first.commodity_id) : null);
      setSelectedBatchId(first.commodity_id ? String(first.commodity_id) : null);
      setUnitId(first.unit_id ? String(first.unit_id) : null);
      setPackagingUnitId(first.packaging_unit_id ? String(first.packaging_unit_id) : null);
      setPackagingSize(first.packaging_size ?? null);

      const batch = commodities.find((c) => c.id === first.commodity_id);
      setBatchQuantity(batch?.quantity ?? 0);

      setDestinations(
        rawLines.map((line) => ({
          id: Math.random().toString(36).slice(2),
          kind: existingOrder.hub_id ? "hub" : "warehouse",
          hub_id: existingOrder.hub_id ? String(existingOrder.hub_id) : null,
          warehouse_id: existingOrder.warehouse_id ? String(existingOrder.warehouse_id) : null,
          quantity: line.quantity,
          notes: line.notes || "",
        }))
      );
    }
  }, [isEdit, existingOrder, id, commodities]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: createReceiptOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["receipt_orders"] });
      notifications.show({ title: "Success", message: "Receipt Order created", color: "green" });
      navigate(`/officer/receipt-orders/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: "Error",
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          "Failed to create Receipt Order",
        color: "red",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateReceiptOrder(Number(id), payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["receipt_orders"] });
      queryClient.invalidateQueries({ queryKey: ["receipt_orders", id] });
      notifications.show({ title: "Success", message: "Receipt Order updated", color: "green" });
      navigate(`/officer/receipt-orders/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: "Error",
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          "Failed to update Receipt Order",
        color: "red",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReceiptOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt_orders"] });
      notifications.show({ title: "Success", message: "Receipt Order deleted", color: "green" });
      navigate("/officer/receipt-orders");
    },
    onError: (error: unknown) => {
      notifications.show({
        title: "Error",
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          "Failed to delete Receipt Order",
        color: "red",
      });
    },
  });

  // ── Save handler ──
  const handleSave = () => {
    if (!expectedDeliveryDate) {
      notifications.show({ title: "Validation Error", message: "Expected delivery date is required", color: "red" });
      return;
    }
    if (!selectedBatchId) {
      notifications.show({ title: "Validation Error", message: "Please select a commodity and batch", color: "red" });
      return;
    }
    if (!unitId) {
      notifications.show({ title: "Validation Error", message: "Unit is required", color: "red" });
      return;
    }
    if (destinations.length === 0) {
      notifications.show({ title: "Validation Error", message: "Add at least one destination", color: "red" });
      return;
    }

    const invalidDest = destinations.find(
      (d) => !d.kind || (!d.hub_id && !d.warehouse_id) || !d.quantity || d.quantity <= 0
    );
    if (invalidDest) {
      notifications.show({
        title: "Validation Error",
        message: "Each destination must have a type, a hub or warehouse, and a quantity greater than 0",
        color: "red",
      });
      return;
    }

    if (totalAssigned > batchQuantity) {
      notifications.show({
        title: "Validation Error",
        message: `Total assigned (${totalAssigned}) exceeds batch quantity (${batchQuantity})`,
        color: "red",
      });
      return;
    }



    const lines: ReceiptOrderLine[] = destinations.map((d) => ({
      commodity_id: parseInt(selectedBatchId),
      quantity: d.quantity,
      unit_id: parseInt(unitId),
      packaging_unit_id: packagingUnitId ? parseInt(packagingUnitId) : undefined,
      packaging_size: packagingSize ?? undefined,
      notes: d.kind === "hub"
        ? `Hub: ${hubs?.find((h) => String(h.id) === d.hub_id)?.name ?? d.hub_id}${d.notes ? ` | ${d.notes}` : ""}`
        : `Warehouse: ${warehouses?.find((w) => String(w.id) === d.warehouse_id)?.name ?? d.warehouse_id}${d.notes ? ` | ${d.notes}` : ""}`,
    }));

    // Use the first destination as the order-level destination
    const firstDest = destinations[0];
    const payload = {
      hub_id: firstDest.kind === "hub" ? Number(firstDest.hub_id) : null,
      destination_warehouse_id: firstDest.kind === "warehouse" ? Number(firstDest.warehouse_id) : null,
      expected_delivery_date: expectedDeliveryDate instanceof Date
        ? expectedDeliveryDate.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      notes,
      lines,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // ── Selected batch info ──
  const selectedBatch = commodities.find((c) => String(c.id) === selectedBatchId);
  const unitLabel = units.find((u) => String(u.id) === unitId)?.name ?? "";
  const packagingUnitLabel = units.find((u) => String(u.id) === packagingUnitId)?.name ?? "";

  // ── Error / loading states for edit ──
  if (isEdit && orderError) {
    return (
      <Stack gap="md">
        <Title order={2}>Edit Receipt Order</Title>
        <Text c="red" size="sm">Could not load this order.</Text>
        <Group>
          <Button variant="light" onClick={() => refetchOrder()}>Retry</Button>
          <Button variant="subtle" onClick={() => navigate("/officer/receipt-orders")}>Back to list</Button>
        </Group>
      </Stack>
    );
  }

  if (isEdit && orderLoading) {
    return (
      <Stack gap="md">
        <Title order={2}>Edit Receipt Order</Title>
        <Text c="dimmed" size="sm">Loading order…</Text>
      </Stack>
    );
  }

  if (isEdit && existingOrder && !isDraftOrder) {
    return (
      <Stack gap="md">
        <Title order={2}>Edit Receipt Order</Title>
        <Text c="dimmed" size="sm">
          Only draft receipt orders can be edited. This order is {existingOrder.status}.
        </Text>
        <Button variant="light" onClick={() => navigate(`/officer/receipt-orders/${existingOrder.id}`)}>
          Back to order
        </Button>
      </Stack>
    );
  }

  // ── Render ──
  return (
    <Stack gap="md">
      <div>
        <Title order={2}>{isEdit ? "Edit Receipt Order" : "Create Receipt Order"}</Title>
        <Text c="dimmed" size="sm">
          {isEdit ? "Update order details" : "Create a new inbound warehouse order"}
        </Text>
      </div>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="lg">

          {/* ── Section 1: Commodity & Batch ── */}
          <div>
            <Text size="sm" fw={700} mb="sm">Commodity & Batch</Text>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="Commodity"
                placeholder="Search and select a commodity"
                data={commodityNameOptions}
                value={selectedCommodityId}
                onChange={handleCommoditySelect}
                searchable
                clearable
                required
                disabled={!fieldsEditable}
              />
              <Select
                label="Batch Number"
                placeholder={selectedCommodityId ? "Select a batch" : "Select commodity first"}
                data={batchOptions}
                value={selectedBatchId}
                onChange={handleBatchSelect}
                searchable
                clearable
                required
                disabled={!fieldsEditable || !selectedCommodityId}
              />
            </SimpleGrid>

            {selectedBatch && (
              <Card withBorder mt="sm" padding="sm" bg="blue.0" radius="md">
                <Group gap="xl" wrap="wrap">
                  <div>
                    <Text size="xs" c="dimmed" fw={600} tt="uppercase">Batch Quantity</Text>
                    <Text fw={700}>{batchQuantity.toLocaleString()} {unitLabel}</Text>
                  </div>
                  {packagingUnitLabel && (
                    <div>
                      <Text size="xs" c="dimmed" fw={600} tt="uppercase">Packaging Unit</Text>
                      <Text fw={700}>{packagingUnitLabel}</Text>
                    </div>
                  )}
                  {packagingSize && (
                    <div>
                      <Text size="xs" c="dimmed" fw={600} tt="uppercase">Size per Package</Text>
                      <Text fw={700}>{packagingSize}</Text>
                    </div>
                  )}
                  <div>
                    <Text size="xs" c="dimmed" fw={600} tt="uppercase">Remaining</Text>
                    <Text fw={700} c={remaining < 0 ? "red" : remaining === 0 ? "dimmed" : "green"}>
                      {remaining.toLocaleString()} {unitLabel}
                    </Text>
                  </div>
                </Group>
              </Card>
            )}
          </div>

          <Divider />

          {/* ── Section 2: Order Details ── */}
          <div>
            <Text size="sm" fw={700} mb="sm">Order Details</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <DateInput
                label="Expected Delivery Date"
                placeholder="Select date"
                value={expectedDeliveryDate}
                onChange={(val: string | null) =>
                  setExpectedDeliveryDate(val ? new Date(val) : null)
                }
                required
                disabled={!fieldsEditable}
              />
            </SimpleGrid>
            <Textarea
              label="Notes"
              placeholder="Add any general notes about this order..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              mt="md"
              rows={3}
              disabled={!fieldsEditable}
            />
          </div>

          <Divider />

          {/* ── Section 3: Destinations ── */}
          <div>
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={700}>Destinations</Text>
              {fieldsEditable && (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={handleAddDestination}
                  disabled={!selectedBatchId}
                >
                  Add Destination
                </Button>
              )}
            </Group>

            {!selectedBatchId && (
              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                Select a commodity and batch first, then assign destinations.
              </Alert>
            )}

            {selectedBatchId && remaining < 0 && (
              <Alert icon={<IconInfoCircle size={16} />} color="red" variant="light" mb="sm">
                Total assigned ({totalAssigned}) exceeds batch quantity ({batchQuantity}). Please reduce quantities.
              </Alert>
            )}

            {selectedBatchId && (
              <Table.ScrollContainer minWidth={900}>
                <Table striped verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Destination Type</Table.Th>
                      <Table.Th>Hub / Warehouse</Table.Th>
                      <Table.Th>Quantity</Table.Th>
                      <Table.Th>Notes</Table.Th>
                      {fieldsEditable && <Table.Th style={{ width: 50 }} />}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {destinations.map((dest) => {
                      const maxForThis = batchQuantity - (totalAssigned - dest.quantity);
                      return (
                        <Table.Tr key={dest.id}>
                          <Table.Td>
                            <Select
                              placeholder="Hub or Warehouse"
                              data={[
                                { value: "hub", label: "Hub" },
                                { value: "warehouse", label: "Warehouse" },
                              ]}
                              value={dest.kind || null}
                              onChange={(val) =>
                                handleDestinationChange(dest.id, "kind", (val || "") as DestinationKind)
                              }
                              disabled={!fieldsEditable}
                            />
                          </Table.Td>
                          <Table.Td>
                            {dest.kind === "hub" && (
                              <Select
                                placeholder="Select hub"
                                data={hubOptions}
                                value={dest.hub_id}
                                onChange={(val) => handleDestinationChange(dest.id, "hub_id", val)}
                                searchable
                                disabled={!fieldsEditable}
                              />
                            )}
                            {dest.kind === "warehouse" && (
                              <Select
                                placeholder="Select warehouse"
                                data={standaloneWarehouseOptions}
                                value={dest.warehouse_id}
                                onChange={(val) => handleDestinationChange(dest.id, "warehouse_id", val)}
                                searchable
                                disabled={!fieldsEditable}
                              />
                            )}
                            {!dest.kind && (
                              <Text size="sm" c="dimmed">Select type first</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={2}>
                              <NumberInput
                                placeholder="0"
                                value={dest.quantity}
                                onChange={(val) =>
                                  handleDestinationChange(dest.id, "quantity", Number(val) || 0)
                                }
                                min={0}
                                max={maxForThis > 0 ? maxForThis : undefined}
                                disabled={!fieldsEditable}
                              />
                              {batchQuantity > 0 && (
                                <Text size="xs" c={dest.quantity > maxForThis ? "red" : "dimmed"}>
                                  Max: {maxForThis.toLocaleString()} {unitLabel}
                                </Text>
                              )}
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <input
                              placeholder="Notes for this destination"
                              value={dest.notes}
                              onChange={(e) => handleDestinationChange(dest.id, "notes", e.target.value)}
                              disabled={!fieldsEditable}
                              style={{
                                width: "100%",
                                padding: "6px 10px",
                                border: "1px solid var(--mantine-color-gray-4)",
                                borderRadius: 4,
                                fontSize: 14,
                              }}
                            />
                          </Table.Td>
                          {fieldsEditable && (
                            <Table.Td>
                              <ActionIcon
                                color="red"
                                variant="subtle"
                                onClick={() => handleRemoveDestination(dest.id)}
                                disabled={destinations.length === 1}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Table.Td>
                          )}
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}

            {selectedBatchId && destinations.length > 0 && (
              <Group justify="flex-end" mt="xs">
                <Badge variant="light" color={remaining < 0 ? "red" : remaining === 0 ? "green" : "blue"} size="lg">
                  {totalAssigned.toLocaleString()} / {batchQuantity.toLocaleString()} {unitLabel} assigned
                </Badge>
              </Group>
            )}
          </div>

          {/* ── Actions ── */}
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => navigate("/officer/receipt-orders")}>
              Cancel
            </Button>
            {isEdit && (
              <Button
                color="red"
                variant="light"
                onClick={() => deleteMutation.mutate()}
                loading={isSaving}
              >
                Delete
              </Button>
            )}
            {fieldsEditable && (
              <Button onClick={handleSave} loading={isSaving}>
                {isEdit ? "Update draft" : "Save as Draft"}
              </Button>
            )}
          </Group>

        </Stack>
      </Card>
    </Stack>
  );
}

export default ReceiptOrderFormPage;
