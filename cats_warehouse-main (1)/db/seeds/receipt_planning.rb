# db/seeds/receipt_planning.rb
#
# Purpose:
# Seed focused test data for Hub Manager receipt flow screens:
# - Screen 6: Receipt Authorization
# - Screen 7: Hub Authorization (Store Assignment)
#
# Notes:
# - Idempotent (safe to run multiple times).
# - Screen 5 (Hub Check-In) is a React-only divergence and has been removed from routing/menu.

puts '*************************** Seeding Receipt Planning Test Data ***************************'

application_module = Cats::Core::ApplicationModule.find_by(prefix: 'CATS-WH')
unless application_module
  puts 'Application module CATS-WH not found. Run main seeds first.'
  return
end

mt_unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'MT')
unless mt_unit
  puts 'Unit MT not found. Run others.rb first.'
  return
end

admin_user = Cats::Core::User.find_by(email: 'admin@example.com')
hub_manager_user = Cats::Core::User.find_by(email: 'hub_manager@example.com')
hub_dispatch_officer_user = Cats::Core::User.find_by(email: 'hub_and_dispatch_officer@example.com')
hub_dispatch_approver_user = Cats::Core::User.find_by(email: 'hub_and_dispatch_approver@example.com')

unless admin_user
  puts 'Admin user not found. Run users seed first.'
  return
end

hub = Cats::Core::Location.find_by(code: 'HUB1') || Cats::Core::Location.find_by(location_type: 'Hub')
source_hub = Cats::Core::Location.where(location_type: 'Hub').where.not(id: hub&.id).first || hub
unless hub
  puts 'Hub location not found. Run locations.rb first.'
  return
end

warehouse = Cats::Core::Location.find_by(code: 'WH1') ||
            Cats::Core::Location.find_by(location_type: 'Warehouse', parent_id: hub.id) ||
            Cats::Core::Location.where(location_type: 'Warehouse').first
unless warehouse
  puts 'Warehouse not found. Run locations.rb first.'
  return
end

store_a = Cats::Core::Store.find_by(code: 'ST1') ||
          Cats::Core::Store.where(warehouse_id: warehouse.id).first
store_b = Cats::Core::Store.find_by(code: 'ST2') ||
          Cats::Core::Store.where(warehouse_id: warehouse.id).second

unless store_a && store_b
  puts 'Stores not found for hub warehouse. Run locations.rb first.'
  return
end

commodity = Cats::Core::Commodity.find_by(description: 'Wheat') || Cats::Core::Commodity.first
transporter = Cats::Core::Transporter.find_by(code: 'TRA') || Cats::Core::Transporter.first

unless commodity && transporter
  puts 'Commodity or transporter not found. Run planning.rb first.'
  return
end

puts "Using Hub=#{hub.code} Warehouse=#{warehouse.code} Stores=#{store_a.code},#{store_b.code}"

# Ensure notification rule required by ReceiptAuthorizationsController#create exists.
receipt_auth_rule = Cats::Core::NotificationRule.find_or_initialize_by(code: 'receipt_authorization')
receipt_auth_rule.roles = %w[store_keeper hub_manager hub_and_dispatch_officer hub_and_dispatch_approver]
receipt_auth_rule.save! if receipt_auth_rule.new_record? || receipt_auth_rule.changed?

# Ensure hub context on relevant users (required by Angular/React filters)
[hub_manager_user, hub_dispatch_officer_user, hub_dispatch_approver_user].compact.each do |u|
  details = (u.details || {}).dup
  details['hub'] = hub.id
  u.update!(details: details)
  puts "User hub context set: #{u.email} -> hub #{hub.id}"
end

# Dispatch Plan for destination hub receipt authorization
dispatch_plan = Cats::Core::DispatchPlan.find_or_initialize_by(reference_no: 'DP-RCP-2026-001')
dispatch_plan.assign_attributes(
  description: 'Receipt planning seed dispatch plan',
  status: 'Approved',
  upstream: nil,
  prepared_by: admin_user,
  approved_by_id: admin_user.id
)
dispatch_plan.save!

# Allocation items for Hub Authorization screen (statuses follow Angular logic)
dpi_unauthorized = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-RCP-UNAUTH-001')
dpi_unauthorized.assign_attributes(
  dispatch_plan: dispatch_plan,
  source: source_hub,
  destination: hub,
  commodity: commodity,
  quantity: 100,
  unit: mt_unit,
  status: 'Unauthorized',
  commodity_status: 'Good'
)
dpi_unauthorized.save!

dpi_source_authorized = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-RCP-SRCAUTH-001')
dpi_source_authorized.assign_attributes(
  dispatch_plan: dispatch_plan,
  source: source_hub,
  destination: hub,
  commodity: commodity,
  quantity: 80,
  unit: mt_unit,
  status: 'Source Authorized',
  commodity_status: 'Good'
)
dpi_source_authorized.save!

dpi_destination_authorized = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-RCP-DESAUTH-001')
dpi_destination_authorized.assign_attributes(
  dispatch_plan: dispatch_plan,
  source: source_hub,
  destination: hub,
  commodity: commodity,
  quantity: 60,
  unit: mt_unit,
  status: 'Destination Authorized',
  commodity_status: 'Good'
)
dpi_destination_authorized.save!

# Dispatches must be Started for Receipt Authorization screen
dispatch1 = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-RCP-001')
dispatch1.assign_attributes(
  dispatch_plan_item: dpi_unauthorized,
  transporter: transporter,
  plate_no: 'ETH-RCP-001',
  driver_name: 'Receipt Driver One',
  driver_phone: '0911000001',
  quantity: 70,
  unit: mt_unit,
  prepared_by: admin_user,
  dispatch_status: 'Started'
)
dispatch1.save!

dispatch2 = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-RCP-002')
dispatch2.assign_attributes(
  dispatch_plan_item: dpi_unauthorized,
  transporter: transporter,
  plate_no: 'ETH-RCP-002',
  driver_name: 'Receipt Driver Two',
  driver_phone: '0911000002',
  quantity: 30,
  unit: mt_unit,
  prepared_by: admin_user,
  dispatch_status: 'Started'
)
dispatch2.save!

# Additional started dispatches so Source/Destination authorized allocation items
# are visible in Store Assignment flow (React derives allocation list from dispatches/filter).
dispatch3 = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-RCP-SRCAUTH-001')
dispatch3.assign_attributes(
  dispatch_plan_item: dpi_source_authorized,
  transporter: transporter,
  plate_no: 'ETH-RCP-SRCAUTH-001',
  driver_name: 'Receipt Driver Source Auth',
  driver_phone: '0911000003',
  quantity: 40,
  unit: mt_unit,
  prepared_by: admin_user,
  dispatch_status: 'Started'
)
dispatch3.save!

dispatch4 = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-RCP-DESAUTH-001')
dispatch4.assign_attributes(
  dispatch_plan_item: dpi_destination_authorized,
  transporter: transporter,
  plate_no: 'ETH-RCP-DESAUTH-001',
  driver_name: 'Receipt Driver Destination Auth',
  driver_phone: '0911000004',
  quantity: 30,
  unit: mt_unit,
  prepared_by: admin_user,
  dispatch_status: 'Started'
)
dispatch4.save!

# Existing receipt authorizations for edit/list testing on screen 6
ra1 = Cats::Core::ReceiptAuthorization.find_or_initialize_by(dispatch: dispatch1, store: store_a)
ra1.assign_attributes(
  quantity: 20,
  unit: mt_unit,
  status: 'Authorized',
  authorized_by_id: hub_manager_user&.id || admin_user.id
)
ra1.save!

ra2 = Cats::Core::ReceiptAuthorization.find_or_initialize_by(dispatch: dispatch1, store: store_b)
ra2.assign_attributes(
  quantity: 10,
  unit: mt_unit,
  status: 'Authorized',
  authorized_by_id: hub_manager_user&.id || admin_user.id
)
ra2.save!

# Existing hub authorizations for table/edit testing on screen 7
ha1 = Cats::Core::HubAuthorization.find_or_initialize_by(
  dispatch_plan_item: dpi_destination_authorized,
  store: store_a,
  authorization_type: 'Source'
)
ha1.assign_attributes(
  quantity: 25,
  unit: mt_unit,
  authorized_by_id: hub_manager_user&.id || admin_user.id
)
ha1.save!

ha2 = Cats::Core::HubAuthorization.find_or_initialize_by(
  dispatch_plan_item: dpi_source_authorized,
  store: store_b,
  authorization_type: 'Destination'
)
ha2.assign_attributes(
  quantity: 20,
  unit: mt_unit,
  authorized_by_id: hub_manager_user&.id || admin_user.id
)
ha2.save!

puts 'Receipt planning seed complete.'
puts "Dispatch Plan: #{dispatch_plan.reference_no} (status=#{dispatch_plan.status})"
puts "Dispatches: #{dispatch1.reference_no}, #{dispatch2.reference_no}, #{dispatch3.reference_no}, #{dispatch4.reference_no} (Started)"
puts "Dispatch Plan Items for Hub Authorization: Unauthorized / Source Authorized / Destination Authorized"
puts "Stores: #{store_a.code}, #{store_b.code}"
