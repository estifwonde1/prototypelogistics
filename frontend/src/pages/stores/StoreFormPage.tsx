/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  NumberInput,
  Select,
  Switch,
  Card,
  Text,
  Tooltip,
  SimpleGrid,
  Alert,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconDeviceFloppy } from "@tabler/icons-react";
import { getStore, getStores, createStore, updateStore } from "../../api/stores";
import { getWarehouse, getWarehouses } from "../../api/warehouses";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { notifications } from "@mantine/notifications";
import type { Store } from "../../types/store";
import {
  allocatedStoreMt,
  storeUsableVolumeM3,
  storeDimensionHints,
  formatFootprintHint,
  dimensionAxisStatus,
  footprintStatus,
  dimensionInputBorderStyle,
  dimensionValidLabel,
  previewWarehouseCapacity,
  type DimensionFieldStatus,
} from "../../utils/capacityCalculator";

function StoreFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const preselectedWarehouseId = searchParams.get("warehouse_id");
  const hydratedStoreIdRef = useRef<number | null>(null);

  const { data: store, isLoading } = useQuery({
    queryKey: ["stores", id],
    queryFn: () => getStore(Number(id)),
    enabled: isEdit,
  });

  // Get active assignment context for filtering
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || useAuthStore((state) => state.role));
  const userHubId = activeAssignment?.hub?.id;
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const isHubManager = roleSlug === 'hub_manager';
  const isWarehouseManager = roleSlug === 'warehouse_manager';

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", { hub_id: isHubManager ? userHubId : undefined, warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
    queryFn: async () => {
      if (isHubManager && userHubId) {
        return getWarehouses({ hub_id: userHubId });
      }
      if (isWarehouseManager && userWarehouseId) {
        const wh = await getWarehouse(userWarehouseId);
        return [wh];
      }
      return getWarehouses();
    },
  });

  const form = useForm({
    initialValues: {
      code: "",
      name: "",
      length: 0,
      width: 0,
      height: 0,
      temporary: false,
      has_gangway: false,
      gangway_length: 0,
      gangway_width: 0,
      gangway_height: 0,
      warehouse_id: preselectedWarehouseId || "",
    },
    validate: {
      name: (value) => (!value ? "Name is required" : null),
      code: (value) => (!value ? "Code is required" : null),
      length: (value) => (value <= 0 ? "Length must be greater than 0" : null),
      width: (value) => (value <= 0 ? "Width must be greater than 0" : null),
      height: (value) => (value <= 0 ? "Height must be greater than 0" : null),
      warehouse_id: (value) => (!value ? "Warehouse is required" : null),
    },
  });

  useEffect(() => {
    if (store && hydratedStoreIdRef.current !== store.id) {
      form.setValues({
        code: store.code,
        name: store.name,
        length: store.length,
        width: store.width,
        height: store.height,
        temporary: store.temporary,
        has_gangway: store.has_gangway,
        gangway_length: store.gangway_length || 0,
        gangway_width: store.gangway_width || 0,
        gangway_height: store.gangway_height || 0,
        warehouse_id: store.warehouse_id.toString(),
      });
      hydratedStoreIdRef.current = store.id;
    }
  }, [store, form]);

  // Auto-select warehouse when user only has access to one (e.g. warehouse manager).
  useEffect(() => {
    if (isEdit || preselectedWarehouseId || form.values.warehouse_id || warehouses.length !== 1) return;
    form.setFieldValue("warehouse_id", warehouses[0].id.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses, isEdit, preselectedWarehouseId]);

  const createMutation = useMutation({
    mutationFn: createStore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      notifications.show({
        title: "Success",
        message: "Store created successfully",
        color: "green",
      });
      navigate("/stores");
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.error?.message || "Failed to create store",
        color: "red",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Store>) => updateStore(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      queryClient.invalidateQueries({ queryKey: ["stores", id] });
      notifications.show({
        title: "Success",
        message: "Store updated successfully",
        color: "green",
      });
      navigate("/stores");
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.error?.message || "Failed to update store",
        color: "red",
      });
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    const wh = warehouses.find((w) => w.id.toString() === values.warehouse_id);
    if (wh && !wh.capacity?.capacity_established) {
      notifications.show({
        title: "Capacity required",
        message: "Establish warehouse capacity before creating stores",
        color: "red",
      });
      return;
    }

    if (dimensionHints && !dimensionsAllValid) {
      notifications.show({
        title: "Dimensions out of range",
        message: "Fix fields marked in red so the store fits inside the warehouse.",
        color: "red",
      });
      return;
    }

    if (capacityExceedsWarehouse) {
      notifications.show({
        title: "Capacity exceeded",
        message: "This store would use more MT than the warehouse has remaining.",
        color: "red",
      });
      return;
    }

    const payload: Partial<Store> = {
      code: values.code,
      name: values.name,
      length: values.length,
      width: values.width,
      height: values.height,
      temporary: values.temporary,
      has_gangway: values.has_gangway,
      warehouse_id: Number(values.warehouse_id),
    };

    if (values.has_gangway) {
      payload.gangway_length = values.gangway_length;
      payload.gangway_width = values.gangway_width;
      payload.gangway_height = values.gangway_height;
    }

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const warehouseOptions = warehouses?.map((warehouse) => ({
    value: warehouse.id.toString(),
    label: `${warehouse.name} (${warehouse.code})`,
  }));

  const totalSpace = form.values.length * form.values.width;
  const gangwayArea = form.values.has_gangway
    ? form.values.gangway_length * form.values.gangway_width
    : 0;
  const storeArea = Math.max(totalSpace - gangwayArea, 0);

  const selectedWarehouse = warehouses.find(
    (w) => w.id.toString() === form.values.warehouse_id
  );
  const capacityEstablished = selectedWarehouse?.capacity?.capacity_established === true;
  const warehouseUsablePct = selectedWarehouse?.capacity?.usable_space_percentage ?? 75;
  const floorAreaM2 = storeArea;
  const storeVolumeM3 = storeUsableVolumeM3(
    form.values.length,
    form.values.width,
    form.values.height,
    gangwayArea
  );
  const warehouseCapacityPreview = useMemo(() => {
    const cap = selectedWarehouse?.capacity;
    if (!cap?.capacity_established) return null;
    return previewWarehouseCapacity(
      cap.length_m ?? 0,
      cap.width_m ?? 0,
      cap.height_m ?? 0,
      cap.usable_space_percentage ?? 75
    );
  }, [selectedWarehouse]);

  const warehouseUsableVolume =
    Number(selectedWarehouse?.capacity?.usable_volume_m3) ||
    warehouseCapacityPreview?.usableVolumeM3 ||
    0;
  const warehouseUsableMt =
    Number(selectedWarehouse?.capacity?.usable_storage_capacity_mt) ||
    warehouseCapacityPreview?.capacityMt ||
    0;
  const proRataMt = allocatedStoreMt(storeVolumeM3, warehouseUsableVolume, warehouseUsableMt);
  const warehouseRemainingMt =
    selectedWarehouse?.capacity?.remaining_capacity_mt != null
      ? Number(selectedWarehouse.capacity.remaining_capacity_mt)
      : null;

  const warehouseIdNum = form.values.warehouse_id ? Number(form.values.warehouse_id) : undefined;

  const { data: siblingStores = [] } = useQuery({
    queryKey: ["stores", { warehouse_id: warehouseIdNum }],
    queryFn: () => getStores({ warehouse_id: warehouseIdNum! }),
    enabled: !!warehouseIdNum && capacityEstablished,
  });

  const dimensionHints = useMemo(
    () =>
      storeDimensionHints(
        selectedWarehouse?.capacity?.length_m,
        selectedWarehouse?.capacity?.width_m,
        selectedWarehouse?.capacity?.height_m,
        siblingStores,
        isEdit ? Number(id) : undefined
      ),
    [selectedWarehouse, siblingStores, isEdit, id]
  );

  const footprintHint = dimensionHints
    ? formatFootprintHint(
        dimensionHints.remainingFootprintSqm,
        dimensionHints.maxLengthM,
        dimensionHints.maxWidthM
      )
    : null;

  const lengthStatus: DimensionFieldStatus = dimensionHints
    ? dimensionAxisStatus(form.values.length, dimensionHints.maxLengthM)
    : 'empty';
  const widthStatus: DimensionFieldStatus = dimensionHints
    ? dimensionAxisStatus(form.values.width, dimensionHints.maxWidthM)
    : 'empty';
  const heightStatus: DimensionFieldStatus = dimensionHints
    ? dimensionAxisStatus(form.values.height, dimensionHints.maxHeightM)
    : 'empty';
  const floorStatus: DimensionFieldStatus = dimensionHints
    ? footprintStatus(storeArea, dimensionHints.remainingFootprintSqm)
    : 'empty';

  const dimensionsAllValid =
    lengthStatus === 'valid' &&
    widthStatus === 'valid' &&
    heightStatus === 'valid' &&
    floorStatus === 'valid';

  const lengthError =
    lengthStatus === 'invalid'
      ? `Length cannot exceed ${dimensionHints?.maxLengthM} m`
      : floorStatus === 'invalid' && form.values.length > 0 && form.values.width > 0
        ? `Floor ${storeArea.toFixed(0)} m² exceeds ${dimensionHints?.remainingFootprintSqm.toLocaleString()} m² available`
        : undefined;

  const widthError =
    widthStatus === 'invalid'
      ? `Width cannot exceed ${dimensionHints?.maxWidthM} m`
      : floorStatus === 'invalid' && form.values.length > 0 && form.values.width > 0
        ? `Reduce width or length — only ${dimensionHints?.remainingFootprintSqm.toLocaleString()} m² floor left`
        : undefined;

  const heightError =
    heightStatus === 'invalid'
      ? `Height cannot exceed ${dimensionHints?.maxHeightM} m (warehouse ceiling)`
      : undefined;

  const hasStoreDimensions =
    form.values.length > 0 && form.values.width > 0 && form.values.height > 0;
  const canEstimateMt =
    !!form.values.warehouse_id &&
    capacityEstablished &&
    hasStoreDimensions &&
    warehouseUsableVolume > 0 &&
    warehouseUsableMt > 0;
  const displayProRataMt = canEstimateMt ? proRataMt : null;
  const capacityExceedsWarehouse =
    dimensionsAllValid &&
    displayProRataMt != null &&
    warehouseRemainingMt != null &&
    displayProRataMt > warehouseRemainingMt + 1e-6;

  const estCapacityPlaceholder = !form.values.warehouse_id
    ? "Select warehouse first"
    : !capacityEstablished
      ? "Set warehouse capacity"
      : !hasStoreDimensions
        ? "Enter length, width, height"
        : displayProRataMt === null
          ? "Cannot compute — check warehouse capacity"
          : undefined;

  if (isEdit && isLoading) {
    return <LoadingState message="Loading store..." />;
  }

  if (isEdit && !store) {
    return <ErrorState message="Store not found" />;
  }

  return (
    <Stack gap="md">
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate("/stores")}
        >
          Back
        </Button>
        <Title order={2}>{isEdit ? "Edit Store" : "Create Store"}</Title>
      </Group>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Basic Information</Title>

              <Group grow>
                <TextInput
                  label="Code"
                  placeholder="STORE-001"
                  required
                  {...form.getInputProps("code")}
                />
                <TextInput
                  label="Name"
                  placeholder="Main Storage Area"
                  required
                  {...form.getInputProps("name")}
                />
              </Group>

              <Select
                label="Warehouse"
                placeholder="Select warehouse"
                required
                searchable
                data={warehouseOptions || []}
                disabled={!!preselectedWarehouseId && !isEdit}
                {...form.getInputProps("warehouse_id")}
              />

              <Group grow>
                <Switch
                  label="Temporary Storage"
                  description="Is this a temporary storage space?"
                  {...form.getInputProps("temporary", { type: "checkbox" })}
                />
              </Group>
            </Stack>
          </Card>

          {selectedWarehouse && !capacityEstablished && (
            <Alert color="orange" title="Warehouse capacity not established">
              Configure length, width, height, and usable floor % on the warehouse Capacity tab before adding stores.
            </Alert>
          )}
          {warehouseRemainingMt != null && capacityEstablished && (
            <Alert color="blue" variant="light">
              Warehouse has {Number(warehouseRemainingMt).toLocaleString(undefined, { maximumFractionDigits: 2 })} MT remaining of{" "}
              {Number(warehouseUsableMt).toLocaleString()} MT total capacity.
            </Alert>
          )}

          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Dimensions</Title>

              {capacityEstablished && dimensionHints && (
                <Group gap="md">
                  <Text size="xs" c="green" fw={600}>● Green border = within limit</Text>
                  <Text size="xs" c="red" fw={600}>● Red = adjust before saving</Text>
                </Group>
              )}

              {capacityEstablished && dimensionHints && (
                <Alert color="gray" variant="light" title="Size limits for this warehouse">
                  <Text size="sm">
                    Warehouse building: {dimensionHints.warehouseLengthM} × {dimensionHints.warehouseWidthM} m
                    floor, {dimensionHints.warehouseHeightM} m high ({dimensionHints.warehouseFootprintSqm.toLocaleString()} m²
                    total footprint).
                  </Text>
                  <Text size="sm" mt={4}>
                    {footprintHint}. Each side cannot exceed the warehouse wall length on that axis; height cannot
                    exceed {dimensionHints.maxHeightM} m.
                  </Text>
                </Alert>
              )}

              <Group grow align="flex-start">
                <NumberInput
                  label="Length (m)"
                  placeholder={
                    dimensionHints
                      ? `Max ${dimensionHints.maxLengthM} m`
                      : capacityEstablished
                        ? "Along warehouse length"
                        : "Set warehouse capacity first"
                  }
                  description={
                    lengthError
                      ? undefined
                      : dimensionValidLabel(lengthStatus) ||
                        (dimensionHints ? `≤ ${dimensionHints.maxLengthM} m (warehouse length)` : undefined)
                  }
                  error={lengthError}
                  required
                  min={0}
                  decimalScale={2}
                  styles={dimensionInputBorderStyle(lengthStatus)}
                  {...form.getInputProps("length")}
                />
                <NumberInput
                  label="Width (m)"
                  placeholder={
                    dimensionHints
                      ? `Max ${dimensionHints.maxWidthM} m`
                      : capacityEstablished
                        ? "Along warehouse width"
                        : "Set warehouse capacity first"
                  }
                  description={
                    widthError
                      ? undefined
                      : dimensionValidLabel(widthStatus) ||
                        (dimensionHints ? `≤ ${dimensionHints.maxWidthM} m (warehouse width)` : undefined)
                  }
                  error={widthError}
                  required
                  min={0}
                  decimalScale={2}
                  styles={dimensionInputBorderStyle(widthStatus)}
                  {...form.getInputProps("width")}
                />
                <NumberInput
                  label="Height (m)"
                  placeholder={
                    dimensionHints
                      ? `Max ${dimensionHints.maxHeightM} m`
                      : capacityEstablished
                        ? "Up to warehouse ceiling"
                        : "Set warehouse capacity first"
                  }
                  description={
                    heightError
                      ? undefined
                      : dimensionValidLabel(heightStatus) ||
                        (dimensionHints ? `≤ ${dimensionHints.maxHeightM} m (warehouse height)` : undefined)
                  }
                  error={heightError}
                  required
                  min={0}
                  decimalScale={2}
                  styles={dimensionInputBorderStyle(heightStatus)}
                  {...form.getInputProps("height")}
                />
              </Group>

              {floorStatus === 'invalid' && form.values.length > 0 && form.values.width > 0 && (
                <Text size="sm" c="red">
                  This store footprint ({storeArea.toLocaleString()} m²) is too large — only{' '}
                  {dimensionHints?.remainingFootprintSqm.toLocaleString()} m² floor area remains in this warehouse.
                </Text>
              )}

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                {/* Total floor area — raw l×w */}
                <NumberInput
                  label="Total Area (m²)"
                  value={Number(totalSpace.toFixed(2))}
                  readOnly
                  disabled
                  error={
                    floorStatus === 'invalid' && storeArea > 0
                      ? `Exceeds ${dimensionHints?.remainingFootprintSqm.toLocaleString()} m² available`
                      : undefined
                  }
                  styles={dimensionInputBorderStyle(floorStatus === 'empty' ? 'empty' : floorStatus)}
                  description={floorStatus === 'valid' ? 'Within limit' : undefined}
                />

                <NumberInput
                  label={
                    <Group gap={4}>
                      <Text size="sm" fw={500}>Floor Area (m²)</Text>
                      <Tooltip
                        label="Net store floor (length × width minus gangway). Warehouse usable % applies only on the warehouse Capacity tab."
                        multiline
                        w={280}
                        withArrow
                      >
                        <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
                      </Tooltip>
                    </Group>
                  }
                  value={Number(floorAreaM2.toFixed(2))}
                  readOnly
                  disabled
                  styles={dimensionsAllValid ? dimensionInputBorderStyle('valid') : undefined}
                  description={
                    dimensionsAllValid
                      ? 'Net floor · Within limit'
                      : form.values.has_gangway
                        ? 'Gangway excluded'
                        : undefined
                  }
                />

                {/* Option C — pro-rata MT capacity from warehouse */}
                <NumberInput
                  label={
                    <Group gap={4}>
                      <Text size="sm" fw={500}>Est. Capacity (MT)</Text>
                      <Tooltip
                        label={
                          displayProRataMt !== null
                            ? `Pro-rata share of warehouse usable capacity.\n` +
                              `Store volume (${Number(storeVolumeM3).toFixed(1)} m³) ÷ ` +
                              `Warehouse volume (${warehouseUsableVolume.toFixed(1)} m³) × ` +
                              `${warehouseUsableMt.toFixed(1)} MT`
                            : dimensionsAllValid
                              ? "Establish warehouse dimensions and capacity to see this estimate."
                              : "Fix red fields above to see estimated MT capacity."
                        }
                        multiline
                        w={280}
                        withArrow
                      >
                        <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
                      </Tooltip>
                    </Group>
                  }
                  value={displayProRataMt !== null ? Number(displayProRataMt.toFixed(2)) : ""}
                  placeholder={estCapacityPlaceholder}
                  readOnly
                  disabled
                  error={
                    capacityExceedsWarehouse
                      ? `Exceeds warehouse remaining ${warehouseRemainingMt?.toLocaleString(undefined, { maximumFractionDigits: 2 })} MT`
                      : undefined
                  }
                  styles={
                    displayProRataMt != null && !capacityExceedsWarehouse
                      ? dimensionInputBorderStyle('valid')
                      : capacityExceedsWarehouse
                        ? undefined
                        : undefined
                  }
                  description={
                    capacityExceedsWarehouse
                      ? undefined
                      : displayProRataMt !== null
                        ? "Pro-rata share of warehouse MT capacity · Within limit"
                        : !form.values.warehouse_id
                          ? "Choose a warehouse to calculate MT share"
                          : !capacityEstablished
                            ? "Requires established warehouse capacity"
                            : !dimensionsAllValid
                              ? "Fix red dimension fields if over warehouse limits"
                              : undefined
                  }
                />
              </SimpleGrid>

              {capacityEstablished && (
                <Text size="xs" c="dimmed">
                  Warehouse usable floor ({warehouseUsablePct}%) is configured on the warehouse Capacity tab only.
                  Store and stack capacity use full dimensions.
                </Text>
              )}
              <Text size="xs" c="dimmed">
                Floor area and available space are saved automatically by the backend when you submit.
              </Text>
            </Stack>
          </Card>

          <Card withBorder padding="lg">
            <Stack gap="md">
              <Group>
                <Title order={4}>Gangway</Title>
                <Switch
                  label="Has Gangway"
                  {...form.getInputProps("has_gangway", { type: "checkbox" })}
                />
              </Group>

              {form.values.has_gangway && (
                <>
                  <Text size="sm" c="dimmed">
                    Gangway dimensions (optional)
                  </Text>
                  <Group grow>
                    <NumberInput
                      label="Gangway Length (m)"
                      placeholder="0"
                      min={0}
                      decimalScale={2}
                      {...form.getInputProps("gangway_length")}
                    />
                    <NumberInput
                      label="Gangway Width (m)"
                      placeholder="0"
                      min={0}
                      decimalScale={2}
                      {...form.getInputProps("gangway_width")}
                    />
                    <NumberInput
                      label="Gangway Height (m)"
                      placeholder="0"
                      min={0}
                      decimalScale={2}
                      {...form.getInputProps("gangway_height")}
                    />
                  </Group>
                </>
              )}
            </Stack>
          </Card>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => navigate("/stores")}>
              Cancel
            </Button>
            <Button
              type="submit"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={
                (!!selectedWarehouse && !capacityEstablished) ||
                (!!dimensionHints && !dimensionsAllValid) ||
                capacityExceedsWarehouse
              }
            >
              {isEdit ? "Update Store" : "Create Store"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}

export default StoreFormPage;
