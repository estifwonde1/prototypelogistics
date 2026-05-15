/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useRef } from "react";
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
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconDeviceFloppy } from "@tabler/icons-react";
import { getStore, createStore, updateStore } from "../../api/stores";
import { getWarehouses } from "../../api/warehouses";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { useAuthStore } from '../../store/authStore';
import { normalizeRoleSlug } from '../../contracts/warehouse';
import { notifications } from "@mantine/notifications";
import type { Store } from "../../types/store";

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

  // ── Option A: Usable area = store floor area × warehouse usable_space_percentage ──
  const selectedWarehouse = warehouses.find(
    (w) => w.id.toString() === form.values.warehouse_id
  );
  const usablePct = (selectedWarehouse?.capacity as any)?.usable_space_percentage ?? 75;
  const usableAreaM2 = storeArea * (usablePct / 100);

  // ── Option C: Pro-rata MT capacity ──────────────────────────────────────────
  // store_share = store_area / warehouse_total_area_sqm
  // store_usable_mt = warehouse_usable_storage_capacity_mt × store_share
  const warehouseTotalAreaSqm: number | undefined =
    (selectedWarehouse?.capacity as any)?.total_area_sqm;
  const warehouseUsableMt: number | undefined =
    (selectedWarehouse?.capacity as any)?.usable_storage_capacity_mt;

  const proRataMt =
    warehouseTotalAreaSqm && warehouseTotalAreaSqm > 0 && warehouseUsableMt && storeArea > 0
      ? (storeArea / warehouseTotalAreaSqm) * warehouseUsableMt
      : null;

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

          <Card withBorder padding="lg">
            <Stack gap="md">
              <Title order={4}>Dimensions</Title>

              <Group grow>
                <NumberInput
                  label="Length (m)"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps("length")}
                />
                <NumberInput
                  label="Width (m)"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps("width")}
                />
                <NumberInput
                  label="Height (m)"
                  placeholder="0"
                  required
                  min={0}
                  decimalScale={2}
                  {...form.getInputProps("height")}
                />
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                {/* Total floor area — raw l×w */}
                <NumberInput
                  label="Total Area (m²)"
                  value={Number(totalSpace.toFixed(2))}
                  readOnly
                  disabled
                />

                {/* Option A — usable area after applying warehouse usable % */}
                <NumberInput
                  label={
                    <Group gap={4}>
                      <Text size="sm" fw={500}>Usable Area (m²)</Text>
                      <Tooltip
                        label={`Store floor area × ${usablePct}% usable space (warehouse setting). Gangway excluded.`}
                        multiline
                        w={260}
                        withArrow
                      >
                        <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
                      </Tooltip>
                    </Group>
                  }
                  value={Number(usableAreaM2.toFixed(2))}
                  readOnly
                  disabled
                  description={`${usablePct}% of store area`}
                />

                {/* Option C — pro-rata MT capacity from warehouse */}
                <NumberInput
                  label={
                    <Group gap={4}>
                      <Text size="sm" fw={500}>Est. Capacity (MT)</Text>
                      <Tooltip
                        label={
                          proRataMt !== null
                            ? `Pro-rata share of warehouse usable capacity.\n` +
                              `Store area (${storeArea.toFixed(1)} m²) ÷ ` +
                              `Warehouse area (${warehouseTotalAreaSqm?.toFixed(1)} m²) × ` +
                              `${warehouseUsableMt?.toFixed(1)} MT`
                            : "Set the warehouse Total Area (m²) and Storage Capacity (MT) to see this estimate."
                        }
                        multiline
                        w={280}
                        withArrow
                      >
                        <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
                      </Tooltip>
                    </Group>
                  }
                  value={proRataMt !== null ? Number(proRataMt.toFixed(2)) : ""}
                  placeholder={proRataMt === null ? "Set warehouse capacity" : undefined}
                  readOnly
                  disabled
                  description={
                    proRataMt !== null
                      ? "Pro-rata share of warehouse MT capacity"
                      : "Requires warehouse area + MT capacity"
                  }
                />
              </SimpleGrid>

              <Text size="xs" c="dimmed">
                Final usable and available area are saved automatically by the backend when you submit.
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
