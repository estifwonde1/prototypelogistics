# db/seeds/locations.rb

puts '*************************** Seeding Location Hierarchy ***************************'

# LEVEL 1: REGIONS (2)
regions = []
['Region 1', 'Region 2'].each_with_index do |name, i|
  code = "REG#{i + 1}"
  regions << Cats::Core::Location.where(name: name, location_type: 'Region').first_or_create!(code: code)
end

# LEVEL 2: ZONES (4 total, 2 per Region)
zones = []
regions.each_with_index do |region, ri|
  2.times do |zi|
    name = "Zone #{ri * 2 + zi + 1}"
    code = "ZON#{ri * 2 + zi + 1}"
    zones << Cats::Core::Location.where(name: name, location_type: 'Zone').first_or_create!(code: code, parent: region)
  end
end

# LEVEL 3: WOREDAS (8 total, 2 per Zone)
woredas = []
zones.each_with_index do |zone, zi|
  2.times do |wi|
    name = "Woreda #{zi * 2 + wi + 1}"
    code = "WOR#{zi * 2 + wi + 1}"
    woredas << Cats::Core::Location.where(name: name, location_type: 'Woreda').first_or_create!(code: code, parent: zone)
  end
end

# LEVEL 4: FDPS (16 total, 2 per Woreda)
fdps = []
woredas.each_with_index do |woreda, wi|
  2.times do |fi|
    name = "FDP #{wi * 2 + fi + 1}"
    code = "FDP#{wi * 2 + fi + 1}"
    fdps << Cats::Core::Location.where(name: name, location_type: 'Fdp').first_or_create!(code: code, parent: woreda)
  end
end

# LEVEL 5: HUBS (32 total, 2 per FDP)
hubs = []
fdps.each_with_index do |fdp, fi|
  2.times do |hi|
    name = "Hub #{fi * 2 + hi + 1}"
    code = "HUB#{fi * 2 + hi + 1}"
    hubs << Cats::Core::Location.where(name: name, location_type: 'Hub').first_or_create!(code: code, parent: fdp)
  end
end

# LEVEL 6: WAREHOUSES (64 total, 2 per Hub)
warehouses = []
hubs.each_with_index do |hub, hi|
  2.times do |whi|
    name = "Warehouse #{hi * 2 + whi + 1}"
    code = "WH#{hi * 2 + whi + 1}"
    warehouses << Cats::Core::Location.where(name: name, location_type: 'Warehouse').first_or_create!(code: code, parent: hub)
  end
end

# LEVEL 7: STORES (128 total, 2 per Warehouse)
stores = []
warehouses.each_with_index do |warehouse, whi|
  2.times do |si|
    name = "Store #{whi * 2 + si + 1}"
    code = "ST#{whi * 2 + si + 1}"
    store = Cats::Core::Store.where(name: name, warehouse_id: warehouse.id).first_or_create!(
      code: code,
      length: 10,
      width: 10,
      height: 5,
      usable_space: 500,
      available_space: 500
    )
    stores << store
  end
end

puts "Seeded Locations: Regions(#{regions.count}), Hubs(#{hubs.count}), Warehouses(#{warehouses.count}), Stores(#{stores.count})"

puts '*************************** Seeding Stacks ***************************'
# Stacks depend on Commodities and UnitOfMeasures. Idempotent: find_or_create to avoid FK violation when receipt_transactions reference stacks.
commodity = Cats::Core::Commodity.first
unit = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'MT')

unless commodity && unit
  puts "Warning: Commodity or UnitOfMeasure not found. Seed planning.rb and others.rb first to create stacks."
else
  stores.each do |store|
    2.times do |i|
      code = "#{store.code}-S#{i+1}"
      Cats::Core::Stack.find_or_initialize_by(store: store, code: code).tap do |stack|
        stack.assign_attributes(
          length: 2,
          width: 2,
          height: 4,
          start_x: i * 5 + 1,
          start_y: 1,
          commodity_id: commodity.id,
          unit_id: unit.id,
          commodity_status: 'Good',
          stack_status: 'Reserved',
          quantity: stack.quantity || 0
        )
        stack.save!
      end
    end
  end
  puts "Seeded Stacks for #{stores.count} stores."
end
