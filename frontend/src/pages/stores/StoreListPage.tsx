import { SearchableSelect } from '../../components/common/SearchableSelect';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stack,
  Title,
  Button,
  Group,
  TextInput,
  Table,
  ActionIcon,
  Modal,
  Text,
  Badge,
  Tooltip,
} from "@mantine/core";
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconEye,
  IconUsers,
} from "@tabler/icons-react";
import {
  getStores,
  deleteStore,
  getStoreStorekeepers,
  assignStorekeeper,
  unassignStorekeeper,
} from "../../api/stores";
import { getWarehouses } from "../../api/warehouses";
import { getMyAssignments } from "../../api/me";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { AssignStorekeeperModal } from "../../components/stores/AssignStorekeeperModal";
import { notifications } from "@mantine/notifications";
import { usePermission } from "../../hooks/usePermission";
import { useAuth } from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { normalizeRoleSlug } from "../../contracts/warehouse";

function StoreListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<number | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [storeToAssign, setStoreToAssign] = useState<number | null>(null);

  // CRITICAL: Get the active warehouse context
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const authRole = useAuthStore((state) => state.role);
  const currentUserId = useAuthStore((state) => state.userId);
  const setAssignments = useAuthStore((state) => state.setAssignments);
  const setActiveAssignment = useAuthStore((state) => state.setActiveAssignment);
  const roleSlug = normalizeRoleSlug(activeAssignment?.role_name || authRole);
  const userWarehouseId = activeAssignment?.warehouse?.id;
  const userHubId = activeAssignment?.hub?.id;
  const isWarehouseManager = roleSlug === 'warehouse_manager';
  const isHubManager = roleSlug === 'hub_manager';

  // Debug logging
  console.log('=== StoreListPage Debug ===');
  console.log('Active Assignment:', activeAssignment);
  console.log('User Warehouse ID:', userWarehouseId);
  console.log('User Hub ID:', userHubId);
  console.log('Role Slug:', roleSlug);
  console.log('Is Warehouse Manager:', isWarehouseManager);
  console.log('Is Hub Manager:', isHubManager);

  // CRITICAL: Warehouse managers should ONLY see stores from their active warehouse
  // Hub managers should ONLY see stores from warehouses in their active hub
  const {
    data: stores = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["stores", { 
      warehouse_id: isWarehouseManager ? userWarehouseId : undefined,
      hub_id: isHubManager ? userHubId : undefined 
    }],
    queryFn: () => {
      if (isWarehouseManager && userWarehouseId) {
        const params = { warehouse_id: userWarehouseId };
        console.log('Fetching stores with warehouse params:', params);
        return getStores(params);
      } else if (isHubManager && userHubId) {
        // For hub managers, we need to get warehouses in their hub first, then get stores
        console.log('Hub manager - need to fetch stores from hub warehouses');
        return getStores(); // Will be filtered by backend based on user access
      }
      return getStores();
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", { hub_id: isHubManager ? userHubId : undefined }],
    queryFn: () => {
      if (isHubManager && userHubId) {
        return getWarehouses({ hub_id: userHubId });
      }
      return getWarehouses();
    },
  });

  const { data: storekeepers = [] } = useQuery({
    queryKey: ["store-storekeepers", { warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
    queryFn: () => getStoreStorekeepers(isWarehouseManager && userWarehouseId ? { warehouse_id: userWarehouseId } : {}),
    enabled: role === "warehouse_manager" || role === "admin",
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      notifications.show({
        title: "Success",
        message: "Store deleted successfully",
        color: "green",
      });
      setDeleteModalOpen(false);
      setStoreToDelete(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.error?.message || "Failed to delete store",
        color: "red",
      });
    },
  });

  const refreshCurrentUserAssignments = async (changedUserId: number) => {
    queryClient.invalidateQueries({ queryKey: ["me", "assignments"] });
    queryClient.invalidateQueries({ queryKey: ["me", "storekeeper_stores"] });

    if (currentUserId !== changedUserId) return;

    const freshAssignments = await getMyAssignments();
    setAssignments(freshAssignments);

    const activeStillExists =
      activeAssignment &&
      freshAssignments.some((assignment) => assignment.id === activeAssignment.id);

    if (!activeStillExists && freshAssignments.length > 0) {
      setActiveAssignment(freshAssignments[0]);
    }
  };

  const assignMutation = useMutation({
    mutationFn: ({
      userId,
      storeIds,
    }: {
      userId: number;
      storeIds?: number[];
    }) => {
      // Use the first store in the list, or any store if assigning to all
      const storeId =
        storeIds && storeIds.length > 0 ? storeIds[0] : stores[0]?.id;
      return assignStorekeeper(storeId, {
        user_id: userId,
        store_ids: storeIds,
      });
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      queryClient.invalidateQueries({ queryKey: ["store-storekeepers"] });
      await refreshCurrentUserAssignments(variables.userId);
      notifications.show({
        title: "Success",
        message: "Storekeeper assigned successfully",
        color: "green",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.error?.message ||
          "Failed to assign storekeeper",
        color: "red",
      });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: ({
      storeId,
      userId,
    }: {
      storeId: number;
      userId: number;
    }) => unassignStorekeeper(storeId, userId),
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      queryClient.invalidateQueries({ queryKey: ["store-storekeepers"] });
      await refreshCurrentUserAssignments(variables.userId);
      notifications.show({
        title: "Success",
        message: "Storekeeper removed from store",
        color: "green",
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.error?.message ||
          "Failed to remove storekeeper",
        color: "red",
      });
    },
  });

  const handleDelete = () => {
    if (storeToDelete) {
      deleteMutation.mutate(storeToDelete);
    }
  };

  const handleAssign = async (userId: number, storeIds?: number[]) => {
    await assignMutation.mutateAsync({ userId, storeIds });
  };

  const handleUnassign = async (userId: number) => {
    if (!selectedStoreToAssign) return;
    await unassignMutation.mutateAsync({
      storeId: selectedStoreToAssign.id,
      userId,
    });
  };

  const selectedStoreToAssign = stores.find((store) => store.id === storeToAssign);

  const filteredStores = stores?.filter((store) => {
    // CRITICAL: Double-check warehouse filtering on frontend as safety measure
    if (isWarehouseManager && userWarehouseId) {
      if (store.warehouse_id !== userWarehouseId) {
        console.warn('Filtering out store from wrong warehouse:', store.name, 'warehouse_id:', store.warehouse_id, 'expected:', userWarehouseId);
        return false;
      }
    }

    const matchesSearch =
      store.name.toLowerCase().includes(search.toLowerCase()) ||
      store.code.toLowerCase().includes(search.toLowerCase());
    const matchesWarehouse =
      !warehouseFilter || store.warehouse_id?.toString() === warehouseFilter;
    return matchesSearch && matchesWarehouse;
  });

  const warehouseOptions = warehouses?.map((warehouse) => ({
    value: warehouse.id.toString(),
    label: `${warehouse.name} (${warehouse.code})`,
  }));

  const canManageStorekeepers =
    role === "warehouse_manager" || role === "admin";

  if (isLoading) {
    return <LoadingState message="Loading stores..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load stores. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Stores</Title>
          <Text c="dimmed" size="sm">
            Manage storage spaces within warehouses
          </Text>
        </div>
        <Group>
          {can("stores", "create") && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate("/stores/new")}
            >
              Create Store
            </Button>
          )}
        </Group>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by name or code..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <SearchableSelect
          placeholder="Filter by warehouse"
          data={warehouseOptions || []}
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          clearable
          style={{ width: 250 }}
        />
      </Group>

      {filteredStores && filteredStores.length === 0 ? (
        <EmptyState
          title="No stores found"
          description={
            search || warehouseFilter
              ? "Try adjusting your filters"
              : "Get started by creating your first store"
          }
          action={
            !search && !warehouseFilter && can("stores", "create")
              ? {
                  label: "Create Store",
                  onClick: () => navigate("/stores/new"),
                }
              : undefined
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={1200}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Warehouse</Table.Th>
                <Table.Th>Dimensions (L×W×H)</Table.Th>
                <Table.Th>Floor Area</Table.Th>
                <Table.Th>Available Space</Table.Th>
                <Table.Th>Type</Table.Th>
                {canManageStorekeepers && (
                  <Table.Th>Assigned Storekeepers</Table.Th>
                )}
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredStores?.map((store) => {
                const warehouse = warehouses?.find(
                  (w) => w.id === store.warehouse_id,
                );
                const canUpdate = can("stores", "update");
                const canDelete = can("stores", "delete");
                const canView = can("stores", "read");
                const storeHasStock = (store.used_capacity_mt ?? 0) > 0;

                return (
                  <Table.Tr
                    key={store.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/stores/${store.id}`)}
                  >
                    <Table.Td>{store.code}</Table.Td>
                    <Table.Td>{store.name}</Table.Td>
                    <Table.Td>{warehouse?.name || "-"}</Table.Td>
                    <Table.Td>
                      {store.length}×{store.width}×{store.height}m
                    </Table.Td>
                    <Table.Td>{store.usable_space} m²</Table.Td>
                    <Table.Td>{store.available_space} m³</Table.Td>
                    <Table.Td>
                      <Badge color={store.temporary ? "yellow" : "blue"}>
                        {store.temporary ? "Temporary" : "Permanent"}
                      </Badge>
                    </Table.Td>
                    {canManageStorekeepers && (
                      <Table.Td>
                        {store.assigned_storekeepers &&
                        store.assigned_storekeepers.length > 0 ? (
                          <Group gap="xs" wrap="wrap">
                            {store.assigned_storekeepers
                              .slice(0, 3)
                              .map((sk) => (
                                <Badge key={sk.id} variant="light" color="blue">
                                  {sk.name}
                                </Badge>
                              ))}
                            {store.assigned_storekeepers.length > 3 && (
                              <Badge variant="outline" color="gray">
                                +{store.assigned_storekeepers.length - 3} more
                              </Badge>
                            )}
                          </Group>
                        ) : (
                          <Text size="sm" c="dimmed">
                            None
                          </Text>
                        )}
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        {!canUpdate && !canDelete && canView && (
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/stores/${store.id}`);
                            }}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        )}
                        {canManageStorekeepers && storekeepers.length > 0 && (
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            aria-label={`Assign storekeeper to ${store.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setStoreToAssign(store.id);
                              setAssignModalOpen(true);
                            }}
                          >
                            <IconUsers size={16} />
                          </ActionIcon>
                        )}
                        {canUpdate && (
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/stores/${store.id}/edit`);
                            }}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        )}
                        {canDelete &&
                          (storeHasStock ? (
                            <Tooltip label="Cannot delete a store that has stock. Move or remove stock first.">
                              <span>
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  disabled
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </span>
                            </Tooltip>
                          ) : (
                            <Tooltip label="Delete store">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setStoreToDelete(store.id);
                                  setDeleteModalOpen(true);
                                }}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          ))}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Store"
      >
        <Text mb="md">
          Are you sure you want to delete this store? This action cannot be
          undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </Group>
      </Modal>

      {canManageStorekeepers && assignModalOpen && selectedStoreToAssign && (
        <AssignStorekeeperModal
          opened={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setStoreToAssign(null);
          }}
          storekeepers={storekeepers}
          stores={stores}
          store={selectedStoreToAssign!}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          isLoading={assignMutation.isPending || unassignMutation.isPending}
        />
      )}
    </Stack>
  );
}

export default StoreListPage;
