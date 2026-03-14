import { NavLink } from 'react-router-dom';
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
} from '@tabler/icons-react';
import { usePermission } from '../../hooks/usePermission';

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

  return (
    <Stack gap="md" p="md">
      {navigationGroups.map((group) => {
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
              {visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  onClick={onLinkClick}
                >
                  {({ isActive }) => (
                    <MantineNavLink
                      label={item.label}
                      leftSection={item.icon}
                      active={isActive}
                      variant="subtle"
                    />
                  )}
                </NavLink>
              ))}
            </MantineNavLink>
          </div>
        );
      })}
    </Stack>
  );
}
