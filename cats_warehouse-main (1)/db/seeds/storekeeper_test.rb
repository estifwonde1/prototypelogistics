# db/seeds/storekeeper_test.rb
# 
# This file seeds test data for the Store Keeper workflow.
# NOTE: ReceiptAuthorizations are NOT created here — they should be created
# by the Hub Manager via the UI. The Hub Manager navigates to Receipt Authorization,
# selects a dispatch, and fills in the form to authorize it.

puts '*************************** Seeding Storekeeper Test Data ***************************'

# 1. Get Store Keeper User
sk_user = Cats::Core::User.find_by(email: 'sarah.store_keeper1@example.com')
unless sk_user
  puts "Error: Store Keeper user not found."
  return
end

# 2. Get a Store
store = Cats::Core::Store.find_by(code: 'ST1')
unless store
  puts "Error: Store ST1 not found."
  return
end

# 3. Assign User to Store (idempotent)
Cats::Core::StoreAssignment.where(user: sk_user, store: store).first_or_create!
puts "Assigned #{sk_user.email} to Store #{store.code}"

# 4. Verify Dispatches are in 'Started' state
dispatch1 = Cats::Core::Dispatch.find_by(reference_no: 'DISP-001')
dispatch2 = Cats::Core::Dispatch.find_by(reference_no: 'DISP-002')

unless dispatch1 && dispatch2
  puts "Error: Dispatches not found. Run planning.rb first."
  return
end

puts "Dispatch DISP-001 status: #{dispatch1.dispatch_status} (Qty: #{dispatch1.quantity} #{dispatch1.unit&.abbreviation})"
puts "Dispatch DISP-002 status: #{dispatch2.dispatch_status} (Qty: #{dispatch2.quantity} #{dispatch2.unit&.abbreviation})"

# 5. Clear any pre-existing RAs so Hub Manager can create them fresh via the UI
existing_ra_count = Cats::Core::ReceiptAuthorization.where(dispatch: [dispatch1, dispatch2]).count
if existing_ra_count > 0
  puts "Clearing #{existing_ra_count} pre-existing ReceiptAuthorizations (Hub Manager will create new ones via UI)..."
  Cats::Core::ReceiptAuthorization.where(dispatch: [dispatch1, dispatch2]).destroy_all
end

puts "Storekeeper test data seeding complete."
puts "== NEXT STEPS =="
puts "1. Login as hub manager and create Receipt Authorizations for DISP-001 and DISP-002."
puts "2. Store: #{store.code} (#{store.name}) - Hub: #{store.hub&.name}"
puts "3. Hub Manager email: (see hub manager user in users.rb)"
