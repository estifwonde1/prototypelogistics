import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
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
  SimpleGrid,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconTrash, IconPlus } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  createReceiptOrder,
  getReceiptOrder,
  updateReceiptOrder,
  deleteReceiptOrder,
} from "../../api/receiptOrders";
import { getWarehouses } from "../../api/warehouses";
import { getHubs } from "../../api/hubs";
import {
  getCommodityReferences,
  getUnitReferences,
} from "../../api/referenceData";
import type { ReceiptOrderLine } from "../../api/receiptOrders";
import type { ApiError } from "../../types/common";

/** Receipt destination: receive into a warehouse under a hub, or a stand-alone warehouse */
type ReceiptDestinationKind = "hub" | "warehouse" | "";

const createEmptyItem = (): ReceiptOrderLine => ({
  commodity_id: 0,
  quantity: 0,
  unit_id: 0,
  notes: "",
  line_reference_no: "",
  packaging_unit_id: undefined,
  packaging_size: undefined,
});

function ReceiptOrderFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [destinationKind, setDestinationKind] =
    useState<ReceiptDestinationKind>("");
  const [destinationHubId, setDestinationHubId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | null>(
    new Date(),
  );
  const destinationHydratedKeyRef = useRef<string | null>(null);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReceiptOrderLine[]>([createEmptyItem()]);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
  });

  const { data: hubs } = useQuery({
    queryKey: ["hubs"],
    queryFn: getHubs,
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ["reference-data", "commodities"],
    queryFn: getCommodityReferences,
  });

  const { data: units = [] } = useQuery({
    queryKey: ["reference-data", "units"],
    queryFn: getUnitReferences,
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

  useEffect(() => {
    if (!isEdit || !existingOrder) return;

    const warehouseNumeric =
      existingOrder.destination_warehouse_id ?? existingOrder.warehouse_id;
    setWarehouseId(warehouseNumeric != null ? String(warehouseNumeric) : null);

    const dateRaw =
      existingOrder.expected_delivery_date || existingOrder.received_date;
    setExpectedDeliveryDate(dateRaw ? new Date(dateRaw) : null);

    setNotes(existingOrder.notes ?? existingOrder.description ?? "");

    const rawLines =
      existingOrder.lines ?? existingOrder.receipt_order_lines ?? [];
    setItems(
      rawLines.length > 0
        ? rawLines.map((line) => ({
            commodity_id: line.commodity_id,
            quantity: line.quantity,
            unit_id: line.unit_id,
            notes: line.notes ?? "",
            line_reference_no: line.line_reference_no ?? "",
          }))
        : [createEmptyItem()],
    );
  }, [isEdit, existingOrder]);

  useEffect(() => {
    if (!isEdit) {
      destinationHydratedKeyRef.current = null;
    }
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit || !id || !existingOrder) return;
    const hydrateKey = `${id}:${existingOrder.updated_at ?? existingOrder.id}`;
    if (destinationHydratedKeyRef.current === hydrateKey) return;
    const wid =
      existingOrder.destination_warehouse_id ?? existingOrder.warehouse_id;

    if (wid != null && warehouses?.length) {
      const w = warehouses.find((x) => x.id === wid);
      if (!w) return;
      if (w.hub_id != null) {
        setDestinationKind("hub");
        setDestinationHubId(String(w.hub_id));
      } else {
        setDestinationKind("warehouse");
        setDestinationHubId(null);
      }
      destinationHydratedKeyRef.current = hydrateKey;
      return;
    }

    if (wid == null && existingOrder.hub_id != null) {
      setDestinationKind("hub");
      setDestinationHubId(String(existingOrder.hub_id));
      destinationHydratedKeyRef.current = hydrateKey;
    }
  }, [isEdit, id, existingOrder, warehouses]);

  const destinationKindOptions = [
    { value: "hub", label: "Hub" },
    { value: "warehouse", label: "Warehouse" },
  ];

  const hubSelectOptions = useMemo(
    () => (hubs ?? []).map((h) => ({ value: String(h.id), label: h.name })),
    [hubs],
  );

  const standaloneWarehouses = useMemo(
    () => (warehouses ?? []).filter((w) => w.hub_id == null),
    [warehouses],
  );

  const standaloneWarehouseOptions = useMemo(
    () =>
      standaloneWarehouses.map((w) => ({ value: String(w.id), label: w.name })),
    [standaloneWarehouses],
  );

  const selectedWarehouse = warehouses?.find(
    (w) => String(w.id) === warehouseId,
  );
  const selectedHubName =
    destinationKind === "hub" && destinationHubId
      ? hubs?.find((h) => String(h.id) === destinationHubId)?.name
      : undefined;

  const handleDestinationKindChange = useCallback((val: string | null) => {
    const next = (val || "") as ReceiptDestinationKind;
    setDestinationKind(next);
    setDestinationHubId(null);
    setWarehouseId(null);
  }, []);

  const handleDestinationHubChange = useCallback((val: string | null) => {
    setDestinationHubId(val);
  }, []);

  const commodityOptions =
    commodities?.map((c) => {
      const name = c.name ?? `Commodity #${c.id}`;
      const label = c.batch_no ? `${name} — ${c.batch_no}` : name;
      return {
        value: String(c.id),
        label,
      };
    }) || [];

  const commodityLabelById = useMemo(() => {
    const map = new Map<number, string>();
    commodities.forEach((c) => {
      const name = c.name ?? `Commodity #${c.id}`;
      map.set(c.id, c.batch_no ? `${name} — ${c.batch_no}` : name);
    });
    return map;
  }, [commodities]);

  const unitOptions =
    units?.map((u) => ({
      value: String(u.id),
      label: u.name,
    })) || [];

  const createMutation = useMutation({
    mutationFn: createReceiptOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["receipt_orders"] });
      notifications.show({
        title: "Success",
        message: "Receipt Order created successfully",
        color: "green",
      });
      navigate(`/officer/receipt-orders/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: "Error",
        message:
          (isAxiosError<ApiError>(error)
            ? error.response?.data?.error?.message
            : undefined) || "Failed to create Receipt Order",
        color: "red",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateReceiptOrder(Number(id), payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["receipt_orders"] });
      queryClient.invalidateQueries({ queryKey: ["receipt_orders", id] });
      notifications.show({
        title: "Success",
        message: "Receipt Order updated successfully",
        color: "green",
      });
      navigate(`/officer/receipt-orders/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: "Error",
        message:
          (isAxiosError<ApiError>(error)
            ? error.response?.data?.error?.message
            : undefined) || "Failed to update Receipt Order",
        color: "red",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReceiptOrder(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt_orders"] });
      notifications.show({
        title: "Success",
        message: "Receipt Order deleted successfully",
        color: "green",
      });
      navigate("/officer/receipt-orders");
    },
    onError: (error: unknown) => {
      notifications.show({
        title: "Error",
        message:
          (isAxiosError<ApiError>(error)
            ? error.response?.data?.error?.message
            : undefined) || "Failed to delete Receipt Order",
        color: "red",
      });
    },
  });

  const handleAddItem = () => {
    setItems((current) => [...current, createEmptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const handleItemChange = <K extends keyof ReceiptOrderLine>(
    index: number,
    field: K,
    value: ReceiptOrderLine[K],
  ) => {
    setItems((current) => {
      const next = [...current];

      const stringValue = String(value);

      if (!stringValue) {
        return current;
      }

      next[index] = { ...next[index], [field]: value };

      // Auto-fill unit and line_ref when commodity is selected
      if (field === "commodity_id") {
        const numericId = Number(stringValue);
        const commodity = commodities.find((c) => c.id === numericId);
        if (commodity) {
          // Auto-select unit if defined
          if (commodity.unit_id) {
            next[index].unit_id = commodity.unit_id;
          }
          // Auto-fill line_reference_no from batch_no if empty
          if (commodity.batch_no && !next[index].line_reference_no) {
            next[index].line_reference_no = commodity.batch_no;
          }
          // Auto-select packaging unit if defined
          if (commodity.package_unit_id && !next[index].packaging_unit_id) {
            next[index].packaging_unit_id = commodity.package_unit_id;
          }
          // Auto-fill size per package if defined
          if (commodity.package_size && !next[index].packaging_size) {
            next[index].packaging_size = commodity.package_size;
          }
        }
      }

      return next;
    });
  };

  const handleSave = () => {
    if (!expectedDeliveryDate) {
      notifications.show({
        title: "Validation Error",
        message: "Please fill in all required fields",
        color: "red",
      });
      return;
    }

    if (!destinationKind) {
      notifications.show({
        title: "Validation Error",
        message: "Please select a destination type (Hub or Warehouse)",
        color: "red",
      });
      return;
    }

    if (destinationKind === "hub") {
      if (!destinationHubId) {
        notifications.show({
          title: "Validation Error",
          message: "Please select a hub",
          color: "red",
        });
        return;
      }
    } else if (destinationKind === "warehouse") {
      if (!warehouseId) {
        notifications.show({
          title: "Validation Error",
          message: "Please select a destination warehouse",
          color: "red",
        });
        return;
      }
      const wh = warehouses?.find((w) => String(w.id) === warehouseId);
      if (wh && wh.hub_id != null) {
        notifications.show({
          title: "Validation Error",
          message:
            "Select a stand-alone warehouse, or choose destination type Hub",
          color: "red",
        });
        return;
      }
    }

    if (
      items.length === 0 ||
      items.some(
        (item) => !item.commodity_id || !item.quantity || !item.unit_id,
      )
    ) {
      notifications.show({
        title: "Validation Error",
        message:
          "Please add at least one line with commodity, quantity, and unit",
        color: "red",
      });
      return;
    }

    const exceeding = items.find((item) => {
      if (!item.commodity_id) return false;
      const commodity = commodities.find((c) => c.id === item.commodity_id);
      if (!commodity || commodity.quantity == null) return false;
      return item.quantity > commodity.quantity;
    });

    if (exceeding) {
      const label =
        commodityLabelById.get(exceeding.commodity_id) ||
        "selected commodity";
      notifications.show({
        title: "Validation Error",
        message: `Destination quantity exceeds the total quantity for ${label}.`,
        color: "red",
      });
      return;
    }

    const dateStr =
      expectedDeliveryDate instanceof Date
        ? expectedDeliveryDate.toISOString().split("T")[0]
        : expectedDeliveryDate;

    const payload =
      destinationKind === "hub"
        ? {
            destination_warehouse_id: null,
            hub_id: Number(destinationHubId),
            expected_delivery_date: dateStr,
            notes,
            lines: items,
          }
        : {
            destination_warehouse_id: Number(warehouseId),
            hub_id: selectedWarehouse?.hub_id ?? null,
            expected_delivery_date: dateStr,
            notes,
            lines: items,
          };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  if (isEdit && orderError) {
    return (
      <Stack gap="md">
        <Title order={2}>Edit Receipt Order</Title>
        <Text c="red" size="sm">
          Could not load this order.
        </Text>
        <Group>
          <Button variant="light" onClick={() => refetchOrder()}>
            Retry
          </Button>
          <Button
            variant="subtle"
            onClick={() => navigate("/officer/receipt-orders")}
          >
            Back to list
          </Button>
        </Group>
      </Stack>
    );
  }

  if (isEdit && orderLoading) {
    return (
      <Stack gap="md">
        <Title order={2}>Edit Receipt Order</Title>
        <Text c="dimmed" size="sm">
          Loading order…
        </Text>
      </Stack>
    );
  }

  if (isEdit && existingOrder && !isDraftOrder) {
    return (
      <Stack gap="md">
        <Title order={2}>Edit Receipt Order</Title>
        <Text c="dimmed" size="sm">
          Only draft receipt orders can be edited. This order is{" "}
          {existingOrder.status}.
        </Text>
        <Button
          variant="light"
          onClick={() =>
            navigate(`/officer/receipt-orders/${existingOrder.id}`)
          }
        >
          Back to order
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>
          {isEdit ? "Edit Receipt Order" : "Create Receipt Order"}
        </Title>
        <Text c="dimmed" size="sm">
          {isEdit
            ? "Update order details"
            : "Create a new inbound warehouse order"}
        </Text>
      </div>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <div>
            <Text size="sm" fw={600} mb="md">
              Order Details
            </Text>

            <Select
              label="Destination Type"
              placeholder="Select destination type"
              description="Hub: receiving is directed to a hub (no warehouse yet). Warehouse: a stand-alone site only."
              data={destinationKindOptions}
              value={destinationKind || null}
              onChange={handleDestinationKindChange}
              required
              disabled={!fieldsEditable}
              mt="md"
            />

            {destinationKind === "hub" && (
              <Select
                label="Hub"
                placeholder="Select hub"
                data={hubSelectOptions}
                value={destinationHubId}
                onChange={handleDestinationHubChange}
                required
                disabled={!fieldsEditable}
                mt="sm"
              />
            )}

            {destinationKind === "warehouse" && (
              <Select
                label="Destination Warehouse"
                placeholder={
                  standaloneWarehouses.length
                    ? "Select stand-alone warehouse"
                    : "No stand-alone warehouses available"
                }
                data={standaloneWarehouseOptions}
                value={warehouseId}
                onChange={setWarehouseId}
                required
                disabled={!fieldsEditable || standaloneWarehouses.length === 0}
                mt="sm"
              />
            )}

            <SimpleGrid cols={{ base: 1, sm: 2 }} mt="md">
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
            {destinationKind === "hub" && selectedHubName && (
              <Text size="sm" c="dimmed" mt="xs">
                Goods will be received into hub: {selectedHubName}. A specific
                warehouse can be set when confirming or receiving (e.g. on GRN).
              </Text>
            )}
            {destinationKind === "warehouse" && selectedWarehouse && (
              <Text size="sm" c="dimmed" mt="xs">
                Receiving hub:{" "}
                {selectedWarehouse.hub_name ??
                  "— (standalone warehouse, not under a hub)"}
              </Text>
            )}
            <Textarea
              label="Notes"
              placeholder="Add any notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              mt="md"
              rows={3}
              disabled={!fieldsEditable}
            />
          </div>

          <div>
            <Group justify="space-between" mb="md">
              <Text size="sm" fw={600}>
                Order Items
              </Text>
              {fieldsEditable && (
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPlus size={14} />}
                    onClick={handleAddItem}
                  >
                    Add Item
                  </Button>
                </Group>
              )}
            </Group>

            {destinationKind === "hub" && (
              <Text size="xs" c="dimmed" mb="sm">
                Destination is a hub; available stock validation is skipped
                until a warehouse is set.
              </Text>
            )}

            <Table.ScrollContainer minWidth={720}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Commodity</Table.Th>
                    <Table.Th>Line ref</Table.Th>
                    <Table.Th>Destination Quantity</Table.Th>
                    <Table.Th>Unit</Table.Th>
                    <Table.Th>Packaging Unit</Table.Th>
                    <Table.Th>Size per Package</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th>Notes</Table.Th>
                    {fieldsEditable && (
                      <Table.Th style={{ textAlign: "right" }}>
                        Actions
                      </Table.Th>
                    )}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((item, index) => {
                    const total =
                      item.packaging_size && item.quantity
                        ? (item.quantity * item.packaging_size).toFixed(2)
                        : null;
                    return (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <Select
                            placeholder="Select commodity"
                            data={commodityOptions}
                            value={item.commodity_id?.toString()}
                            onChange={(val) =>
                              handleItemChange(
                                index,
                                "commodity_id",
                                parseInt(val || "0"),
                              )
                            }
                            searchable
                            disabled={!fieldsEditable}
                          />
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            placeholder="Optional; auto if empty"
                            value={item.line_reference_no ?? ""}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "line_reference_no",
                                e.target.value,
                              )
                            }
                            disabled={!fieldsEditable}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <NumberInput
                              placeholder="0"
                              value={item.quantity}
                              onChange={(val) =>
                                handleItemChange(
                                  index,
                                  "quantity",
                                  Number(val) || 0,
                                )
                              }
                              disabled={!fieldsEditable}
                            />
                            {item.commodity_id
                              ? (() => {
                                  const commodity = commodities.find((c) => c.id === item.commodity_id);
                                  if (!commodity || commodity.quantity == null) return null;
                                  const maxQuantity = commodity.quantity;
                                  const isOver = item.quantity > maxQuantity;
                                  const unitLabel = commodity.unit_name || commodity.unit_abbreviation || "";
                                  return (
                                    <Text
                                      size="xs"
                                      c={isOver ? "red" : "dimmed"}
                                    >
                                      Max allowed: {maxQuantity.toFixed(2)} {unitLabel}
                                    </Text>
                                  );
                                })()
                              : null}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Select
                            placeholder="Select unit"
                            data={unitOptions}
                            value={item.unit_id?.toString()}
                            onChange={(val) =>
                              handleItemChange(
                                index,
                                "unit_id",
                                parseInt(val || "0"),
                              )
                            }
                            disabled={!fieldsEditable}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Select
                            placeholder="e.g. Bag"
                            data={unitOptions}
                            value={item.packaging_unit_id?.toString() ?? null}
                            onChange={(val) =>
                              handleItemChange(
                                index,
                                "packaging_unit_id",
                                val ? parseInt(val) : undefined,
                              )
                            }
                            clearable
                            disabled={!fieldsEditable}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            placeholder="e.g. 25"
                            value={item.packaging_size ?? ""}
                            onChange={(val) =>
                              handleItemChange(
                                index,
                                "packaging_size",
                                val !== "" ? Number(val) : undefined,
                              )
                            }
                            disabled={!fieldsEditable}
                            min={0}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text
                            size="sm"
                            fw={600}
                            c={total ? "blue" : "dimmed"}
                          >
                            {total
                              ? `${total} ${unitOptions.find((u) => u.value === item.unit_id?.toString())?.label ?? ""}`
                              : "—"}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            placeholder="Notes"
                            value={item.notes}
                            onChange={(e) =>
                              handleItemChange(index, "notes", e.target.value)
                            }
                            disabled={!fieldsEditable}
                          />
                        </Table.Td>
                        {fieldsEditable && (
                          <Table.Td>
                            <ActionIcon
                              color="red"
                              variant="subtle"
                              onClick={() => handleRemoveItem(index)}
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
          </div>

          <Group justify="flex-end" mt="xl">
            <Button
              variant="light"
              onClick={() => navigate("/officer/receipt-orders")}
            >
              Cancel
            </Button>
            {isEdit && (
              <Button
                color="red"
                variant="light"
                onClick={() => deleteMutation.mutate()}
                loading={isLoading}
              >
                Delete
              </Button>
            )}
            {fieldsEditable && (
              <Button onClick={handleSave} loading={isLoading}>
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
