# CATS Warehouse Management System - Local Testing Guide

This guide provides step-by-step instructions to run and test the complete CATS Warehouse Management System (backend + frontend) on your local machine.

## Prerequisites

Before starting, ensure you have the following installed:

- **Ruby 3.x** (check with `ruby -v`)
- **Rails 7.x** (check with `rails -v`)
- **PostgreSQL 15+** (check with `psql --version`)
- **Node.js 18+** (check with `node -v`)
- **npm** (check with `npm -v`)
- **Git** (check with `git -v`)

---

## Part 1: Backend Setup

### Step 1: Navigate to Backend Directory

```bash
cd backend/warehouse-backend
```

### Step 2: Install Ruby Dependencies

```bash
bundle install
```

If you encounter any gem installation issues:
```bash
bundle update
bundle install
```

### Step 3: Setup Database

```bash
# Create the database
rails db:create

# Run migrations
rails db:migrate

# Seed the database with test data
rails db:seed
```

**Expected Output:**
- Database created successfully
- All migrations run without errors
- Seed data loaded (users, sample hubs, warehouses, etc.)

### Step 4: Enable CORS

Open `backend/warehouse-backend/config/initializers/cors.rb` and ensure it's configured:

```ruby
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'http://localhost:5173'  # Vite dev server

    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose: ['Authorization']
  end
end
```

If the file is commented out, uncomment it and save.

### Step 5: Start the Backend Server

```bash
rails server
```

Or to run on a specific port:
```bash
rails server -p 3000
```

**Expected Output:**
```
=> Booting Puma
=> Rails 7.x application starting in development
=> Run `bin/rails server --help` for more startup options
Puma starting in single mode...
* Listening on http://127.0.0.1:3000
* Listening on http://[::1]:3000
Use Ctrl-C to stop
```

### Step 6: Verify Backend is Running

Open a new terminal and test the API:

```bash
# Test health check (if available)
curl http://localhost:3000/health

# Test API base path
curl http://localhost:3000/cats_warehouse/v1
```

**Keep this terminal running with the Rails server.**

---

## Part 2: Frontend Setup

### Step 1: Open New Terminal

Open a new terminal window/tab (keep the backend running in the first terminal).

### Step 2: Navigate to Frontend Directory

```bash
cd frontend
```

### Step 3: Install Node Dependencies

```bash
npm install
```

**Expected Output:**
- All dependencies installed successfully
- No critical errors (warnings are okay)

### Step 4: Configure Environment Variables

Create a `.env` file:

```bash
# On Windows (PowerShell)
Copy-Item .env.example .env

# On Windows (CMD)
copy .env.example .env

# On Mac/Linux
cp .env.example .env
```

Verify the `.env` file contains:

```env
VITE_API_BASE_URL=http://localhost:3000/cats_warehouse/v1
VITE_ENV=development
```

### Step 5: Start the Frontend Development Server

```bash
npm run dev
```

**Expected Output:**
```
VITE v8.0.0  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h + enter to show help
```

### Step 6: Open the Application

Open your web browser and navigate to:

```
http://localhost:5173
```

You should see the CATS Warehouse Management login page.

**Keep this terminal running with the Vite dev server.**

---

## Part 3: Testing the Application

### Test 1: Authentication

#### Login with Different User Roles

Test each user role to verify role-based access control:

| Email | Password | Role | Expected Access |
|-------|----------|------|-----------------|
| admin@cats.local | Password1! | Admin | Full access to everything |
| warehouse.manager@cats.local | Password1! | Warehouse Manager | Warehouses, Stores, Stacks, Operations |
| hub.manager@cats.local | Password1! | Hub Manager | Only Hubs |
| receiver@cats.local | Password1! | Storekeeper | Stores, Stacks, GRNs, GINs (read + create) |
| inspector@cats.local | Password1! | Inspector | Inspections, GRNs |
| dispatcher@cats.local | Password1! | Dispatcher | Waybills, GINs |

**Steps:**
1. Go to `http://localhost:5173/login`
2. Enter email and password
3. Click "Login"
4. Verify you're redirected to the dashboard
5. Check sidebar navigation - only allowed menu items should be visible
6. Click "Logout" from the user menu
7. Repeat with different users

**Expected Results:**
- ✅ Successful login redirects to dashboard
- ✅ Failed login shows error message
- ✅ Sidebar shows only permitted menu items based on role
- ✅ Logout clears session and redirects to login

---

### Test 2: Hub Management (Admin or Hub Manager)

**Login as:** `admin@cats.local` or `hub.manager@cats.local`

#### Create a Hub

1. Click "Hubs" in the sidebar
2. Click "Create Hub" button
3. Fill in the form:
   - Code: `HUB-TEST-001`
   - Name: `Test Regional Hub`
   - Hub Type: Select "Regional"
   - Status: Select "Active"
   - Description: `Test hub for local testing`
   - Location ID: `1` (or any valid location)
4. Click "Save"

**Expected Results:**
- ✅ Success notification appears
- ✅ Redirected to hub detail page
- ✅ Hub information displayed correctly

#### View Hub Details

1. From hub list, click on the newly created hub
2. Navigate through tabs:
   - Overview
   - Capacity
   - Access
   - Infrastructure
   - Contacts
   - Warehouses

**Expected Results:**
- ✅ All tabs load without errors
- ✅ Data displays correctly
- ✅ Edit and Delete buttons visible (for admin)

#### Edit a Hub

1. On hub detail page, click "Edit"
2. Modify the name: `Test Regional Hub - Updated`
3. Click "Save"

**Expected Results:**
- ✅ Success notification appears
- ✅ Updated name displays on detail page

#### Delete a Hub

1. On hub detail page, click "Delete"
2. Confirm deletion in modal
3. Verify redirect to hub list

**Expected Results:**
- ✅ Confirmation modal appears
- ✅ Hub deleted successfully
- ✅ Hub no longer appears in list

---

### Test 3: Warehouse Management (Admin or Warehouse Manager)

**Login as:** `admin@cats.local` or `warehouse.manager@cats.local`

#### Create a Warehouse

1. Click "Warehouses" in sidebar
2. Click "Create Warehouse"
3. Fill in the form:
   - Code: `WH-TEST-001`
   - Name: `Test Main Warehouse`
   - Warehouse Type: Select "Main"
   - Status: Select "Active"
   - Hub: Select a hub from dropdown
   - Location ID: `1`
4. Click "Save"

**Expected Results:**
- ✅ Warehouse created successfully
- ✅ Redirected to warehouse detail page
- ✅ All tabs accessible (Overview, Capacity, Access, Infrastructure, Contacts, Stores, Stock Balances, Recent Operations)

---

### Test 4: Store Management

**Login as:** `admin@cats.local` or `warehouse.manager@cats.local`

#### Create a Store

1. Click "Stores" in sidebar
2. Click "Create Store"
3. Fill in the form:
   - Code: `STORE-001`
   - Name: `Test Store A`
   - Length: `50`
   - Width: `30`
   - Height: `10`
   - Usable Space: `15000`
   - Available Space: `15000`
   - Warehouse: Select the warehouse you created
   - Temporary: Toggle off
   - Has Gangway: Toggle on
   - Gangway Length: `5`
   - Gangway Width: `2`
4. Click "Save"

**Expected Results:**
- ✅ Store created successfully
- ✅ Redirected to store list
- ✅ New store appears in the list

---

### Test 5: Stack Management

**Login as:** `admin@cats.local` or `warehouse.manager@cats.local`

#### Create a Stack

1. Click "Stacks" in sidebar
2. Click "Create Stack"
3. Fill in the form:
   - Code: `STACK-001`
   - Length: `10`
   - Width: `10`
   - Height: `5`
   - Start X: `0`
   - Start Y: `0`
   - Store: Select the store you created
   - Commodity ID: `1`
   - Unit ID: `1`
   - Commodity Status: Select "Good"
   - Stack Status: Select "Available"
   - Quantity: `0` (initially empty)
4. Click "Save"

**Expected Results:**
- ✅ Stack created successfully
- ✅ Stack appears in list with correct details

---

### Test 6: GRN (Goods Received Note) Workflow

**Login as:** `admin@cats.local` or `warehouse.manager@cats.local`

#### Create a GRN

1. Click "GRNs" in sidebar
2. Click "Create GRN"
3. Fill in header:
   - Reference No: `GRN-2026-001`
   - Warehouse: Select your test warehouse
   - Received On: Select today's date
   - Received By (User ID): `1`
   - Source Type: `Purchase`
   - Source ID: `1`
4. Add line items:
   - Click "Add Item"
   - Commodity ID: `1`
   - Quantity: `1000`
   - Unit ID: `1`
   - Quality Status: Select "Good"
   - Store ID: Select your store
   - Stack ID: Select your stack
5. Click "Create GRN"

**Expected Results:**
- ✅ GRN created with status "Draft"
- ✅ Redirected to GRN detail page
- ✅ All items displayed correctly

#### Confirm a GRN

1. On GRN detail page, click "Confirm GRN"
2. Confirm the action

**Expected Results:**
- ✅ Status changes from "Draft" to "Confirmed"
- ✅ Confirm button disappears
- ✅ Success notification appears

#### Verify Stock Balance Updated

1. Click "Stock Balances" in sidebar
2. Filter by your warehouse
3. Find the commodity you received

**Expected Results:**
- ✅ Stock balance shows quantity of 1000
- ✅ Warehouse, store, and stack information correct

---

### Test 7: GIN (Goods Issue Note) Workflow

**Login as:** `admin@cats.local` or `warehouse.manager@cats.local`

#### Create a GIN

1. Click "GINs" in sidebar
2. Click "Create GIN"
3. Fill in header:
   - Reference No: `GIN-2026-001`
   - Warehouse: Select your test warehouse
   - Issued On: Select today's date
   - Issued By (User ID): `1`
   - Destination Type: `Distribution`
   - Destination ID: `1`
4. Add line items:
   - Commodity ID: `1` (same as GRN)
   - Quantity: `500` (issue half)
   - Unit ID: `1`
   - Store ID: Select your store
   - Stack ID: Select your stack
5. Click "Create GIN"

**Expected Results:**
- ✅ GIN created with status "Draft"
- ✅ Redirected to GIN detail page

#### Confirm a GIN

1. On GIN detail page, click "Confirm GIN"
2. Confirm the action

**Expected Results:**
- ✅ Status changes to "Confirmed"
- ✅ Success notification appears

#### Verify Stock Balance Decreased

1. Go to "Stock Balances"
2. Check the same commodity

**Expected Results:**
- ✅ Stock balance now shows 500 (1000 - 500)
- ✅ Quantity updated correctly

---

### Test 8: Inspection Workflow

**Login as:** `inspector@cats.local`

#### Create an Inspection

1. Click "Inspections" in sidebar
2. Click "Create Inspection"
3. Fill in header:
   - Reference No: `INS-2026-001`
   - Warehouse: Select warehouse
   - Inspected On: Select today's date
   - Inspector (User ID): `1`
   - Source Type: `GRN`
   - Source ID: `1`
4. Add inspection items:
   - Commodity ID: `1`
   - Quantity Received: `1000`
   - Quantity Damaged: `50`
   - Quantity Lost: `10`
   - Quality Status: Select "Good"
   - Packaging Condition: Select "Intact"
   - Remarks: `Minor damage on 5 bags`
5. Click "Create Inspection"

**Expected Results:**
- ✅ Inspection created successfully
- ✅ Summary shows totals and damage/loss rates
- ✅ Alert banner shows if quality issues detected

#### Confirm Inspection

1. Click "Confirm Inspection"
2. Confirm the action

**Expected Results:**
- ✅ Status changes to "Confirmed"
- ✅ Inspector can confirm (role permission working)

---

### Test 9: Waybill Workflow

**Login as:** `dispatcher@cats.local`

#### Create a Waybill

1. Click "Waybills" in sidebar
2. Click "Create Waybill"
3. Fill in header:
   - Reference No: `WB-2026-001`
   - Issued On: Select today's date
   - Source Location ID: `1`
   - Destination Location ID: `2`
   - Dispatch ID: `1` (optional)
4. Fill in transport details:
   - Transporter ID: `1`
   - Vehicle Plate No: `AA-1234-BB`
   - Driver Name: `John Doe`
   - Driver Phone: `+251911234567`
5. Add waybill items:
   - Commodity ID: `1`
   - Quantity: `500`
   - Unit ID: `1`
6. Click "Create Waybill"

**Expected Results:**
- ✅ Waybill created successfully
- ✅ Transport details card displays correctly
- ✅ All items listed

#### Confirm Waybill

1. Click "Confirm Waybill"
2. Confirm the action

**Expected Results:**
- ✅ Status changes to "Confirmed"
- ✅ Dispatcher can confirm (role permission working)

---

### Test 10: Role-Based Access Control

#### Test Storekeeper Permissions

**Login as:** `receiver@cats.local`

**Expected Behavior:**
- ✅ Can view Stores, Stacks, GRNs, GINs, Stock Balances
- ✅ Can create GRNs and GINs
- ✅ Cannot see Edit/Delete buttons on stores and stacks
- ✅ Cannot confirm GRNs or GINs
- ✅ Cannot access Hubs, Warehouses, Inspections, Waybills

#### Test Inspector Permissions

**Login as:** `inspector@cats.local`

**Expected Behavior:**
- ✅ Can only see Inspections and GRNs in sidebar
- ✅ Can create and confirm inspections
- ✅ Can view GRNs but cannot create or confirm them
- ✅ Cannot access other modules

#### Test Dispatcher Permissions

**Login as:** `dispatcher@cats.local`

**Expected Behavior:**
- ✅ Can only see Waybills and GINs in sidebar
- ✅ Can create and confirm waybills
- ✅ Can view GINs but cannot create or confirm them
- ✅ Cannot access other modules

---

### Test 11: Dashboard Statistics

**Login as:** `admin@cats.local`

1. Go to Dashboard (home page)
2. Verify summary cards show:
   - Total Hubs
   - Total Warehouses
   - Total Stores
   - Total Stacks
   - Pending GRNs (Draft status)
   - Pending GINs (Draft status)
   - Pending Inspections (Draft status)

**Expected Results:**
- ✅ All statistics display correct counts
- ✅ Quick action buttons work
- ✅ Recent activity feed shows latest operations

---

### Test 12: Search and Filter Functionality

#### Test Hub Search

1. Go to Hubs page
2. Use search box to search by hub name or code
3. Verify results filter in real-time

#### Test Warehouse Filters

1. Go to Warehouses page
2. Use hub filter dropdown
3. Use search box
4. Verify filtering works correctly

#### Test Stock Balance Filters

1. Go to Stock Balances page
2. Filter by warehouse
3. Use group-by dropdown (None, By Warehouse, By Commodity)
4. Verify grouping works correctly

**Expected Results:**
- ✅ Search filters results in real-time
- ✅ Dropdowns filter correctly
- ✅ Group-by changes table structure
- ✅ No errors in console

---

### Test 13: Error Handling

#### Test Network Error

1. Stop the Rails backend server (Ctrl+C in backend terminal)
2. Try to perform any action in the frontend
3. Verify error notification appears

**Expected Results:**
- ✅ "Network Error" notification appears
- ✅ Message: "Unable to connect to the server"

#### Test 401 Unauthorized

1. Restart backend server
2. In browser DevTools, clear localStorage
3. Try to navigate to any protected page
4. Verify redirect to login

**Expected Results:**
- ✅ Automatically redirected to login page
- ✅ Session expired message may appear

#### Test Validation Errors

1. Try to create a hub without required fields
2. Submit the form

**Expected Results:**
- ✅ Validation errors display
- ✅ Form doesn't submit
- ✅ Error messages clear and helpful

---

### Test 14: Responsive Design

#### Test Mobile View

1. Open browser DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select a mobile device (e.g., iPhone 12)
4. Navigate through the application

**Expected Results:**
- ✅ Sidebar collapses to hamburger menu
- ✅ Tables scroll horizontally
- ✅ Forms stack vertically
- ✅ Buttons are touch-friendly (44px minimum)
- ✅ All features accessible on mobile

#### Test Tablet View

1. Select iPad or similar tablet size
2. Navigate through pages

**Expected Results:**
- ✅ Layout adapts appropriately
- ✅ Sidebar can be toggled
- ✅ Content readable and accessible

---

## Part 4: Troubleshooting

### Backend Issues

#### Issue: Database connection error

**Solution:**
```bash
# Check PostgreSQL is running
# Windows: Check Services
# Mac: brew services list
# Linux: sudo systemctl status postgresql

# Recreate database
rails db:drop db:create db:migrate db:seed
```

#### Issue: Port 3000 already in use

**Solution:**
```bash
# Find and kill the process
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9

# Or run on different port
rails server -p 3001
```

#### Issue: CORS errors

**Solution:**
- Verify `config/initializers/cors.rb` is uncommented
- Restart Rails server after changes
- Check origin matches frontend URL exactly

### Frontend Issues

#### Issue: Port 5173 already in use

**Solution:**
```bash
# Kill the process or change port in vite.config.ts
# Change server.port to 5174 or any available port
```

#### Issue: API calls failing

**Solution:**
- Verify `.env` file exists with correct `VITE_API_BASE_URL`
- Check backend is running on correct port
- Open browser DevTools Network tab to see actual errors
- Verify CORS is enabled on backend

#### Issue: Login not working

**Solution:**
- Verify backend database is seeded
- Check backend logs for errors
- Try different seed user credentials
- Clear browser localStorage and cookies

#### Issue: Build errors

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm install
npm run build
```

---

## Part 5: Verification Checklist

Use this checklist to verify everything is working:

### Backend Verification
- [ ] Rails server starts without errors
- [ ] Database migrations completed
- [ ] Seed data loaded successfully
- [ ] CORS enabled for localhost:5173
- [ ] API endpoints responding (test with curl)

### Frontend Verification
- [ ] Vite dev server starts without errors
- [ ] Application loads at http://localhost:5173
- [ ] Login page displays correctly
- [ ] No console errors on page load

### Authentication
- [ ] Can login with admin user
- [ ] Can login with different role users
- [ ] Logout works correctly
- [ ] Session persists on page refresh
- [ ] Unauthorized access redirects to login

### CRUD Operations
- [ ] Can create hubs
- [ ] Can view hub details
- [ ] Can edit hubs
- [ ] Can delete hubs
- [ ] Same for warehouses, stores, stacks

### Document Workflows
- [ ] Can create GRN with items
- [ ] Can confirm GRN
- [ ] Stock balance updates after GRN confirm
- [ ] Can create GIN with items
- [ ] Can confirm GIN
- [ ] Stock balance decreases after GIN confirm
- [ ] Can create and confirm inspections
- [ ] Can create and confirm waybills

### Role-Based Access
- [ ] Admin sees all menu items
- [ ] Hub Manager sees only Hubs
- [ ] Warehouse Manager sees warehouses and operations
- [ ] Storekeeper has limited permissions
- [ ] Inspector sees only inspections and GRNs
- [ ] Dispatcher sees only waybills and GINs

### UI/UX
- [ ] Search and filters work
- [ ] Loading states display
- [ ] Error messages show appropriately
- [ ] Success notifications appear
- [ ] Responsive design works on mobile
- [ ] All buttons and links functional

---

## Part 6: Performance Testing

### Load Time Testing

1. Open browser DevTools (F12)
2. Go to Network tab
3. Reload the page
4. Check:
   - Initial page load < 3 seconds
   - API responses < 1 second
   - No failed requests

### Memory Testing

1. Open DevTools Performance tab
2. Record while navigating through pages
3. Check for memory leaks
4. Verify smooth performance

---

## Part 7: Stopping the Application

### Stop Frontend

In the terminal running Vite:
```bash
# Press Ctrl+C
# Confirm with Y if prompted
```

### Stop Backend

In the terminal running Rails:
```bash
# Press Ctrl+C
# Wait for graceful shutdown
```

---

## Part 8: Restarting for Next Session

### Quick Start

```bash
# Terminal 1: Backend
cd backend/warehouse-backend
rails server

# Terminal 2: Frontend
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## Support and Debugging

### View Backend Logs

```bash
# In backend directory
tail -f log/development.log
```

### View Frontend Console

- Open browser DevTools (F12)
- Check Console tab for JavaScript errors
- Check Network tab for API call failures

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Network Error" | Backend not running | Start Rails server |
| "CORS Error" | CORS not enabled | Check cors.rb configuration |
| "401 Unauthorized" | Session expired | Login again |
| "403 Forbidden" | Insufficient permissions | Login with correct role |
| "404 Not Found" | Invalid route | Check URL and backend routes |
| "422 Validation Error" | Invalid data | Check form inputs |

---

## Next Steps

After successful local testing:

1. **Document Issues**: Note any bugs or unexpected behavior
2. **Test Edge Cases**: Try invalid inputs, boundary conditions
3. **Performance Optimization**: Identify slow operations
4. **User Feedback**: Have others test the application
5. **Prepare for Deployment**: Review deployment guide when ready

---

## Contact

For issues or questions during testing:
- Check backend logs: `backend/warehouse-backend/log/development.log`
- Check browser console for frontend errors
- Review this guide's troubleshooting section
- Contact the development team

---

**Happy Testing! 🚀**
