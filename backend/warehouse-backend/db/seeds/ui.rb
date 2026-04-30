puts "Seeding UI menus and menu items..."

def find_or_create_with(model, attrs, updates = {})
  record = model.find_or_initialize_by(attrs)
  record.assign_attributes(attrs.merge(updates))
  record.save! if record.new_record? || record.changed?
  record
end

application_module = find_or_create_with(
  Cats::Core::ApplicationModule,
  { prefix: "CATS-WH" },
  { name: "CATS Warehouse" }
)

roles = {
  hub_manager: find_or_create_with(Cats::Core::Role, { name: "Hub Manager", application_module: application_module }),
  warehouse_manager: find_or_create_with(Cats::Core::Role, { name: "Warehouse Manager", application_module: application_module }),
  store_keeper: find_or_create_with(Cats::Core::Role, { name: "Storekeeper", application_module: application_module }),
  officer: find_or_create_with(Cats::Core::Role, { name: "Officer", application_module: application_module }),
  federal_officer: find_or_create_with(Cats::Core::Role, { name: "Federal Officer", application_module: application_module }),
  regional_officer: find_or_create_with(Cats::Core::Role, { name: "Regional Officer", application_module: application_module }),
  zonal_officer: find_or_create_with(Cats::Core::Role, { name: "Zonal Officer", application_module: application_module }),
  woreda_officer: find_or_create_with(Cats::Core::Role, { name: "Woreda Officer", application_module: application_module }),
  kebele_officer: find_or_create_with(Cats::Core::Role, { name: "Kebele Officer", application_module: application_module }),
  admin: find_or_create_with(Cats::Core::Role, { name: "Admin", application_module: application_module }),
  superadmin: find_or_create_with(Cats::Core::Role, { name: "Superadmin", application_module: application_module })
}

setup_menu = find_or_create_with(Cats::Core::Menu, { label: "Setup", application_module: application_module }, { icon: "pi pi-fw pi-cog" })
user_mgmt_menu = find_or_create_with(Cats::Core::Menu, { label: "User Management", application_module: application_module }, { icon: "pi pi-users" })
operations_menu = find_or_create_with(Cats::Core::Menu, { label: "Operations", application_module: application_module }, { icon: "pi pi-map" })
transactions_menu = find_or_create_with(Cats::Core::Menu, { label: "Transactions", application_module: application_module }, { icon: "pi pi-book" })
report_menu = find_or_create_with(Cats::Core::Menu, { label: "Reports", application_module: application_module }, { icon: "pi pi-wallet" })
hub_management_menu = find_or_create_with(Cats::Core::Menu, { label: "Hub Management", application_module: application_module }, { icon: "pi pi-telegram" })
hub_operations_menu = find_or_create_with(Cats::Core::Menu, { label: "Hub Operations", application_module: application_module }, { icon: "pi pi-globe" })
warehouse_management_menu = find_or_create_with(Cats::Core::Menu, { label: "Warehouse Management", application_module: application_module }, { icon: "pi pi-telegram" })
warehouse_operations_menu = find_or_create_with(Cats::Core::Menu, { label: "Warehouse Operations", application_module: application_module }, { icon: "pi pi-building" })
assignments_menu = find_or_create_with(Cats::Core::Menu, { label: "Assignments", application_module: application_module }, { icon: "pi pi-list-check" })
documents_menu = find_or_create_with(Cats::Core::Menu, { label: "Documents", application_module: application_module }, { icon: "pi pi-file" })
officer_overview_menu = find_or_create_with(Cats::Core::Menu, { label: "Overview", application_module: application_module }, { icon: "pi pi-eye" })
officer_orders_menu = find_or_create_with(Cats::Core::Menu, { label: "Orders", application_module: application_module }, { icon: "pi pi-shopping-cart" })
officer_operations_menu = find_or_create_with(Cats::Core::Menu, { label: "Officer Operations", application_module: application_module }, { icon: "pi pi-briefcase" })
password_mgt_menu = find_or_create_with(Cats::Core::Menu, { label: "Manage Password", application_module: application_module }, { icon: "fa fa-paypal" })

# Admin menu items
find_or_create_with(Cats::Core::MenuItem, { label: "Locations", menu: setup_menu, route: "/admin/setup/locations" }, { icon: "pi pi-map-marker" })
find_or_create_with(Cats::Core::MenuItem, { label: "Create Hub", menu: setup_menu, route: "/admin/setup/hubs" }, { icon: "pi pi-sitemap" })
find_or_create_with(Cats::Core::MenuItem, { label: "Create Warehouse", menu: setup_menu, route: "/admin/setup/warehouses" }, { icon: "pi pi-building" })
find_or_create_with(Cats::Core::MenuItem, { label: "Commodities", menu: setup_menu, route: "/admin/setup/commodities" }, { icon: "pi pi-box" })
find_or_create_with(Cats::Core::MenuItem, { label: "Users", menu: user_mgmt_menu, route: "/admin/users" }, { icon: "pi pi-users" })
find_or_create_with(Cats::Core::MenuItem, { label: "User Assignments", menu: user_mgmt_menu, route: "/admin/assignments" }, { icon: "pi pi-arrow-right" })

# Operations (superadmin style)
find_or_create_with(Cats::Core::MenuItem, { label: "Hubs", menu: operations_menu, route: "/hubs" }, { icon: "pi pi-sitemap" })
find_or_create_with(Cats::Core::MenuItem, { label: "Warehouses", menu: operations_menu, route: "/warehouses" }, { icon: "pi pi-building" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stores", menu: operations_menu, route: "/stores" }, { icon: "pi pi-shop" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stacks", menu: operations_menu, route: "/stacks" }, { icon: "pi pi-th-large" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stacking", menu: operations_menu, route: "/stacks/layout" }, { icon: "pi pi-th-large" })

# Transactions
find_or_create_with(Cats::Core::MenuItem, { label: "GRN", menu: transactions_menu, route: "/grns" }, { icon: "pi pi-download" })
find_or_create_with(Cats::Core::MenuItem, { label: "GIN", menu: transactions_menu, route: "/gins" }, { icon: "pi pi-upload" })
find_or_create_with(Cats::Core::MenuItem, { label: "Receipts", menu: transactions_menu, route: "/receipts" }, { icon: "pi pi-inbox" })
find_or_create_with(Cats::Core::MenuItem, { label: "Dispatches", menu: transactions_menu, route: "/dispatches" }, { icon: "pi pi-send" })
find_or_create_with(Cats::Core::MenuItem, { label: "Inspections", menu: transactions_menu, route: "/inspections" }, { icon: "pi pi-check-square" })
find_or_create_with(Cats::Core::MenuItem, { label: "Waybills", menu: transactions_menu, route: "/waybills" }, { icon: "pi pi-truck" })

# Reports
find_or_create_with(Cats::Core::MenuItem, { label: "Bin Card", menu: report_menu, route: "/reports/bin-card" }, { icon: "pi pi-chart-line" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stock Balances", menu: report_menu, route: "/stock-balances" }, { icon: "pi pi-chart-bar" })

# Hub manager menu items
find_or_create_with(Cats::Core::MenuItem, { label: "Dashboard", menu: hub_management_menu, route: "/hub/dashboard" }, { icon: "pi pi-chart-bar" })
find_or_create_with(Cats::Core::MenuItem, { label: "Hubs", menu: hub_management_menu, route: "/hubs" }, { icon: "pi pi-sitemap" })
find_or_create_with(Cats::Core::MenuItem, { label: "Warehouses", menu: hub_management_menu, route: "/warehouses" }, { icon: "pi pi-building" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stores", menu: hub_management_menu, route: "/stores" }, { icon: "pi pi-shop" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stacks", menu: hub_management_menu, route: "/stacks" }, { icon: "pi pi-th-large" })
find_or_create_with(Cats::Core::MenuItem, { label: "Receipts", menu: hub_management_menu, route: "/receipts" }, { icon: "pi pi-inbox" })
find_or_create_with(Cats::Core::MenuItem, { label: "Dispatches", menu: hub_management_menu, route: "/dispatches" }, { icon: "pi pi-send" })
find_or_create_with(Cats::Core::MenuItem, { label: "GRN", menu: hub_operations_menu, route: "/grns" }, { icon: "pi pi-download" })
find_or_create_with(Cats::Core::MenuItem, { label: "GIN", menu: hub_operations_menu, route: "/gins" }, { icon: "pi pi-upload" })
find_or_create_with(Cats::Core::MenuItem, { label: "Inspections", menu: hub_operations_menu, route: "/inspections" }, { icon: "pi pi-check-square" })
find_or_create_with(Cats::Core::MenuItem, { label: "Waybills", menu: hub_operations_menu, route: "/waybills" }, { icon: "pi pi-truck" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stock Balances", menu: hub_operations_menu, route: "/stock-balances" }, { icon: "pi pi-chart-bar" })
find_or_create_with(Cats::Core::MenuItem, { label: "Bin Card", menu: hub_operations_menu, route: "/reports/bin-card" }, { icon: "pi pi-chart-line" })

# Warehouse manager menu items
find_or_create_with(Cats::Core::MenuItem, { label: "Dashboard", menu: warehouse_management_menu, route: "/warehouse/dashboard" }, { icon: "pi pi-chart-bar" })
find_or_create_with(Cats::Core::MenuItem, { label: "Warehouses", menu: warehouse_management_menu, route: "/warehouses" }, { icon: "pi pi-building" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stores", menu: warehouse_management_menu, route: "/stores" }, { icon: "pi pi-shop" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stacks", menu: warehouse_management_menu, route: "/stacks" }, { icon: "pi pi-th-large" })
find_or_create_with(Cats::Core::MenuItem, { label: "Transfer Requests", menu: warehouse_management_menu, route: "/transfer-requests" }, { icon: "pi pi-arrow-right-arrow-left" })
find_or_create_with(Cats::Core::MenuItem, { label: "Receipts", menu: warehouse_management_menu, route: "/receipts" }, { icon: "pi pi-inbox" })
find_or_create_with(Cats::Core::MenuItem, { label: "Dispatches", menu: warehouse_management_menu, route: "/dispatches" }, { icon: "pi pi-send" })
find_or_create_with(Cats::Core::MenuItem, { label: "GRN", menu: warehouse_operations_menu, route: "/grns" }, { icon: "pi pi-download" })
find_or_create_with(Cats::Core::MenuItem, { label: "GIN", menu: warehouse_operations_menu, route: "/gins" }, { icon: "pi pi-upload" })
find_or_create_with(Cats::Core::MenuItem, { label: "Inspections", menu: warehouse_operations_menu, route: "/inspections" }, { icon: "pi pi-check-square" })
find_or_create_with(Cats::Core::MenuItem, { label: "Waybills", menu: warehouse_operations_menu, route: "/waybills" }, { icon: "pi pi-truck" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stock Balances", menu: warehouse_operations_menu, route: "/stock-balances" }, { icon: "pi pi-chart-bar" })
find_or_create_with(Cats::Core::MenuItem, { label: "Bin Card", menu: warehouse_operations_menu, route: "/reports/bin-card" }, { icon: "pi pi-chart-line" })

# Storekeeper menu items
find_or_create_with(Cats::Core::MenuItem, { label: "Dashboard", menu: operations_menu, route: "/storekeeper/dashboard" }, { icon: "pi pi-chart-bar" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stores", menu: operations_menu, route: "/stores" }, { icon: "pi pi-shop" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stacks", menu: operations_menu, route: "/stacks" }, { icon: "pi pi-th-large" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stacking", menu: operations_menu, route: "/stacks/layout" }, { icon: "pi pi-th-large" })
find_or_create_with(Cats::Core::MenuItem, { label: "Transfer Requests", menu: operations_menu, route: "/transfer-requests" }, { icon: "pi pi-arrow-right-arrow-left" })
find_or_create_with(Cats::Core::MenuItem, { label: "My Assignments", menu: assignments_menu, route: "/storekeeper/assignments" }, { icon: "pi pi-list-check" })
find_or_create_with(Cats::Core::MenuItem, { label: "GRN", menu: documents_menu, route: "/grns" }, { icon: "pi pi-download" })
find_or_create_with(Cats::Core::MenuItem, { label: "GIN", menu: documents_menu, route: "/gins" }, { icon: "pi pi-upload" })
find_or_create_with(Cats::Core::MenuItem, { label: "Inspections", menu: documents_menu, route: "/inspections" }, { icon: "pi pi-check-square" })
find_or_create_with(Cats::Core::MenuItem, { label: "Receipts", menu: documents_menu, route: "/receipts" }, { icon: "pi pi-inbox" })
find_or_create_with(Cats::Core::MenuItem, { label: "Dispatches", menu: documents_menu, route: "/dispatches" }, { icon: "pi pi-send" })

# Officer menu items
find_or_create_with(Cats::Core::MenuItem, { label: "Dashboard", menu: officer_overview_menu, route: "/officer/dashboard" }, { icon: "pi pi-chart-bar" })
find_or_create_with(Cats::Core::MenuItem, { label: "Facilities", menu: officer_overview_menu, route: "/officer/facilities" }, { icon: "pi pi-building" })
find_or_create_with(Cats::Core::MenuItem, { label: "Receipt Orders", menu: officer_orders_menu, route: "/officer/receipt-orders" }, { icon: "pi pi-file-import" })
find_or_create_with(Cats::Core::MenuItem, { label: "Dispatch Orders", menu: officer_orders_menu, route: "/officer/dispatch-orders" }, { icon: "pi pi-file-export" })
find_or_create_with(Cats::Core::MenuItem, { label: "Commodities", menu: officer_orders_menu, route: "/officer/commodities/new" }, { icon: "pi pi-box" })
find_or_create_with(Cats::Core::MenuItem, { label: "Dashboard", menu: officer_operations_menu, route: "/officer/dashboard" }, { icon: "pi pi-chart-bar" })
find_or_create_with(Cats::Core::MenuItem, { label: "Facilities", menu: officer_operations_menu, route: "/officer/facilities" }, { icon: "pi pi-building" })
find_or_create_with(Cats::Core::MenuItem, { label: "Receipt Orders", menu: officer_operations_menu, route: "/officer/receipt-orders" }, { icon: "pi pi-file-import" })
find_or_create_with(Cats::Core::MenuItem, { label: "Dispatch Orders", menu: officer_operations_menu, route: "/officer/dispatch-orders" }, { icon: "pi pi-file-export" })
find_or_create_with(Cats::Core::MenuItem, { label: "Commodities", menu: officer_operations_menu, route: "/officer/commodities/new" }, { icon: "pi pi-box" })

puts "Assigning menus to roles..."
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:admin], menu: user_mgmt_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:admin], menu: setup_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:admin], menu: password_mgt_menu })

find_or_create_with(Cats::Core::RoleMenu, { role: roles[:warehouse_manager], menu: warehouse_management_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:warehouse_manager], menu: warehouse_operations_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:hub_manager], menu: hub_management_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:hub_manager], menu: hub_operations_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:store_keeper], menu: operations_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:store_keeper], menu: assignments_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:store_keeper], menu: documents_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:store_keeper], menu: report_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:officer], menu: officer_operations_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:federal_officer], menu: officer_operations_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:regional_officer], menu: officer_overview_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:regional_officer], menu: officer_orders_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:zonal_officer], menu: officer_overview_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:zonal_officer], menu: officer_orders_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:woreda_officer], menu: officer_overview_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:woreda_officer], menu: officer_orders_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:kebele_officer], menu: officer_overview_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:kebele_officer], menu: officer_orders_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: user_mgmt_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: setup_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: operations_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: transactions_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: report_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: password_mgt_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: hub_management_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: hub_operations_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: warehouse_management_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: warehouse_operations_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: assignments_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: documents_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: officer_overview_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: officer_orders_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:officer], menu: officer_operations_menu })

# Sync role-menu item joins for every role/menu assignment to avoid missing menu items
Cats::Core::RoleMenu.includes(:menu).find_each do |role_menu|
  role_menu.menu.menu_items.find_each do |item|
    role_menu.menu_items << item unless role_menu.menu_items.exists?(item.id)
  end
end

puts "UI menus seeded."
