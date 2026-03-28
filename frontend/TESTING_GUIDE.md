# CATS Warehouse Management - Testing Guide

## Prerequisites

1. **Backend Running:**
   ```bash
   cd backend/warehouse-backend
   rails s
   ```
   Backend should be running on `http://localhost:3000`

2. **Frontend Running:**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend should be running on `http://localhost:5173`

3. **Database Seeded:**
   Ensure seed users are created in the backend database

## Phase 1 & 2 Testing

### 1. Login Flow

1. Navigate to `http://localhost:5173`
2. Should redirect to `/login`
3. Try invalid credentials → should show error
4. Login with: `admin@cats.local` / `Password1!`
5. Should redirect to dashboard

### 2. Dashboard

1. After login, should see dashboard
2. Verify stats cards display:
   - Total Hubs
   - Total Warehouses
   - Total Stores
   - Total Stacks
   - Pending GRNs
   - Pending GINs
   - Pending Inspections
3. Quick action buttons should be visible
4. Click "Create GRN" → should navigate to `/grns/new` (placeholder page)

### 3. Navigation

1. Click "Hubs" in sidebar → should navigate to `/hubs`
2. Verify active link is highlighted
3. Try all sidebar links → should navigate to respective pages

### 4. Hub List Page

**URL:** `http://localhost:5173/hubs`

**Test Cases:**

1. **Empty State:**
   - If no hubs exist, should show empty state
   - "Create Hub" button should be visible
   - Click button → should navigate to `/hubs/new`

2. **With Data:**
   - Table should display all hubs
   - Columns: Code, Name, Type, Status, Location ID, Actions
   - Status should be color-coded badge

3. **Search:**
   - Type in search box
   - Results should filter in real-time
   - Try searching by code
   - Try searching by name
   - Clear search → all hubs should reappear

4. **Row Click:**
   - Click any row → should navigate to detail page
   - URL should be `/hubs/:id`

5. **Actions:**
   - Click eye icon → should navigate to detail
   - Click edit icon → should navigate to edit form
   - Click delete icon → should show confirmation modal
   - Cancel delete → modal should close
   - Confirm delete → hub should be removed, notification shown

6. **Create Button:**
   - Click "Create Hub" → should navigate to `/hubs/new`

### 5. Hub Detail Page

**URL:** `http://localhost:5173/hubs/:id`

**Test Cases:**

1. **Header:**
   - Hub name should be displayed
   - Hub code should be shown below name
   - Status badge should be visible
   - "Back" button should return to list
   - "Edit" button should navigate to edit form
   - "Delete" button should show confirmation modal

2. **Overview Tab:**
   - Should be default active tab
   - Display: Type, Status, Location ID, Geo ID, Description
   - All fields should show data or "-" if empty

3. **Capacity Tab:**
   - Click "Capacity" tab
   - Display: Total Area, Total Capacity, Construction Year, Ownership Type
   - Should show "No capacity information available" if no data

4. **Access Tab:**
   - Click "Access" tab
   - Display: Loading dock info, road type, nearest town, distance, weighbridge
   - Boolean fields should show "Yes" or "No"

5. **Infrastructure Tab:**
   - Click "Infrastructure" tab
   - Display: Floor type, roof type, ventilation, drainage, fumigation, pest control, fire safety, security
   - Boolean fields should show "Yes" or "No"

6. **Contacts Tab:**
   - Click "Contacts" tab
   - Display: Manager name, phone, email
   - Should show "No contact information available" if no data

7. **Warehouses Tab:**
   - Click "Warehouses" tab
   - Should show list of warehouses belonging to this hub
   - Badge should show count
   - Click warehouse card → should navigate to warehouse detail
   - Should show "No warehouses associated with this hub" if empty

8. **Delete:**
   - Click "Delete" button
   - Confirmation modal should appear
   - Cancel → modal closes
   - Confirm → hub deleted, redirects to list, notification shown

### 6. Hub Form Page (Create)

**URL:** `http://localhost:5173/hubs/new`

**Test Cases:**

1. **Initial State:**
   - Form should be empty
   - Title should be "Create Hub"
   - Required fields should be marked with asterisk

2. **Validation:**
   - Try submitting empty form → should show validation errors
   - Fill only name → should still show error for code
   - Fill only code → should still show error for name

3. **Form Fields:**
   - Code: text input
   - Name: text input
   - Hub Type: dropdown (regional/zonal/woreda)
   - Status: dropdown (active/inactive/maintenance)
   - Description: textarea
   - Location ID: number input
   - Geo ID: number input

4. **Submit:**
   - Fill all required fields
   - Click "Create Hub"
   - Button should show loading spinner
   - On success: notification shown, redirects to detail page
   - On error: error notification shown, form stays populated

5. **Cancel:**
   - Click "Cancel" → should return to list page
   - Click "Back" → should return to list page

### 7. Hub Form Page (Edit)

**URL:** `http://localhost:5173/hubs/:id/edit`

**Test Cases:**

1. **Initial State:**
   - Form should be pre-filled with hub data
   - Title should be "Edit Hub"
   - All fields should have existing values

2. **Modify:**
   - Change name
   - Change status
   - Update description
   - Modify location ID

3. **Submit:**
   - Click "Update Hub"
   - Button should show loading spinner
   - On success: notification shown, redirects to detail page
   - Changes should be reflected in detail page
   - On error: error notification shown

4. **Cancel:**
   - Click "Cancel" → should return to detail page
   - Click "Back" → should return to detail page

### 8. Notifications

**Test Cases:**

1. **Success Notifications:**
   - Create hub → green notification "Hub created successfully"
   - Update hub → green notification "Hub updated successfully"
   - Delete hub → green notification "Hub deleted successfully"
   - Notifications should auto-dismiss after 5 seconds

2. **Error Notifications:**
   - Network error → red notification with error message
   - Validation error → red notification with details
   - Server error → red notification "Failed to..."

### 9. Loading States

**Test Cases:**

1. **List Page:**
   - On initial load → should show loading spinner with message
   - While deleting → delete button should show spinner

2. **Detail Page:**
   - On initial load → should show loading spinner
   - While loading tabs → content should appear smoothly

3. **Form Page:**
   - On submit → button should show loading spinner
   - Button should be disabled during submission

### 10. Error States

**Test Cases:**

1. **Network Error:**
   - Stop backend server
   - Try to load hubs → should show error state
   - "Try Again" button should be visible
   - Click "Try Again" → should retry request

2. **404 Error:**
   - Navigate to `/hubs/99999` (non-existent ID)
   - Should show "Hub not found" error

### 11. Logout

**Test Cases:**

1. Click user menu in header
2. Click "Logout"
3. Should clear auth token
4. Should redirect to login page
5. Try accessing `/hubs` → should redirect to login

## Expected API Calls

### Hub List Page
- `GET /cats_warehouse/v1/hubs`

### Hub Detail Page
- `GET /cats_warehouse/v1/hubs/:id`
- `GET /cats_warehouse/v1/warehouses` (for warehouses tab)

### Hub Create
- `POST /cats_warehouse/v1/hubs`
- Payload: `{ payload: { code, name, hub_type, status, ... } }`

### Hub Update
- `PUT /cats_warehouse/v1/hubs/:id`
- Payload: `{ payload: { name, status, ... } }`

### Hub Delete
- `DELETE /cats_warehouse/v1/hubs/:id`

## Common Issues & Solutions

### Issue: CORS Error
**Solution:** Ensure CORS is enabled in backend `config/initializers/cors.rb`

### Issue: 401 Unauthorized
**Solution:** Login again, token may have expired

### Issue: Empty List
**Solution:** Create hubs using the backend seed data or create manually

### Issue: Validation Errors
**Solution:** Check backend logs for detailed validation messages

### Issue: Network Error
**Solution:** Ensure backend is running on port 3000

## Browser Console

Open browser console (F12) to see:
- API requests and responses
- React Query cache
- Error messages
- Network activity

## React Query DevTools

To enable React Query DevTools:
1. Install: `npm install @tanstack/react-query-devtools`
2. Add to App.tsx
3. See cache state, queries, mutations in real-time

## Next Steps

After Phase 2 testing is complete:
- Test Phase 3: Warehouse Management
- Test Phase 4: Store & Stack Management
- Continue through all phases
