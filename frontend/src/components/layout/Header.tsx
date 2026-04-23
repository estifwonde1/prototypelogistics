import { Group, Text, Button, Menu, Avatar, Burger, Stack } from '@mantine/core';
import { IconLogout, IconUser, IconSwitchVertical } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getRoleLabel } from '../../utils/constants';

interface HeaderProps {
  mobileOpened: boolean;
  desktopOpened: boolean;
  toggleMobile: () => void;
  toggleDesktop: () => void;
}

export function Header({ mobileOpened, desktopOpened, toggleMobile, toggleDesktop }: HeaderProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, assignments, activeAssignment, clearAuth } = useAuthStore();
  const roleLabel = getRoleLabel(role);
  
  const facilityName = activeAssignment?.hub?.name || 
                       activeAssignment?.warehouse?.name || 
                       activeAssignment?.store?.name || 
                       activeAssignment?.location?.name ||
                       'Federal';

  const handleLogout = () => {
    clearAuth();
    queryClient.clear(); // wipe cached data so next user gets fresh scoped results
    navigate('/login');
  };

  const handleSwitchWorkspace = () => {
    navigate('/select-role');
  };

  return (
    <Group h="100%" px="md" justify="space-between">
      <Group>
        <Burger
          opened={mobileOpened}
          onClick={toggleMobile}
          hiddenFrom="sm"
          size="sm"
        />
        <Burger
          opened={desktopOpened}
          onClick={toggleDesktop}
          visibleFrom="sm"
          size="sm"
        />
        <Text size="lg" fw={700}>
          CATS Warehouse Management
        </Text>
      </Group>

      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Button variant="subtle" leftSection={<Avatar size="sm" radius="xl" />}>
            <Stack gap={0} align="flex-start">
              <Text size="sm" fw={600}>{roleLabel}</Text>
              <Text size="xs" c="dimmed">{facilityName}</Text>
            </Stack>
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Account</Menu.Label>
          <Menu.Item leftSection={<IconUser size={14} />}>
            Profile
          </Menu.Item>
          {assignments.length > 1 && (
            <Menu.Item leftSection={<IconSwitchVertical size={14} />} onClick={handleSwitchWorkspace}>
              Switch Workspace
            </Menu.Item>
          )}
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconLogout size={14} />}
            onClick={handleLogout}
          >
            Logout
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
