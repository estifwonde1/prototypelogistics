# Fix unit conversions
mt = Cats::Core::Unit.find_by(abbreviation: 'MT')
kg = Cats::Core::Unit.find_by(abbreviation: 'KG')

if mt && kg
  conversion = Cats::Core::UnitConversion.find_or_create_by!(from: mt, to: kg) do |c|
    c.factor = 1000
  end
  puts "✓ Created conversion: 1 MT = 1000 KG (ID: #{conversion.id})"
else
  puts "✗ Could not find MT or KG units"
  puts "MT: #{mt.inspect}"
  puts "KG: #{kg.inspect}"
end

# Also create quintal conversion if it exists
quintal = Cats::Core::Unit.find_by(abbreviation: 'QTL')
if mt && quintal
  conversion = Cats::Core::UnitConversion.find_or_create_by!(from: mt, to: quintal) do |c|
    c.factor = 10
  end
  puts "✓ Created conversion: 1 MT = 10 QTL (ID: #{conversion.id})"
end

if quintal && kg
  conversion = Cats::Core::UnitConversion.find_or_create_by!(from: quintal, to: kg) do |c|
    c.factor = 100
  end
  puts "✓ Created conversion: 1 QTL = 100 KG (ID: #{conversion.id})"
end

puts "\nAll unit conversions created successfully!"
