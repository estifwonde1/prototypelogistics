/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  MultiSelect,
  Badge,
  Divider,
  Alert,
  Radio,
} from "@mantine/core";
import { IconInfoCircle, IconUser } from "@tabler/icons-react";
import type { Storekeeper, Store } from "../../types/store";

interface AssignStorekeeperModalProps {
  opened: boolean;
  onClose: () => void;
  storekeepers: Storekeeper[];
  stores: Store[];
  onAssign: (userId: number, storeIds: number[] | undefined) => Promise<void>;
  isLoading: boolean;
}

export function AssignStorekeeperModal({
  opened,
  onClose,
  storekeepers,
  stores,
  onAssign,
  isLoading,
}: AssignStorekeeperModalProps) {
  const [selectedStorekeeper, setSelectedStorekeeper] = useState<number | null>(
    null,
  );
  const [assignmentType, setAssignmentType] = useState<"warehouse" | "store">(
    "warehouse",
  );
  const [selectedStores, setSelectedStores] = useState<string[]>([]);

  const currentStorekeeper = storekeepers.find(
    (sk) => sk.id === selectedStorekeeper,
  );

  const handleSelectStorekeeper = (storekeeperId: number) => {
    setSelectedStorekeeper(storekeeperId);

    const selected = storekeepers.find((sk) => sk.id === storekeeperId);
    if (!selected) {
      setAssignmentType("warehouse");
      setSelectedStores([]);
      return;
    }

    setAssignmentType(selected.assignment_type);
    setSelectedStores(selected.assigned_store_ids.map(String));
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (opened) {
      setSelectedStorekeeper(null);
      setAssignmentType("warehouse");
      setSelectedStores([]);
    }
  }, [opened]);

  const handleAssign = async () => {
    if (!selectedStorekeeper) return;

    const storeIds =
      assignmentType === "warehouse" ? undefined : selectedStores.map(Number);

    await onAssign(selectedStorekeeper, storeIds);
    onClose();
  };

  const storeOptions = stores.map((store) => ({
    value: store.id.toString(),
    label: `${store.name} (${store.code})`,
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Assign Storekeeper to Stores"
      size="lg"
    >
      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          Assign storekeepers to specific stores or give them access to all
          stores in the warehouse.
        </Alert>

        {/* Storekeeper Selection */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Select Storekeeper
          </Text>
          <Stack gap="xs">
            {storekeepers.map((storekeeper) => (
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
                        ? "All Stores"
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
            ))}
          </Stack>
        </div>

        {selectedStorekeeper && (
          <>
            <Divider />

            {/* Assignment Type */}
            <div>
              <Text size="sm" fw={500} mb="xs">
                Assignment Type
              </Text>
              <Radio.Group
                value={assignmentType}
                onChange={(value) =>
                  setAssignmentType(value as "warehouse" | "store")
                }
              >
                <Stack gap="xs">
                  <Radio
                    value="warehouse"
                    label="All Stores in Warehouse"
                    description="Storekeeper can access all stores in the warehouse"
                  />
                  <Radio
                    value="store"
                    label="Specific Stores"
                    description="Storekeeper can only access selected stores"
                  />
                </Stack>
              </Radio.Group>
            </div>

            {/* Store Selection (only if specific stores) */}
            {assignmentType === "store" && (
              <div>
                <Text size="sm" fw={500} mb="xs">
                  Select Stores
                </Text>
                <MultiSelect
                  data={storeOptions}
                  value={selectedStores}
                  onChange={setSelectedStores}
                  placeholder="Select stores..."
                  searchable
                  clearable
                />
                {selectedStores.length === 0 && (
                  <Text size="xs" c="red" mt="xs">
                    Please select at least one store
                  </Text>
                )}
              </div>
            )}

            {/* Summary */}
            <Alert color="gray" variant="light">
              <Text size="sm" fw={500} mb={4}>
                Summary
              </Text>
              <Text size="sm">
                {currentStorekeeper?.name} will be assigned to{" "}
                {assignmentType === "warehouse" ? (
                  <strong>
                    all stores in {currentStorekeeper?.warehouse_name}
                  </strong>
                ) : (
                  <strong>{selectedStores.length} selected store(s)</strong>
                )}
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
            disabled={
              !selectedStorekeeper ||
              (assignmentType === "store" && selectedStores.length === 0)
            }
          >
            Assign Storekeeper
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
