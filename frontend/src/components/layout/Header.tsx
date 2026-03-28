import { Group, Text, Button, Menu, Avatar, Burger } from '@mantine/core';
import { IconLogout, IconUser } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
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
  const { userId, role, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
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
            {getRoleLabel(role)} {userId != null && `#${userId}`}
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Account</Menu.Label>
          <Menu.Item leftSection={<IconUser size={14} />}>
            Profile
          </Menu.Item>
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
