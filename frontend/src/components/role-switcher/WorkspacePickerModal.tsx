import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Stack, Text, Paper, Group, Badge, Button, SimpleGrid } from '@mantine/core';
import {
  IconMapPin,
  IconBuilding,
  IconBuildingWarehouse,
  IconChevronRight,
} from '@tabler/icons-react';
import { useAuthStore, type OfficerAssignment } from '../../store/authStore';
import { getRoleLabel, normalizeRoleSlug } from '../../contracts/warehouse';
import {
  commitWorkspaceSwitch,
  facilityLabelForAssignment,
  prefetchDashboardData,
  prefetchDashboardForAssignment,
} from '../../utils/workspaceSwitch';

interface WorkspacePickerModalProps {
  opened: boolean;
  onClose: () => void;
}

function getFacilityIcon(a: OfficerAssignment) {
  if (a.hub) return <IconBuilding size={20} />;
  if (a.warehouse) return <IconBuildingWarehouse size={20} />;
  if (a.store) return <IconBuildingWarehouse size={20} />;
  return <IconMapPin size={20} />;
}

export function WorkspacePickerModal({ opened, onClose }: WorkspacePickerModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const assignments = useAuthStore((state) => state.assignments);
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const fromRole = useAuthStore((state) => state.role);

  useEffect(() => {
    if (!opened) return;
    assignments.forEach((assignment) => {
      prefetchDashboardForAssignment(assignment);
      prefetchDashboardData(queryClient, assignment);
    });
  }, [opened, assignments, queryClient]);

  const handleSelect = (assignment: OfficerAssignment) => {
    const roleSlug = normalizeRoleSlug(assignment.role_name);
    if (!roleSlug) return;

    onClose();
    void commitWorkspaceSwitch({
      assignment,
      queryClient,
      navigate,
      fromRole,
      showNotification: true,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Stack gap={2}>
          <Text fw={700} size="lg">
            Switch Workspace
          </Text>
          <Text size="sm" c="dimmed">
            Choose which role and facility to operate in
          </Text>
        </Stack>
      }
      centered
      size="lg"
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="xs">
        {assignments.map((assignment) => {
          const isActive = activeAssignment?.id === assignment.id;
          const facilityName =
            normalizeRoleSlug(assignment.role_name) === 'storekeeper' && assignment.store
              ? assignment.store.name
              : facilityLabelForAssignment(assignment);

          return (
            <Paper
              key={assignment.id}
              withBorder
              p="md"
              radius="md"
              component="button"
              disabled={isActive}
              onClick={() => handleSelect(assignment)}
              onMouseEnter={() => {
                prefetchDashboardForAssignment(assignment);
                prefetchDashboardData(queryClient, assignment);
              }}
              style={{
                cursor: isActive ? 'default' : 'pointer',
                textAlign: 'left',
                width: '100%',
                backgroundColor: 'var(--mantine-color-body)',
                opacity: isActive ? 0.65 : 1,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                border: isActive
                  ? '2px solid var(--mantine-color-blue-5)'
                  : '1px solid var(--mantine-color-gray-3)',
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap="xs">
                  <Badge size="md" variant={isActive ? 'filled' : 'light'}>
                    {getRoleLabel(assignment.role_name.toLowerCase().replace(/\s+/g, '_'))}
                  </Badge>
                  <Group gap={8} c="dimmed">
                    {getFacilityIcon(assignment)}
                    <Text fw={600} size="sm" c="bright">
                      {facilityName}
                    </Text>
                  </Group>
                  {assignment.location && (
                    <Text size="xs" c="dimmed">
                      {assignment.location.location_type}: {assignment.location.name}
                    </Text>
                  )}
                  {isActive && (
                    <Text size="xs" c="blue" fw={600}>
                      Current workspace
                    </Text>
                  )}
                </Stack>
                {!isActive && (
                  <IconChevronRight size={20} color="var(--mantine-color-blue-6)" />
                )}
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>

      <Button variant="subtle" color="gray" onClick={onClose} mt="md" fullWidth>
        Cancel
      </Button>
    </Modal>
  );
}
