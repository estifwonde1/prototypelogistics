import { NavLink, useLocation } from 'react-router-dom';
import { Stack, NavLink as MantineNavLink } from '@mantine/core';
import {
  IconDashboard,
  IconBuilding,
  IconBuildingWarehouse,
  IconBox,
  IconStack2,
  IconChartBar,
  IconFileImport,
  IconFileExport,
  IconClipboardCheck,
  IconTruck,
  IconUsers,
  IconUserCheck,
  IconMapPins,
  IconBuildingSkyscraper,
} from '@tabler/icons-react';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  resource?: 'hubs' | 'warehouses' | 'stores' | 'stacks' | 'grns' | 'gins' | 'inspections' | 'waybills' | 'stock_balances';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  onLinkClick?: () => void;
}

const navigationGroups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', icon: <IconDashboard size={20} />, path: '/' },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Hubs', icon: <IconBuilding size={20} />, path: '/hubs', resource: 'hubs' },
      { label: 'Warehouses', icon: <IconBuildingWarehouse size={20} />, path: '/warehouses', resource: 'warehouses' },
      { label: 'Stores', icon: <IconBox size={20} />, path: '/stores', resource: 'stores' },
      { label: 'Stacks', icon: <IconStack2 size={20} />, path: '/stacks', resource: 'stacks' },
      { label: 'Stock Balances', icon: <IconChartBar size={20} />, path: '/stock-balances', resource: 'stock_balances' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'GRNs', icon: <IconFileImport size={20} />, path: '/grns', resource: 'grns' },
      { label: 'GINs', icon: <IconFileExport size={20} />, path: '/gins', resource: 'gins' },
      { label: 'Inspections', icon: <IconClipboardCheck size={20} />, path: '/inspections', resource: 'inspections' },
      { label: 'Waybills', icon: <IconTruck size={20} />, path: '/waybills', resource: 'waybills' },
    ],
  },
];

export function Sidebar({ onLinkClick }: SidebarProps) {
  const { can } = usePermission();
  const role = useAuthStore((state) => state.role);
  const location = useLocation();
  const isAdmin = role === 'admin' || role === 'superadmin';

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

      {!isAdmin && navigationGroups.map((group) => {
        // Filter items based on permissions
        const visibleItems = group.items.filter((item) => {
          // Dashboard is always visible
          if (!item.resource) return true;
          // Check if user has read permission for this resource
          return can(item.resource, 'read');
        });

        // Don't render group if no items are visible
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.label}>
            <MantineNavLink
              label={group.label}
              childrenOffset={0}
              defaultOpened
              style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--mantine-color-dimmed)' }}
            >
              {visibleItems.map((item) => {
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);
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
        );
      })}
    </Stack>
  );
}
