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

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
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
      { label: 'Hubs', icon: <IconBuilding size={20} />, path: '/hubs' },
      { label: 'Warehouses', icon: <IconBuildingWarehouse size={20} />, path: '/warehouses' },
      { label: 'Stores', icon: <IconBox size={20} />, path: '/stores' },
      { label: 'Stacks', icon: <IconStack2 size={20} />, path: '/stacks' },
      { label: 'Stock Balances', icon: <IconChartBar size={20} />, path: '/stock-balances' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'GRNs', icon: <IconFileImport size={20} />, path: '/grns' },
      { label: 'GINs', icon: <IconFileExport size={20} />, path: '/gins' },
      { label: 'Inspections', icon: <IconClipboardCheck size={20} />, path: '/inspections' },
      { label: 'Waybills', icon: <IconTruck size={20} />, path: '/waybills' },
    ],
  },
];

export function Sidebar() {
  return (
    <Stack gap="md" p="md">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          <MantineNavLink
            label={group.label}
            childrenOffset={0}
            defaultOpened
            style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--mantine-color-dimmed)' }}
          >
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                style={{ textDecoration: 'none', color: 'inherit' }}
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
      ))}
    </Stack>
  );
}
