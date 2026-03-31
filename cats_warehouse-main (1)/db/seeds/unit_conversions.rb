# Unit Conversions Seed
# This file creates the necessary unit conversion factors

puts "Seeding unit conversions..."

# Find or create units
mt = Cats::Core::Unit.find_or_create_by!(abbreviation: 'MT') do |unit|
  unit.name = 'Metric Ton'
end

kg = Cats::Core::Unit.find_or_create_by!(abbreviation: 'KG') do |unit|
  unit.name = 'Kilogram'
end

quintal = Cats::Core::Unit.find_or_create_by!(abbreviation: 'QTL') do |unit|
  unit.name = 'Quintal'
end

# Create unit conversions
# 1 MT = 1000 KG
Cats::Core::UnitConversion.find_or_create_by!(from: mt, to: kg) do |conversion|
  conversion.factor = 1000
end
puts "✓ Created conversion: 1 MT = 1000 KG"

# 1 MT = 10 Quintal
Cats::Core::UnitConversion.find_or_create_by!(from: mt, to: quintal) do |conversion|
  conversion.factor = 10
end
puts "✓ Created conversion: 1 MT = 10 QTL"

# 1 Quintal = 100 KG
Cats::Core::UnitConversion.find_or_create_by!(from: quintal, to: kg) do |conversion|
  conversion.factor = 100
end
puts "✓ Created conversion: 1 QTL = 100 KG"

puts "Unit conversions seeded successfully!"
