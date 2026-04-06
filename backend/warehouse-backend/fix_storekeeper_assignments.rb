# Fix Storekeeper Store Assignments
# This script removes extra store assignments and ensures each storekeeper
# is only assigned to their intended store

puts "Fixing storekeeper store assignments..."
puts ""

# Storekeeper 1 should only be assigned to Store 1 (Bole Central Warehouse Store 1)
user1 = Cats::Core::User.find_by(email: 'store_keeper@example.com')
if user1
  puts "Storekeeper 1 (#{user1.email}):"
  assignments = Cats::Warehouse::UserAssignment.where(user_id: user1.id, role_name: 'Storekeeper')
  puts "  Current assignments: #{assignments.count}"
  
  # Keep only Store ID 1
  assignments.where.not(store_id: 1).destroy_all
  
  # Ensure Store ID 1 is assigned
  unless assignments.exists?(store_id: 1)
    Cats::Warehouse::UserAssignment.create!(
      user_id: user1.id,
      role_name: 'Storekeeper',
      store_id: 1
    )
  end
  
  remaining = Cats::Warehouse::UserAssignment.where(user_id: user1.id, role_name: 'Storekeeper')
  puts "  After fix: #{remaining.count} assignment(s)"
  remaining.each do |a|
    store = Cats::Warehouse::Store.find(a.store_id)
    puts "    - Store #{a.store_id}: #{store.name}"
  end
  puts ""
end

# Storekeeper 2 should only be assigned to Store 4 (Yeka Logistics Warehouse Store 2)
user2 = Cats::Core::User.find_by(email: 'store_keeper2@example.com')
if user2
  puts "Storekeeper 2 (#{user2.email}):"
  assignments = Cats::Warehouse::UserAssignment.where(user_id: user2.id, role_name: 'Storekeeper')
  puts "  Current assignments: #{assignments.count}"
  
  # Keep only Store ID 4
  assignments.where.not(store_id: 4).destroy_all
  
  # Ensure Store ID 4 is assigned
  unless assignments.exists?(store_id: 4)
    Cats::Warehouse::UserAssignment.create!(
      user_id: user2.id,
      role_name: 'Storekeeper',
      store_id: 4
    )
  end
  
  remaining = Cats::Warehouse::UserAssignment.where(user_id: user2.id, role_name: 'Storekeeper')
  puts "  After fix: #{remaining.count} assignment(s)"
  remaining.each do |a|
    store = Cats::Warehouse::Store.find(a.store_id)
    puts "    - Store #{a.store_id}: #{store.name}"
  end
  puts ""
end

puts "Done! Storekeeper assignments have been fixed."
puts ""
puts "To verify:"
puts "  1. Restart the backend: docker-compose restart backend"
puts "  2. Login as store_keeper@example.com - should see only Store 1"
puts "  3. Login as store_keeper2@example.com - should see only Store 4"
