import { Modal, Stack, Text, Paper, Group, Button, Loader, Center, Alert } from '@mantine/core';
import { IconBuildingWarehouse, IconChevronRight, IconAlertCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { getStorekeeperStores, type StorekeeperStore } from '../../api/me';

interface StorekeeperStorePickerModalProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (store: StorekeeperStore) => void;
}

export function StorekeeperStorePickerModal({
  opened,
  onClose,
  onSelect,
}: StorekeeperStorePickerModalProps) {
  const { data: stores = [], isLoading, isError } = useQuery({
    queryKey: ['me', 'storekeeper_stores'],
    queryFn: getStorekeeperStores,
    enabled: opened,
    staleTime: 30_000,
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Stack gap={2}>
          <Text fw={700} size="lg">Select Store</Text>
          <Text size="sm" c="dimmed">
            Choose which store to operate as <strong>Storekeeper</strong>
          </Text>
        </Stack>
      }
      centered
      size="sm"
    >
      <Stack gap="sm" mt="xs">
        {isLoading && (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        )}

        {isError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            Failed to load stores. Please try again.
          </Alert>
        )}

        {!isLoading && !isError && stores.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No stores found in your managed warehouses.
          </Text>
        )}

        {stores.map((store) => (
          <Paper
            key={store.id}
            withBorder
            p="md"
            radius="md"
            component="button"
            onClick={() => onSelect(store)}
            style={{
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              backgroundColor: 'var(--mantine-color-body)',
              transition: 'box-shadow 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'var(--mantine-shadow-md)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '';
              e.currentTarget.style.transform = '';
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" c="dimmed">
                <IconBuildingWarehouse size={18} />
                <Stack gap={2}>
                  <Text fw={600} size="sm" c="bright">{store.name}</Text>
                  <Text size="xs" c="dimmed">{store.warehouse_name}</Text>
                </Stack>
              </Group>
              <IconChevronRight size={18} color="var(--mantine-color-blue-6)" />
            </Group>
          </Paper>
        ))}

        <Button variant="subtle" color="gray" onClick={onClose} mt="xs">
          Cancel
        </Button>
      </Stack>
    </Modal>
  );
}
