puts '*************************** Seeding Dispatch Planning (RoundPlan + RHN) ***************************'

module DispatchPlanningSeed
  module_function

  def ensure_commodity_categories_for_seeded_projects
    psnp_category = Cats::Core::CommodityCategory.where(code: 'CC-PSNP').first_or_create!(
      name: 'PSNP Category',
      description: 'Category used for PSNP commodities'
    )
    relief_category = Cats::Core::CommodityCategory.where(code: 'CC-REL').first_or_create!(
      name: 'REL Category',
      description: 'Category used for Relief commodities'
    )
    nutrition_category = Cats::Core::CommodityCategory.where(code: 'CC-NUTR').first_or_create!(
      name: 'Nutrition Category',
      description: 'Category used for nutrition commodities'
    )
    school_category = Cats::Core::CommodityCategory.where(code: 'CC-SCH').first_or_create!(
      name: 'School Category',
      description: 'Category used for school feeding commodities'
    )

    psnp_project = Cats::Core::Project.find_by(code: 'PSNP-2026')
    relief_project = Cats::Core::Project.find_by(code: 'REL-2026')
    nutrition_project = Cats::Core::Project.find_by(code: 'NUT-2026')
    school_project = Cats::Core::Project.find_by(code: 'SCH-2026')

    if psnp_project && psnp_project.source_type == 'Cats::Core::Donor'
      psnp_project.update!(source: psnp_category)
    end
    if relief_project && relief_project.source_type == 'Cats::Core::Donor'
      relief_project.update!(source: relief_category)
    end
    if nutrition_project && nutrition_project.source_type == 'Cats::Core::Donor'
      nutrition_project.update!(source: nutrition_category)
    end
    if school_project && school_project.source_type == 'Cats::Core::Donor'
      school_project.update!(source: school_category)
    end
  end

  def ensure_program
    Cats::Core::Program.where(code: 'RELIEF').first_or_create!(
      name: 'Relief Program',
      description: 'Seeded relief program for dispatch planning flow'
    )
  end

  def ensure_plan(program)
    Cats::Core::Plan.where(reference_no: 'PLN-RND-2026-001').first_or_create!(
      year: 2026,
      season: Cats::Core::Plan::ANNUAL,
      status: Cats::Core::Plan::APPROVED,
      start_date: Date.new(2026, 1, 1),
      total_days: 180,
      rounds: 3,
      program: program
    )
  end

  def ensure_beneficiary_category(plan)
    Cats::Core::BeneficiaryCategory.where(code: 'BC-RND-001').first_or_create!(
      name: 'General Beneficiary',
      plan: plan
    )
  end

  def ensure_commodity_category
    category = Cats::Core::CommodityCategory.find_or_initialize_by(code: 'CC-RND-001')
    category.name = 'PSNP Round Category'
    category.description = 'Seed category for round dispatch planning'
    category.save!
    category
  end

  def ensure_operator
    Cats::Core::Operator.where(code: 'OP-RND-001').first_or_create!(
      name: 'Default Operator',
      contact_name: 'Seed Operator',
      contact_phone: '0911000000'
    )
  end

  def location_chain
    region = Cats::Core::Location.where(location_type: Cats::Core::Location::REGION).first
    raise 'No Region found. Run location seeds first.' unless region

    zone = region.children.where(location_type: Cats::Core::Location::ZONE).first
    woreda = zone&.children&.where(location_type: Cats::Core::Location::WOREDA)&.first
    fdp = woreda&.children&.where(location_type: Cats::Core::Location::FDP)&.first
    raise 'Unable to resolve Region->Zone->Woreda->FDP chain.' unless zone && woreda && fdp

    { region: region, zone: zone, woreda: woreda, fdp: fdp }
  end

  def ensure_plan_item(plan, operator, chain)
    Cats::Core::PlanItem.where(plan: plan, fdp: chain[:fdp]).first_or_create!(
      region: chain[:region],
      zone: chain[:zone],
      woreda: chain[:woreda],
      operator: operator
    )
  end

  def ensure_beneficiary_plan_item(plan_item, beneficiary_category)
    Cats::Core::BeneficiaryPlanItem.where(
      plan_item: plan_item,
      beneficiary_category: beneficiary_category
    ).first_or_create!(
      beneficiaries: 150
    )
  end

  def ensure_round_plan(reference_no, status, rounds, plan, region)
    Cats::Core::RoundPlan.where(reference_no: reference_no).first_or_create!(
      rounds: rounds,
      status: status,
      plan: plan,
      region: region
    )
  end

  def ensure_round_ration(round_plan, beneficiary_category, commodity_category, unit)
    Cats::Core::RoundRation.where(
      round_plan: round_plan,
      beneficiary_category: beneficiary_category,
      commodity_category: commodity_category
    ).first_or_create!(
      quantity: 1.0,
      no_of_days: 30,
      unit_of_measure: unit
    )
  end

  def ensure_round_plan_item(round_plan, plan_item, operator, chain)
    Cats::Core::RoundPlanItem.where(round_plan: round_plan, fdp: chain[:fdp]).first_or_create!(
      region: chain[:region],
      zone: chain[:zone],
      woreda: chain[:woreda],
      operator: operator,
      plan_item_id: plan_item.id
    )
  end

  def ensure_beneficiary_round_plan_item(round_plan_item, beneficiary_category, beneficiary_plan_item)
    Cats::Core::BeneficiaryRoundPlanItem.where(
      round_plan_item: round_plan_item,
      beneficiary_category: beneficiary_category
    ).first_or_create!(
      planned_beneficiaries: 150,
      beneficiaries: 150,
      beneficiary_plan_item_id: beneficiary_plan_item.id
    )
  end

  def ensure_round_plan_item_detail(beneficiary_round_plan_item, round_ration, unit, quantity)
    Cats::Core::RoundPlanItemDetail.where(
      beneficiary_round_plan_item: beneficiary_round_plan_item,
      round_ration: round_ration
    ).first_or_create!(
      quantity: quantity,
      unit: unit
    )
  end

  def ensure_rhn_request
    commodity = Cats::Core::Commodity.first
    return unless commodity

    begin
      commodity.approve if commodity.status != Cats::Core::Commodity::APPROVED
    rescue StandardError
      # Keep seeding resilient; request creation below will still validate status.
    end

    return unless commodity.status == Cats::Core::Commodity::APPROVED

    request = Cats::Core::RhnRequest.where(reference_no: 'RHN-2026-001').first_or_create!(
      commodity: commodity,
      unit: commodity.unit_of_measure,
      quantity: 50,
      request_date: Date.new(2026, 1, 5),
      requested_by: 'Seed Dispatcher',
      status: Cats::Core::RhnRequest::DRAFT
    )
    request.approve if request.status == Cats::Core::RhnRequest::DRAFT
  end
end

DispatchPlanningSeed.ensure_commodity_categories_for_seeded_projects
program = DispatchPlanningSeed.ensure_program
plan = DispatchPlanningSeed.ensure_plan(program)
beneficiary_category = DispatchPlanningSeed.ensure_beneficiary_category(plan)
commodity_category = DispatchPlanningSeed.ensure_commodity_category
operator = DispatchPlanningSeed.ensure_operator
chain = DispatchPlanningSeed.location_chain
plan_item = DispatchPlanningSeed.ensure_plan_item(plan, operator, chain)
beneficiary_plan_item = DispatchPlanningSeed.ensure_beneficiary_plan_item(plan_item, beneficiary_category)
unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'MT')
raise 'Unit MT not found. Run unit seeds first.' unless unit

round_plan_approved = DispatchPlanningSeed.ensure_round_plan(
  'RP-2026-001',
  Cats::Core::RoundPlan::APPROVED,
  [1],
  plan,
  chain[:region]
)
round_plan_in_progress = DispatchPlanningSeed.ensure_round_plan(
  'RP-2026-002',
  Cats::Core::RoundPlan::IN_PROGRESS,
  [2],
  plan,
  chain[:region]
)

[
  [round_plan_approved, 120.0],
  [round_plan_in_progress, 80.0]
].each do |round_plan, quantity|
  round_ration = DispatchPlanningSeed.ensure_round_ration(round_plan, beneficiary_category, commodity_category, unit)
  round_plan_item = DispatchPlanningSeed.ensure_round_plan_item(round_plan, plan_item, operator, chain)
  brpi = DispatchPlanningSeed.ensure_beneficiary_round_plan_item(round_plan_item, beneficiary_category, beneficiary_plan_item)
  DispatchPlanningSeed.ensure_round_plan_item_detail(brpi, round_ration, unit, quantity)
end

DispatchPlanningSeed.ensure_rhn_request

puts 'Seeded RoundPlans: ' + Cats::Core::RoundPlan.where(reference_no: ['RP-2026-001', 'RP-2026-002']).count.to_s
puts 'Seeded RHN Requests: ' + Cats::Core::RhnRequest.where(reference_no: ['RHN-2026-001']).count.to_s
