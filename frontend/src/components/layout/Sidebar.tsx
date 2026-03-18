import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Stack, NavLink as MantineNavLink } from '@mantine/core';
import {
  IconBuilding,
  IconBuildingWarehouse,
  IconBox,
  IconStack2,
  IconChartBar,
  IconFileImport,
  IconFileExport,
  IconUsers,
  IconUserCheck,
  IconMapPins,
  IconBuildingSkyscraper,
  IconInbox,
  IconTruck,
  IconReportAnalytics,
} from '@tabler/icons-react';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  resource?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  onLinkClick?: () => void;
}

export function Sidebar({ onLinkClick }: SidebarProps) {
  const role = useAuthStore((state) => state.role);
  const location = useLocation();
  const isAdmin = role === 'admin' || role === 'superadmin';

  const roleMenus: NavGroup[] = useMemo(() => {
    if (isAdmin) {
      return [];
    }

    if (role === 'hub_manager') {
      return [
        {
          label: 'Hub Management',
          items: [
            { label: 'Hubs', icon: <IconBuilding size={20} />, path: '/hubs' },
            { label: 'Receipts', icon: <IconInbox size={20} />, path: '/receipts' },
            { label: 'Dispatches', icon: <IconTruck size={20} />, path: '/dispatches' },
          ],
        },
        {
          label: 'Hub Operations',
          items: [
            { label: 'GRN', icon: <IconFileImport size={20} />, path: '/grns' },
            { label: 'GIN', icon: <IconFileExport size={20} />, path: '/gins' },
          ],
        },
      ];
    }

    if (role === 'warehouse_manager') {
      return [
        {
          label: 'Warehouse Management',
          items: [
            { label: 'Warehouses', icon: <IconBuildingWarehouse size={20} />, path: '/warehouses' },
            { label: 'Receipts', icon: <IconInbox size={20} />, path: '/receipts' },
            { label: 'Dispatches', icon: <IconTruck size={20} />, path: '/dispatches' },
          ],
        },
        {
          label: 'Warehouse Operations',
          items: [
            { label: 'GRN', icon: <IconFileImport size={20} />, path: '/grns' },
            { label: 'GIN', icon: <IconFileExport size={20} />, path: '/gins' },
          ],
        },
      ];
    }

    if (role === 'storekeeper') {
      return [
        {
          label: 'Store Management',
          items: [
            { label: 'Stacks', icon: <IconStack2 size={20} />, path: '/stacks' },
            { label: 'Stacking', icon: <IconBox size={20} />, path: '/stacks/layout' },
          ],
        },
        {
          label: 'Reports',
          items: [
            { label: 'Bin Card', icon: <IconReportAnalytics size={20} />, path: '/reports/bin-card' },
            { label: 'Stock Balances', icon: <IconChartBar size={20} />, path: '/stock-balances' },
          ],
        },
      ];
    }

    return [];
  }, [isAdmin, role]);

  return (
    <Stack gap="md" p="md">
      {isAdmin ? (
        <>
          <div>
            <MantineNavLink
              label="User Management"
              childrenOffset={0}
              defaultOpened
              style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--mantine-color-dimmed)' }}
            >
              <MantineNavLink
                component={NavLink}
                to="/admin/users"
                label="Users"
                leftSection={<IconUsers size={20} />}
                active={location.pathname.startsWith('/admin/users')}
                variant="subtle"
                onClick={onLinkClick}
              />
              <MantineNavLink
                component={NavLink}
                to="/admin/assignments"
                label="User Assignments"
                leftSection={<IconUserCheck size={20} />}
                active={location.pathname.startsWith('/admin/assignments')}
                variant="subtle"
                onClick={onLinkClick}
              />
            </MantineNavLink>
          </div>

          <div>
            <MantineNavLink
              label="Setup"
              childrenOffset={0}
              defaultOpened
              style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--mantine-color-dimmed)' }}
            >
              <MantineNavLink
                component={NavLink}
                to="/admin/setup/locations"
                label="Locations"
                leftSection={<IconMapPins size={20} />}
                active={location.pathname.startsWith('/admin/setup/locations')}
                variant="subtle"
                onClick={onLinkClick}
              />
              <MantineNavLink
                component={NavLink}
                to="/admin/setup/hubs"
                label="Hubs"
                leftSection={<IconBuildingSkyscraper size={20} />}
                active={location.pathname.startsWith('/admin/setup/hubs')}
                variant="subtle"
                onClick={onLinkClick}
              />
              <MantineNavLink
                component={NavLink}
                to="/admin/setup/warehouses"
                label="Warehouses"
                leftSection={<IconBuildingWarehouse size={20} />}
                active={location.pathname.startsWith('/admin/setup/warehouses')}
                variant="subtle"
                onClick={onLinkClick}
              />
            </MantineNavLink>
          </div>
        </>
      ) : null}

      {!isAdmin &&
        roleMenus.map((group) => (
          <div key={group.label}>
            <MantineNavLink
              label={group.label}
              childrenOffset={0}
              defaultOpened
              style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--mantine-color-dimmed)' }}
            >
              {group.items.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <MantineNavLink
                    key={item.path}
                    component={NavLink}
                    to={item.path}
                    label={item.label}
                    leftSection={item.icon}
                    active={isActive}
                    variant="subtle"
                    onClick={onLinkClick}
                  />
                );
              })}
            </MantineNavLink>
          </div>
        ))}
    </Stack>
  );
}
