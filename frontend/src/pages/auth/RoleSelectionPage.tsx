import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Container, Title, Paper, Button, Stack, Text, Group, Badge, SimpleGrid } from '@mantine/core';
import { IconMapPin, IconBuilding, IconBuildingWarehouse, IconChevronRight } from '@tabler/icons-react';
import { useAuthStore, type OfficerAssignment } from '../../store/authStore';
import {
  getDefaultRouteForRole,
  getRoleLabel,
  normalizeRoleSlug,
  type RoleSlug,
} from '../../contracts/warehouse';

export default function RoleSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const assignments = useAuthStore((state) => state.assignments);
  const setActiveAssignment = useAuthStore((state) => state.setActiveAssignment);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const arrivedFromLogin = (location.state as { fromLogin?: boolean } | null)?.fromLogin === true;

  // Single-assignment users should never stay on this screen.
  useEffect(() => {
    if (assignments.length === 0) {
      clearAuth();
      queryClient.clear();
      navigate('/login', { replace: true });
      return;
    }
    if (assignments.length === 1) {
      const only = assignments[0];
      setActiveAssignment(only);
      const roleSlug = normalizeRoleSlug(only.role_name) as RoleSlug | null;
      navigate(getDefaultRouteForRole(roleSlug), { replace: true });
    }
  }, [assignments, clearAuth, navigate, queryClient, setActiveAssignment]);

  const returnToLogin = () => {
    clearAuth();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  // After login with multiple workspaces, browser Back signs out and returns to /login.
  useEffect(() => {
    if (!arrivedFromLogin || assignments.length <= 1) return;

    window.history.pushState({ rolePickerTrap: true }, '', window.location.href);

    const onPopState = () => {
      clearAuth();
      queryClient.clear();
      navigate('/login', { replace: true });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [arrivedFromLogin, assignments.length, clearAuth, queryClient, navigate]);

  const handleSelectRole = (assignment: OfficerAssignment) => {
    const roleSlug = normalizeRoleSlug(assignment.role_name) as RoleSlug | null;
    if (!roleSlug) return;

    setActiveAssignment(assignment);
    navigate(getDefaultRouteForRole(roleSlug), { replace: true, state: {} });
  };

  const getFacilityName = (a: OfficerAssignment) => {
    if (a.hub) return a.hub.name;
    if (a.warehouse) return a.warehouse.name;
    if (a.store) return a.store.name;
    if (a.location) return a.location.name;
    return 'Federal';
  };

  const getFacilityIcon = (a: OfficerAssignment) => {
    if (a.hub) return <IconBuilding size={20} />;
    if (a.warehouse) return <IconBuildingWarehouse size={20} />;
    if (a.store) return <IconBuildingWarehouse size={20} />;
    return <IconMapPin size={20} />;
  };

  return (
    <Container size="md" my={80}>
      <Stack align="center" gap="xs" mb={40}>
        <Title order={1}>Select Your Role</Title>
        <Text c="dimmed">You have multiple assignments. Please choose a workspace to continue.</Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {assignments.map((assignment) => (
          <Paper
            key={assignment.id}
            withBorder
            p="xl"
            radius="md"
            shadow="xs"
            component="button"
            onClick={() => handleSelectRole(assignment)}
            style={{
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              backgroundColor: 'var(--mantine-color-body)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              border: '1px solid var(--mantine-color-gray-3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = 'var(--mantine-shadow-md)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'var(--mantine-shadow-xs)';
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap="xs">
                <Badge size="lg" variant="filled">
                  {getRoleLabel(assignment.role_name.toLowerCase().replace(/\s+/g, '_'))}
                </Badge>
                <Group gap={8} c="dimmed">
                  {getFacilityIcon(assignment)}
                  <Text fw={600} size="lg" c="bright">
                    {getFacilityName(assignment)}
                  </Text>
                </Group>
                {assignment.location && (
                  <Text size="sm" c="dimmed">
                    {assignment.location.location_type}: {assignment.location.name}
                  </Text>
                )}
              </Stack>
              <IconChevronRight size={24} color="var(--mantine-color-blue-6)" />
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <Stack align="center" mt={50}>
        <Button variant="subtle" color="gray" onClick={returnToLogin}>
          Back to Login
        </Button>
      </Stack>
    </Container>
  );
}
