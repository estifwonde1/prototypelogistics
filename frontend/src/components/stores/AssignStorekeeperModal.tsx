/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Badge,
  Divider,
  Alert,
  Radio,
  ActionIcon,
} from "@mantine/core";
import { IconInfoCircle, IconTrash, IconUser } from "@tabler/icons-react";
import type { Storekeeper, Store } from "../../types/store";

interface AssignStorekeeperModalProps {
  opened: boolean;
  onClose: () => void;
  storekeepers: Storekeeper[];
  stores: Store[];
  store: Store;
  onAssign: (userId: number, storeIds: number[] | undefined) => Promise<void>;
  onUnassign: (userId: number) => Promise<void>;
  isLoading: boolean;
}

export function AssignStorekeeperModal({
  opened,
  onClose,
  storekeepers,
  stores,
  store,
  onAssign,
  onUnassign,
  isLoading,
}: AssignStorekeeperModalProps) {
  const [selectedStorekeeper, setSelectedStorekeeper] = useState<number | null>(
    null,
  );
  // CRITICAL: Get current warehouse ID from stores to filter storekeepers
  const currentWarehouseId = store.warehouse_id;
  const currentWarehouseStoreIds = new Set(stores.map(s => s.id));

  // CRITICAL: Filter storekeepers to only show those assigned to current warehouse
  const filteredStorekeepers = storekeepers.filter((sk) => {
    if (!currentWarehouseId) return true; // If no warehouse context, show all (admin view)
    
    // Check if storekeeper's warehouse_id matches current warehouse
    if (sk.warehouse_id === currentWarehouseId) {
      return true;
    }
    
    // Check if storekeeper is assigned to any store in the current warehouse
    const hasStoreInCurrentWarehouse = sk.assigned_store_ids.some(
      (storeId) => currentWarehouseStoreIds.has(storeId)
    );
    
    return hasStoreInCurrentWarehouse;
  });

  const currentStorekeeper = filteredStorekeepers.find(
    (sk) => sk.id === selectedStorekeeper,
  );
  const assignedStorekeeperIds = new Set(
    (store.assigned_storekeepers ?? []).map((storekeeper) => storekeeper.id),
  );
  const assignableStorekeepers = filteredStorekeepers.filter(
    (storekeeper) => !assignedStorekeeperIds.has(storekeeper.id),
  );

  const handleSelectStorekeeper = (storekeeperId: number) => {
    setSelectedStorekeeper(storekeeperId);

    const selected = filteredStorekeepers.find((sk) => sk.id === storekeeperId);
    if (!selected) return;
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (opened) {
      setSelectedStorekeeper(null);
    }
  }, [opened]);

  const handleAssign = async () => {
    if (!selectedStorekeeper) return;

    await onAssign(selectedStorekeeper, [store.id]);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Assign Storekeeper to Stores"
      size="lg"
    >
      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          Assign a warehouse storekeeper to <strong>{store.name}</strong>. A
          warehouse-level assignment only makes the user available here; it does
          not automatically assign them to every store.
        </Alert>

        <div>
          <Text size="sm" fw={500} mb="xs">
            Assigned Storekeepers
          </Text>
          {store.assigned_storekeepers && store.assigned_storekeepers.length > 0 ? (
            <Stack gap="xs">
              {store.assigned_storekeepers.map((storekeeper) => (
                <Group
                  key={storekeeper.id}
                  p="sm"
                  justify="space-between"
                  style={{
                    border: "1px solid #e9ecef",
                    borderRadius: "4px",
                  }}
                >
                  <Group gap="xs">
                    <IconUser size={16} />
                    <Text size="sm" fw={500}>
                      {storekeeper.name}
                    </Text>
                    <Badge size="sm" color="green">
                      Assigned
                    </Badge>
                  </Group>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Remove ${storekeeper.name}`}
                    disabled={isLoading}
                    onClick={() => onUnassign(storekeeper.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          ) : (
            <Alert color="gray" variant="light">
              No storekeepers assigned to this store yet.
            </Alert>
          )}
        </div>

        <Divider />

        {/* Storekeeper Selection */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Assign Storekeeper
          </Text>
          <Stack gap="xs">
            {assignableStorekeepers.length === 0 ? (
              <Alert color="yellow" variant="light">
                No available storekeepers for this store.
              </Alert>
            ) : (
              assignableStorekeepers.map((storekeeper) => (
              <Group
                key={storekeeper.id}
                p="sm"
                style={{
                  border: "1px solid #e9ecef",
                  borderRadius: "4px",
                  cursor: "pointer",
                  backgroundColor:
                    selectedStorekeeper === storekeeper.id
                      ? "#f1f3f5"
                      : "transparent",
                }}
                onClick={() => handleSelectStorekeeper(storekeeper.id)}
              >
                <Radio
                  checked={selectedStorekeeper === storekeeper.id}
                  onChange={() => handleSelectStorekeeper(storekeeper.id)}
                />
                <div style={{ flex: 1 }}>
                  <Group gap="xs">
                    <IconUser size={16} />
                    <Text size="sm" fw={500}>
                      {storekeeper.name}
                    </Text>
                    <Badge
                      size="sm"
                      color={
                        storekeeper.assignment_type === "warehouse"
                          ? "blue"
                          : "green"
                      }
                    >
                      {storekeeper.assignment_type === "warehouse"
                        ? "Warehouse pool"
                        : `${storekeeper.assigned_stores.length} Store(s)`}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {storekeeper.email}
                  </Text>
                  {storekeeper.assignment_type === "store" &&
                    storekeeper.assigned_stores.length > 0 && (
                      <Text size="xs" c="dimmed" mt={4}>
                        Currently assigned to:{" "}
                        {storekeeper.assigned_stores
                          .map((s) => s.name)
                          .join(", ")}
                      </Text>
                    )}
                </div>
              </Group>
            ))
            )}
          </Stack>
        </div>

        {selectedStorekeeper && (
          <>
            <Divider />

            {/* Summary */}
            <Alert color="gray" variant="light">
              <Text size="sm" fw={500} mb={4}>
                Summary
              </Text>
              <Text size="sm">
                {currentStorekeeper?.name} will be assigned to{" "}
                <strong>{store.name}</strong>.
              </Text>
            </Alert>
          </>
        )}

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            loading={isLoading}
            disabled={!selectedStorekeeper}
          >
            Assign Storekeeper
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
