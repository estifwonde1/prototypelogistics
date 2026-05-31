import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Stack, NavLink as MantineNavLink, Badge, Text } from "@mantine/core";
import {
  IconBuilding,
  IconBuildingWarehouse,
  IconBox,
  IconStack2,
  IconChartBar,
  IconFileImport,
  IconUsers,
  IconUserCheck,
  IconInbox,
  IconTruck,
  IconReportAnalytics,
  IconClipboardList,
  IconMapPin,
  IconFileArrowRight,
  IconClipboardCheck,
} from "@tabler/icons-react";
import { useAuthStore } from "../../store/authStore";
import { usePermission } from "../../hooks/usePermission";
import {
  OFFICER_ROLE_SLUGS,
  type Resource,
  type RoleSlug,
} from "../../contracts/warehouse";
import { useWarehouseManagerRaAccess } from "../../hooks/useWarehouseManagerRaAccess";

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
  const isAdmin = role === "admin" || role === "superadmin";
  const isSuperAdmin = role === "superadmin";
  const roleSlug = (role as RoleSlug | null) ?? null;
  const isOfficerRole = roleSlug
    ? OFFICER_ROLE_SLUGS.includes(roleSlug)
    : false;
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const { canAccessRaWorkspace: wmCanAccessRa } = useWarehouseManagerRaAccess();

  const isFullAccess = roleSlug === 'federal_officer' || roleSlug === 'officer';

  const currentScopeLabel = activeAssignment?.hub?.name || 
                           activeAssignment?.warehouse?.name || 
                           activeAssignment?.store?.name || 
                           activeAssignment?.location?.name ||
                           (isFullAccess ? 'System-wide' : 'No facility assigned');

  const adminMenus: NavGroup[] = [
    {
      label: "Facilities",
      items: [
        {
          label: "Hubs",
          icon: <IconBuilding size={20} />,
          path: "/hubs",
        },
        {
          label: "Warehouses",
          icon: <IconBuildingWarehouse size={20} />,
          path: "/warehouses",
        },
      ],
    },
    {
      label: "User Management",
      items: [
        { label: "Users", icon: <IconUsers size={20} />, path: "/admin/users" },
        {
          label: "User Assignments",
          icon: <IconUserCheck size={20} />,
          path: "/admin/assignments",
        },
      ],
    },
    {
      label: "Setup",
      items: [
        {
          label: "Commodities",
          icon: <IconBox size={20} />,
          path: "/admin/setup/commodities",
        },
      ],
    },
  ];

  const superAdminMenus: NavGroup[] = [
    {
      label: "Operations",
      items: [
        {
          label: "Hubs",
          icon: <IconBuilding size={20} />,
          path: "/hubs",
          resource: "hubs",
        },
        {
          label: "Warehouses",
          icon: <IconBuildingWarehouse size={20} />,
          path: "/warehouses",
          resource: "warehouses",
        },
        {
          label: "Stores",
          icon: <IconBox size={20} />,
          path: "/stores",
          resource: "stores",
        },
        {
          label: "Stacks",
          icon: <IconStack2 size={20} />,
          path: "/stacks",
          resource: "stacks",
        },
      ],
    },
    {
      label: "Transactions",
      items: [
        {
          label: "GRN",
          icon: <IconFileImport size={20} />,
          path: "/grns",
          resource: "grns",
        },
        {
          label: "Receipts",
          icon: <IconInbox size={20} />,
          path: "/receipts",
          resource: "receipts",
        },
      ],
    },
    {
      label: "Reports",
      items: [
        {
          label: "Bin Card",
          icon: <IconReportAnalytics size={20} />,
          path: "/reports/bin-card",
          resource: "reports",
        },
        {
          label: "Stock Balances",
          icon: <IconChartBar size={20} />,
          path: "/stock-balances",
          resource: "stock_balances",
        },
      ],
    },
  ];

  const roleMenus: NavGroup[] = useMemo(() => {
    if (isAdmin) {
      return [];
    }

    if (role === "hub_manager") {
      return [
        {
          label: "Hub Management",
          items: [
            {
              label: "Dashboard",
              icon: <IconChartBar size={20} />,
              path: "/hub/dashboard",
              resource: "hubs",
            },
            {
              label: "Hubs",
              icon: <IconBuilding size={20} />,
              path: "/hubs",
              resource: "hubs",
            },
            {
              label: "Warehouses",
              icon: <IconBuildingWarehouse size={20} />,
              path: "/warehouses",
              resource: "warehouses",
            },
            {
              label: "Stores",
              icon: <IconBox size={20} />,
              path: "/stores",
              resource: "stores",
            },
            {
              label: "Receipts",
              icon: <IconInbox size={20} />,
              path: "/receipts",
              resource: "receipts",
            },
            {
              label: "Receipt Authorizations",
              icon: <IconClipboardCheck size={20} />,
              path: "/hub/receipt-authorizations",
              resource: "receipt_authorizations",
            },
          ],
        },
      ];
    }

    if (role === "warehouse_manager") {
      const warehouseManagementItems: NavItem[] = [
        {
          label: "Dashboard",
          icon: <IconChartBar size={20} />,
          path: "/warehouse/dashboard",
          resource: "warehouses",
        },
        {
          label: "Warehouses",
          icon: <IconBuildingWarehouse size={20} />,
          path: "/warehouses",
          resource: "warehouses",
        },
        {
          label: "Stores",
          icon: <IconBox size={20} />,
          path: "/stores",
          resource: "stores",
        },
        {
          label: "Stacks",
          icon: <IconStack2 size={20} />,
          path: "/stacks",
          resource: "stacks",
        },
        {
          label: "Transfer Requests",
          icon: <IconFileArrowRight size={20} />,
          path: "/transfer-requests",
          resource: "transfer_requests",
        },
        {
          label: "Receipts",
          icon: <IconInbox size={20} />,
          path: "/receipts",
          resource: "receipt_orders",
        },
        ...(wmCanAccessRa
          ? [
              {
                label: "Receipt Authorizations",
                icon: <IconClipboardCheck size={20} />,
                path: "/warehouse/receipt-authorizations",
                resource: "receipt_authorizations" as Resource,
              },
            ]
          : []),
      ];

      return [
        {
          label: "Warehouse Management",
          items: warehouseManagementItems,
        },
        {
          label: "Warehouse Operations",
          items: [
            {
              label: "GRN",
              icon: <IconFileImport size={20} />,
              path: "/grns",
              resource: "grns",
            },
            {
              label: "Stock Balances",
              icon: <IconChartBar size={20} />,
              path: "/stock-balances",
              resource: "stock_balances",
            },
            {
              label: "Bin Card",
              icon: <IconReportAnalytics size={20} />,
              path: "/reports/bin-card",
              resource: "reports",
            },
          ],
        },
      ];
    }

    if (role === "storekeeper") {
      return [
        {
          label: "Store Management",
          items: [
            {
              label: "Dashboard",
              icon: <IconChartBar size={20} />,
              path: "/storekeeper/dashboard",
              resource: "stores",
            },
            {
              label: "Stores",
              icon: <IconBox size={20} />,
              path: "/stores",
              resource: "stores",
            },
            {
              label: "Stacks",
              icon: <IconStack2 size={20} />,
              path: "/stacks",
              resource: "stacks",
            },
            {
              label: "Transfer Requests",
              icon: <IconFileArrowRight size={20} />,
              path: "/transfer-requests",
              resource: "transfer_requests",
            },
          ],
        },
        {
          label: "Assignments",
          items: [
            {
              label: "My Assignments",
              icon: <IconClipboardList size={20} />,
              path: "/storekeeper/assignments",
              resource: "receipt_orders",
            },
            {
              label: "Driver Arrivals",
              icon: <IconTruck size={20} />,
              path: "/storekeeper/receipt-authorizations",
              resource: "receipt_orders",
            },
          ],
        },
        {
          label: "Documents",
          items: [
            {
              label: "GRN",
              icon: <IconFileImport size={20} />,
              path: "/grns",
              resource: "grns",
            },
          ],
        },
        {
          label: "Reports",
          items: [
            {
              label: "Bin Card",
              icon: <IconReportAnalytics size={20} />,
              path: "/reports/bin-card",
              resource: "reports",
            },
            {
              label: "Stock Balances",
              icon: <IconChartBar size={20} />,
              path: "/stock-balances",
              resource: "stock_balances",
            },
          ],
        },
      ];
    }

    if (isOfficerRole) {
      // Federal / generic officer: full operational menu
      if (isFullAccess) {
        return [
          {
            label: "Officer Operations",
            items: [
              {
                label: "Dashboard",
                icon: <IconChartBar size={20} />,
                path: "/officer/dashboard",
                resource: "receipt_orders",
              },
              {
                label: "Facilities",
                icon: <IconBuildingWarehouse size={20} />,
                path: "/officer/facilities",
                resource: "receipt_orders",
              },
              {
                label: "Receipt Orders",
                icon: <IconFileImport size={20} />,
                path: "/officer/receipt-orders",
                resource: "receipt_orders",
              },
              {
                label: "Commodities",
                icon: <IconBox size={20} />,
                path: "/officer/commodities/new",
                resource: "receipt_orders",
              },
            ],
          },
        ];
      }

      // Regional / Zonal / Woreda / Kebele: monitoring-focused menu (read-only scope)
      return [
        {
          label: "Overview",
          items: [
            {
              label: "Dashboard",
              icon: <IconChartBar size={20} />,
              path: "/officer/dashboard",
              resource: "receipt_orders",
            },
            {
              label: "Facilities",
              icon: <IconBuildingWarehouse size={20} />,
              path: "/officer/facilities",
              resource: "receipt_orders",
            },
          ],
        },
        {
          label: "Orders",
          items: [
            {
              label: "Receipt Orders",
              icon: <IconFileImport size={20} />,
              path: "/officer/receipt-orders",
              resource: "receipt_orders",
            },
            {
              label: "Commodities",
              icon: <IconBox size={20} />,
              path: "/officer/commodities/new",
              resource: "receipt_orders",
            },
          ],
        },
      ];
    }

    return [];
  }, [isAdmin, role, isOfficerRole, isFullAccess, activeAssignment, wmCanAccessRa]);

  const filterGroupItems = (group: NavGroup) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.resource) return true;
      return can(item.resource, "read");
    }),
  });

  return (
    <Stack
      gap="md"
      p="md"
      h="calc(100dvh - 60px)"
      style={{ overflowY: "auto", overflowX: "hidden" }}
    >
      {!isAdmin && (
        <div style={{ padding: "4px 8px" }}>
          <Badge
            leftSection={<IconMapPin size={12} />}
            color={!activeAssignment ? "green" : "blue"}
            variant="light"
            size="sm"
            fullWidth
            style={{ justifyContent: "flex-start" }}
          >
            <Text size="xs" truncate>
              {currentScopeLabel}
            </Text>
          </Badge>
        </div>
      )}

      {isAdmin &&
        adminMenus.map((group) => (
          <div key={group.label}>
            <MantineNavLink
              label={group.label}
              childrenOffset={0}
              defaultOpened
              style={{
                fontWeight: 600,
                fontSize: "0.875rem",
                color: "var(--mantine-color-dimmed)",
              }}
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

      {isSuperAdmin &&
        superAdminMenus
          .map(filterGroupItems)
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.label}>
              <MantineNavLink
                label={group.label}
                childrenOffset={0}
                defaultOpened
                style={{
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  color: "var(--mantine-color-dimmed)",
                }}
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
                style={{
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  color: "var(--mantine-color-dimmed)",
                }}
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
