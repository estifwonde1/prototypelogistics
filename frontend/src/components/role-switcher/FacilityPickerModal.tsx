import { Modal, Stack, Text, Paper, Group, Badge, Button } from '@mantine/core';
import { IconBuilding, IconBuildingWarehouse, IconMapPin, IconChevronRight } from '@tabler/icons-react';
import type { OfficerAssignment } from '../../store/authStore';
import { getRoleLabel, normalizeRoleSlug } from '../../contracts/warehouse';

interface FacilityPickerModalProps {
  opened: boolean;
  onClose: () => void;
  /** The role name being switched to (display only) */
  targetRoleName: string;
  /** All assignments that match the target role */
  candidates: OfficerAssignment[];
  onSelect: (assignment: OfficerAssignment) => void;
}

function facilityName(a: OfficerAssignment): string {
  if (a.hub) return a.hub.name;
  if (a.warehouse) return a.warehouse.name;
  if (a.store) return a.store.name;
  if (a.location) return a.location.name;
  return 'Federal';
}

function facilityIcon(a: OfficerAssignment) {
  if (a.hub) return <IconBuilding size={18} />;
  if (a.warehouse) return <IconBuildingWarehouse size={18} />;
  if (a.store) return <IconBuildingWarehouse size={18} />;
  return <IconMapPin size={18} />;
}

export function FacilityPickerModal({
  opened,
  onClose,
  targetRoleName,
  candidates,
  onSelect,
}: FacilityPickerModalProps) {
  const roleLabel = getRoleLabel(normalizeRoleSlug(targetRoleName));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Stack gap={2}>
          <Text fw={700} size="lg">Select Facility</Text>
          <Text size="sm" c="dimmed">
            Choose which facility to operate as <strong>{roleLabel}</strong>
          </Text>
        </Stack>
      }
      centered
      size="sm"
    >
      <Stack gap="sm" mt="xs">
        {candidates.map((a) => (
          <Paper
            key={a.id}
            withBorder
            p="md"
            radius="md"
            component="button"
            onClick={() => onSelect(a)}
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
                {facilityIcon(a)}
                <Stack gap={2}>
                  <Text fw={600} size="sm" c="bright">
                    {facilityName(a)}
                  </Text>
                  {a.location && (
                    <Text size="xs" c="dimmed">
                      {a.location.location_type}: {a.location.name}
                    </Text>
                  )}
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
