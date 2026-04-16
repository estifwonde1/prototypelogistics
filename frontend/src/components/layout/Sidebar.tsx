import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Stack, NavLink as MantineNavLink, Badge, Text } from '@mantine/core';
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
  IconClipboardList,
  IconMapPin,
} from '@tabler/icons-react';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import { useOfficerScope } from '../../hooks/useOfficerScope';
import { OFFICER_ROLE_SLUGS, type Resource, type RoleSlug } from '../../contracts/warehouse';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  resource?: Resource;
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
  const { can } = usePermission();
  const location = useLocation();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isSuperAdmin = role === 'superadmin';
  const roleSlug = (role as RoleSlug | null) ?? null;
  const isOfficerRole = roleSlug ? OFFICER_ROLE_SLUGS.includes(roleSlug) : false;
  const { scopeLabel, isFullAccess } = useOfficerScope();

  const adminMenus: NavGroup[] = [
    {
      label: 'User Management',
      items: [
        { label: 'Users', icon: <IconUsers size={20} />, path: '/admin/users' },
        { label: 'User Assignments', icon: <IconUserCheck size={20} />, path: '/admin/assignments' },
      ],
    },
    {
      label: 'Setup',
      items: [
        { label: 'Locations', icon: <IconMapPins size={20} />, path: '/admin/setup/locations' },
        { label: 'Create Hub', icon: <IconBuildingSkyscraper size={20} />, path: '/admin/setup/hubs' },
        { label: 'Create Warehouse', icon: <IconBuildingWarehouse size={20} />, path: '/admin/setup/warehouses' },
      ],
    },
  ];

  const superAdminMenus: NavGroup[] = [
    {
      label: 'Operations',
      items: [
        { label: 'Hubs', icon: <IconBuilding size={20} />, path: '/hubs', resource: 'hubs' },
        { label: 'Warehouses', icon: <IconBuildingWarehouse size={20} />, path: '/warehouses', resource: 'warehouses' },
        { label: 'Stores', icon: <IconBox size={20} />, path: '/stores', resource: 'stores' },
        { label: 'Stacks', icon: <IconStack2 size={20} />, path: '/stacks', resource: 'stacks' },
        { label: 'Stacking', icon: <IconBox size={20} />, path: '/stacks/layout', resource: 'stacks' },
      ],
    },
    {
      label: 'Transactions',
      items: [
        { label: 'GRN', icon: <IconFileImport size={20} />, path: '/grns', resource: 'grns' },
        { label: 'GIN', icon: <IconFileExport size={20} />, path: '/gins', resource: 'gins' },
        { label: 'Receipts', icon: <IconInbox size={20} />, path: '/receipts', resource: 'receipts' },
        { label: 'Dispatches', icon: <IconTruck size={20} />, path: '/dispatches', resource: 'dispatches' },
        { label: 'Inspections', icon: <IconUserCheck size={20} />, path: '/inspections', resource: 'inspections' },
        { label: 'Waybills', icon: <IconTruck size={20} />, path: '/waybills', resource: 'waybills' },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Bin Card', icon: <IconReportAnalytics size={20} />, path: '/reports/bin-card', resource: 'reports' },
        { label: 'Stock Balances', icon: <IconChartBar size={20} />, path: '/stock-balances', resource: 'stock_balances' },
      ],
    },
  ];

  const roleMenus: NavGroup[] = useMemo(() => {
    if (isAdmin) {
      return [];
    }

    if (role === 'hub_manager') {
      return [
        {
          label: 'Hub Management',
          items: [
            { label: 'Hubs', icon: <IconBuilding size={20} />, path: '/hubs', resource: 'hubs' },
            { label: 'Warehouses', icon: <IconBuildingWarehouse size={20} />, path: '/warehouses', resource: 'warehouses' },
            { label: 'Stores', icon: <IconBox size={20} />, path: '/stores', resource: 'stores' },
            { label: 'Stacks', icon: <IconStack2 size={20} />, path: '/stacks', resource: 'stacks' },
            { label: 'Receipts', icon: <IconInbox size={20} />, path: '/receipts', resource: 'receipts' },
            { label: 'Dispatches', icon: <IconTruck size={20} />, path: '/dispatches', resource: 'dispatches' },
          ],
        },
        {
          label: 'Hub Operations',
          items: [
            { label: 'GRN', icon: <IconFileImport size={20} />, path: '/grns', resource: 'grns' },
            { label: 'GIN', icon: <IconFileExport size={20} />, path: '/gins', resource: 'gins' },
            { label: 'Inspections', icon: <IconUserCheck size={20} />, path: '/inspections', resource: 'inspections' },
            { label: 'Waybills', icon: <IconTruck size={20} />, path: '/waybills', resource: 'waybills' },
            { label: 'Stock Balances', icon: <IconChartBar size={20} />, path: '/stock-balances', resource: 'stock_balances' },
            { label: 'Bin Card', icon: <IconReportAnalytics size={20} />, path: '/reports/bin-card', resource: 'reports' },
          ],
        },
      ];
    }

    if (role === 'warehouse_manager') {
      return [
        {
          label: 'Warehouse Management',
          items: [
            { label: 'Warehouses', icon: <IconBuildingWarehouse size={20} />, path: '/warehouses', resource: 'warehouses' },
            { label: 'Stores', icon: <IconBox size={20} />, path: '/stores', resource: 'stores' },
            { label: 'Stacks', icon: <IconStack2 size={20} />, path: '/stacks', resource: 'stacks' },
            { label: 'Receipts', icon: <IconInbox size={20} />, path: '/receipts', resource: 'receipts' },
            { label: 'Dispatches', icon: <IconTruck size={20} />, path: '/dispatches', resource: 'dispatches' },
          ],
        },
        {
          label: 'Warehouse Operations',
          items: [
            { label: 'GRN', icon: <IconFileImport size={20} />, path: '/grns', resource: 'grns' },
            { label: 'GIN', icon: <IconFileExport size={20} />, path: '/gins', resource: 'gins' },
            { label: 'Inspections', icon: <IconUserCheck size={20} />, path: '/inspections', resource: 'inspections' },
            { label: 'Waybills', icon: <IconTruck size={20} />, path: '/waybills', resource: 'waybills' },
            { label: 'Stock Balances', icon: <IconChartBar size={20} />, path: '/stock-balances', resource: 'stock_balances' },
            { label: 'Bin Card', icon: <IconReportAnalytics size={20} />, path: '/reports/bin-card', resource: 'reports' },
          ],
        },
      ];
    }

    if (role === 'storekeeper') {
      return [
        {
          label: 'Store Management',
          items: [
            { label: 'Stores', icon: <IconBox size={20} />, path: '/stores', resource: 'stores' },
            { label: 'Stacks', icon: <IconStack2 size={20} />, path: '/stacks', resource: 'stacks' },
            { label: 'Stacking', icon: <IconBox size={20} />, path: '/stacks/layout', resource: 'stacks' },
          ],
        },
        {
          label: 'Assignments',
          items: [
            { label: 'My Assignments', icon: <IconClipboardList size={20} />, path: '/storekeeper/assignments', resource: 'receipt_orders' },
          ],
        },
        {
          label: 'Documents',
          items: [
            { label: 'GRN', icon: <IconFileImport size={20} />, path: '/grns', resource: 'grns' },
            { label: 'GIN', icon: <IconFileExport size={20} />, path: '/gins', resource: 'gins' },
            { label: 'Inspections', icon: <IconUserCheck size={20} />, path: '/inspections', resource: 'inspections' },
            { label: 'Receipts', icon: <IconInbox size={20} />, path: '/receipts', resource: 'receipts' },
            { label: 'Dispatches', icon: <IconTruck size={20} />, path: '/dispatches', resource: 'dispatches' },
          ],
        },
        {
          label: 'Reports',
          items: [
            { label: 'Bin Card', icon: <IconReportAnalytics size={20} />, path: '/reports/bin-card', resource: 'reports' },
            { label: 'Stock Balances', icon: <IconChartBar size={20} />, path: '/stock-balances', resource: 'stock_balances' },
          ],
        },
      ];
    }

    if (isOfficerRole) {
      // Federal / generic officer: full operational menu
      if (isFullAccess) {
        return [
          {
            label: 'Officer Operations',
            items: [
              { label: 'Dashboard', icon: <IconChartBar size={20} />, path: '/officer/dashboard', resource: 'receipt_orders' },
              { label: 'Facilities', icon: <IconBuildingWarehouse size={20} />, path: '/officer/facilities', resource: 'receipt_orders' },
              { label: 'Receipt Orders', icon: <IconFileImport size={20} />, path: '/officer/receipt-orders', resource: 'receipt_orders' },
              { label: 'Dispatch Orders', icon: <IconFileExport size={20} />, path: '/officer/dispatch-orders', resource: 'dispatch_orders' },
              { label: 'Commodities', icon: <IconBox size={20} />, path: '/officer/commodities/new', resource: 'receipt_orders' },
            ],
          },
        ];
      }

      // Regional / Zonal / Woreda / Kebele: monitoring-focused menu (read-only scope)
      return [
        {
          label: 'Overview',
          items: [
            { label: 'Dashboard', icon: <IconChartBar size={20} />, path: '/officer/dashboard', resource: 'receipt_orders' },
            { label: 'Facilities', icon: <IconBuildingWarehouse size={20} />, path: '/officer/facilities', resource: 'receipt_orders' },
          ],
        },
        {
          label: 'Orders',
          items: [
            { label: 'Receipt Orders', icon: <IconFileImport size={20} />, path: '/officer/receipt-orders', resource: 'receipt_orders' },
            { label: 'Dispatch Orders', icon: <IconFileExport size={20} />, path: '/officer/dispatch-orders', resource: 'dispatch_orders' },
            { label: 'Commodities', icon: <IconBox size={20} />, path: '/officer/commodities/new', resource: 'receipt_orders' },
          ],
        },
      ];
    }

    return [];
  }, [isAdmin, role, isOfficerRole]);

  const filterGroupItems = (group: NavGroup) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.resource) return true;
      return can(item.resource, 'read');
    }),
  });

  return (
    <Stack
      gap="md"
      p="md"
      h="calc(100dvh - 60px)"
      style={{ overflowY: 'auto', overflowX: 'hidden' }}
    >
      {isAdmin &&
        [...adminMenus, ...(isSuperAdmin ? superAdminMenus : [])]
          .map(filterGroupItems)
          .filter((group) => group.items.length > 0)
          .map((group) => (
          <div key={group.label}>
            <MantineNavLink
              label={group.label}
              childrenOffset={0}
              defaultOpened
              style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--mantine-color-dimmed)' }}
            >
              {group.items.map((item) => (
                <MantineNavLink
                  key={item.path}
                  component={NavLink}
                  to={item.path}
                  label={item.label}
                  leftSection={item.icon}
                  active={location.pathname.startsWith(item.path)}
                  variant="subtle"
                  onClick={onLinkClick}
                />
              ))}
            </MantineNavLink>
          </div>
        ))}

      {!isAdmin && isOfficerRole && (
        <div style={{ padding: '4px 8px' }}>
          <Badge
            leftSection={<IconMapPin size={12} />}
            color={isFullAccess ? 'green' : 'blue'}
            variant="light"
            size="sm"
            fullWidth
            style={{ justifyContent: 'flex-start' }}
          >
            <Text size="xs" truncate>
              {isFullAccess ? 'System-wide' : scopeLabel}
            </Text>
          </Badge>
        </div>
      )}

      {!isAdmin &&
        roleMenus
          .map(filterGroupItems)
          .filter((group) => group.items.length > 0)
          .map((group) => (
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
