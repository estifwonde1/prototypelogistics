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
  admin: find_or_create_with(Cats::Core::Role, { name: "Admin", application_module: application_module }),
  superadmin: find_or_create_with(Cats::Core::Role, { name: "Superadmin", application_module: application_module })
}

setup_menu = find_or_create_with(Cats::Core::Menu, { label: "Setup", application_module: application_module }, { icon: "pi pi-fw pi-cog" })
user_mgmt_menu = find_or_create_with(Cats::Core::Menu, { label: "User Management", application_module: application_module }, { icon: "pi pi-users" })
store_management_menu = find_or_create_with(Cats::Core::Menu, { label: "Store Management", application_module: application_module }, { icon: "pi pi-map" })
report_menu = find_or_create_with(Cats::Core::Menu, { label: "Reports", application_module: application_module }, { icon: "pi pi-wallet" })
receipt_management_menu = find_or_create_with(Cats::Core::Menu, { label: "Receipt Management", application_module: application_module }, { icon: "pi pi-book" })
dispatch_management_menu = find_or_create_with(Cats::Core::Menu, { label: "Dispatch Management", application_module: application_module }, { icon: "pi pi-send" })
hub_management_menu = find_or_create_with(Cats::Core::Menu, { label: "Hub Management", application_module: application_module }, { icon: "pi pi-telegram" })
hub_operations_menu = find_or_create_with(Cats::Core::Menu, { label: "Hub Operation", application_module: application_module }, { icon: "pi pi-globe" })
warehouse_management_menu = find_or_create_with(Cats::Core::Menu, { label: "Warehouse Management", application_module: application_module }, { icon: "pi pi-telegram" })
warehouse_operations_menu = find_or_create_with(Cats::Core::Menu, { label: "Warehouse Operation", application_module: application_module }, { icon: "pi pi-building" })
password_mgt_menu = find_or_create_with(Cats::Core::Menu, { label: "Manage Password", application_module: application_module }, { icon: "fa fa-paypal" })

# Admin menu items
find_or_create_with(Cats::Core::MenuItem, { label: "Locations", menu: setup_menu, route: "/main/setups/location" }, { icon: "pi pi-map-marker" })
find_or_create_with(Cats::Core::MenuItem, { label: "Users", menu: user_mgmt_menu, route: "/main/users" }, { icon: "pi pi-users" })
find_or_create_with(Cats::Core::MenuItem, { label: "User Assignment", menu: user_mgmt_menu, route: "/main/user-assignment" }, { icon: "pi pi-arrow-right" })

# Store keeper menu items
find_or_create_with(Cats::Core::MenuItem, { label: "Stacks", menu: store_management_menu, route: "/main/stacks" }, { icon: "pi pi-th-large" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stack Transaction", menu: store_management_menu, route: "/main/stack-transaction" }, { icon: "pi pi-th-large" })
find_or_create_with(Cats::Core::MenuItem, { label: "Free Space Report", menu: store_management_menu, route: "/main/freespace-report" }, { icon: "pi pi-percentage" })
find_or_create_with(Cats::Core::MenuItem, { label: "Stacking", menu: store_management_menu, route: "/main/stacking" }, { icon: "fa fa-database" })
find_or_create_with(Cats::Core::MenuItem, { label: "Bin Card Report", menu: report_menu, route: "/main/reports/stack-card-report" }, { icon: "fa fa-clipboard-list" })

# Hub manager menu items
find_or_create_with(Cats::Core::MenuItem, { label: "Receipt", menu: hub_management_menu, route: "/main/hub-receipts" }, { icon: "pi pi-tags" })
find_or_create_with(Cats::Core::MenuItem, { label: "Dispatch", menu: hub_management_menu, route: "/main/hub-dispatches" }, { icon: "pi pi-tags" })
find_or_create_with(Cats::Core::MenuItem, { label: "Download GRN", menu: hub_operations_menu, route: "/main/hub-receipts/goods-receipt-note" }, { icon: "pi pi-download" })
find_or_create_with(Cats::Core::MenuItem, { label: "Download GIN", menu: hub_operations_menu, route: "/main/hub-dispatches/goods-issue-note" }, { icon: "pi pi-download" })

# Warehouse manager menu items
find_or_create_with(Cats::Core::MenuItem, { label: "Receipt", menu: warehouse_management_menu, route: "/main/warehouse-receipts" }, { icon: "pi pi-tags" })
find_or_create_with(Cats::Core::MenuItem, { label: "Dispatch", menu: warehouse_management_menu, route: "/main/warehouse-dispatches" }, { icon: "pi pi-tags" })
find_or_create_with(Cats::Core::MenuItem, { label: "Download GRN", menu: warehouse_operations_menu, route: "/main/warehouse-receipts/goods-receipt-note" }, { icon: "pi pi-download" })
find_or_create_with(Cats::Core::MenuItem, { label: "Download GIN", menu: warehouse_operations_menu, route: "/main/warehouse-dispatches/goods-issue-note" }, { icon: "pi pi-download" })

puts "Assigning menus to roles..."
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:warehouse_manager], menu: warehouse_management_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:warehouse_manager], menu: warehouse_operations_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:store_keeper], menu: store_management_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:store_keeper], menu: receipt_management_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:admin], menu: user_mgmt_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:admin], menu: setup_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:hub_manager], menu: hub_management_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:hub_manager], menu: hub_operations_menu })
find_or_create_with(Cats::Core::RoleMenu, { role: roles[:admin], menu: password_mgt_menu })

# Superadmin gets all menus and menu items
[setup_menu, user_mgmt_menu, store_management_menu, report_menu, receipt_management_menu,
 dispatch_management_menu, hub_management_menu, hub_operations_menu,
 warehouse_management_menu, warehouse_operations_menu, password_mgt_menu].each do |menu|
  role_menu = find_or_create_with(Cats::Core::RoleMenu, { role: roles[:superadmin], menu: menu })
  menu.menu_items.each do |item|
    role_menu.menu_items << item unless role_menu.menu_items.exists?(item.id)
  end
end

puts "UI menus seeded."
