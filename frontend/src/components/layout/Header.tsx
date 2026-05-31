import {
  Group,
  Text,
  Button,
  Menu,
  Avatar,
  Burger,
  Stack,
  ScrollArea,
  Divider,
  Badge,
  Box,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBell,
  IconChevronDown,
  IconChevronRight,
  IconLogout,
  IconUser,
  IconSwitchVertical,
  IconCheck,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getRoleLabel, OFFICER_ROLE_SLUGS, type RoleSlug } from '../../utils/constants';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  notificationsQueryKey,
  notificationsUnreadCountKey,
} from '../../api/notifications';
import { useRoleSwitcher } from '../../hooks/useRoleSwitcher';
import { FacilityPickerModal } from '../role-switcher/FacilityPickerModal';
import { StorekeeperStorePickerModal } from '../role-switcher/StorekeeperStorePickerModal';
import { normalizeRoleSlug } from '../../contracts/warehouse';

interface HeaderProps {
  mobileOpened: boolean;
  desktopOpened: boolean;
  toggleMobile: () => void;
  toggleDesktop: () => void;
}

function resolveNotificationPath(params: unknown): string | null {
  if (!params || typeof params !== 'object') return null;
  const p = params as Record<string, unknown>;
  const raw = p.path;
  return typeof raw === 'string' && raw.startsWith('/') ? raw : null;
}

export function Header({ mobileOpened, desktopOpened, toggleMobile, toggleDesktop }: HeaderProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, assignments, activeAssignment, clearAuth, token } = useAuthStore();
  const roleLabel = getRoleLabel(role);
  const [notifMenuOpened, setNotifMenuOpened] = useState(false);
  const activeWarehouseId = activeAssignment?.warehouse?.id;

  const { switchState, switchToRole, onFacilitySelected, onStoreSelected, dismissPicker } =
    useRoleSwitcher();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: [...notificationsUnreadCountKey, { warehouse_id: activeWarehouseId }],
    queryFn: () => fetchUnreadNotificationCount({ warehouse_id: activeWarehouseId }),
    enabled: Boolean(token),
    staleTime: 0,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: recentNotifications = [] } = useQuery({
    queryKey: [...notificationsQueryKey, 'recent', { warehouse_id: activeWarehouseId }],
    queryFn: () => fetchNotifications({ limit: 15, warehouse_id: activeWarehouseId }),
    enabled: Boolean(token),
    staleTime: 0,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const isOfficer = role && OFFICER_ROLE_SLUGS.includes(role as RoleSlug);

  const facilityName =
    activeAssignment?.hub?.name ||
    activeAssignment?.warehouse?.name ||
    activeAssignment?.store?.name ||
    activeAssignment?.location?.name ||
    'Federal';

  // All unique role names this user holds
  const uniqueRoleNames = Array.from(new Set(assignments.map((a) => a.role_name)));
  const hasMultipleRoles = uniqueRoleNames.length > 1;

  const handleLogout = () => {
    clearAuth();
    queryClient.clear();
    navigate('/login');
  };

  const handleSwitchWorkspace = () => {
    navigate('/select-role', { state: { fromSwitchWorkspace: true } });
  };

  return (
    <>
      <Group h="100%" px="md" justify="space-between">
        {/* ── Left: burger + app title ── */}
        <Group>
          <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
          <Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom="sm" size="sm" />
          <Text size="lg" fw={700}>
            DRiMS Warehouse Management
          </Text>
        </Group>

        {/* ── Right: notifications · role switcher · profile ── */}
        <Group gap="xs">

          {/* ── Notification bell ── */}
          <Menu
            shadow="md"
            width={360}
            position="bottom-end"
            withinPortal
            opened={notifMenuOpened}
            onChange={setNotifMenuOpened}
          >
            <Menu.Target>
              <Box pos="relative" style={{ display: 'inline-block' }}>
                <Button variant="default" px="xs" aria-label="Notifications">
                  <IconBell size={20} stroke={1.5} />
                </Button>
                {unreadCount > 0 &&
                  (unreadCount === 1 ? (
                    <Box
                      pos="absolute"
                      top={2}
                      right={2}
                      w={10}
                      h={10}
                      bg="var(--mantine-color-red-filled)"
                      title="1 unread"
                      style={{
                        borderRadius: '50%',
                        boxShadow: '0 0 0 2px var(--mantine-color-body)',
                        pointerEvents: 'none',
                      }}
                    />
                  ) : (
                    <Badge
                      size="sm"
                      variant="filled"
                      color="red"
                      pos="absolute"
                      top={-6}
                      right={-6}
                      circle
                      style={{ pointerEvents: 'none', minWidth: 22, height: 22, padding: 0 }}
                      title={`${unreadCount} unread`}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  ))}
              </Box>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Notifications</Menu.Label>
              <ScrollArea.Autosize mah={320}>
                {recentNotifications.length === 0 ? (
                  <Text size="sm" c="dimmed" px="sm" py="xs">
                    No notifications yet.
                  </Text>
                ) : (
                  recentNotifications.map((n) => {
                    const path = resolveNotificationPath(n.params);
                    const canOpen = Boolean(path);
                    return (
                      <UnstyledButton
                        key={n.id}
                        w="100%"
                        px="sm"
                        py="xs"
                        mx={4}
                        my={2}
                        disabled={!canOpen}
                        aria-label={canOpen ? `Open: ${n.title}` : `${n.title} (no link)`}
                        onClick={() => {
                          if (!canOpen || !path) return;
                          setNotifMenuOpened(false);
                          navigate(path);
                          if (!n.read_at) {
                            void markNotificationRead(n.id)
                              .then(() =>
                                Promise.all([
                                  queryClient.invalidateQueries({ queryKey: notificationsUnreadCountKey }),
                                  queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
                                ])
                              )
                              .catch(() => {});
                          }
                        }}
                        styles={(theme) => ({
                          root: {
                            borderRadius: theme.radius.md,
                            border: `1px solid ${canOpen ? theme.colors.gray[2] : 'transparent'}`,
                            cursor: canOpen ? 'pointer' : 'default',
                            textAlign: 'left' as const,
                            transition:
                              'box-shadow 160ms ease, background-color 160ms ease, border-color 160ms ease, transform 120ms ease',
                            ...(canOpen
                              ? {
                                  '&:hover': {
                                    backgroundColor: theme.colors.gray[0],
                                    boxShadow: theme.shadows.md,
                                    borderColor: theme.colors.gray[3],
                                  },
                                  '&:active': { transform: 'scale(0.995)' },
                                }
                              : { opacity: 0.85 }),
                          },
                        })}
                      >
                        <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
                          <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                            <Text size="sm" fw={600} lineClamp={1}>{n.title}</Text>
                            <Text size="xs" c="dimmed" lineClamp={2}>{n.body}</Text>
                            {canOpen && <Text size="xs" c="blue" fw={500}>Open linked page</Text>}
                          </Stack>
                          <Stack gap={4} align="flex-end" justify="center" miw={canOpen ? 28 : undefined}>
                            {!n.read_at && <Badge size="xs" variant="filled" color="blue">New</Badge>}
                            {canOpen && (
                              <IconChevronRight
                                size={18}
                                stroke={1.5}
                                color="var(--mantine-color-dimmed)"
                                style={{ flexShrink: 0 }}
                              />
                            )}
                          </Stack>
                        </Group>
                      </UnstyledButton>
                    );
                  })
                )}
              </ScrollArea.Autosize>
              <Divider my={4} />
              <Text size="xs" c="dimmed" px="sm">
                Showing the 15 most recent. Unread updates about every minute.
              </Text>
            </Menu.Dropdown>
          </Menu>

          {/* ── Role switcher: visible only when user has multiple roles ── */}
          {hasMultipleRoles && (
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <Button
                  variant="light"
                  rightSection={<IconChevronDown size={14} />}
                  aria-label="Switch role"
                >
                  {roleLabel}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Switch Role</Menu.Label>
                {uniqueRoleNames.map((rName) => {
                  const slug = normalizeRoleSlug(rName);
                  const isActive = slug === role;
                  return (
                    <Menu.Item
                      key={rName}
                      leftSection={
                        isActive ? (
                          <IconCheck size={14} color="var(--mantine-color-blue-6)" />
                        ) : (
                          <IconSwitchVertical size={14} />
                        )
                      }
                      fw={isActive ? 600 : undefined}
                      c={isActive ? 'blue' : undefined}
                      disabled={isActive}
                      onClick={() => { if (!isActive) switchToRole(rName); }}
                    >
                      {getRoleLabel(slug)}
                    </Menu.Item>
                  );
                })}
              </Menu.Dropdown>
            </Menu>
          )}

          {/* ── Profile / account menu ── */}
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

              {/* Switch Workspace — restored exactly as before */}
              {assignments.length > 1 && !isOfficer && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconSwitchVertical size={14} />}
                    onClick={handleSwitchWorkspace}
                  >
                    Switch Workspace
                  </Menu.Item>
                </>
              )}

              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconLogout size={14} />} onClick={handleLogout}>
                Logout
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

        </Group>
      </Group>

      {/* Facility picker modal */}
      {switchState.type === 'facility_picker' && (
        <FacilityPickerModal
          opened
          onClose={dismissPicker}
          targetRoleName={switchState.targetRoleName}
          candidates={switchState.candidates}
          onSelect={onFacilitySelected}
        />
      )}

      {/* Store picker modal (WM → Storekeeper) */}
      {switchState.type === 'store_picker' && (
        <StorekeeperStorePickerModal
          opened
          onClose={dismissPicker}
          onSelect={onStoreSelected}
        />
      )}
    </>
  );
}
