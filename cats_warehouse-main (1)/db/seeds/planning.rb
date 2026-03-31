# db/seeds/planning.rb

puts '*************************** Seeding Planning Models ***************************'

# Unit of Measure lookup
mt_unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'MT')
kg_unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'KG')
qtl_unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'QTL')
l_unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'L')
pcs_unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'PCS')
bag_unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'BAG')
ctn_unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'CTN')

unless mt_unit && l_unit && pcs_unit && ctn_unit
  puts "Warning: Unit of measures not found. Run others.rb first."
  return
end

# Commodity source categories.
# NOTE: cats_core Commodity#name calls project.source.commodity_name, so project source
# must respond to commodity_name (CommodityCategory works; Donor does not).
psnp_category = Cats::Core::CommodityCategory.where(code: 'CC-PSNP').first_or_create!(
  name: 'PSNP Category',
  description: 'Commodity category for PSNP project commodities'
)
relief_category = Cats::Core::CommodityCategory.where(code: 'CC-REL').first_or_create!(
  name: 'REL Category',
  description: 'Commodity category for Relief project commodities'
)
nutrition_category = Cats::Core::CommodityCategory.where(code: 'CC-NUTR').first_or_create!(
  name: 'Nutrition Category',
  description: 'Category for nutrition commodities'
)
school_category = Cats::Core::CommodityCategory.where(code: 'CC-SCH').first_or_create!(
  name: 'School Category',
  description: 'Category for school feeding commodities'
)

# 1. Programs
puts "Seeding Programs..."
psnp = Cats::Core::Program.where(code: 'PSNP').first_or_create!(name: 'Productive Safety Net Program', description: 'PSNP Program')
relief = Cats::Core::Program.where(code: 'REL').first_or_create!(name: 'Relief Program', description: 'Emergency Relief')
nutrition = Cats::Core::Program.where(code: 'NUT').first_or_create!(name: 'Nutrition Program', description: 'Nutrition Specific Program')
school = Cats::Core::Program.where(code: 'SCH').first_or_create!(name: 'School Feeding Program', description: 'School Feeding Specific Program')

# 2. Projects
puts "Seeding Projects..."
psnp_project = Cats::Core::Project.where(code: 'PSNP-2026').first_or_create!(
  description: 'PSNP 2026 Project',
  program: psnp,
  source: psnp_category,
  year: 2026,
  implementing_agency: 'EBI'
)
relief_project = Cats::Core::Project.where(code: 'REL-2026').first_or_create!(
  description: 'Relief 2026 Project',
  program: relief,
  source: relief_category,
  year: 2026,
  implementing_agency: 'WFP'
)
nutrition_project = Cats::Core::Project.where(code: 'NUT-2026').first_or_create!(
  description: 'Nutrition 2026 Project',
  program: nutrition,
  source: nutrition_category,
  year: 2026,
  implementing_agency: 'EBI'
)
school_project = Cats::Core::Project.where(code: 'SCH-2026').first_or_create!(
  description: 'School Feeding 2026 Project',
  program: school,
  source: school_category,
  year: 2026,
  implementing_agency: 'WFP'
)

# 3. Commodities
puts "Seeding Commodities..."
wheat = Cats::Core::Commodity.where(description: 'Wheat').first_or_create!(
  unit_of_measure: mt_unit,
  project: psnp_project,
  quantity: 100,
  batch_no: 'B-WHEAT-001',
  commodity_grade: 'Grade1',
  best_use_before: Date.today + 1.year,
  status: 'Approved'
)
rice = Cats::Core::Commodity.where(description: 'Rice').first_or_create!(
  unit_of_measure: mt_unit,
  project: school_project,
  quantity: 100,
  batch_no: 'B-RICE-001',
  commodity_grade: 'Grade1',
  best_use_before: Date.today + 2.year,
  status: 'Approved'
)
plumpy_net = Cats::Core::Commodity.where(description: 'Plumpy Nut').first_or_create!(
  unit_of_measure: mt_unit,
  project: nutrition_project,
  quantity: 100,
  batch_no: 'B-PLUMPY-001',
  commodity_grade: 'Grade1',
  best_use_before: Date.today + 1.year,
  status: 'Approved'
)
jerikan_oil = Cats::Core::Commodity.where(description: 'Jerikan Oil').first_or_create!(
  unit_of_measure: l_unit,
  project: relief_project,
  quantity: 100,
  batch_no: 'B-JOIL-001',
  commodity_grade: 'Grade1',
  best_use_before: Date.today + 1.year,
  status: 'Approved'
)
flour = Cats::Core::Commodity.where(description: 'Flour').first_or_create!(
  unit_of_measure: mt_unit,
  project: school_project,
  quantity: 100,
  batch_no: 'B-FLOUR-001',
  commodity_grade: 'Grade1',
  best_use_before: Date.today + 1.year,
  status: 'Approved'
)
lentil = Cats::Core::Commodity.where(description: 'Lentil').first_or_create!(
  unit_of_measure: mt_unit,
  project: psnp_project,
  quantity: 100,
  batch_no: 'B-LENTIL-001',
  commodity_grade: 'Grade1',
  best_use_before: Date.today + 5.year,
  status: 'Approved'
)
sugar = Cats::Core::Commodity.where(description: 'Sugar').first_or_create!(
  unit_of_measure: mt_unit,
  project: nutrition_project,
  quantity: 100,
  batch_no: 'B-SUGAR-001',
  commodity_grade: 'Grade1',
  best_use_before: Date.today + 1.year,
  status: 'Approved'
)
oil = Cats::Core::Commodity.where(description: 'Veg Oil').first_or_create!(
  unit_of_measure: l_unit,
  project: psnp_project,
  quantity: 100,
  batch_no: 'B-OIL-001',
  commodity_grade: 'Grade1',
  best_use_before: Date.today + 1.year,
  status: 'Approved'
)
cereal = Cats::Core::Commodity.where(description: 'Cereal').first_or_create!(
  unit_of_measure: mt_unit,
  project: relief_project,
  quantity: 100,
  batch_no: 'B-CEREAL-001',
  commodity_grade: 'Grade1',
  best_use_before: Date.today + 1.year,
  status: 'Approved'
)

target_commodity_seed = {
  'Wheat' => { unit: mt_unit, quantity: 100 },
  'Rice' => { unit: mt_unit, quantity: 100 },
  'Plumpy Nut' => { unit: mt_unit, quantity: 100 },
  'Jerikan Oil' => { unit: l_unit, quantity: 100 },
  'Flour' => { unit: mt_unit, quantity: 100 },
  'Lentil' => { unit: mt_unit, quantity: 100 },
  'Sugar' => { unit: mt_unit, quantity: 100 },
  'Veg Oil' => { unit: l_unit, quantity: 100 },
  'Cereal' => { unit: mt_unit, quantity: 100 }
}

[wheat, rice, plumpy_net, jerikan_oil, flour, lentil, sugar, oil, cereal].each do |commodity|
  target = target_commodity_seed[commodity.description] || {}
  target_unit = target[:unit] || commodity.unit_of_measure
  target_quantity = target[:quantity] || 100
  commodity.update_columns(
    unit_of_measure_id: target_unit.id,
    quantity: target_quantity,
    status: 'Approved',
    updated_at: Time.current
  )
end

# 4. Transporters
puts "Seeding Transporters..."
transporter_a = Cats::Core::Transporter.where(code: 'TRA').first_or_create!(
  name: 'Transporter Alpha',
  address: 'Addis Ababa',
  contact_phone: '0911000001'
)
transporter_b = Cats::Core::Transporter.where(code: 'TRB').first_or_create!(
  name: 'Transporter Beta',
  address: 'Addis Ababa',
  contact_phone: '0911000002'
)
transporter_c = Cats::Core::Transporter.where(code: 'TRC').first_or_create!(
  name: 'Transporter Gamma',
  address: 'Addis Ababa',
  contact_phone: '0911000003'
)

# Check if locations exist for Dispatch Plans
region = Cats::Core::Location.find_by(location_type: 'Region')
hubs = Cats::Core::Location.where(location_type: 'Hub').to_a
hub = hubs.first
hub_b = hubs.second

if region && hub
  # 5. Dispatch Plans (multiple so hub manager has a list to authorize)
  puts "Seeding Dispatch Plans..."
  admin_user = Cats::Core::User.find_by(email: 'admin@example.com') || Cats::Core::User.find_by(email: 'john.admin1@example.com')
  unless admin_user
    puts "Warning: Admin user not found. Run users seeds first."
    return
  end
  planner = Cats::Core::User.find_by(email: 'dispatch_planner@example.com')
  unless planner
    puts "Warning: Planner user not found. Run users.rb first."
  else
    # Plan 1: existing
    plan1 = Cats::Core::DispatchPlan.find_or_initialize_by(reference_no: 'DP-2026-001')
    plan1.assign_attributes(
      description: 'Annual PSNP dispatch plan',
      status: 'Draft',
      prepared_by: planner
    )
    plan1.save!

    # 6. Dispatch Plan Items - REMOVED TO ALLOW MANUAL ITEM CREATION
    # Users should manually add items to dispatch plans through the UI
    puts "Skipping Dispatch Plan Items seeding (items should be added manually)..."
    
    # Note: The following dispatch plan item seeds have been commented out
    # to ensure new dispatch plans start empty and users add items manually
    
    # dpi = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-001')
    # dpi.assign_attributes(
    #   dispatch_plan: plan1,
    #   source: region,
    #   destination: hub,
    #   commodity: wheat,
    #   quantity: 100,
    #   unit: mt_unit,
    #   status: 'Unauthorized'
    # )
    # dpi.save!
    # dpi2 = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-002')
    # dpi2.assign_attributes(
    #   dispatch_plan: plan1,
    #   source: region,
    #   destination: hub,
    #   commodity: lentil,
    #   quantity: 50,
    #   unit: mt_unit,
    #   status: 'Unauthorized'
    # )
    # dpi2.save!
    # dpi3 = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-003')
    # dpi3.assign_attributes(
    #   dispatch_plan: plan1,
    #   source: region,
    #   destination: hub,
    #   commodity: oil,
    #   quantity: 10000,
    #   unit: l_unit,
    #   status: 'Unauthorized'
    # )
    # dpi3.save!

    # Plan 2: extra plan for hub authorization list
    plan2 = Cats::Core::DispatchPlan.find_or_initialize_by(reference_no: 'DP-2026-002')
    plan2.assign_attributes(
      description: 'Emergency Relief dispatch plan',
      status: 'Draft',
      prepared_by: planner
    )
    plan2.save!

    # dpi4 = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-004')
    # dpi4.assign_attributes(
    #   dispatch_plan: plan2,
    #   source: region,
    #   destination: hub,
    #   commodity: oil,
    #   quantity: 50000,
    #   unit: l_unit,
    #   status: 'Unauthorized'
    # )
    # dpi4.save!

    # dpi5 = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-005')
    # dpi5.assign_attributes(
    #   dispatch_plan: plan2,
    #   source: region,
    #   destination: hub,
    #   commodity: cereal,
    #   quantity: 50,
    #   unit: mt_unit,
    #   status: 'Unauthorized'
    # )
    # dpi5.save!

    # Plan 3: another plan for hub authorization list
    plan3 = Cats::Core::DispatchPlan.find_or_initialize_by(reference_no: 'DP-2026-003')
    plan3.assign_attributes(
      description: 'Annual nutrition specific plan',
      status: 'Draft',
      prepared_by: planner
    )
    plan3.save!

    # dpi6 = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-006')
    # dpi6.assign_attributes(
    #   dispatch_plan: plan3,
    #   source: region,
    #   destination: hub,
    #   commodity: plumpy_net,
    #   quantity: 50,
    #   unit: mt_unit,
    #   status: 'Unauthorized'
    # )
    # dpi6.save!

    # dpi7 = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-007')
    # dpi7.assign_attributes(
    #   dispatch_plan: plan3,
    #   source: region,
    #   destination: hub,
    #   commodity: sugar,
    #   quantity: 100,
    #   unit: mt_unit,
    #   status: 'Unauthorized'
    # )
    # dpi7.save!

    # Plan 4: another plan for hub authorization list
    plan4 = Cats::Core::DispatchPlan.find_or_initialize_by(reference_no: 'DP-2026-004')
    plan4.assign_attributes(
      description: 'Annual School Feeding plan',
      status: 'Draft',
      prepared_by: planner
    )
    plan4.save!

    # dpi8 = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-008')
    # dpi8.assign_attributes(
    #   dispatch_plan: plan4,
    #   source: region,
    #   destination: hub,
    #   commodity: rice,
    #   quantity: 50,
    #   unit: mt_unit,
    #   status: 'Unauthorized'
    # )
    # dpi8.save!

    # dpi9 = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-009')
    # dpi9.assign_attributes(
    #   dispatch_plan: plan4,
    #   source: region,
    #   destination: hub,
    #   commodity: flour,
    #   quantity: 50,
    #   unit: mt_unit,
    #   status: 'Unauthorized'
    # )
    # dpi9.save!

    # Approve first dispatch plan so Dispatches can be created (validation: plan must be approved)
    # Note: Plans are kept in Draft status since there are no items to dispatch
    # plan1.update!(status: 'Approved', approved_by_id: planner.id)
    # plan2.update!(status: 'Approved', approved_by_id: planner.id)

    # 7. Dispatches - REMOVED SINCE DISPATCH PLAN ITEMS WERE REMOVED
    # Dispatches depend on dispatch plan items, which are now created manually
    puts "Skipping Dispatches seeding (depends on manually created dispatch plan items)..."
    
    # disp1 = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-001')
    # disp1.assign_attributes(
    #   dispatch_plan_item: dpi,
    #   transporter: transporter_a,
    #   plate_no: 'ETH-12345',
    #   driver_name: 'Abebe Bikila',
    #   driver_phone: '0911223344',
    #   quantity: 20,
    #   unit: mt_unit,
    #   prepared_by: admin_user,
    #   dispatch_status: 'Started'
    # )
    # disp1.save!

    # disp2 = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-002')
    # disp2.assign_attributes(
    #   dispatch_plan_item: dpi,
    #   transporter: transporter_a,
    #   plate_no: 'ETH-67890',
    #   driver_name: 'Haile Gebrselassie',
    #   driver_phone: '0922334455',
    #   quantity: 15,
    #   unit: mt_unit,
    #   prepared_by: admin_user,
    #   dispatch_status: 'Started'
    # )
    # disp2.save!

    # disp3 = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-003')
    # disp3.assign_attributes(
    #   dispatch_plan_item: dpi,
    #   transporter: transporter_a,
    #   plate_no: 'ETH-11122',
    #   driver_name: 'Kenenisa Bekele',
    #   driver_phone: '0933445566',
    #   quantity: 10,
    #   unit: mt_unit,
    #   prepared_by: admin_user,
    #   dispatch_status: 'Started'
    # )
    # disp3.save!

    # disp4 = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-004')
    # disp4.assign_attributes(
    #   dispatch_plan_item: dpi,
    #   transporter: transporter_a,
    #   plate_no: 'ETH-22334',
    #   driver_name: 'Tirunesh Dibaba',
    #   driver_phone: '0944556677',
    #   quantity: 12,
    #   unit: mt_unit,
    #   prepared_by: admin_user,
    #   dispatch_status: 'Started'
    # )
    # disp4.save!

    # disp5 = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-005')
    # disp5.assign_attributes(
    #   dispatch_plan_item: dpi,
    #   transporter: transporter_a,
    #   plate_no: 'ETH-33556',
    #   driver_name: 'Derartu Tulu',
    #   driver_phone: '0955667788',
    #   quantity: 8,
    #   unit: mt_unit,
    #   prepared_by: admin_user,
    #   dispatch_status: 'Started'
    # )
    # disp5.save!

    # disp6 = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-006')
    # disp6.assign_attributes(
    #   dispatch_plan_item: dpi,
    #   transporter: transporter_a,
    #   plate_no: 'ETH-44778',
    #   driver_name: 'Haile Gebremariam',
    #   driver_phone: '0966778899',
    #   quantity: 18,
    #   unit: mt_unit,
    #   prepared_by: admin_user,
    #   dispatch_status: 'Started'
    # )
    # disp6.save!

    # 8. Hub-to-Hub flow test data (separate from Region->Hub)
    # ALSO COMMENTED OUT - depends on dispatch plan items
    # if hub_b
    #   plan5 = Cats::Core::DispatchPlan.find_or_initialize_by(reference_no: 'DP-2026-H2H-001')
    #   plan5.assign_attributes(
    #     description: 'Hub to Hub transfer dispatch plan',
    #     status: 'Draft',
    #     prepared_by: planner
    #   )
    #   plan5.save!

    #   dpi_h2h = Cats::Core::DispatchPlanItem.find_or_initialize_by(reference_no: 'DPI-H2H-001')
    #   dpi_h2h.assign_attributes(
    #     dispatch_plan: plan5,
    #     source: hub,
    #     destination: hub_b,
    #     commodity: wheat,
    #     quantity: 30,
    #     unit: mt_unit,
    #     status: 'Unauthorized'
    #   )
    #   dpi_h2h.save!

    #   source_hub_store = Cats::Core::Store.includes(:warehouse).detect do |store|
    #     store.warehouse&.parent&.id == hub.id
    #   end
    #   if source_hub_store
    #     hub_stack = Cats::Core::Stack.where(store: source_hub_store, commodity: wheat).first_or_initialize
    #     hub_stack.assign_attributes(
    #       code: hub_stack.code.presence || "H2H-WHEAT-#{source_hub_store.id}",
    #       unit: mt_unit,
    #       quantity: [hub_stack.quantity.to_f, 500.0].max,
    #       commodity_status: Cats::Core::Commodity::GOOD,
    #       stack_status: Cats::Core::Stack::ALLOCATED,
    #       length: 1,
    #       width: 1,
    #       height: 1,
    #       start_x: 1,
    #       start_y: 1
    #     )
    #     hub_stack.save!(validate: false)
    #   else
    #     puts "Warning: Could not find source-hub store for hub #{hub.id}; H2H authorization may fail."
    #   end

    #   plan5.update!(status: 'Approved', approved_by_id: planner.id)

    #   disp_h2h = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-H2H-001')
    #   disp_h2h.assign_attributes(
    #     dispatch_plan_item: dpi_h2h,
    #     transporter: transporter_b,
    #     plate_no: 'ETH-H2H-001',
    #     driver_name: 'Hub Transfer Driver',
    #     driver_phone: '0977001122',
    #     quantity: 10,
    #     unit: mt_unit,
    #     prepared_by: admin_user,
    #     dispatch_status: 'Started'
    #   )
    #   disp_h2h.save!

    #   disp_h2h_draft = Cats::Core::Dispatch.find_or_initialize_by(reference_no: 'DISP-H2H-DRAFT-001')
    #   disp_h2h_draft.assign_attributes(
    #     dispatch_plan_item: dpi_h2h,
    #     transporter: transporter_b,
    #     plate_no: 'ETH-H2H-DRAFT-001',
    #     driver_name: 'Hub Draft Driver',
    #     driver_phone: '0977001133',
    #     quantity: 0,
    #     unit: mt_unit,
    #     prepared_by: admin_user,
    #     dispatch_status: 'Draft'
    #   )
    #   disp_h2h_draft.save!
    # else
    #   puts "Skipping Hub->Hub seed: at least 2 hubs are required."
    # end

    # Ensure hub manager users have hub in details so they receive the list to authorize
    hub_manager_role = Cats::Core::Role.find_by(name: 'hub_manager', application_module: admin_user.application_module)
    if hub_manager_role && hub
      user_ids = ActiveRecord::Base.connection.select_values(
        ActiveRecord::Base.sanitize_sql_array(['SELECT user_id FROM cats_core_users_cats_core_roles WHERE role_id = ?', hub_manager_role.id])
      )
      Cats::Core::User.where(id: user_ids).find_each do |u|
        next if u.details.is_a?(Hash) && u.details['hub'].present?
        u.update!(details: (u.details || {}).merge('hub' => hub.id))
        puts "Set hub #{hub.id} for hub manager: #{u.email}"
      end
    end
  end
else
  puts "Skipping Dispatch Plans/Items/Dispatches until locations are seeded."
end

puts "Planning Seeding step completed."
