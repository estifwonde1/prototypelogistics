# Storekeeper Access & Commodity Listing Fixes

## Issues Fixed

### Issue #1: Storekeeper Accessing All Stores
**Problem**: Storekeepers were able to see all stores in the system instead of only their assigned stores.

**Root Cause**: Role priority issue in access control logic. When a user had both "Storekeeper" and "Officer" roles, the role checks were evaluated in an order that could allow broader access than intended.

**Solution**: 
- Updated `FacilityScopeQuery#stores_scope` to check `storekeeper?` role FIRST before other roles
- Updated `AccessContext#accessible_store_ids` to prioritize storekeeper role
- Added explicit comments explaining the precedence logic

**Files Changed**:
- `backend/warehouse-backend/engines/cats_warehouse/app/queries/cats/warehouse/facility_scope_query.rb`
- `backend/warehouse-backend/engines/cats_warehouse/app/services/cats/warehouse/access_context.rb`

**Impact**: Storekeepers will now only see stores they are explicitly assigned to via `UserAssignment` records, even if they have additional roles like Officer.

---

### Issue #2: Commodities Not Listing in Stack Configuration Modal
**Problem**: The commodity dropdown in the Stack Configuration modal was empty or not showing relevant commodities for the selected store.

**Root Cause**: The `buildCommodityOptions()` and `buildUnitOptions()` functions were receiving ALL stacks from the entire system instead of only stacks from the selected store.

**Solution**:
- Changed `buildCommodityOptions(stacks)` to `buildCommodityOptions(storeStacks)`
- Changed `buildUnitOptions(stacks)` to `buildUnitOptions(storeStacks)`
- This ensures only commodities and units from the selected store's stacks appear in the dropdowns

**Files Changed**:
- `frontend/src/pages/stacks/StackLayoutPage.tsx` (lines 222-224)

**Impact**: The commodity and unit dropdowns in the Stack Configuration modal will now only show options from stacks that exist in the currently selected store, making it easier for storekeepers to configure stacks with relevant commodities.

---

## Testing Recommendations

### Test Case 1: Storekeeper Store Access
1. Log in as a storekeeper user assigned to specific stores (e.g., Store A and Store B)
2. Navigate to the Stores list page
3. Verify only assigned stores (Store A and Store B) are visible
4. Verify other stores in the system are NOT visible

### Test Case 2: Multi-Role User Store Access
1. Create a user with both "Storekeeper" and "Officer" roles
2. Assign them to specific stores as a storekeeper
3. Log in as this user
4. Navigate to the Stores list page
5. Verify they only see their assigned stores (storekeeper role takes precedence)

### Test Case 3: Commodity Listing in Stack Configuration
1. Log in as a storekeeper
2. Navigate to Stack Layout page
3. Select a store that has existing stacks with commodities
4. Click "Edit Layout" and create a new stack or edit an existing one
5. Open the commodity dropdown in the Stack Configuration modal
6. Verify only commodities from stacks in the selected store appear
7. Change to a different store and verify the commodity list updates accordingly

### Test Case 4: Empty Store Commodity Listing
1. Select a store that has NO stacks yet
2. Try to create a new stack
3. Verify the commodity dropdown is empty (expected behavior - no stacks = no commodities)
4. Note: Future enhancement could fall back to showing all commodities from reference data

---

## Technical Details

### Role Priority Logic
The access control system now enforces this role priority for store access:
1. Admin/Superadmin → All stores
2. Storekeeper → Only assigned stores (takes precedence over other roles)
3. Hub Manager → Stores in assigned hubs
4. Warehouse Manager → Stores in assigned warehouses
5. Officer → All stores (but overridden by storekeeper if user has both roles)

### Data Flow for Commodity Listing
```
1. Fetch all stacks → getStacks()
2. Filter by selected store → storeStacks = stacks.filter(...)
3. Extract commodities from store stacks → buildCommodityOptions(storeStacks)
4. Display in dropdown → <Select data={commodityOptions} />
```

---

## Deployment Notes

### Backend Changes
- Restart the Rails backend service after pulling changes
- No database migrations required
- No rebuild required (code changes only)

### Frontend Changes
- No rebuild required if running in development mode (hot reload)
- For production: rebuild frontend Docker image

### Verification Command
```bash
# After pulling changes, restart backend
docker-compose restart backend

# Frontend will hot-reload automatically in dev mode
```

---

## Related Files

### Backend
- `app/services/cats/warehouse/access_context.rb` - Core access control logic
- `app/queries/cats/warehouse/facility_scope_query.rb` - Query scoping for facilities
- `app/controllers/cats/warehouse/stores_controller.rb` - Store API endpoints
- `app/policies/cats/warehouse/store_policy.rb` - Store authorization policy

### Frontend
- `frontend/src/pages/stacks/StackLayoutPage.tsx` - Stack layout visualization and configuration
- `frontend/src/api/stores.ts` - Store API client
- `frontend/src/api/stacks.ts` - Stack API client

---

## Future Enhancements

1. **Commodity Fallback**: When a store has no stacks, show all commodities from reference data to allow creating the first stack
2. **Role Conflict Warning**: Add UI warning when a user has conflicting roles (e.g., both Storekeeper and Officer)
3. **Audit Logging**: Log when storekeepers attempt to access stores they're not assigned to
4. **Assignment Validation**: Prevent assigning conflicting roles to the same user in the admin interface
