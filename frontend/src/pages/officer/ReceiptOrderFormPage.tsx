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
  Text,
  Textarea,
  SimpleGrid,
  Divider,
  ActionIcon,
  NumberInput,
  Badge,
  TextInput,
  Alert,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash, IconAlertCircle } from "@tabler/icons-react";
import {
  createReceiptOrder,
  getReceiptOrder,
  updateReceiptOrder,
  deleteReceiptOrder,
} from "../../api/receiptOrders";
import { getWarehouses } from "../../api/warehouses";
import { getHubs } from "../../api/hubs";
import { getCommodityReferences, getUnitReferences } from "../../api/referenceData";
import { useAuthStore } from "../../store/authStore";
import { normalizeRoleSlug } from '../../contracts/warehouse';
import type { ReceiptOrderLine } from "../../api/receiptOrders";
import type { ApiError } from "../../types/common";

// ── Types ──────────────────────────────────────────────────────────────────

type DestinationKind = "hub" | "warehouse";

interface DestinationRow {
  id: string; // local key only
  kind: DestinationKind | "";
  hubId: string | null;
  warehouseId: string | null;
  quantity: number | string;
  notes: string;
}

function newDestinationRow(): DestinationRow {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "",
    hubId: null,
    warehouseId: null,
    quantity: "",
    notes: "",
  };
}

// ── Component ──────────────────────────────────────────────────────────────

function ReceiptOrderFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Auth & location context ──
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const location = activeAssignment?.location;
  const jurisdictionLabel = location
    ? `${location.name} (${location.location_type})`
    : "Federal / System-wide";

  // Check if sub-federal officer without location
  const SUB_FEDERAL_ROLES = ["Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer"];
  const isSubFederalOfficer = activeAssignment?.role_name
    ? SUB_FEDERAL_ROLES.includes(activeAssignment.role_name)
    : false;
  const hasLocationIssue = isSubFederalOfficer && !location;

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

  // ── Multiple destinations ──
  const [destinations, setDestinations] = useState<DestinationRow[]>([newDestinationRow()]);

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

  // Get active assignment context for filtering
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((state) => state.role));
  const userHubId = activeAssignment?.hub?.id;
  const isHubManager = roleSlug === 'hub_manager';

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => {
      if (isHubManager && userHubId) {
        return getWarehouses({ hub_id: userHubId });
      }
      return getWarehouses();
    },
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

  // ── Derived: total quantity assigned across all destinations ──
  const totalAssigned = useMemo(
    () =>
      destinations.reduce((sum, d) => {
        const q = Number(d.quantity);
        return sum + (isNaN(q) ? 0 : q);
      }, 0),
    [destinations]
  );

  const remaining = batchQuantity - totalAssigned;

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

  // ── Handlers: destinations ──
  const updateDestination = useCallback(
    (rowId: string, patch: Partial<DestinationRow>) => {
      setDestinations((prev) =>
        prev.map((d) => (d.id === rowId ? { ...d, ...patch } : d))
      );
    },
    []
  );

  const addDestination = useCallback(() => {
    setDestinations((prev) => [...prev, newDestinationRow()]);
  }, []);

  const removeDestination = useCallback((rowId: string) => {
    setDestinations((prev) => {
      if (prev.length <= 1) return prev; // keep at least one row
      return prev.filter((d) => d.id !== rowId);
    });
  }, []);

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

      // Build destination rows from lines
      const rows: DestinationRow[] = rawLines.map((line) => ({
        id: Math.random().toString(36).slice(2),
        kind: existingOrder.hub_id ? "hub" : "warehouse",
        hubId: existingOrder.hub_id ? String(existingOrder.hub_id) : null,
        warehouseId: existingOrder.warehouse_id ? String(existingOrder.warehouse_id) : null,
        quantity: line.quantity ?? "",
        notes: line.notes ?? "",
      }));
      setDestinations(rows.length > 0 ? rows : [newDestinationRow()]);
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
      notifications.show({ title: "Validation Error", message: "Unit is required — select a batch first", color: "red" });
      return;
    }

    // Validate destinations
    for (const dest of destinations) {
      if (!dest.kind || (!dest.hubId && !dest.warehouseId)) {
        notifications.show({
          title: "Validation Error",
          message: "Each destination must have a type and a facility selected",
          color: "red",
        });
        return;
      }
      const q = Number(dest.quantity);
      if (!dest.quantity || isNaN(q) || q <= 0) {
        notifications.show({
          title: "Validation Error",
          message: "Each destination must have a quantity greater than 0",
          color: "red",
        });
        return;
      }
    }

    if (totalAssigned > batchQuantity && batchQuantity > 0) {
      notifications.show({
        title: "Validation Error",
        message: `Total assigned (${totalAssigned}) exceeds batch quantity (${batchQuantity})`,
        color: "red",
      });
      return;
    }

    // Build one line per destination
    const lines: ReceiptOrderLine[] = destinations.map((dest) => {
      const facilityLabel =
        dest.kind === "hub"
          ? hubs?.find((h) => String(h.id) === dest.hubId)?.name ?? dest.hubId ?? ""
          : warehouses?.find((w) => String(w.id) === dest.warehouseId)?.name ?? dest.warehouseId ?? "";

      return {
        commodity_id: parseInt(selectedBatchId!),
        quantity: Number(dest.quantity),
        unit_id: parseInt(unitId!),
        packaging_unit_id: packagingUnitId ? parseInt(packagingUnitId) : undefined,
        packaging_size: packagingSize ?? undefined,
        notes: `${dest.kind === "hub" ? "Hub" : "Warehouse"}: ${facilityLabel}${dest.notes ? ` | ${dest.notes}` : ""}`,
      };
    });

    // Use first destination for hub/warehouse headers (backend links the order to one primary destination)
    const firstDest = destinations[0];
    const payload = {
      hub_id: firstDest.kind === "hub" ? Number(firstDest.hubId) : null,
      destination_warehouse_id:
        firstDest.kind === "warehouse" ? Number(firstDest.warehouseId) : null,
      expected_delivery_date:
        expectedDeliveryDate instanceof Date
          ? expectedDeliveryDate.toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      notes,
      lines,
      location_id: location?.id ?? null,
      hierarchical_level: location?.location_type ?? "Federal",
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // ── Selected batch info ──
  const unitLabel = units.find((u) => String(u.id) === unitId)?.name ?? "";

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

          {/* ── Warning: Missing location assignment ── */}
          {hasLocationIssue && (
            <Alert icon={<IconAlertCircle size={16} />} color="yellow" title="Missing Geographic Assignment">
              Your account has no geographic assignment. Contact your administrator.
            </Alert>
          )}

          {/* ── Section 1: Commodity & Batch ── */}
          <div>
            <Text size="sm" fw={700} mb="sm">Commodity &amp; Batch</Text>

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

            {/* Batch quantity / remaining info bar */}
            {selectedBatchId && (
              <Card
                withBorder
                mt="sm"
                padding="xs"
                radius="sm"
                style={{ background: "var(--mantine-color-blue-0)" }}
              >
                <Group gap="xl">
                  <div>
                    <Text size="xs" c="dimmed" fw={600} tt="uppercase">Batch Quantity</Text>
                    <Text fw={700} size="sm">
                      {batchQuantity.toLocaleString()} {unitLabel}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" fw={600} tt="uppercase">Remaining</Text>
                    <Text
                      fw={700}
                      size="sm"
                      c={remaining < 0 ? "red" : "blue"}
                    >
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
              <TextInput
                label="Jurisdiction"
                value={jurisdictionLabel}
                disabled
                description="Automatically assigned based on your role"
              />
              <DateInput
                label="Expected Delivery Date"
                placeholder="Select date"
                value={expectedDeliveryDate}
                onChange={(val: any) => setExpectedDeliveryDate(val ? new Date(val) : null)}
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
                  onClick={addDestination}
                >
                  Add Destination
                </Button>
              )}
            </Group>

            {/* Column headers */}
            <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm" mb={4}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Destination Type</Text>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Hub / Warehouse</Text>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Quantity</Text>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Notes</Text>
            </SimpleGrid>

            <Stack gap="xs">
              {destinations.map((dest, idx) => (
                <DestinationRowItem
                  key={dest.id}
                  dest={dest}
                  index={idx}
                  fieldsEditable={fieldsEditable}
                  hubOptions={hubOptions}
                  warehouseOptions={standaloneWarehouseOptions}
                  batchQuantity={batchQuantity}
                  unitLabel={unitLabel}
                  canRemove={destinations.length > 1}
                  onUpdate={(patch) => updateDestination(dest.id, patch)}
                  onRemove={() => removeDestination(dest.id)}
                />
              ))}
            </Stack>

            {/* Running total */}
            {selectedBatchId && batchQuantity > 0 && (
              <Group justify="flex-end" mt="xs">
                <Badge
                  color={totalAssigned > batchQuantity ? "red" : "blue"}
                  variant="light"
                  size="md"
                  tt="uppercase"
                >
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
              <Button onClick={handleSave} loading={isSaving} disabled={hasLocationIssue}>
                {isEdit ? "Update draft" : "Save as Draft"}
              </Button>
            )}
          </Group>

        </Stack>
      </Card>
    </Stack>
  );
}

// ── DestinationRowItem sub-component ──────────────────────────────────────

interface DestinationRowItemProps {
  dest: DestinationRow;
  index: number;
  fieldsEditable: boolean;
  hubOptions: { value: string; label: string }[];
  warehouseOptions: { value: string; label: string }[];
  batchQuantity: number;
  unitLabel: string;
  canRemove: boolean;
  onUpdate: (patch: Partial<DestinationRow>) => void;
  onRemove: () => void;
}

function DestinationRowItem({
  dest,
  fieldsEditable,
  hubOptions,
  warehouseOptions,
  batchQuantity,
  unitLabel,
  canRemove,
  onUpdate,
  onRemove,
}: DestinationRowItemProps) {
  const facilityOptions = dest.kind === "hub" ? hubOptions : warehouseOptions;
  const facilityValue = dest.kind === "hub" ? dest.hubId : dest.warehouseId;

  const handleKindChange = (val: string | null) => {
    onUpdate({
      kind: (val || "") as DestinationKind | "",
      hubId: null,
      warehouseId: null,
    });
  };

  const handleFacilityChange = (val: string | null) => {
    if (dest.kind === "hub") onUpdate({ hubId: val });
    else onUpdate({ warehouseId: val });
  };

  return (
    <Group gap="sm" align="flex-end" wrap="nowrap">
      {/* Destination Type */}
      <Select
        placeholder="Select type"
        data={[
          { value: "hub", label: "Hub" },
          { value: "warehouse", label: "Independent Warehouse" },
        ]}
        value={dest.kind || null}
        onChange={handleKindChange}
        disabled={!fieldsEditable}
        style={{ flex: "0 0 180px" }}
      />

      {/* Hub / Warehouse */}
      <Select
        placeholder={dest.kind ? `Select ${dest.kind === "hub" ? "hub" : "warehouse"}` : "Type first"}
        data={dest.kind ? facilityOptions : []}
        value={facilityValue ?? null}
        onChange={handleFacilityChange}
        searchable
        disabled={!fieldsEditable || !dest.kind}
        style={{ flex: 1 }}
      />

      {/* Quantity */}
      <div style={{ flex: "0 0 160px" }}>
        <NumberInput
          placeholder="Quantity"
          value={dest.quantity === "" ? undefined : Number(dest.quantity)}
          onChange={(val) => onUpdate({ quantity: val ?? "" })}
          min={0}
          max={batchQuantity > 0 ? batchQuantity : undefined}
          disabled={!fieldsEditable}
          description={batchQuantity > 0 ? `Max: ${batchQuantity.toLocaleString()} ${unitLabel}` : undefined}
        />
      </div>

      {/* Notes */}
      <div style={{ flex: 1 }}>
        <input
          type="text"
          placeholder="Notes for this destination"
          value={dest.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          disabled={!fieldsEditable}
          style={{
            width: "100%",
            padding: "7px 10px",
            border: "1px solid var(--mantine-color-gray-4)",
            borderRadius: 6,
            fontSize: 14,
            background: fieldsEditable ? "white" : "var(--mantine-color-gray-1)",
            color: "var(--mantine-color-dark-9)",
          }}
        />
      </div>

      {/* Remove button */}
      {fieldsEditable && (
        <ActionIcon
          color="gray"
          variant="subtle"
          onClick={onRemove}
          disabled={!canRemove}
          title="Remove destination"
          mb={20}
        >
          <IconTrash size={16} />
        </ActionIcon>
      )}
    </Group>
  );
}

export default ReceiptOrderFormPage;
