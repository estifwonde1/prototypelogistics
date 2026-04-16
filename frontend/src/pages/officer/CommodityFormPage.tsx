import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  Autocomplete,
  NumberInput,
  Select,
  Card,
  Text,
  Table,
  Switch,
  Badge,
  Tooltip,
  ActionIcon,
  Collapse,
  Box,
  Divider,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  IconArrowLeft,
  IconPlus,
  IconRefresh,
  IconChevronDown,
  IconChevronRight,
  IconSearch,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { isAxiosError } from "axios";
import {
  getCommodityReferences,
  getUnitReferences,
  getCategoryReferences,
  createCommodity,
} from "../../api/referenceData";
import type { ApiError } from "../../types/common";
import type { CreateCommodityPayload } from "../../api/referenceData";
import type { CommodityReference } from "../../types/referenceData";

function CommodityFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [batchNo, setBatchNo] = useState("");
  const [autoGenBatch, setAutoGenBatch] = useState(true);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [packageUnitId, setPackageUnitId] = useState<string | null>(null);
  const [packageSize, setPackageSize] = useState<number | string>("");
  const [sourceType, setSourceType] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCommodities, setExpandedCommodities] = useState<Set<string>>(
    new Set(),
  );

  const generateBatchNo = () =>
    `BATCH-${dayjs().format("YYYYMMDD")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  const [previewBatch, setPreviewBatch] = useState(() => generateBatchNo());

  const { data: commodities = [], isLoading } = useQuery({
    queryKey: ["reference-data", "commodities"],
    queryFn: getCommodityReferences,
  });

  const { data: units = [] } = useQuery({
    queryKey: ["reference-data", "units"],
    queryFn: getUnitReferences,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["reference-data", "categories"],
    queryFn: getCategoryReferences,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateCommodityPayload) => {
      return createCommodity({
        name: payload.name,
        batch_no: payload.batch_no,
        quantity: payload.quantity,
        unit_id: payload.unit_id || undefined,
        commodity_category_id: payload.commodity_category_id || undefined,
        best_use_before: payload.best_use_before,
        package_unit_id: payload.package_unit_id,
        package_size: payload.package_size,
        source_type: payload.source_type,
        source_name: payload.source_name,
      });
    },
    onSuccess: (newCommodity) => {
      queryClient.invalidateQueries({
        queryKey: ["reference-data", "commodities"],
      });
      setName("");
      setBatchNo("");
      setAutoGenBatch(true);
      setPreviewBatch(generateBatchNo());
      setQuantity(1);
      setUnitId(null);
      setPackageUnitId(null);
      setPackageSize("");
      setCategory(null);
      setExpiryDate(null);
      setSourceType("");
      setSourceName("");
      notifications.show({
        title: "Success",
        message: `Commodity "${newCommodity.name}" created successfully`,
        color: "green",
      });
    },
    onError: (error: unknown) => {
      notifications.show({
        title: "Error",
        message:
          (isAxiosError<ApiError>(error)
            ? error.response?.data?.error?.message
            : undefined) || "Failed to create commodity",
        color: "red",
      });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      notifications.show({
        title: "Error",
        message: "Commodity name is required",
        color: "red",
      });
      return;
    }
    if (!sourceType.trim()) {
      notifications.show({
        title: "Error",
        message: "Source type is required",
        color: "red",
      });
      return;
    }
    if (!sourceName.trim()) {
      notifications.show({
        title: "Error",
        message: "Source name is required",
        color: "red",
      });
      return;
    }
    const qty =
      typeof quantity === "number"
        ? quantity
        : parseFloat(quantity as string) || 0;
    if (qty <= 0) {
      notifications.show({
        title: "Error",
        message: "Quantity must be greater than 0",
        color: "red",
      });
      return;
    }
    if (!autoGenBatch && !batchNo.trim()) {
      notifications.show({
        title: "Error",
        message: "Please enter a Batch No. or switch to auto-generate",
        color: "red",
      });
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      batch_no: autoGenBatch ? undefined : batchNo.trim(),
      quantity: qty,
      unit_id: unitId ? parseInt(unitId) : undefined,
      commodity_category_id: category ? parseInt(category) : undefined,
      best_use_before: expiryDate ? dayjs(expiryDate).toISOString() : undefined,
      package_unit_id: packageUnitId ? parseInt(packageUnitId) : undefined,
      package_size:
        packageSize !== ""
          ? typeof packageSize === "number"
            ? packageSize
            : parseFloat(packageSize as string) || undefined
          : undefined,
      source_type: sourceType.trim(),
      source_name: sourceName.trim(),
    });
  };

  const unitOptions = units.map((u) => ({
    value: String(u.id),
    label: u.name,
  }));

  const categoryOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const sourceTypeOptions = [
    { value: "Supplier", label: "Supplier" },
    { value: "Gift", label: "Gift (Donation)" },
  ];

  const commodityNameOptions = useMemo(() => {
    const names = commodities
      .map((c) => c.name?.trim())
      .filter((val): val is string => Boolean(val));
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [commodities]);

  const normalizedName = name.trim().toLowerCase();
  const existingNameMatch = useMemo(
    () =>
      Boolean(normalizedName) &&
      commodityNameOptions.some((n) => n.toLowerCase() === normalizedName),
    [commodityNameOptions, normalizedName],
  );

  // Group commodities by name
  const groupedCommodities = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; batches: CommodityReference[] }
    >();

    commodities.forEach((commodity) => {
      const commodityName = commodity.name || "Unnamed";
      if (!groups.has(commodityName)) {
        groups.set(commodityName, { name: commodityName, batches: [] });
      }
      groups.get(commodityName)!.batches.push(commodity);
    });

    // Sort batches within each group by ID (most recent first)
    groups.forEach((group) => {
      group.batches.sort((a, b) => b.id - a.id);
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [commodities]);

  // Filter commodities based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedCommodities;

    const query = searchQuery.toLowerCase().trim();
    return groupedCommodities
      .map((group) => ({
        ...group,
        batches: group.batches.filter(
          (batch) =>
            group.name.toLowerCase().includes(query) ||
            batch.batch_no?.toLowerCase().includes(query) ||
            batch.source_type?.toLowerCase().includes(query) ||
            batch.source_name?.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.batches.length > 0);
  }, [groupedCommodities, searchQuery]);

  const toggleCommodityExpansion = (commodityName: string) => {
    setExpandedCommodities((prev) => {
      const next = new Set(prev);
      if (next.has(commodityName)) {
        next.delete(commodityName);
      } else {
        next.add(commodityName);
      }
      return next;
    });
  };

  return (
    <Stack gap="md">
      <Group>
        <Button
          variant="default"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate("/officer/receipt-orders/new")}
        >
          Back to Receipt Order
        </Button>
      </Group>

      <Card padding="lg">
        <Stack gap="md">
          <Title order={3}>Create New Commodity</Title>

          <Autocomplete
            label="Commodity Name"
            placeholder="e.g. Sugar, Rice, Blankets"
            required
            value={name}
            onChange={setName}
            data={commodityNameOptions}
          />

          {existingNameMatch && (
            <Text size="sm" c="orange">
              This commodity name already exists. Creating it will add a new
              batch with a different batch number.
            </Text>
          )}

          <Select
            label="Source Type"
            placeholder="Select source type"
            required
            data={sourceTypeOptions}
            value={sourceType}
            onChange={(val) => setSourceType(val || "")}
            description="Where is this commodity coming from?"
          />

          <TextInput
            label="Source Name"
            placeholder="Enter source name"
            required
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            description="Name of the supplier or donor"
          />

          <Switch
            label="Auto-generate Batch No."
            checked={autoGenBatch}
            onChange={(e) => setAutoGenBatch(e.currentTarget.checked)}
          />

          {autoGenBatch ? (
            <Group gap="xs" align="center">
              <Text size="sm" c="dimmed">
                Preview:
              </Text>
              <Badge
                variant="outline"
                color="blue"
                size="lg"
                style={{ fontFamily: "monospace", letterSpacing: 1 }}
              >
                {previewBatch}
              </Badge>
              <Tooltip label="Refresh preview">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => setPreviewBatch(generateBatchNo())}
                >
                  <IconRefresh size={14} />
                </ActionIcon>
              </Tooltip>
              <Text size="xs" c="dimmed">
                (final value set by server)
              </Text>
            </Group>
          ) : (
            <TextInput
              label="Batch No."
              placeholder="e.g. BATCH-20260415-XYZ"
              required
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              description="Unique identifier for this commodity batch"
            />
          )}

          <NumberInput
            label="Quantity"
            placeholder="e.g. 1000"
            min={1}
            value={quantity}
            onChange={setQuantity}
            description="Must be greater than 0"
            required
          />

          <Select
            label="Default Unit (optional)"
            placeholder="Select unit"
            data={unitOptions}
            value={unitId}
            onChange={setUnitId}
            clearable
          />

          <Select
            label="Packaging Unit (optional)"
            placeholder="Select packaging unit"
            data={unitOptions}
            value={packageUnitId}
            onChange={setPackageUnitId}
            clearable
          />

          <NumberInput
            label="Size per Package (optional)"
            placeholder="e.g. 25"
            min={0}
            value={packageSize}
            onChange={setPackageSize}
          />

          <Select
            label="Category (optional)"
            placeholder="Select category"
            data={categoryOptions}
            value={category}
            onChange={setCategory}
            clearable
          />

          <DateInput
            label="Expiry Date (optional)"
            placeholder="Select expiry date"
            value={expiryDate}
            onChange={(val) => setExpiryDate(val as Date | null)}
            clearable
          />

          <Group>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              leftSection={<IconPlus size={16} />}
            >
              Create Commodity
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card padding="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Existing Commodities</Title>
            <Badge size="lg" variant="light">
              {filteredGroups.length} Commodit
{filteredGroups.length === 1 ? "y" : "ies"}
            </Badge>
          </Group>

          <TextInput
            placeholder="Search by name, batch number, source type, or source name..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            rightSection={
              searchQuery && (
                <ActionIcon
                  variant="subtle"
                  onClick={() => setSearchQuery("")}
                  size="sm"
                >
                  ×
                </ActionIcon>
              )
            }
          />

          {isLoading ? (
            <Text>Loading...</Text>
          ) : filteredGroups.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {searchQuery
                ? "No commodities found matching your search"
                : "No commodities created yet"}
            </Text>
          ) : (
            <Box>
              {filteredGroups.map((group) => {
                const isExpanded = expandedCommodities.has(group.name);
                const latestBatch = group.batches[0];
                const totalBatches = group.batches.length;

                return (
                  <Card
                    key={group.name}
                    withBorder
                    mb="sm"
                    padding="md"
                    style={{ cursor: "pointer" }}
                  >
                    <Box
                      onClick={() => toggleCommodityExpansion(group.name)}
                      style={{ userSelect: "none" }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            color="gray"
                          >
                            {isExpanded ? (
                              <IconChevronDown size={16} />
                            ) : (
                              <IconChevronRight size={16} />
                            )}
                          </ActionIcon>
                          <div>
                            <Text fw={600} size="lg">
                              {group.name}
                            </Text>
                            <Group gap="xs" mt={4}>
                              <Badge size="sm" variant="light" color="blue">
                                {totalBatches} Batch
                                {totalBatches === 1 ? "" : "es"}
                              </Badge>
                              {latestBatch.source_type && (
                                <Badge size="sm" variant="dot" color="green">
                                  {latestBatch.source_type}
                                </Badge>
                              )}
                            </Group>
                          </div>
                        </Group>
                        <Box ta="right">
                          <Text size="sm" c="dimmed">
                            Latest Batch
                          </Text>
                          <Text size="sm" fw={500} style={{ fontFamily: "monospace" }}>
                            {latestBatch.batch_no || "—"}
                          </Text>
                        </Box>
                      </Group>
                    </Box>

                    <Collapse in={isExpanded}>
                      <Divider my="md" />
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Batch No</Table.Th>
                            <Table.Th>Source Type</Table.Th>
                            <Table.Th>Source Name</Table.Th>
                            <Table.Th>Quantity</Table.Th>
                            <Table.Th>Unit</Table.Th>
                            <Table.Th>Packaging</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {group.batches.map((batch) => (
                            <Table.Tr key={batch.id}>
                              <Table.Td>
                                <Text
                                  size="sm"
                                  fw={500}
                                  style={{ fontFamily: "monospace" }}
                                >
                                  {batch.batch_no || "—"}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                {batch.source_type ? (
                                  <Badge size="sm" variant="light" color="green">
                                    {batch.source_type}
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {batch.source_name || "—"}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" fw={500}>
                                  {batch.quantity?.toLocaleString() ?? "—"}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {batch.unit_abbreviation ||
                                    batch.unit_name ||
                                    "—"}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                {batch.package_size && batch.package_unit_name ? (
                                  <Text size="sm">
                                    {batch.package_size} {batch.package_unit_name}
                                  </Text>
                                ) : (
                                  "—"
                                )}
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Collapse>
                  </Card>
                );
              })}
            </Box>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

export default CommodityFormPage;
