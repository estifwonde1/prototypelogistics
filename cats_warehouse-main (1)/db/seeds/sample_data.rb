# db/seeds/sample_data.rb
# Seeds only for models that have no existing seed data.
# Idempotent: uses first_or_create / find_or_create_by where possible.

puts '*************************** Seeding Sample Data (Notification, UnitConversion, Route, RoundBeneficiary) ***************************'

application_module = Cats::Core::ApplicationModule.find_by(prefix: 'CATS-WH')

# --- UnitConversion (uses UnitOfMeasure; run after others.rb) ---
if Cats::Core::UnitOfMeasure.exists?
  puts 'Seeding UnitConversion...'
  mt = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'MT')
  kg = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'KG')
  qtl = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'QTL')
  if mt && kg
    Cats::Core::UnitConversion.find_or_create_by!(from: mt, to: kg) { |c| c.factor = 1000 }
    puts '  UnitConversion: 1 MT = 1000 KG'
  end
  if mt && qtl
    Cats::Core::UnitConversion.find_or_create_by!(from: mt, to: qtl) { |c| c.factor = 10 }
    puts '  UnitConversion: 1 MT = 10 QTL'
  end
  if qtl && kg
    Cats::Core::UnitConversion.find_or_create_by!(from: qtl, to: kg) { |c| c.factor = 100 }
    puts '  UnitConversion: 1 QTL = 100 KG'
  end
  puts "  Total UnitConversions: #{Cats::Core::UnitConversion.count}"
end

# --- Notification (sample for admin user; run after users) ---
if application_module
  admin = Cats::Core::User.find_by(email: 'admin@example.com', application_module: application_module)
  if admin
    existing = Cats::Core::Notification.where(recipient_type: 'Cats::Core::User', recipient_id: admin.id).count
    if existing < 2
      Cats::Core::Notification.create!(
        recipient_type: 'Cats::Core::User',
        recipient_id: admin.id,
        params: { message: 'Welcome to CATS Warehouse. This is a sample notification.' }
      )
      Cats::Core::Notification.create!(
        recipient_type: 'Cats::Core::User',
        recipient_id: admin.id,
        params: { message: 'Sample system alert: Review pending authorizations when ready.' }
      )
      puts "Seeded sample Notifications for admin (total: #{Cats::Core::Notification.where(recipient_type: 'Cats::Core::User', recipient_id: admin.id).count})"
    else
      puts 'Notifications already present for admin; skipping.'
    end
  end
end

# --- Route (region + source + destination locations; run after locations) ---
region = Cats::Core::Location.where(location_type: 'Region').first
if region
  zones = region.children.where(location_type: 'Zone').limit(2).to_a
  if zones.size >= 2
    route = Cats::Core::Route.find_or_initialize_by(source_id: zones[0].id, destination_id: zones[1].id)
    route.region_id = region.id
    route.name = 'Seed Route Zone 1 to Zone 2'
    route.save!
    puts "Seeded Route: #{Cats::Core::Route.count} route(s)"
  else
    puts 'Route seed skipped: need at least 2 zones under region.'
  end
else
  puts 'Route seed skipped: no Region found. Run locations seed first.'
end

# --- Beneficiary + RoundBeneficiary (run after dispatch_planning) ---
plan = Cats::Core::Plan.find_by(reference_no: 'PLN-RND-2026-001')
round_plan = Cats::Core::RoundPlan.find_by(reference_no: 'RP-2026-001')
round_plan_item = round_plan&.round_plan_items&.first
beneficiary_category = Cats::Core::BeneficiaryCategory.find_by(code: 'BC-RND-001')
fdp = Cats::Core::Location.where(location_type: 'Fdp').first
commodity_category = Cats::Core::CommodityCategory.find_by(code: 'CC-RND-001') || Cats::Core::CommodityCategory.first
unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'MT')

if round_plan_item && beneficiary_category && fdp && commodity_category && unit
  beneficiary = Cats::Core::Beneficiary.find_or_initialize_by(
    full_name: 'Sample Beneficiary One',
    fdp_id: fdp.id
  )
  beneficiary.beneficiary_category_id = beneficiary_category.id
  beneficiary.age = 30
  beneficiary.gender = 'M'
  beneficiary.phone = '0911000000' if beneficiary.phone.blank?
  beneficiary.save!

  rb = Cats::Core::RoundBeneficiary.find_or_initialize_by(
    beneficiary_id: beneficiary.id,
    round_plan_item_id: round_plan_item.id,
    commodity_category_id: commodity_category.id
  )
  rb.quantity = 50.0
  rb.unit_id = unit.id
  rb.received = false
  rb.save!
  puts "Seeded Beneficiary and RoundBeneficiary (total RoundBeneficiaries: #{Cats::Core::RoundBeneficiary.count})"
else
  puts 'RoundBeneficiary seed skipped: missing plan/round_plan_item/beneficiary_category/fdp/commodity_category/unit. Run dispatch_planning and others first.'
end

puts '*************************** Sample Data Seeding Done ***************************'
