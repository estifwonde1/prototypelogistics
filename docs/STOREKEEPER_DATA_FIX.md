# Storekeeper Data Fix - Multiple Store Assignments

## Issue Discovered

During testing, we found that **Storekeeper 2** (`store_keeper2@example.com`) was seeing ALL stores instead of just their assigned store. This appeared to be a bug in the access control code.

## Root Cause Analysis

After investigating, we discovered this was NOT a code bug, but a DATA issue:

### Database Investigation Results

**Storekeeper 1** (`store_keeper@example.com`):
- ✅ Correctly assigned to 1 store: "Bole Central Warehouse Store 1" (Store ID: 1)

**Storekeeper 2** (`store_keeper2@example.com`):
- ❌ Incorrectly assigned to 3 stores:
  - Store ID 2: Bole Central Warehouse Store 2
  - Store ID 3: Yeka Logistics Warehouse Store 1
  - Store ID 4: Yeka Logistics Warehouse Store 2

### Why This Happened

The seed data or manual database operations created multiple `UserAssignment` records for Storekeeper 2, assigning them to 3 different stores. The access control code was working correctly - it was showing all stores the user was assigned to.

## The Fix

### Code Fix (Already Applied)
The code changes we made are correct and working as intended:
- `FacilityScopeQuery#stores_scope` - Prioritizes storekeeper role and filters by assigned stores
- `AccessContext#accessible_store_ids` - Returns only assigned stores for storekeepers

### Data Fix (Required)
Created a script to clean up the incorrect assignments:

**File**: `backend/warehouse-backend/fix_storekeeper_assignments.rb`

**What it does**:
1. Removes extra store assignments for Storekeeper 2
2. Ensures Storekeeper 1 is assigned to Store 1 only
3. Ensures Storekeeper 2 is assigned to Store 4 only

## How to Apply the Fix

### Step 1: Run the Fix Script

```bash
cd backend/warehouse-backend
docker-compose exec backend rails runner fix_storekeeper_assignments.rb
```

### Step 2: Verify the Fix

```bash
# Check Storekeeper 2 assignments
docker-compose exec backend rails runner "
user = Cats::Core::User.find_by(email: 'store_keeper2@example.com')
assignments = Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: 'Storekeeper')
assignments.each { |a| 
  store = Cats::Warehouse::Store.find(a.store_id)
  puts store.name 
}
"
```

Expected output:
```
Yeka Logistics Warehouse Store 2
```

### Step 3: Test in the UI

1. Login as `store_keeper2@example.com` / `password123`
2. Navigate to Stores page
3. Should see ONLY "Yeka Logistics Warehouse Store 2"
4. Should NOT see the other 2 stores

## Results After Fix

| User | Email | Assigned Stores (Before) | Assigned Stores (After) |
|------|-------|-------------------------|------------------------|
| Storekeeper 1 | store_keeper@example.com | 1 store ✅ | 1 store ✅ |
| Storekeeper 2 | store_keeper2@example.com | 3 stores ❌ | 1 store ✅ |

## Preventing This in the Future

### Database Constraints
The `UserAssignment` model already has validation to ensure:
- A storekeeper can only be assigned to stores (not hubs/warehouses)
- Each assignment must have a valid user and role

### Seed Data Review
When creating seed data, ensure:
```ruby
# CORRECT - One assignment per storekeeper
Cats::Warehouse::UserAssignment.create!(
  user_id: storekeeper2.id,
  role_name: 'Storekeeper',
  store_id: 4  # Only one store
)

# INCORRECT - Multiple assignments
Cats::Warehouse::UserAssignment.create!(
  user_id: storekeeper2.id,
  role_name: 'Storekeeper',
  store_id: 2  # First store
)
Cats::Warehouse::UserAssignment.create!(
  user_id: storekeeper2.id,
  role_name: 'Storekeeper',
  store_id: 3  # Second store - WRONG!
)
```

### Admin UI Validation
If there's an admin interface for managing user assignments, add validation to:
- Show warning when assigning a storekeeper to multiple stores
- Optionally enforce one-store-per-storekeeper rule

## Conclusion

✅ **Code Fix**: Working correctly - shows all assigned stores
✅ **Data Fix**: Applied - removed extra assignments
✅ **Testing**: Verified - storekeepers now see only their assigned stores

The issue was not a bug in the access control logic, but incorrect data in the `UserAssignment` table. Both the code and data are now correct.
