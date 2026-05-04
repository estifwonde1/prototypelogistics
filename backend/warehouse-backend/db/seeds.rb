puts "Seeding CATS Warehouse (Ethiopia regions enabled)..."

def find_or_create_with(model, attrs, updates = {})
  record = model.find_or_initialize_by(attrs)
  record.assign_attributes(attrs.merge(updates))
  record.save! if record.new_record? || record.changed?
  record
end

def table_exists?(table_name)
  ActiveRecord::Base.connection.data_source_exists?(table_name)
end

def add_role(user, role_name)
  user.add_role(role_name)
  user
end

def kebele_location_type
  return unless Cats::Core::Location.kebele_enabled?

  Cats::Core::Location::KEBELE
end

def kebele_number_for(location)
  return unless location

  match = location.name.to_s.match(/\d+/)
  return unless match

  number = match[0].to_i
  number if number.between?(1, 40)
end

puts "Creating application module and roles..."
application_module = find_or_create_with(
  Cats::Core::ApplicationModule,
  { prefix: "CATS-WH" },
  { name: "CATS Warehouse" }
)

roles = {
  hub_manager: find_or_create_with(Cats::Core::Role, { name: "Hub Manager", application_module: application_module }),
  warehouse_manager: find_or_create_with(Cats::Core::Role, { name: "Warehouse Manager", application_module: application_module }),
  store_keeper: find_or_create_with(Cats::Core::Role, { name: "Storekeeper", application_module: application_module }),
  receipt_authorizer: find_or_create_with(Cats::Core::Role, { name: "Receipt Authorizer", application_module: application_module }),
  officer: find_or_create_with(Cats::Core::Role, { name: "Officer", application_module: application_module }),
  federal_officer: find_or_create_with(Cats::Core::Role, { name: "Federal Officer", application_module: application_module }),
  regional_officer: find_or_create_with(Cats::Core::Role, { name: "Regional Officer", application_module: application_module }),
  zonal_officer: find_or_create_with(Cats::Core::Role, { name: "Zonal Officer", application_module: application_module }),
  woreda_officer: find_or_create_with(Cats::Core::Role, { name: "Woreda Officer", application_module: application_module }),
  kebele_officer: find_or_create_with(Cats::Core::Role, { name: "Kebele Officer", application_module: application_module }),
  admin: find_or_create_with(Cats::Core::Role, { name: "Admin", application_module: application_module }),
  superadmin: find_or_create_with(Cats::Core::Role, { name: "Superadmin", application_module: application_module })
}

puts "Creating notification rules..."
find_or_create_with(Cats::Core::NotificationRule, { code: "allocation" }, { roles: %w[Warehouse\ Manager Hub\ Manager] })
find_or_create_with(Cats::Core::NotificationRule, { code: "dispatch" }, { roles: %w[Warehouse\ Manager Hub\ Manager] })
# receipt_authorization rule covers all RA lifecycle events:
#   receipt_authorization.created       → Req 12.1 (notify Storekeeper)
#   receipt_authorization.driver_confirmed → Req 12.2 (notify Hub/Warehouse Manager)
#   receipt_authorization.grn_confirmed → Req 12.3 (notify Hub/Warehouse Manager)
#   receipt_order.completed             → Req 12.4 (notify Officer)
#   receipt_authorization.cancelled     → Req 12.6 (notify Storekeeper)
find_or_create_with(Cats::Core::NotificationRule, { code: "receipt_authorization" }, { roles: %w[Warehouse\ Manager Hub\ Manager Storekeeper Officer] })
find_or_create_with(Cats::Core::NotificationRule, { code: "dispatch_authorization" }, { roles: %w[Warehouse\ Manager Hub\ Manager] })

puts "Creating users..."
admin_user = find_or_create_with(
  Cats::Core::User,
  { email: "admin@example.com" },
  {
    first_name: "Mekdes",
    last_name: "Tadesse",
    password: "newpassword123",
    phone_number: "0911111111",
    application_module: application_module
  }
)
add_role(admin_user, "Admin")

superadmin_user = find_or_create_with(
  Cats::Core::User,
  { email: "superadmin@example.com" },
  {
    first_name: "Yonatan",
    last_name: "Bekele",
    password: "newpassword123",
    phone_number: "0911111112",
    application_module: application_module
  }
)
add_role(superadmin_user, "Superadmin")

hub_manager_user = find_or_create_with(
  Cats::Core::User,
  { email: "hub_manager@example.com" },
  {
    first_name: "Hanna",
    last_name: "Girma",
    password: "newpassword123",
    phone_number: "0911111113",
    application_module: application_module
  }
)
add_role(hub_manager_user, "Hub Manager")

warehouse_manager_user = find_or_create_with(
  Cats::Core::User,
  { email: "warehouse_manager@example.com" },
  {
    first_name: "Samuel",
    last_name: "Alemu",
    password: "newpassword123",
    phone_number: "0911111114",
    application_module: application_module
  }
)
add_role(warehouse_manager_user, "Warehouse Manager")

store_keeper_user = find_or_create_with(
  Cats::Core::User,
  { email: "store_keeper@example.com" },
  {
    first_name: "Rahel",
    last_name: "Kebede",
    password: "password123",
    phone_number: "0911111115",
    application_module: application_module
  }
)
add_role(store_keeper_user, "Storekeeper")

hub_manager_user_2 = find_or_create_with(
  Cats::Core::User,
  { email: "hub_manager2@example.com" },
  {
    first_name: "Mulu",
    last_name: "Asrat",
    password: "newpassword123",
    phone_number: "0911111116",
    application_module: application_module
  }
)
add_role(hub_manager_user_2, "Hub Manager")

warehouse_manager_user_2 = find_or_create_with(
  Cats::Core::User,
  { email: "warehouse_manager2@example.com" },
  {
    first_name: "Tigist",
    last_name: "Wondimu",
    password: "newpassword123",
    phone_number: "0911111117",
    application_module: application_module
  }
)
add_role(warehouse_manager_user_2, "Warehouse Manager")

store_keeper_user_2 = find_or_create_with(
  Cats::Core::User,
  { email: "store_keeper2@example.com" },
  {
    first_name: "Getachew",
    last_name: "Mekuria",
    password: "password123",
    phone_number: "0911111118",
    application_module: application_module
  }
)
add_role(store_keeper_user_2, "Storekeeper")

officer_user = find_or_create_with(
  Cats::Core::User,
  { email: "officer@example.com" },
  {
    first_name: "Abebe",
    last_name: "Bikila",
    password: "password123",
    phone_number: "0911111119",
    application_module: application_module
  }
)
add_role(officer_user, "Officer")

federal_officer_user = find_or_create_with(
  Cats::Core::User,
  { email: "federal_officer@example.com" },
  {
    first_name: "Selam",
    last_name: "Tesfaye",
    password: "password123",
    phone_number: "0911111120",
    application_module: application_module
  }
)
add_role(federal_officer_user, "Federal Officer")

regional_officer_user = find_or_create_with(
  Cats::Core::User,
  { email: "regional_officer@example.com" },
  {
    first_name: "Daniel",
    last_name: "Haile",
    password: "password123",
    phone_number: "0911111121",
    application_module: application_module
  }
)
add_role(regional_officer_user, "Regional Officer")

zonal_officer_user = find_or_create_with(
  Cats::Core::User,
  { email: "zonal_officer@example.com" },
  {
    first_name: "Liya",
    last_name: "Desta",
    password: "password123",
    phone_number: "0911111122",
    application_module: application_module
  }
)
add_role(zonal_officer_user, "Zonal Officer")

woreda_officer_user = find_or_create_with(
  Cats::Core::User,
  { email: "woreda_officer@example.com" },
  {
    first_name: "Tewodros",
    last_name: "Mamo",
    password: "password123",
    phone_number: "0911111123",
    application_module: application_module
  }
)
add_role(woreda_officer_user, "Woreda Officer")

kebele_officer_user = find_or_create_with(
  Cats::Core::User,
  { email: "kebele_officer@example.com" },
  {
    first_name: "Mimi",
    last_name: "Worku",
    password: "password123",
    phone_number: "0911111124",
    application_module: application_module
  }
)
add_role(kebele_officer_user, "Kebele Officer")

puts "Seeding Ethiopian regions..."
ethiopian_regions = [
  { code: "TIG-REG", name: "Tigray" },
  { code: "AFA-REG", name: "Afar" },
  { code: "AMH-REG", name: "Amhara" },
  { code: "ORO-REG", name: "Oromia" },
  { code: "SOM-REG", name: "Somali" },
  { code: "BEN-REG", name: "Benishangul-Gumuz" },
  { code: "GAM-REG", name: "Gambella" },
  { code: "SNNPR-REG", name: "Southern Nations Nationalities and People Region (SNNPR)" },
  { code: "HAR-REG", name: "Harari" },
  { code: "SWEPR-REG", name: "South West Ethiopia Peoples' Region (SWEPR)" },
  { code: "ADD-REG", name: "Addis Ababa" },
  { code: "DD-REG", name: "Dire Dawa" }
]

region_records = ethiopian_regions.to_h do |region|
  record = find_or_create_with(
    Cats::Core::Location,
    { code: region[:code] },
    { name: region[:name], location_type: Cats::Core::Location::REGION }
  )
  [region[:name], record]
end

puts "Seeding default zone and woreda coverage for non-Addis regions..."
region_records.each do |region_name, region|
  next if region_name == "Addis Ababa"

  zone = find_or_create_with(
    Cats::Core::Location,
    { code: "#{region.code}-Z01" },
    { name: "#{region_name} Zone 1", location_type: Cats::Core::Location::ZONE, parent: region }
  )

  woreda = find_or_create_with(
    Cats::Core::Location,
    { code: "#{region.code}-W01" },
    { name: "#{region_name} Woreda 1", location_type: Cats::Core::Location::WOREDA, parent: zone }
  )

  if kebele_location_type
    find_or_create_with(
      Cats::Core::Location,
      { code: "#{region.code}-K01" },
      { name: "#{region_name} Kebele 1", location_type: kebele_location_type, parent: woreda }
    )
  end
end

puts "Seeding Addis Ababa locations (Region -> Subcity -> Woreda)..."
region_addis = region_records.fetch("Addis Ababa")

subcity_woredas = {
  "Addis Ketema" => 14,
  "Akaki Kality" => 13,
  "Arada" => 10,
  "Bole" => 14,
  "Gullele" => 10,
  "Kirkos" => 11,
  "Kolfe Keranyo" => 15,
  "Lemi Kura" => 10,
  "Lideta" => 10,
  "Nifas Silk Lafto" => 12,
  "Yeka" => 12
}

zones = subcity_woredas.keys.map.with_index do |name, idx|
  find_or_create_with(
    Cats::Core::Location,
    { code: format("ADD-Z%02d", idx + 1) },
    { name: name, location_type: Cats::Core::Location::ZONE, parent: region_addis }
  )
end

woredas = zones.flat_map.with_index do |zone, idx|
  count = subcity_woredas[zone.name]
  (1..count).map do |w|
    find_or_create_with(
      Cats::Core::Location,
      { code: format("ADD-W%02d-%02d", idx + 1, w) },
      { name: "Woreda #{w}", location_type: Cats::Core::Location::WOREDA, parent: zone }
    )
  end
end

kebeles = if kebele_location_type
  woredas.map.with_index do |woreda, idx|
    find_or_create_with(
      Cats::Core::Location,
      { code: format("ADD-K%02d", idx + 1) },
      { name: "Kebele #{idx + 1}", location_type: kebele_location_type, parent: woreda }
    )
  end
else
  []
end

fdps = woredas.first(6).map.with_index do |woreda, idx|
  find_or_create_with(
    Cats::Core::Location,
    { code: format("ADD-FDP-%02d", idx + 1) },
    { name: "FDP #{idx + 1}", location_type: Cats::Core::Location::FDP, parent: woreda }
  )
end

hub_locations = [
  { code: "ADD-HUB-01", name: "Bole Hub", parent: fdps[0] },
  { code: "ADD-HUB-02", name: "Yeka Hub", parent: fdps[1] },
  { code: "ADD-HUB-03", name: "Kirkos Hub", parent: fdps[2] }
].map do |h|
  find_or_create_with(
    Cats::Core::Location,
    { code: h[:code] },
    { name: h[:name], location_type: Cats::Core::Location::HUB, parent: h[:parent] }
  )
end

warehouse_locations = [
  { code: "ADD-WH-01", name: "Bole Central Warehouse", parent: hub_locations[0] },
  { code: "ADD-WH-02", name: "Yeka Logistics Warehouse", parent: hub_locations[1] },
  { code: "ADD-WH-03", name: "Kirkos Storage Warehouse", parent: hub_locations[2] }
].map do |wh|
  find_or_create_with(
    Cats::Core::Location,
    { code: wh[:code] },
    { name: wh[:name], location_type: Cats::Core::Location::WAREHOUSE, parent: wh[:parent] }
  )
end

puts "Seeding core reference data..."
units = {
  kg: find_or_create_with(Cats::Core::UnitOfMeasure, { abbreviation: "kg" }, { name: "Kilogram", unit_type: Cats::Core::UnitOfMeasure::WEIGHT }),
  mt: find_or_create_with(Cats::Core::UnitOfMeasure, { abbreviation: "mt" }, { name: "Metric Ton", unit_type: Cats::Core::UnitOfMeasure::WEIGHT }),
  kntl: find_or_create_with(Cats::Core::UnitOfMeasure, { abbreviation: "kntl" }, { name: "Kuntal (100 kg)", unit_type: Cats::Core::UnitOfMeasure::WEIGHT }),
  lb: find_or_create_with(Cats::Core::UnitOfMeasure, { abbreviation: "lb" }, { name: "Pound", unit_type: Cats::Core::UnitOfMeasure::WEIGHT }),
  l: find_or_create_with(Cats::Core::UnitOfMeasure, { abbreviation: "l" }, { name: "Liter", unit_type: Cats::Core::UnitOfMeasure::VOLUME }),
  pcs: find_or_create_with(Cats::Core::UnitOfMeasure, { abbreviation: "pcs" }, { name: "Pieces", unit_type: Cats::Core::UnitOfMeasure::ITEM }),
  bag: find_or_create_with(Cats::Core::UnitOfMeasure, { abbreviation: "bag" }, { name: "Bag", unit_type: Cats::Core::UnitOfMeasure::ITEM })
}

if table_exists?("cats_warehouse_uom_conversions")
  puts "Seeding UOM conversions..."
  find_or_create_with(
    Cats::Warehouse::UomConversion,
    { from_unit: units[:bag], to_unit: units[:kg] },
    { multiplier: 50.0 }
  )
  find_or_create_with(
    Cats::Warehouse::UomConversion,
    { from_unit: units[:kg], to_unit: units[:mt] },
    { multiplier: 0.001 }
  )
  # Metric kuntal (quintal) and pound bridge into kg so any kg→… chain (e.g. to mt) applies automatically.
  find_or_create_with(
    Cats::Warehouse::UomConversion,
    { from_unit: units[:kntl], to_unit: units[:kg] },
    { multiplier: 100.0 }
  )
  find_or_create_with(
    Cats::Warehouse::UomConversion,
    { from_unit: units[:lb], to_unit: units[:kg] },
    { multiplier: 0.45359237 }
  )
  find_or_create_with(
    Cats::Warehouse::UomConversion,
    { from_unit: units[:kntl], to_unit: units[:mt] },
    { multiplier: 0.1 }
  )
  find_or_create_with(
    Cats::Warehouse::UomConversion,
    { from_unit: units[:lb], to_unit: units[:mt] },
    { multiplier: 0.00045359237 }
  )
else
  puts "Skipping UOM conversions: table cats_warehouse_uom_conversions is not present in the current database."
end

currencies = {
  etb: find_or_create_with(Cats::Core::Currency, { code: "ETB" }, { name: "Ethiopian Birr" })
}

# Commodity categories (used by donation + commodities)
commodity_groups = [
  { code: "FOOD", name: "Food" },
  { code: "NONFOOD", name: "Non-Food" }
].map do |group|
  find_or_create_with(Cats::Core::CommodityCategory, { code: group[:code] }, { name: group[:name] })
end

# Ensure donor exists before records that depend on it
donor = find_or_create_with(
  Cats::Core::Donor,
  { code: "ADD-RELIEF-DESK" },
  { name: "Addis Relief Desk" }
)

# Step 1: Make sure there is a program/project to attach commodities to
program = find_or_create_with(
  Cats::Core::Program,
  { code: "DEFAULT-PROGRAM" },
  { name: "Default Program", description: "Default program for warehouse seed data" }
)

project = find_or_create_with(
  Cats::Core::Project,
  { code: "DEFAULT-PROJECT" },
  {
    description: "Default project for warehouse seed data",
    program_id: program.id,
    source: donor,
    year: Date.current.year,
    implementing_agency: "CATS"
  }
)

# Step 2: Create commodities
commodities = [
  { batch_no: "ADD-RICE-001", description: "Rice", category: commodity_groups[0], unit: units[:kg] },
  { batch_no: "ADD-WHEAT-001", description: "Wheat Flour", category: commodity_groups[0], unit: units[:kg] },
  { batch_no: "ADD-OIL-001", description: "Cooking Oil", category: commodity_groups[0], unit: units[:l] },
  { batch_no: "ADD-BEAN-001", description: "Beans", category: commodity_groups[0], unit: units[:kg] },
  { batch_no: "ADD-SOAP-001", description: "Soap Bars", category: commodity_groups[1], unit: units[:pcs] },
  { batch_no: "ADD-BLANKET-001", description: "Blankets", category: commodity_groups[1], unit: units[:pcs] },
  { batch_no: "ADD-JERRYCAN-001", description: "Jerry Cans", category: commodity_groups[1], unit: units[:pcs] },
  { batch_no: "ADD-BAG-001", description: "Storage Bags", category: commodity_groups[1], unit: units[:bag] }
].map do |c|
  # Create a Commodity Definition so it's available in the frontend dropdown
  if Object.const_defined?("Cats::Warehouse::CommodityDefinition")
    commodity_def = Cats::Warehouse::CommodityDefinition.find_or_initialize_by(name: c[:description])
    if commodity_def.new_record?
      commodity_def.commodity_category_id = c[:category].id
      begin
        commodity_def.save!
      rescue ActiveRecord::RecordInvalid => e
        puts "  Warning: Could not create commodity definition '#{c[:description]}': #{e.message}"
        # Try to find existing record
        commodity_def = Cats::Warehouse::CommodityDefinition.find_by(name: c[:description])
      end
    end
  end

  find_or_create_with(
    Cats::Core::Commodity,
    { batch_no: c[:batch_no] },
    {
      name: c[:description],
      commodity_category_id: c[:category].id,
      unit_of_measure: c[:unit],
      project_id: project.id,   # <-- add this line
      quantity: 1000,
      best_use_before: Date.today + 365,
      status: Cats::Core::Commodity::DRAFT,
      arrival_status: Cats::Core::Commodity::AT_SOURCE
    }
  )
end

puts "Seeding transporters, purchase orders, and gift certificates..."
transporters = [
  { code: "ADD-TR-01", name: "Addis Transport PLC", address: "Bole, Addis Ababa", contact_phone: "0911000001" },
  { code: "ADD-TR-02", name: "Sheger Logistics", address: "Yeka, Addis Ababa", contact_phone: "0911000002" }
].map do |t|
  find_or_create_with(
    Cats::Core::Transporter,
    { code: t[:code] },
    { name: t[:name], address: t[:address], contact_phone: t[:contact_phone] }
  )
end

# Ensure funding records exist before records that depend on them
etb_currency = Cats::Core::Currency.find_or_initialize_by(code: "ETB")
if etb_currency.new_record?
  etb_currency.name = "Ethiopian Birr"
  etb_currency.save!
end

cash_donation = find_or_create_with(
  Cats::Core::CashDonation,
  { reference_no: "CD-ADD-001" },
  {
    donor: donor,
    amount: 100_000,
    donated_on: Date.today - 5,
    currency: etb_currency,
    description: "Seed funding for Addis Ababa warehouse records"
  }
)

fdps = [
  { code: "ADD-FDP-01", name: "Addis Ketema FDP", parent: woredas[0] },
  { code: "ADD-FDP-02", name: "Bole FDP", parent: woredas[10] },
  { code: "ADD-FDP-03", name: "Kirkos FDP", parent: woredas[20] }
].map do |fdp|
  find_or_create_with(
    Cats::Core::Location,
    { code: fdp[:code] },
    { name: fdp[:name], location_type: Cats::Core::Location::FDP, parent: fdp[:parent] }
  )
end

hub_locations = [
  { code: "ADD-HUB-01", name: "Bole Hub", parent: fdps[0] },
  { code: "ADD-HUB-02", name: "Yeka Hub", parent: fdps[1] },
  { code: "ADD-HUB-03", name: "Kirkos Hub", parent: fdps[2] }
].map do |h|
  find_or_create_with(
    Cats::Core::Location,
    { code: h[:code] },
    { name: h[:name], location_type: Cats::Core::Location::HUB, parent: h[:parent] }
  )
end

warehouse_locations = [
  { code: "ADD-WH-01", name: "Bole Central Warehouse", parent: hub_locations[0] },
  { code: "ADD-WH-02", name: "Yeka Logistics Warehouse", parent: hub_locations[1] },
  { code: "ADD-WH-03", name: "Kirkos Storage Warehouse", parent: hub_locations[2] }
].map do |wh|
  find_or_create_with(
    Cats::Core::Location,
    { code: wh[:code] },
    { name: wh[:name], location_type: Cats::Core::Location::WAREHOUSE, parent: wh[:parent] }
  )
end

purchase_orders = [
  { reference_no: "PO-ADD-001", supplier: "Addis Grain Suppliers", commodity_category: commodity_groups[0], unit: units[:kg], quantity: 20_000, price: 32.5 },
  { reference_no: "PO-ADD-002", supplier: "Sheger Non-Food Traders", commodity_category: commodity_groups[1], unit: units[:pcs], quantity: 5_000, price: 15.0 }
].map do |po|
  find_or_create_with(
    Cats::Core::PurchaseOrder,
    { reference_no: po[:reference_no] },
    {
      order_date: Date.today - 7,
      supplier: po[:supplier],
      purchase_type: Cats::Core::PurchaseOrder::LOCAL,
      cash_donation: cash_donation,
      commodity_category: po[:commodity_category],
      currency: etb_currency,
      unit: po[:unit],
      quantity: po[:quantity],
      price: po[:price]
    }
  )
end

# Now create GiftCertificate
gift_certificates = [
  {
    reference_no: "GC-ADD-001",
    customs_office: "Addis Ababa",
    requested_by: "Addis Relief Desk",
    commodity_category: commodity_groups[1],
    unit: units[:pcs],
    quantity: 1500
  }
].map do |gc|
  find_or_create_with(
    Cats::Core::GiftCertificate,
    { reference_no: gc[:reference_no] },
    {
      cash_donation_id: cash_donation.id,
      gift_date: Date.today - 3,
      requested_by: gc[:requested_by],
      customs_office: gc[:customs_office],
      commodity_category_id: gc[:commodity_category].id,
      unit: gc[:unit],
      currency: etb_currency,
      quantity: gc[:quantity],
      destination_warehouse: warehouse_locations.first
    }
  )
end

puts "Seeding dispatch (requires dispatch plan item by DB constraint)..."
dispatch_plan = find_or_create_with(
  Cats::Core::DispatchPlan,
  { reference_no: "DP-ADD-001" },
  {
    description: "Addis Ababa Dispatch Plan",
    status: "Approved",
    prepared_by: admin_user,
    approved_by: admin_user
  }
)

dispatch_plan_item = find_or_create_with(
  Cats::Core::DispatchPlanItem,
  { reference_no: "DPI-ADD-001" },
  {
    dispatch_plan: dispatch_plan,
    source: warehouse_locations.first,
    destination: fdps.last,
    commodity: commodities.first,
    quantity: 200,
    unit: units[:kg],
    commodity_status: "Good",
    status: "Authorized"
  }
)

dispatch = find_or_create_with(
  Cats::Core::Dispatch,
  { reference_no: "DISP-ADD-001" },
  {
    dispatch_plan_item: dispatch_plan_item,
    transporter: transporters.first,
    plate_no: "AA-12345",
    driver_name: "Tesfaye Kebede",
    driver_phone: "0915000001",
    quantity: 200,
    unit: units[:kg],
    commodity_status: "Good",
    prepared_by: admin_user,
    dispatch_status: Cats::Core::Dispatch::DRAFT
  }
)

puts "Seeding warehouse structures..."
facility_locations = kebeles.any? ? kebeles.first(3) : woredas.first(3)
geos = [
  { latitude: 8.995, longitude: 38.789, address: "Bole, Addis Ababa" },
  { latitude: 9.005, longitude: 38.765, address: "Yeka, Addis Ababa" },
  { latitude: 9.015, longitude: 38.748, address: "Kirkos, Addis Ababa" }
].map do |g|
  find_or_create_with(Cats::Warehouse::Geo, { latitude: g[:latitude], longitude: g[:longitude] }, { address: g[:address] })
end

hubs = [
  { code: "ADD-HUB-01", name: "Bole Hub", location: facility_locations[0], geo: geos[0] },
  { code: "ADD-HUB-02", name: "Yeka Hub", location: facility_locations[1], geo: geos[1] },
  { code: "ADD-HUB-03", name: "Kirkos Hub", location: facility_locations[2], geo: geos[2] }
].map do |h|
  find_or_create_with(
    Cats::Warehouse::Hub,
    { code: h[:code] },
    {
      name: h[:name],
      location: h[:location],
      geo: h[:geo],
      hub_type: h[:location]&.location_type.to_s == kebele_location_type.to_s ? "kebele" : "woreda",
      status: "active",
      kebele: kebele_number_for(h[:location]),
      description: "Addis Ababa hub"
    }
  )
end

hubs.each_with_index do |hub, idx|
  find_or_create_with(Cats::Warehouse::HubCapacity, { hub: hub }, { total_area_sqm: 1500 + idx * 100, total_capacity_mt: 800 + idx * 50 })
  find_or_create_with(Cats::Warehouse::HubAccess, { hub: hub }, { has_loading_dock: true, number_of_loading_docks: 2 })
  find_or_create_with(Cats::Warehouse::HubInfra, { hub: hub }, { floor_type: "concrete", roof_type: "sheet_metal", has_ventilation: true })
  find_or_create_with(
    Cats::Warehouse::HubContacts,
    { hub: hub },
    { manager_name: "#{hub_manager_user.first_name} #{hub_manager_user.last_name}", contact_phone: "091200000#{idx + 1}" }
  )
end

warehouses = [
  { code: "ADD-WH-01", name: "Bole Central Warehouse", hub: hubs[0], geo: geos[0] },
  { code: "ADD-WH-02", name: "Yeka Logistics Warehouse", hub: hubs[1], geo: geos[1] },
  { code: "ADD-WH-03", name: "Kirkos Storage Warehouse", hub: hubs[2], geo: geos[2] }
].map do |w|
  find_or_create_with(
    Cats::Warehouse::Warehouse,
    { code: w[:code] },
    {
      name: w[:name],
      location: w[:hub].location,
      hub: w[:hub],
      geo: w[:geo],
      ownership_type: "self_owned",
      managed_under: "Hub",
      warehouse_type: "main",
      status: "active",
      kebele: kebele_number_for(w[:hub].location),
      description: "Addis Ababa warehouse"
    }
  )
end

if table_exists?("cats_warehouse_inventory_lots")
  puts "Seeding inventory lots..."
  inventory_lot_warehouse = warehouses.first

  find_or_create_with(
    Cats::Warehouse::InventoryLot,
    { warehouse: inventory_lot_warehouse, commodity: commodities.first, batch_no: "LOT-RICE-001" },
    {
      lot_code: "ADD-LOT-RICE-001",
      received_on: Date.current - 2,
      expiry_date: 1.year.from_now.to_date,
      status: "Active"
    }
  )
  find_or_create_with(
    Cats::Warehouse::InventoryLot,
    { warehouse: inventory_lot_warehouse, commodity: commodities.second, batch_no: "LOT-WHEAT-001" },
    {
      lot_code: "ADD-LOT-WHEAT-001",
      received_on: Date.current - 2,
      expiry_date: 6.months.from_now.to_date,
      status: "Active"
    }
  )
else
  puts "Skipping inventory lots: table cats_warehouse_inventory_lots is not present in the current database."
end

warehouses.each_with_index do |warehouse, idx|
  find_or_create_with(
    Cats::Warehouse::WarehouseCapacity,
    { warehouse: warehouse },
    {
      total_area_sqm: 10000 + idx * 500,
      total_storage_capacity_mt: 100000 + idx * 1000,
      usable_space_percentage: 75,
      no_of_stores: 2,
      ownership_type: "Government"
    }
  )
  find_or_create_with(
    Cats::Warehouse::WarehouseAccess,
    { warehouse: warehouse },
    {
      has_loading_dock: true,
      number_of_loading_docks: 1,
      loading_dock_type: "flush",
      access_road_type: "asphalt"
    }
  )
  find_or_create_with(
    Cats::Warehouse::WarehouseInfra,
    { warehouse: warehouse },
    {
      floor_type: "concrete",
      roof_type: "sheet_metal",
      has_fumigation_facility: true,
      has_fire_extinguisher: true,
      has_security_guard: true
    }
  )
  find_or_create_with(
    Cats::Warehouse::WarehouseContacts,
    { warehouse: warehouse },
    { manager_name: "#{warehouse_manager_user.first_name} #{warehouse_manager_user.last_name}", contact_phone: "091300000#{idx + 1}" }
  )
end

stores = warehouses.flat_map do |warehouse|
  (1..2).map do |i|
    find_or_create_with(
      Cats::Warehouse::Store,
      { code: "#{warehouse.code}-ST#{i}" },
      {
        name: "#{warehouse.name} Store #{i}",
        length: 60,
        width: 40,
        height: 10,
        has_gangway: false,
        temporary: false,
        warehouse: warehouse
      }
    )
  end
end

stores.each do |store|
  find_or_create_with(
    Cats::Warehouse::StackingRule,
    { warehouse: store.warehouse },
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
      { code: "#{store.code}-S#{i + 1}" },
      {
        length: 10,
        width: 10,
        height: 5,
        start_x: 1,
        start_y: 1,
        commodity: commodity,
        store: store,
        unit: commodity.unit_of_measure,
        quantity: 200 + (idx * 10)
      }
    )
  end
end

puts "Seeding receipts (GRN) and dispatches (GIN)..."
grn = find_or_create_with(
  Cats::Warehouse::Grn,
  { reference_no: "ADD-GRN-001" },
  {
    warehouse: warehouses.first,
    received_on: Date.today - 2,
    received_by: store_keeper_user,
    approved_by: warehouse_manager_user,
    status: "draft",
    source: gift_certificates.first
  }
)

grn_items = commodities.first(3).map.with_index do |commodity, idx|
  find_or_create_with(
    Cats::Warehouse::GrnItem,
    { grn: grn, commodity: commodity },
    {
      quantity: 100 + idx * 10,
      unit: commodity.unit_of_measure,
      quality_status: "Good",
      store: stores.first,
      stack: stacks.first,
      line_reference_no: "SEED-GRN-ADD-001-#{idx}-#{commodity.id}"
    }
  )
end

Cats::Warehouse::GrnConfirmer.new(grn: grn, approved_by: warehouse_manager_user).call if grn.status != "confirmed"

gin = find_or_create_with(
  Cats::Warehouse::Gin,
  { reference_no: "ADD-GIN-001" },
  {
    warehouse: warehouses.first,
    issued_on: Date.today - 1,
    issued_by: store_keeper_user,
    approved_by: warehouse_manager_user,
    status: "draft",
    destination: fdps.last
  }
)

commodities.first(2).each_with_index do |commodity, idx|
  find_or_create_with(
    Cats::Warehouse::GinItem,
    { gin: gin, commodity: commodity },
    {
      quantity: 30 + idx * 10,
      unit: commodity.unit_of_measure,
      store: stores.first,
      stack: stacks.first
    }
  )
end

Cats::Warehouse::GinConfirmer.new(gin: gin, approved_by: warehouse_manager_user).call if gin.status != "confirmed"

waybill = find_or_create_with(
  Cats::Warehouse::Waybill,
  { reference_no: "ADD-WB-001" },
  {
    issued_on: Date.today,
    dispatch: dispatch,
    source_location: warehouse_locations.first,
    destination_location: fdps.last,
    status: "draft"
  }
)

find_or_create_with(
  Cats::Warehouse::WaybillTransport,
  { waybill: waybill },
  {
    transporter: transporters.first,
    vehicle_plate_no: "AB-12345",
    driver_name: "Amanuel Tesfaye",
    driver_phone: "0914000001"
  }
)

commodities.first(2).each_with_index do |commodity, idx|
  find_or_create_with(
    Cats::Warehouse::WaybillItem,
    { waybill: waybill, commodity: commodity },
    { quantity: 20 + idx * 5, unit: commodity.unit_of_measure }
  )
end

puts "Seeding user assignments..."
find_or_create_with(
  Cats::Warehouse::UserAssignment,
  { user: federal_officer_user, role_name: "Federal Officer" }
)
find_or_create_with(
  Cats::Warehouse::UserAssignment,
  { user: regional_officer_user, role_name: "Regional Officer" },
  { location: region_addis }
)
find_or_create_with(
  Cats::Warehouse::UserAssignment,
  { user: zonal_officer_user, role_name: "Zonal Officer" },
  { location: zones.first }
)
find_or_create_with(
  Cats::Warehouse::UserAssignment,
  { user: woreda_officer_user, role_name: "Woreda Officer" },
  { location: woredas.first }
)
if kebeles.any?
  find_or_create_with(
    Cats::Warehouse::UserAssignment,
    { user: kebele_officer_user, role_name: "Kebele Officer" },
    { location: kebeles.first }
  )
end
find_or_create_with(
  Cats::Warehouse::UserAssignment,
  { user: hub_manager_user, hub: hubs.first },
  { role_name: "Hub Manager" }
)
find_or_create_with(
  Cats::Warehouse::UserAssignment,
  { user: warehouse_manager_user, warehouse: warehouses.first },
  { role_name: "Warehouse Manager" }
)
find_or_create_with(
  Cats::Warehouse::UserAssignment,
  { user: store_keeper_user, store: stores.first },
  { role_name: "Storekeeper" }
)
find_or_create_with(
  Cats::Warehouse::UserAssignment,
  { user: hub_manager_user_2, hub: hubs.second },
  { role_name: "Hub Manager" }
)
find_or_create_with(
  Cats::Warehouse::UserAssignment,
  { user: warehouse_manager_user_2, warehouse: warehouses.second },
  { role_name: "Warehouse Manager" }
)
find_or_create_with(
  Cats::Warehouse::UserAssignment,
  { user: store_keeper_user_2, store: stores.second },
  { role_name: "Storekeeper" }
)
warehouses.each do |warehouse|
  find_or_create_with(
    Cats::Warehouse::UserAssignment,
    { user: officer_user, warehouse: warehouse },
    { role_name: "Officer" }
  )
end

ui_seed = Rails.root.join("db", "seeds", "ui.rb")
load(ui_seed) if File.exist?(ui_seed)

puts "Seeding completed."
