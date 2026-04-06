# Testing Guide: Storekeeper Access & Commodity Listing Fixes

## Prerequisites

### 1. Restart Backend Service
After pulling the changes, restart the backend to load the updated code:

```bash
cd backend/warehouse-backend
docker-compose restart backend
```

Wait about 30 seconds for the backend to fully start.

### 2. Verify Services are Running
```bash
# Check backend (should show "healthy")
docker-compose ps

# Frontend should be running on http://localhost:5173
# Backend should be running on http://localhost:3000
```

---

## Test 1: Storekeeper Store Access (Issue #1)

### Storekeeper 1 Credentials
- **Email:** `store_keeper@example.com`
- **Password:** `password123`
- **Name:** Rahel Kebede
- **Assigned to:** Bole Central Warehouse Store 1

### Storekeeper 2 Credentials
- **Email:** `store_keeper2@example.com`
- **Password:** `password123`
- **Name:** Getachew Mekuria
- **Assigned to:** Yeka Logistics Warehouse Store 2

### Test Steps:

#### Step 1.1: Login as Storekeeper 1
1. Open browser to `http://localhost:5173`
2. Login with:
   - Email: `store_keeper@example.com`
   - Password: `password123`
3. Should redirect to Stock Balances page (default for storekeepers)

#### Step 1.2: Check Store Access
1. Navigate to "Stores" page from the sidebar menu (under "Store Management" section)
2. **Expected Result**: You should ONLY see "Bole Central Warehouse Store 1" in the list
3. **Bug if**: You see multiple stores or all stores in the system
4. **Note**: Storekeepers have read-only access to stores, so no edit/delete buttons should appear

#### Step 1.3: Verify Store List Filtering
1. Check the stores table/list
2. Count how many stores are visible
3. **Expected Result**: Only 1 store should be visible (your assigned store)
4. **Expected Result**: Store details visible in the table:
   - Code (e.g., "ADD-ST-01")
   - Name (e.g., "Bole Central Warehouse Store 1")
   - Warehouse name
   - Dimensions (Length × Width × Height)
   - Usable space
   - Available space
   - Type (Permanent/Temporary)
5. **Expected Result**: No action buttons (Edit/Delete) should appear since storekeepers only have read access
6. **Note**: There is no store detail page - all information is shown in the list view

#### Step 1.4: Test with Storekeeper 2
1. Logout
2. Login with:
   - Email: `store_keeper2@example.com`
   - Password: `password123`
3. Navigate to "Stores" page
4. **Expected Result**: You should ONLY see "Yeka Logistics Warehouse Store 2"
5. **Expected Result**: You should NOT see "Bole Central Warehouse Store 1"

### ✅ Test 1 Passes If:
- Each storekeeper only sees their assigned store(s)
- Storekeepers cannot see stores they are not assigned to
- No "Access Denied" errors appear

---

## Test 2: Commodity Listing in Stack Configuration (Issue #2)

### Prerequisites for Test 2:
You need a store with at least one stack that has a commodity assigned. If you don't have this, follow the setup steps below.

### Setup (If Needed):

#### Option A: Use Admin to Create Test Data
1. Logout from storekeeper account
2. Login as Admin:
   - Email: `admin@example.com`
   - Password: `newpassword123`
3. Navigate to "Stacks" page
4. Create a stack in "Bole Central Warehouse Store 1":
   - Code: `STK-TEST-001`
   - Store: Select "Bole Central Warehouse Store 1"
   - Commodity: Select "Wheat" (or any commodity)
   - Status: "Active"
   - Dimensions: Length=5, Width=4, Height=3
   - Quantity: 100
   - Unit: Select "Quintal" or "kg"
5. Save the stack
6. Logout

#### Option B: Check Existing Data
1. Login as Admin
2. Navigate to "Stacks" page
3. Filter by store: "Bole Central Warehouse Store 1"
4. Check if any stacks exist with commodities
5. Note the commodity names
6. Logout

### Test Steps:

#### Step 2.1: Login as Storekeeper 1
1. Login with:
   - Email: `store_keeper@example.com`
   - Password: `password123`

#### Step 2.2: Navigate to Stack Layout
1. Go to "Stacks" → "Stack Layout" (or similar menu)
2. Select store: "Bole Central Warehouse Store 1"
3. **Expected Result**: The store's stacks should be visible on the layout

#### Step 2.3: Open Stack Configuration Modal
1. Click "Edit Layout" button
2. Click on an existing stack tile OR drag to create a new stack area
3. The "Stack Configuration" modal should open

#### Step 2.4: Check Commodity Dropdown
1. In the modal, look at the "Commodity" dropdown
2. Click on the dropdown to open it
3. **Expected Result**: You should see commodities that exist in stacks in THIS store only
4. **Bug if**: The dropdown is empty when stacks with commodities exist
5. **Bug if**: You see commodities from other stores

#### Step 2.5: Test with Different Store
1. Close the modal
2. Change the store selector to a different store (if you have access)
3. Click "Edit Layout" and open stack configuration again
4. **Expected Result**: The commodity dropdown should show different commodities (or be empty if no stacks)
5. **Expected Result**: Commodities should change based on selected store

#### Step 2.6: Test with Empty Store
1. If you have access to a store with NO stacks:
2. Select that store
3. Try to create a new stack
4. **Expected Result**: Commodity dropdown will be empty (this is expected - no stacks = no commodities)
5. **Note**: This is current behavior; future enhancement will show all commodities

### ✅ Test 2 Passes If:
- Commodity dropdown shows only commodities from the selected store's stacks
- Commodity list changes when you switch stores
- No JavaScript errors in browser console (F12 → Console)
- Unit dropdown also shows only units from the selected store's stacks

---

## Test 3: Multi-Role User (Edge Case)

This tests that storekeeper role takes precedence over other roles.

### Setup:
You'll need an admin to create a test user with multiple roles. If you don't have this setup, you can skip this test.

### Test Steps:

#### Step 3.1: Create Multi-Role User (Admin Only)
1. Login as Admin
2. Go to User Management (if available)
3. Create a new user OR modify existing storekeeper:
   - Add both "Storekeeper" and "Officer" roles
   - Assign to specific stores as storekeeper
4. Save

#### Step 3.2: Test Multi-Role Access
1. Logout and login as the multi-role user
2. Navigate to "Stores" page
3. **Expected Result**: User should ONLY see their assigned stores (storekeeper role takes precedence)
4. **Expected Result**: User should NOT see all stores (even though they have Officer role)

### ✅ Test 3 Passes If:
- Storekeeper role restrictions apply even when user has Officer role
- User only sees assigned stores, not all stores

---

## Test 4: Verify No Regressions

Test that the fixes didn't break other functionality.

### Test 4.1: Admin Access
1. Login as Admin:
   - Email: `admin@example.com`
   - Password: `newpassword123`
2. Navigate to "Stores" page
3. **Expected Result**: Admin should see ALL stores
4. Navigate to "Stack Layout"
5. **Expected Result**: Admin should see all commodities in dropdown

### Test 4.2: Warehouse Manager Access
1. Login as Warehouse Manager:
   - Email: `warehouse_manager@example.com`
   - Password: `newpassword123`
2. Navigate to "Stores" page
3. **Expected Result**: Should see stores in their assigned warehouse
4. Navigate to "Stack Layout"
5. **Expected Result**: Should see commodities from their warehouse's stores

### Test 4.3: Officer Access
1. Login as Officer (if you have credentials)
2. Navigate to "Stores" page
3. **Expected Result**: Officer should see all stores (no restrictions)

### ✅ Test 4 Passes If:
- Admin, Warehouse Manager, and Officer roles still work correctly
- No "Access Denied" errors for authorized users
- No broken functionality in other areas

---

## Troubleshooting

### Issue: "Cannot find stores" or empty list
**Solution:**
1. Check if stores exist in the database
2. Verify storekeeper has UserAssignment records:
   ```bash
   # In Rails console
   docker-compose exec backend rails console
   
   # Check assignments
   user = Cats::Core::User.find_by(email: 'store_keeper@example.com')
   Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: 'Storekeeper')
   ```

### Issue: Commodity dropdown is empty
**Solution:**
1. Verify the selected store has stacks with commodities
2. Check browser console (F12) for JavaScript errors
3. Verify stacks are loaded: Check Network tab for `/stacks` API call

### Issue: "Access Denied" errors
**Solution:**
1. Restart backend: `docker-compose restart backend`
2. Clear browser cache and cookies
3. Logout and login again

### Issue: Changes not visible
**Solution:**
1. Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Check if you pulled the latest code: `git log -1`
3. Verify backend restarted successfully: `docker-compose logs backend`

---

## Expected Test Results Summary

| Test | Expected Result | Status |
|------|----------------|--------|
| Storekeeper 1 sees only assigned store | ✅ Pass | ⬜ Not Tested |
| Storekeeper 2 sees only assigned store | ✅ Pass | ⬜ Not Tested |
| Commodity dropdown shows store-specific commodities | ✅ Pass | ⬜ Not Tested |
| Commodity list changes when switching stores | ✅ Pass | ⬜ Not Tested |
| Multi-role user respects storekeeper restrictions | ✅ Pass | ⬜ Not Tested |
| Admin still sees all stores | ✅ Pass | ⬜ Not Tested |
| Warehouse Manager access unchanged | ✅ Pass | ⬜ Not Tested |

---

## Reporting Results

After testing, please report:

### If Tests Pass ✅
- Confirm which tests passed
- Note any observations or improvements

### If Tests Fail ❌
Please provide:
1. Which test failed
2. What you expected to see
3. What you actually saw
4. Browser console errors (F12 → Console tab)
5. Network errors (F12 → Network tab → look for red/failed requests)
6. Screenshots if possible

---

## Quick Verification (2 minutes)

If you want a super quick test:

1. ✅ Login as `store_keeper@example.com` / `password123`
2. ✅ Should redirect to Stock Balances page
3. ✅ Go to Stores page (sidebar → Store Management → Stores)
4. ✅ Verify you see ONLY "Bole Central Warehouse Store 1" in the table
5. ✅ Verify no Edit/Delete buttons appear (read-only access)
6. ✅ Go to Stack Layout (sidebar → Store Management → Stacking)
7. ✅ Select the store from dropdown
8. ✅ Click "Edit Layout" → Create/Edit stack
9. ✅ Check commodity dropdown shows only relevant commodities
10. ✅ Logout
11. ✅ Login as `store_keeper2@example.com` / `password123`
12. ✅ Go to Stores page
13. ✅ Verify you see ONLY "Yeka Logistics Warehouse Store 2"

If all steps pass, the fixes are working! 🎉

---

## Known Limitations

1. **No Store Detail Page**: Storekeepers can only view store information in the list view. Clicking on a store will result in a 404 error because there is no detail page implemented. This is expected behavior - all store information is visible in the table.

2. **Read-Only Store Access**: Storekeepers cannot create, edit, or delete stores. They can only view their assigned stores in the list.

3. **Empty Commodity Dropdown**: If a store has no stacks with commodities, the commodity dropdown in Stack Configuration will be empty. This is expected - you can only select commodities that already exist in stacks within that store.
