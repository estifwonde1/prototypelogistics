# db/seeds/others.rb

puts '*************************** Seeding Unit of Measures ***************************'

uoms = [
  { name: 'Metric Ton', abbreviation: 'MT', unit_type: 'Weight' },
  { name: 'Kilogram', abbreviation: 'KG', unit_type: 'Weight' },
  { name: 'Quintal', abbreviation: 'QTL', unit_type: 'Weight' },
  { name: 'Liter', abbreviation: 'L', unit_type: 'Volume' },
  { name: 'Piece', abbreviation: 'PCS', unit_type: 'Item' },
  { name: 'Bag', abbreviation: 'BAG', unit_type: 'Item' },
  { name: 'Carton', abbreviation: 'CTN', unit_type: 'Item' }
]

uoms.each do |uom_data|
  Cats::Core::UnitOfMeasure.where(abbreviation: uom_data[:abbreviation]).first_or_create!(uom_data)
end

puts "Seeded #{Cats::Core::UnitOfMeasure.count} Unit of Measures."

puts '*************************** Seeding Donors ***************************'
donors = [
  { name: 'Government of Ethiopia', code: 'GOE' },
  { name: 'World Food Program', code: 'WFP' },
  { name: 'USAID', code: 'USAID' }
]

donors.each do |donor_data|
  Cats::Core::Donor.where(code: donor_data[:code]).first_or_create!(donor_data)
end

puts "Seeded #{Cats::Core::Donor.count} Donors."
