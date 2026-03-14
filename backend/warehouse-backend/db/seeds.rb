puts "Seeding CATS Core and Warehouse data..."

def find_or_create_with(model, attrs, updates = {})
  record = model.find_or_create_by!(attrs)
  record.update!(updates) if updates.any?
  record
end

core_module = find_or_create_with(
  Cats::Core::ApplicationModule,
  {prefix: "core"},
  {name: "Core"}
)

warehouse_module = find_or_create_with(
  Cats::Core::ApplicationModule,
  {prefix: "warehouse"},
  {name: "Warehouse"}
)

roles = {
  admin: find_or_create_with(Cats::Core::Role, {name: "Admin", application_module: core_module}),
  hub_manager: find_or_create_with(Cats::Core::Role, {name: "Hub Manager", application_module: warehouse_module}),
  warehouse_manager: find_or_create_with(Cats::Core::Role, {name: "Warehouse Manager", application_module: warehouse_module}),
  storekeeper: find_or_create_with(Cats::Core::Role, {name: "Storekeeper", application_module: warehouse_module}),
  inspector: find_or_create_with(Cats::Core::Role, {name: "Inspector", application_module: warehouse_module}),
  dispatcher: find_or_create_with(Cats::Core::Role, {name: "Dispatcher", application_module: warehouse_module})
}

admin_menu = find_or_create_with(
  Cats::Core::Menu,
  {label: "Administration", application_module: core_module},
  {icon: "settings"}
)

warehouse_menu = find_or_create_with(
  Cats::Core::Menu,
  {label: "Warehouse", application_module: warehouse_module},
  {icon: "warehouse"}
)

admin_user_item = find_or_create_with(
  Cats::Core::MenuItem,
  {menu: admin_menu, label: "User Management", route: "/admin/users"},
  {icon: "users"}
)
admin_location_item = find_or_create_with(
  Cats::Core::MenuItem,
  {menu: admin_menu, label: "Locations", route: "/admin/locations"},
  {icon: "map"}
)

warehouse_items = [
  {label: "Hubs", route: "/cats_warehouse/v1/hubs", icon: "hub"},
  {label: "Warehouses", route: "/cats_warehouse/v1/warehouses", icon: "warehouse"},
  {label: "Stores", route: "/cats_warehouse/v1/stores", icon: "store"},
  {label: "Stacks", route: "/cats_warehouse/v1/stacks", icon: "layers"},
  {label: "GRNs", route: "/cats_warehouse/v1/grns", icon: "download"},
  {label: "GINs", route: "/cats_warehouse/v1/gins", icon: "upload"},
  {label: "Inspections", route: "/cats_warehouse/v1/inspections", icon: "check"},
  {label: "Waybills", route: "/cats_warehouse/v1/waybills", icon: "truck"},
  {label: "Stock Balances", route: "/cats_warehouse/v1/stock_balances", icon: "box"}
].map do |item|
  find_or_create_with(Cats::Core::MenuItem, {menu: warehouse_menu, label: item[:label], route: item[:route]}, {icon: item[:icon]})
end

admin_role_menu = find_or_create_with(Cats::Core::RoleMenu, {role: roles[:admin], menu: admin_menu})
admin_role_menu.menu_items << admin_user_item unless admin_role_menu.menu_items.exists?(admin_user_item.id)
admin_role_menu.menu_items << admin_location_item unless admin_role_menu.menu_items.exists?(admin_location_item.id)

hub_manager_role_menu = find_or_create_with(Cats::Core::RoleMenu, {role: roles[:hub_manager], menu: warehouse_menu})
hub_items = warehouse_items.select { |i| i.label == "Hubs" }
hub_items.each do |item|
  hub_manager_role_menu.menu_items << item unless hub_manager_role_menu.menu_items.exists?(item.id)
end

warehouse_role_menu = find_or_create_with(Cats::Core::RoleMenu, {role: roles[:warehouse_manager], menu: warehouse_menu})
warehouse_items.reject { |i| i.label == "Hubs" }.each do |item|
  warehouse_role_menu.menu_items << item unless warehouse_role_menu.menu_items.exists?(item.id)
end

storekeeper_role_menu = find_or_create_with(Cats::Core::RoleMenu, {role: roles[:storekeeper], menu: warehouse_menu})
warehouse_items.select { |i| %w[Stores Stacks GRNs GINs Stock\ Balances].include?(i.label) }.each do |item|
  storekeeper_role_menu.menu_items << item unless storekeeper_role_menu.menu_items.exists?(item.id)
end

inspector_role_menu = find_or_create_with(Cats::Core::RoleMenu, {role: roles[:inspector], menu: warehouse_menu})
warehouse_items.select { |i| %w[Inspections GRNs].include?(i.label) }.each do |item|
  inspector_role_menu.menu_items << item unless inspector_role_menu.menu_items.exists?(item.id)
end

dispatcher_role_menu = find_or_create_with(Cats::Core::RoleMenu, {role: roles[:dispatcher], menu: warehouse_menu})
warehouse_items.select { |i| %w[Waybills GINs].include?(i.label) }.each do |item|
  dispatcher_role_menu.menu_items << item unless dispatcher_role_menu.menu_items.exists?(item.id)
end

admin_user = find_or_create_with(
  Cats::Core::User,
  {email: "admin@cats.local"},
  {
    first_name: "Admin",
    last_name: "User",
    password: "Password1!",
    active: true,
    application_module: core_module
  }
)

warehouse_manager = find_or_create_with(
  Cats::Core::User,
  {email: "warehouse.manager@cats.local"},
  {
    first_name: "Warehouse",
    last_name: "Manager",
    password: "Password1!",
    active: true,
    application_module: warehouse_module
  }
)

hub_manager = find_or_create_with(
  Cats::Core::User,
  {email: "hub.manager@cats.local"},
  {
    first_name: "Hub",
    last_name: "Manager",
    password: "Password1!",
    active: true,
    application_module: warehouse_module
  }
)

receiver_user = find_or_create_with(
  Cats::Core::User,
  {email: "receiver@cats.local"},
  {
    first_name: "Receiving",
    last_name: "Officer",
    password: "Password1!",
    active: true,
    application_module: warehouse_module
  }
)

issuer_user = find_or_create_with(
  Cats::Core::User,
  {email: "issuer@cats.local"},
  {
    first_name: "Issuing",
    last_name: "Officer",
    password: "Password1!",
    active: true,
    application_module: warehouse_module
  }
)

inspector_user = find_or_create_with(
  Cats::Core::User,
  {email: "inspector@cats.local"},
  {
    first_name: "Inspection",
    last_name: "Officer",
    password: "Password1!",
    active: true,
    application_module: warehouse_module
  }
)

approver_user = find_or_create_with(
  Cats::Core::User,
  {email: "approver@cats.local"},
  {
    first_name: "Approver",
    last_name: "Officer",
    password: "Password1!",
    active: true,
    application_module: warehouse_module
  }
)

dispatcher_user = find_or_create_with(
  Cats::Core::User,
  {email: "dispatcher@cats.local"},
  {
    first_name: "Dispatch",
    last_name: "Officer",
    password: "Password1!",
    active: true,
    application_module: warehouse_module
  }
)

{
  admin_user => roles[:admin],
  hub_manager => roles[:hub_manager],
  warehouse_manager => roles[:warehouse_manager],
  receiver_user => roles[:storekeeper],
  issuer_user => roles[:storekeeper],
  inspector_user => roles[:inspector],
  approver_user => roles[:warehouse_manager],
  dispatcher_user => roles[:dispatcher]
}.each do |user, role|
  user.roles << role unless user.roles.exists?(role.id)
end

region_1 = find_or_create_with(
  Cats::Core::Location,
  {code: "REG-001"},
  {name: "Region Alpha", location_type: Cats::Core::Location::REGION}
)
zone_1 = find_or_create_with(
  Cats::Core::Location,
  {code: "ZON-001"},
  {name: "Zone Alpha-1", location_type: Cats::Core::Location::ZONE, parent: region_1}
)
woreda_1 = find_or_create_with(
  Cats::Core::Location,
  {code: "WOR-001"},
  {name: "Woreda Alpha-1", location_type: Cats::Core::Location::WOREDA, parent: zone_1}
)
fdp_1 = find_or_create_with(
  Cats::Core::Location,
  {code: "FDP-001"},
  {name: "FDP Alpha-1", location_type: Cats::Core::Location::FDP, parent: woreda_1}
)

region_2 = find_or_create_with(
  Cats::Core::Location,
  {code: "REG-002"},
  {name: "Region Beta", location_type: Cats::Core::Location::REGION}
)
zone_2 = find_or_create_with(
  Cats::Core::Location,
  {code: "ZON-002"},
  {name: "Zone Beta-1", location_type: Cats::Core::Location::ZONE, parent: region_2}
)
woreda_2 = find_or_create_with(
  Cats::Core::Location,
  {code: "WOR-002"},
  {name: "Woreda Beta-1", location_type: Cats::Core::Location::WOREDA, parent: zone_2}
)
fdp_2 = find_or_create_with(
  Cats::Core::Location,
  {code: "FDP-002"},
  {name: "FDP Beta-1", location_type: Cats::Core::Location::FDP, parent: woreda_2}
)

hub_location_1 = find_or_create_with(
  Cats::Core::Location,
  {code: "HUB-001"},
  {name: "Hub Alpha", location_type: Cats::Core::Location::HUB, parent: fdp_1}
)
hub_location_2 = find_or_create_with(
  Cats::Core::Location,
  {code: "HUB-002"},
  {name: "Hub Beta", location_type: Cats::Core::Location::HUB, parent: fdp_2}
)
hub_location_3 = find_or_create_with(
  Cats::Core::Location,
  {code: "HUB-003"},
  {name: "Hub Gamma", location_type: Cats::Core::Location::HUB, parent: fdp_1}
)

warehouse_location_1 = find_or_create_with(
  Cats::Core::Location,
  {code: "WH-001"},
  {name: "Warehouse A", location_type: Cats::Core::Location::WAREHOUSE, parent: hub_location_1}
)
warehouse_location_2 = find_or_create_with(
  Cats::Core::Location,
  {code: "WH-002"},
  {name: "Warehouse B", location_type: Cats::Core::Location::WAREHOUSE, parent: hub_location_1}
)
warehouse_location_3 = find_or_create_with(
  Cats::Core::Location,
  {code: "WH-003"},
  {name: "Warehouse C", location_type: Cats::Core::Location::WAREHOUSE, parent: hub_location_2}
)
warehouse_location_4 = find_or_create_with(
  Cats::Core::Location,
  {code: "WH-004"},
  {name: "Warehouse D", location_type: Cats::Core::Location::WAREHOUSE, parent: hub_location_3}
)

units = {
  kg: find_or_create_with(Cats::Core::UnitOfMeasure, {abbreviation: "kg"}, {name: "Kilogram", unit_type: Cats::Core::UnitOfMeasure::WEIGHT}),
  mt: find_or_create_with(Cats::Core::UnitOfMeasure, {abbreviation: "mt"}, {name: "Metric Ton", unit_type: Cats::Core::UnitOfMeasure::WEIGHT}),
  bag: find_or_create_with(Cats::Core::UnitOfMeasure, {abbreviation: "bag"}, {name: "Bag", unit_type: Cats::Core::UnitOfMeasure::ITEM}),
  pcs: find_or_create_with(Cats::Core::UnitOfMeasure, {abbreviation: "pcs"}, {name: "Pieces", unit_type: Cats::Core::UnitOfMeasure::ITEM}),
  l: find_or_create_with(Cats::Core::UnitOfMeasure, {abbreviation: "l"}, {name: "Liter", unit_type: Cats::Core::UnitOfMeasure::VOLUME}),
  ctn: find_or_create_with(Cats::Core::UnitOfMeasure, {abbreviation: "ctn"}, {name: "Carton", unit_type: Cats::Core::UnitOfMeasure::ITEM})
}

categories = [
  {code: "CEREAL", name: "Cereals"},
  {code: "PULSE", name: "Pulses"},
  {code: "NONFOOD", name: "Non-Food Items"}
].map do |cat|
  find_or_create_with(Cats::Core::CommodityCategory, {code: cat[:code]}, {name: cat[:name]})
end

donor = find_or_create_with(Cats::Core::Donor, {code: "DON-001"}, {name: "Sample Donor"})

currencies = {
  usd: find_or_create_with(Cats::Core::Currency, {code: "USD"}, {name: "US Dollar"}),
  etb: find_or_create_with(Cats::Core::Currency, {code: "ETB"}, {name: "Ethiopian Birr"})
}

cash_donation = find_or_create_with(
  Cats::Core::CashDonation,
  {reference_no: "CD-001"},
  {
    donated_on: Date.today - 30,
    donor: donor,
    currency: currencies[:usd],
    amount: 100_000
  }
)

commodity_donation = find_or_create_with(
  Cats::Core::CommodityDonation,
  {reference_no: "CMD-001"},
  {
    donated_on: Date.today - 30,
    donor: donor,
    commodity_category: categories[0],
    unit: units[:kg],
    quantity: 50_000
  }
)

program = find_or_create_with(
  Cats::Core::Program,
  {code: "PRG-001"},
  {name: "Relief Program"}
)

project = find_or_create_with(
  Cats::Core::Project,
  {code: "PRJ-001"},
  {
    description: "Relief Project",
    source: commodity_donation,
    program: program,
    year: Date.today.year,
    implementing_agency: "CATS"
  }
)

commodities = [
  {batch_no: "COM-001", quantity: 5000, unit: units[:kg]},
  {batch_no: "COM-002", quantity: 3000, unit: units[:kg]},
  {batch_no: "COM-003", quantity: 2000, unit: units[:kg]},
  {batch_no: "COM-004", quantity: 1500, unit: units[:mt]},
  {batch_no: "COM-005", quantity: 1200, unit: units[:mt]},
  {batch_no: "COM-006", quantity: 800, unit: units[:bag]},
  {batch_no: "COM-007", quantity: 600, unit: units[:bag]},
  {batch_no: "COM-008", quantity: 400, unit: units[:pcs]},
  {batch_no: "COM-009", quantity: 300, unit: units[:pcs]},
  {batch_no: "COM-010", quantity: 250, unit: units[:ctn]}
].map do |c|
  find_or_create_with(
    Cats::Core::Commodity,
    {batch_no: c[:batch_no]},
    {
      unit_of_measure: c[:unit],
      project: project,
      quantity: c[:quantity],
      best_use_before: Date.today + 365,
      status: Cats::Core::Commodity::DRAFT,
      arrival_status: Cats::Core::Commodity::AT_SOURCE
    }
  )
end

transporters = [
  {code: "TR-001", name: "Alpha Logistics"},
  {code: "TR-002", name: "Beta Transport"},
  {code: "TR-003", name: "Gamma Freight"}
].map do |t|
  find_or_create_with(Cats::Core::Transporter, {code: t[:code]}, {name: t[:name]})
end

purchase_order = find_or_create_with(
  Cats::Core::PurchaseOrder,
  {reference_no: "PO-001"},
  {
    order_date: Date.today - 15,
    supplier: "Global Supplier",
    purchase_type: Cats::Core::PurchaseOrder::LOCAL,
    commodity_category: categories[1],
    currency: currencies[:usd],
    unit: units[:kg],
    quantity: 10_000,
    price: 2.5,
    cash_donation: cash_donation
  }
)

gift_certificate = find_or_create_with(
  Cats::Core::GiftCertificate,
  {reference_no: "GC-001"},
  {
    gift_date: Date.today - 10,
    requested_by: "Relief Team",
    customs_office: "Addis",
    commodity_category: categories[2],
    unit: units[:pcs],
    currency: currencies[:etb],
    quantity: 1000,
    destination_warehouse: warehouse_location_1
  }
)

dispatch_plan = find_or_create_with(
  Cats::Core::DispatchPlan,
  {reference_no: "DP-001"},
  {
    description: "Sample Dispatch Plan",
    status: "Approved",
    prepared_by: dispatcher_user,
    approved_by: approver_user
  }
)

dispatch_plan_item = find_or_create_with(
  Cats::Core::DispatchPlanItem,
  {reference_no: "DPI-001"},
  {
    dispatch_plan: dispatch_plan,
    source: warehouse_location_1,
    destination: fdp_2,
    commodity: commodities.first,
    quantity: 500,
    unit: units[:kg],
    commodity_status: "Good",
    status: "Authorized"
  }
)

dispatch = find_or_create_with(
  Cats::Core::Dispatch,
  {reference_no: "DISP-001"},
  {
    dispatch_plan_item: dispatch_plan_item,
    transporter: transporters.first,
    plate_no: "ABC-1234",
    driver_name: "Driver One",
    driver_phone: "0912345678",
    quantity: 500,
    unit: units[:kg],
    commodity_status: "Good",
    prepared_by: dispatcher_user,
    dispatch_status: "Authorized"
  }
)

geos = [
  {latitude: 9.0, longitude: 38.7, address: "Addis Ababa"},
  {latitude: 8.9, longitude: 38.8, address: "Sululta"},
  {latitude: 9.1, longitude: 38.6, address: "Bishoftu"},
  {latitude: 8.95, longitude: 38.75, address: "Holeta"},
  {latitude: 9.05, longitude: 38.65, address: "Sebeta"}
].map do |g|
  find_or_create_with(Cats::Warehouse::Geo, {latitude: g[:latitude], longitude: g[:longitude]}, {address: g[:address]})
end

hubs = [
  {code: "HB-001", name: "Hub Alpha", location: hub_location_1, geo: geos[0]},
  {code: "HB-002", name: "Hub Beta", location: hub_location_2, geo: geos[1]},
  {code: "HB-003", name: "Hub Gamma", location: hub_location_3, geo: geos[2]}
].map do |h|
  find_or_create_with(
    Cats::Warehouse::Hub,
    {code: h[:code]},
    {
      name: h[:name],
      location: h[:location],
      geo: h[:geo],
      hub_type: "Regional",
      status: "Active",
      description: "Seeded hub"
    }
  )
end

hubs.each_with_index do |hub, idx|
  find_or_create_with(Cats::Warehouse::HubCapacity, {hub: hub}, {total_area_sqm: 1000 + idx * 100, total_capacity_mt: 500 + idx * 50})
  find_or_create_with(Cats::Warehouse::HubAccess, {hub: hub}, {has_loading_dock: true, number_of_loading_docks: 2})
  find_or_create_with(Cats::Warehouse::HubInfra, {hub: hub}, {floor_type: "Concrete", roof_type: "Metal", has_ventilation: true})
  find_or_create_with(Cats::Warehouse::HubContacts, {hub: hub}, {manager_name: "Manager #{idx + 1}", contact_phone: "09123456#{idx}0"})
end

warehouses = [
  {code: "W-001", name: "Warehouse A", location: warehouse_location_1, hub: hubs[0], geo: geos[3]},
  {code: "W-002", name: "Warehouse B", location: warehouse_location_2, hub: hubs[0], geo: geos[4]},
  {code: "W-003", name: "Warehouse C", location: warehouse_location_3, hub: hubs[1], geo: geos[1]},
  {code: "W-004", name: "Warehouse D", location: warehouse_location_4, hub: hubs[2], geo: geos[2]}
].map do |w|
  find_or_create_with(
    Cats::Warehouse::Warehouse,
    {code: w[:code]},
    {
      name: w[:name],
      location: w[:location],
      hub: w[:hub],
      geo: w[:geo],
      warehouse_type: "Standard",
      status: "Active",
      description: "Seeded warehouse"
    }
  )
end

warehouses.each_with_index do |warehouse, idx|
  find_or_create_with(
    Cats::Warehouse::WarehouseCapacity,
    {warehouse: warehouse},
    {
      total_area_sqm: 2000 + idx * 200,
      total_storage_capacity_mt: 1000 + idx * 100,
      usable_storage_capacity_mt: 800 + idx * 80,
      no_of_stores: 3,
      ownership_type: "Government"
    }
  )
  find_or_create_with(
    Cats::Warehouse::WarehouseAccess,
    {warehouse: warehouse},
    {
      has_loading_dock: true,
      number_of_loading_docks: 1,
      access_road_type: "Paved"
    }
  )
  find_or_create_with(
    Cats::Warehouse::WarehouseInfra,
    {warehouse: warehouse},
    {
      floor_type: "Concrete",
      roof_type: "Metal",
      has_fumigation_facility: true,
      has_fire_extinguisher: true,
      has_security_guard: true
    }
  )
  find_or_create_with(
    Cats::Warehouse::WarehouseContacts,
    {warehouse: warehouse},
    {manager_name: "Warehouse Manager #{idx + 1}", contact_phone: "09123456#{idx}1"}
  )
end

stores = warehouses.flat_map do |warehouse|
  (1..3).map do |i|
    find_or_create_with(
      Cats::Warehouse::Store,
      {code: "#{warehouse.code}-ST#{i}"},
      {
        name: "#{warehouse.name} Store #{i}",
        length: 50,
        width: 40,
        height: 10,
        usable_space: 2000,
        available_space: 1500,
        warehouse: warehouse
      }
    )
  end
end

stores.each do |store|
  find_or_create_with(
    Cats::Warehouse::StackingRule,
    {warehouse: store.warehouse},
    {
      distance_from_wall: 1.0,
      space_between_stack: 1.0,
      distance_from_ceiling: 0.5,
      maximum_height: 5.0,
      maximum_length: 10.0,
      maximum_width: 5.0,
      distance_from_gangway: 1.0
    }
  )
end

stacks = stores.flat_map.with_index do |store, idx|
  commodities.sample(3).map.with_index do |commodity, i|
    find_or_create_with(
      Cats::Warehouse::Stack,
      {code: "#{store.code}-S#{i + 1}"},
      {
        length: 10,
        width: 10,
        height: 5,
        start_x: 1,
        start_y: 1,
        commodity: commodity,
        store: store,
        unit: commodity.unit_of_measure,
        quantity: 100 + (idx * 10)
      }
    )
  end
end

stacks.sample(8).each do |stack|
  find_or_create_with(
    Cats::Warehouse::StockBalance,
    {
      warehouse: stack.store.warehouse,
      store: stack.store,
      stack: stack,
      commodity: stack.commodity,
      unit: stack.unit
    },
    {quantity: stack.quantity}
  )
end

grn = find_or_create_with(
  Cats::Warehouse::Grn,
  {reference_no: "GRN-001"},
  {
    warehouse: warehouses.first,
    received_on: Date.today - 2,
    received_by: receiver_user,
    approved_by: approver_user,
    status: "Draft",
    source: gift_certificate
  }
)

grn_items = commodities.first(3).map.with_index do |commodity, idx|
  find_or_create_with(
    Cats::Warehouse::GrnItem,
    {grn: grn, commodity: commodity},
    {
      quantity: 100 + idx * 10,
      unit: commodity.unit_of_measure,
      quality_status: "Good",
      store: stores.first,
      stack: stacks.first
    }
  )
end

gin = find_or_create_with(
  Cats::Warehouse::Gin,
  {reference_no: "GIN-001"},
  {
    warehouse: warehouses.first,
    issued_on: Date.today - 1,
    issued_by: issuer_user,
    approved_by: approver_user,
    status: "Draft",
    destination: fdp_2
  }
)

commodities.first(2).each_with_index do |commodity, idx|
  find_or_create_with(
    Cats::Warehouse::GinItem,
    {gin: gin, commodity: commodity},
    {
      quantity: 50 + idx * 10,
      unit: commodity.unit_of_measure,
      store: stores.first,
      stack: stacks.first
    }
  )
end

inspection = find_or_create_with(
  Cats::Warehouse::Inspection,
  {reference_no: "INSP-001"},
  {
    warehouse: warehouses.first,
    inspected_on: Date.today - 1,
    inspector: inspector_user,
    status: "Draft",
    source: grn
  }
)

grn_items.first(2).each_with_index do |item, idx|
  find_or_create_with(
    Cats::Warehouse::InspectionItem,
    {inspection: inspection, commodity: item.commodity},
    {
      quantity_received: item.quantity,
      quantity_damaged: idx.zero? ? 5 : 0,
      quantity_lost: idx.zero? ? 2 : 0,
      quality_status: idx.zero? ? "Damaged" : "Good",
      packaging_condition: "OK",
      remarks: "Seeded inspection"
    }
  )
end

waybill = find_or_create_with(
  Cats::Warehouse::Waybill,
  {reference_no: "WB-001"},
  {
    issued_on: Date.today,
    dispatch: dispatch,
    source_location: warehouse_location_1,
    destination_location: fdp_2,
    status: "Draft"
  }
)

find_or_create_with(
  Cats::Warehouse::WaybillTransport,
  {waybill: waybill},
  {
    transporter: transporters.first,
    vehicle_plate_no: "XYZ-9876",
    driver_name: "Driver Two",
    driver_phone: "0911111111"
  }
)

commodities.first(2).each_with_index do |commodity, idx|
  find_or_create_with(
    Cats::Warehouse::WaybillItem,
    {waybill: waybill, commodity: commodity},
    {quantity: 20 + idx * 5, unit: commodity.unit_of_measure}
  )
end

puts "Seeding completed."
