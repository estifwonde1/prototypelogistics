puts '*************************** Seeding Region Commodity Stock ***************************'

seed_commodities = Cats::Core::Commodity.where(status: 'Approved').to_a
regions = Cats::Core::Location.where(location_type: 'Region').to_a

regions.each do |seed_region|
  zone_nodes = seed_region.children.where(location_type: 'Zone')
  woreda_nodes = zone_nodes.flat_map { |z| z.children.where(location_type: 'Woreda').to_a }
  fdp_nodes = woreda_nodes.flat_map { |w| w.children.where(location_type: 'Fdp').to_a }
  hub_nodes = fdp_nodes.flat_map { |f| f.children.where(location_type: 'Hub').to_a }
  warehouse_nodes = hub_nodes.flat_map { |h| h.children.where(location_type: 'Warehouse').to_a }
  next if warehouse_nodes.empty?

  region_store = Cats::Core::Store.where(warehouse_id: warehouse_nodes.map(&:id)).order(:id).first
  next unless region_store

  seed_commodities.each do |commodity|
    code = "SEED-#{seed_region.code}-COM#{commodity.id}"
    stack = Cats::Core::Stack.find_or_initialize_by(code: code)
    stack.assign_attributes(
      store: region_store,
      commodity: commodity,
      unit: commodity.unit_of_measure,
      quantity: 100.0,
      commodity_status: Cats::Core::Commodity::GOOD,
      stack_status: Cats::Core::Stack::ALLOCATED,
      length: stack.length || 2,
      width: stack.width || 2,
      height: stack.height || 2,
      start_x: stack.start_x || 40,
      start_y: stack.start_y || 40
    )
    stack.save!(validate: false)
  end
end

puts "Seeded stock stacks for #{regions.count} regions and #{seed_commodities.count} commodities."
