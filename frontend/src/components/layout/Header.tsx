import { Group, Text, Button, Menu, Avatar } from '@mantine/core';
import { IconLogout, IconUser } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function Header() {
  const navigate = useNavigate();
  const { userId, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <Group h="100%" px="md" justify="space-between">
      <Text size="lg" fw={700}>
        CATS Warehouse Management
      </Text>

      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Button variant="subtle" leftSection={<Avatar size="sm" radius="xl" />}>
            User #{userId}
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
