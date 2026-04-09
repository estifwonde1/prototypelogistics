# Setup Guide & Complete Workflow

## Quick Start After Pulling Changes

### 1. Pull Latest Changes
```bash
git checkout phases
git pull origin phases
```

### 2. Backend Setup

#### Option A: Local Development (Ruby/Rails)
```bash
cd backend/warehouse-backend

# Install new dependencies
bundle install

# Run migrations (NEW migrations may have been added)
bundle exec rails db:migrate

# Reset test database
bundle exec rails db:test:prepare

# Run tests to verify everything works
bundle exec rspec

# Start the server
bundle exec rails server
```

#### Option B: Docker Development
```bash
cd backend/warehouse-backend

# Rebuild containers (pulls new dependencies)
docker compose down
docker compose build --no-cache
docker compose up -d

# Run migrations inside container
docker compose exec web bundle exec rails db:migrate

# Run tests
docker compose exec web bundle exec rspec

# View logs
docker compose logs -f web
```

### 3. Frontend Setup
```bash
cd frontend

# Install new dependencies
npm install

# Clear any cached data (if needed)
rm -rf node_modules/.vite

# Start development server
npm run dev
```

### 4. Verify Setup
- **Backend API**: http://localhost:3000/cats_warehouse/v1
- **Frontend**: http://localhost:5173

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| **Hub Manager** | `hub3manager@test.com` | `Password1!` |
| **Warehouse Manager** | `wh2manager@test.com` | `Password1!` |
| **Storekeeper** | `storekeeper2@test.com` | `Password1!` |
| **Officer** | `abebe@test.com` | (check seed file) |

---

## Complete Workflow: Receipt Order to Stacking

### Flow 1: Hub-Scope (Officer → Hub → Warehouse → Store)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌─────────────┐     ┌──────────────┐
│   OFFICER   │────▶│ HUB MANAGER  │────▶│ WAREHOUSE MGR    │────▶│ STOREKEEPER  │────▶│ STACK LAYOUT │
│             │     │              │     │                  │     │             │     │              │
│ Create Order│     │ Assign WH    │     │ Assign Store     │     │ Accept      │     │ Prepare Stack│
│ to Hub      │     │              │     │                  │     │             │     │              │
└─────────────┘     └──────────────┘     └──────────────────┘     └─────────────┘     └──────────────┘
```

#### Step 1: Officer Creates Receipt Order
1. Login as Officer
2. Go to **Receipt Orders** → **+ New Receipt Order**
3. Fill in:
   - Source type & name
   - Destination: **Hub** (select Hub 3)
   - Add commodity line items
   - Status: **Confirmed**
4. Click **Create**
5. Navigate to the order → **Assignments** tab
6. Click **+ Assign Manager**
7. Select **Hub Manager** from dropdown
8. Click **Create Assignment**

#### Step 2: Hub Manager Assigns Warehouse
1. Login as Hub Manager (`hub3manager@test.com`)
2. Go to **Receipt Orders** → Click the order
3. Go to **Assignments** tab
4. Click **+ Assign Warehouse**
5. Select a warehouse under this hub
6. Click **Create Assignment**

#### Step 3: Warehouse Manager Assigns Store
1. Login as Warehouse Manager (`wh2manager@test.com`)
2. Go to **Receipt Orders** → Click the order
3. Go to **Assignments** tab
4. Click **+ Assign Store**
5. Select a store (storekeeper auto-selected)
6. Click **Create Assignment**

#### Step 4: Storekeeper Accepts & Prepares Stack
1. Login as Storekeeper (`storekeeper2@test.com`)
2. Click **My Assignments** in sidebar
3. See pending order with details
4. Click **Accept & Prepare Stack**
5. Auto-redirects to **Stack Layout** page
6. Blue alert: "Prepare Stacking Space"
7. Green badge: "Space Preparation Mode"
8. Click empty area on stack board to create stack
9. Fill in dimensions (e.g., 6m x 6m x 2.5m)
10. Click **Save**

---

### Flow 2: Warehouse-Scope (Officer → Warehouse → Store)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐     ┌──────────────┐
│   OFFICER   │────▶│ WAREHOUSE MGR    │────▶│ STOREKEEPER  │────▶│ STACK LAYOUT │
│             │     │                  │     │             │     │              │
│ Create Order│     │ Assign Store     │     │ Accept      │     │ Prepare Stack│
│ to WH       │     │                  │     │             │     │              │
└─────────────┘     └──────────────────┘     └─────────────┘     └──────────────┘
```

#### Step 1: Officer Creates Receipt Order
1. Login as Officer
2. Go to **Receipt Orders** → **+ New Receipt Order**
3. Fill in:
   - Source type & name
   - Destination: **Warehouse** (select standalone warehouse)
   - Add commodity line items
   - Status: **Confirmed**
4. Click **Create**
5. Navigate to the order → **Assignments** tab
6. Click **+ Assign Manager**
7. Select **Warehouse Manager** from dropdown
8. Click **Create Assignment**

#### Step 2: Warehouse Manager Assigns Store
*(Same as Flow 1, Step 3)*

#### Step 3: Storekeeper Accepts & Prepares Stack
*(Same as Flow 1, Step 4)*

---

## Role-Based Visibility

### What Each Role Sees

| Role | Can See Assignments For | Can Assign |
|------|------------------------|------------|
| **Officer** | All assignments | Hub Manager, Warehouse Manager |
| **Hub Manager** | Hub & Warehouse assignments | Warehouse |
| **Warehouse Manager** | Warehouse & Store assignments | Store |
| **Storekeeper** | Store assignments only | N/A (accepts only) |

### Assignment Filtering Logic

- **Hub Manager**: Sees assignments where `store_id IS NULL` (hub/warehouse level)
- **Warehouse Manager**: Sees assignments where `hub_id IS NULL` (warehouse/store level)
- **Storekeeper**: Sees only assignments for their store

---

## Key Features Implemented

### 1. Assignment System
- **Officer** can assign managers directly from receipt order detail page
- **Hub Manager** can assign warehouses to hub-scoped orders
- **Warehouse Manager** can assign stores to warehouse-scoped orders
- **Storekeeper** receives assignments and can accept them

### 2. Auto-Redirect to Stacking
- When storekeeper accepts assignment → auto-redirects to `/stacks/layout?store_id=X&auto_prepare=true`
- Stack Layout page shows preparation mode UI
- Store is pre-selected from the assignment

### 3. Role-Based Access Control
- Each role only sees relevant assignments
- Officers see all, Hub Managers see hub/warehouse, Warehouse Managers see warehouse/store

---

## Troubleshooting

### Backend Issues

| Issue | Solution |
|-------|----------|
| `bundle install` fails | Check Ruby version: `ruby -v` (should be 3.2+) |
| `rails db:migrate` fails | Check PostgreSQL is running |
| Tests fail | Run `rails db:test:prepare` first |
| Server won't start | Check port 3000 isn't in use |

### Frontend Issues

| Issue | Solution |
|-------|----------|
| `npm install` fails | Check Node version: `node -v` (should be 20+) |
| Vite cache errors | Run `rm -rf node_modules/.vite` |
| Build fails | Check TypeScript: `npx tsc --noEmit` |
| API calls fail | Check backend is running on port 3000 |

### Docker Issues

| Issue | Solution |
|-------|----------|
| Container won't start | Run `docker compose down` then `docker compose up -d` |
| Database connection fails | Check `docker compose logs db` |
| Migrations fail | Run `docker compose exec web bundle exec rails db:migrate` |
| Port conflicts | Change ports in `docker-compose.yml` |

---

## CI/CD Status

| Check | Status | Notes |
|-------|--------|-------|
| Backend Tests | ✅ 47/48 passing | 1 pre-existing failure (stock balance scoping) |
| Backend Rubocop | ⚠️ Warnings allowed | Non-blocking in CI |
| Frontend Build | ✅ Passing | |
| Frontend Lint | ⚠️ Warnings allowed | Non-blocking in CI |

---

## Known Warnings

- **"Cannot read image.png"**: From `cats_core` gem, doesn't affect functionality
- **Rubocop style warnings**: Informational only, won't block CI

---

## File Structure

```
backend/warehouse-backend/
├── engines/cats_warehouse/
│   ├── app/
│   │   ├── controllers/cats/warehouse/
│   │   │   ├── receipt_orders_controller.rb    # Assignment logic
│   │   │   └── storekeeper_assignments_controller.rb
│   │   ├── serializers/cats/warehouse/
│   │   │   ├── receipt_order_serializer.rb
│   │   │   └── storekeeper_assignment_serializer.rb
│   │   └── policies/cats/warehouse/
│   │       └── storekeeper_assignment_policy.rb
│   └── config/routes.rb

frontend/src/
├── pages/
│   ├── officer/
│   │   └── ReceiptOrderDetailPage.tsx          # Assignment UI
│   ├── storekeeper/
│   │   └── StorekeeperAssignmentsPage.tsx      # My Assignments
│   └── stacks/
│       └── StackLayoutPage.tsx                 # auto_prepare mode
├── api/
│   └── receiptOrders.ts                        # API functions
└── components/layout/
    └── Sidebar.tsx                             # Storekeeper menu
```

---

*Last Updated: 2026-04-05*
