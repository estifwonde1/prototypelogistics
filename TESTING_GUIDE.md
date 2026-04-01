# Manual Testing Guide - Officer Role Implementation

## Prerequisites

### 1. Check Services are Running
```bash
# Backend (should be on http://localhost:3000)
cd backend/warehouse-backend
docker compose ps

# Frontend (should be on http://localhost:5173)
cd frontend
npm run dev
```

### 2. Test User Credentials
- **Email:** officer@example.com
- **Password:** password123
- **Role:** Officer

---

## Test Suite 1: Officer Dashboard & Navigation

### Test 1.1: Login and Dashboard Access
**Steps:**
1. Open browser to `http://localhost:5173`
2. Login with officer credentials
3. Should redirect to Officer Dashboard

**Expected Results:**
- ✅ Login successful
- ✅ Dashboard shows "Officer Dashboard" title
- ✅ "Hubs Overview" section shows hub count (not 0)
- ✅ "Inbound Summary" shows receipt order counts
- ✅ "Outbound Summary" shows dispatch order counts
- ✅ "Quick Actions" has two buttons: "Create Receipt Order" and "Create Dispatch Order"

**If Failed:**
- Check browser console for errors
- Verify backend is running: `curl http://localhost:3000/up`
- Check officer user exists in database

### Test 1.2: Navigation Menu
**Steps:**
1. Check left sidebar menu

**Expected Results:**
- ✅ "Officer Operations" section visible
- ✅ "Dashboard" menu item
- ✅ "Receipt Orders" menu item
- ✅ "Dispatch Orders" menu item
- ✅ No "Access Denied" errors

---

## Test Suite 2: Receipt Order Workflow

### Test 2.1: Create Receipt Order (Draft)
**Steps:**
1. Click "Create Receipt Order" button on dashboard
2. Fill in form:
   - Source Type: Select "Supplier"
   - Source Name: Type "ABC Suppliers Ltd"
   - Destination Warehouse: Select any warehouse from dropdown
   - Expected Delivery Date: Select tomorrow's date
   - Notes: Type "Test receipt order"
3. Click "+ Add Item" button
4. Fill in line item:
   - Commodity: Select "Wheat" (or any commodity)
   - Quantity: Type "100"
   - Unit: Select "Quintal" or "kg"
   - Unit Price: Type "50"
   - Notes: Type "First batch"
5. Click "Save as Draft"

**Expected Results:**
- ✅ Form validates (no errors)
- ✅ Warehouse dropdown shows warehouses (not empty)
- ✅ Commodity dropdown shows commodities (not empty)
- ✅ Success notification appears
- ✅ Redirects to Receipt Orders list
- ✅ New order appears in list with status "Draft"

**If Failed:**
- Check browser console for API errors
- Verify warehouses exist: Go to Warehouses page
- Verify commodities exist: Check reference data

### Test 2.2: View Receipt Order Details
**Steps:**
1. From Receipt Orders list, click on the draft order you created
2. Review the detail page

**Expected Results:**
- ✅ Shows order header with "RO-{id}" format
- ✅ Shows status badge "Draft"
- ✅ Shows source, destination, delivery date
- ✅ Shows line items table with commodity, quantity, unit
- ✅ Shows "Edit", "Delete", and "Confirm Order" buttons
- ✅ No "Access Denied" error

### Test 2.3: Edit Receipt Order
**Steps:**
1. On receipt order detail page, click "Edit" button
2. Change Source Name to "XYZ Suppliers Ltd"
3. Change quantity to "150"
4. Click "Update Order"

**Expected Results:**
- ✅ Form loads with existing data
- ✅ Changes save successfully
- ✅ Success notification appears
- ✅ Detail page shows updated values

### Test 2.4: Confirm Receipt Order
**Steps:**
1. On receipt order detail page, click "Confirm Order" button
2. Confirm in dialog

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ After confirming, status changes to "Confirmed"
- ✅ "Edit" and "Delete" buttons disappear
- ✅ Success notification appears

### Test 2.5: View Phase 3 Tabs (Confirmed Order)
**Steps:**
1. On confirmed receipt order detail page, check for tabs

**Expected Results:**
- ✅ "Details" tab visible and active
- ✅ "Assignments" tab visible
- ✅ "Space Reservations" tab visible
- ✅ "Workflow Timeline" tab visible

### Test 2.6: Create Assignment
**Steps:**
1. Click "Assignments" tab
2. Click "+ Assign Warehouse" button
3. Select a user from dropdown (if available)
4. Type notes: "Please process this order"
5. Click "Create Assignment"

**Expected Results:**
- ✅ Assignment form appears
- ✅ User dropdown shows users (or shows placeholder if none)
- ✅ Assignment created successfully (or shows error if no users)
- ✅ Assignment appears in list

**Note:** If no users in dropdown, this is expected if no warehouse managers exist. The UI should still work.

### Test 2.7: Create Space Reservation
**Steps:**
1. Click "Space Reservations" tab
2. Click "+ Reserve Space" button
3. Select a store from dropdown
4. Enter quantity: "50"
5. Type notes: "Reserve for incoming wheat"
6. Click "Reserve Space"

**Expected Results:**
- ✅ Reservation form appears
- ✅ Store dropdown shows stores
- ✅ Reservation created successfully
- ✅ Reservation appears in list with status badge

### Test 2.8: View Workflow Timeline
**Steps:**
1. Click "Workflow Timeline" tab

**Expected Results:**
- ✅ Timeline shows events (or "No workflow events yet" if none)
- ✅ Events show timestamps and user names
- ✅ Color-coded icons for different event types

---

## Test Suite 3: Dispatch Order Workflow

### Test 3.1: Create Dispatch Order (Draft)
**Steps:**
1. Go to Dashboard
2. Click "Create Dispatch Order" button
3. Fill in form:
   - Source Warehouse: Select any warehouse
   - Destination Type: Select "Beneficiary"
   - Destination Name: Type "Community Center A"
   - Expected Pickup Date: Select tomorrow's date
   - Notes: Type "Test dispatch order"
4. Click "+ Add Item"
5. Fill in line item:
   - Commodity: Select "Wheat"
   - Quantity: Type "50"
   - Unit: Select "Quintal" or "kg"
   - Notes: Type "For distribution"
6. Click "Save as Draft"

**Expected Results:**
- ✅ Form validates
- ✅ Success notification
- ✅ Redirects to Dispatch Orders list
- ✅ New order appears with status "Draft"

### Test 3.2: Confirm Dispatch Order
**Steps:**
1. Click on draft dispatch order
2. Click "Confirm Order" button
3. Confirm in dialog

**Expected Results:**
- ✅ Status changes to "Confirmed"
- ✅ Phase 3 tabs appear (Assignments, Stock Reservations, Workflow Timeline)

### Test 3.3: Create Stock Reservation
**Steps:**
1. Click "Stock Reservations" tab
2. Click "+ Reserve Stock" button
3. Select commodity from dropdown
4. Enter quantity: "30"
5. Type notes: "Reserve for dispatch"
6. Click "Reserve Stock"

**Expected Results:**
- ✅ Reservation form appears
- ✅ Commodity dropdown shows commodities
- ✅ Reservation created successfully
- ✅ Reservation appears in list

---

## Test Suite 4: Phase 2 - Lot/UOM Traceability

### Test 4.1: View GRN with Lot Info
**Steps:**
1. Navigate to GRNs page (if accessible)
2. Click on any GRN
3. Check line items table

**Expected Results:**
- ✅ "Batch/Expiry" column visible
- ✅ Shows batch numbers if available
- ✅ Shows expiry badges (green/yellow/red) if available
- ✅ Shows UOM conversions if available (e.g., "2 bags = 100 kg")

### Test 4.2: View GIN with Lot Info
**Steps:**
1. Navigate to GINs page (if accessible)
2. Click on any GIN
3. Check line items table

**Expected Results:**
- ✅ "Batch/Expiry" column visible
- ✅ Shows batch numbers if available
- ✅ Shows expiry badges if available

### Test 4.3: View Stock Balance with Lot Filter
**Steps:**
1. Navigate to Stock Balance page (if accessible)
2. Check for lot-related features

**Expected Results:**
- ✅ "Batch/Expiry" column visible in table
- ✅ Lot filter dropdown available
- ✅ "Expiring Soon" toggle available

---

## Test Suite 5: Order Linkage (Phase 3)

### Test 5.1: GRN Shows Receipt Order Link
**Steps:**
1. Navigate to GRNs page
2. Find a GRN that was created from a receipt order
3. Click on it

**Expected Results:**
- ✅ Blue card at top shows "Generated from Receipt Order"
- ✅ Shows order ID (RO-123)
- ✅ Shows source type and name
- ✅ "View Order" button navigates to receipt order

### Test 5.2: GIN Shows Dispatch Order Link
**Steps:**
1. Navigate to GINs page
2. Find a GIN that was created from a dispatch order
3. Click on it

**Expected Results:**
- ✅ Blue card at top shows "Generated from Dispatch Order"
- ✅ Shows order ID (DO-456)
- ✅ Shows destination type and name
- ✅ "View Order" button navigates to dispatch order

---

## Test Suite 6: Permissions & Access Control

### Test 6.1: Officer Can View All Resources
**Steps:**
1. Navigate to each page and verify no "Access Denied" errors:
   - Dashboard ✅
   - Receipt Orders ✅
   - Dispatch Orders ✅
   - Hubs (if menu exists) ✅
   - Warehouses (if menu exists) ✅
   - GRNs (if menu exists) ✅
   - GINs (if menu exists) ✅
   - Stock Balance (if menu exists) ✅

**Expected Results:**
- ✅ All pages load without "Access Denied"
- ✅ Lists show data (not empty if data exists)
- ✅ Detail pages load successfully

### Test 6.2: Officer Cannot Create GRN/GIN
**Steps:**
1. Navigate to GRNs page
2. Look for "Create GRN" button

**Expected Results:**
- ✅ No "Create GRN" button visible (or button is disabled)
- ✅ Same for GINs - no create button

---

## Test Suite 7: Error Handling

### Test 7.1: Form Validation
**Steps:**
1. Go to Create Receipt Order
2. Leave required fields empty
3. Try to submit

**Expected Results:**
- ✅ Form shows validation errors
- ✅ Cannot submit until fields are filled
- ✅ Error messages are clear

### Test 7.2: Network Error Handling
**Steps:**
1. Stop backend: `docker compose stop backend`
2. Try to create a receipt order
3. Restart backend: `docker compose start backend`

**Expected Results:**
- ✅ Shows error notification
- ✅ Error message is user-friendly
- ✅ After backend restart, operations work again

---

## Common Issues & Solutions

### Issue 1: "Access Denied" on Receipt Orders
**Solution:**
- Backend needs restart to load policy changes
- Run: `cd backend/warehouse-backend && docker compose restart backend`
- Wait 30 seconds for backend to fully start

### Issue 2: Hub count shows 0
**Solution:**
- Check if hubs exist in database
- Verify FacilityScopeQuery includes officer
- Backend restart may be needed

### Issue 3: Dropdowns are empty
**Solution:**
- Check if reference data exists (commodities, units, warehouses)
- Verify API endpoints return data
- Check browser console for API errors

### Issue 4: Cannot confirm order
**Solution:**
- Verify order has at least one line item
- Check if warehouse is accessible
- Review browser console for errors

### Issue 5: Tabs not showing on confirmed order
**Solution:**
- Verify order status is "Confirmed" (not "Draft")
- Check if Phase 3 code is deployed
- Clear browser cache and refresh

---

## Quick Smoke Test (5 minutes)

If you want a quick test to verify everything works:

1. ✅ Login as officer
2. ✅ Dashboard shows hub count (not 0)
3. ✅ Create receipt order (draft)
4. ✅ Confirm receipt order
5. ✅ See 4 tabs on detail page
6. ✅ Create dispatch order (draft)
7. ✅ Confirm dispatch order
8. ✅ See 4 tabs on detail page
9. ✅ Navigate to Receipt Orders list - no errors
10. ✅ Navigate to Dispatch Orders list - no errors

If all 10 steps pass, the implementation is working correctly!

---

## Reporting Issues

When reporting issues, include:
1. Which test failed
2. Browser console errors (F12 → Console tab)
3. Network errors (F12 → Network tab)
4. Screenshots of the error
5. Steps to reproduce

