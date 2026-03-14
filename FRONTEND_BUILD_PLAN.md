# CATS Warehouse Management System - Frontend Build & Integration Plan

> **Project:** Prototype Logistics - CATS Warehouse  
> **Date:** March 14, 2026  
> **Backend:** Rails 7 API-only (PostgreSQL) with `cats_core` gem + `cats_warehouse` engine  
> **Frontend:** React 19 + TypeScript + Vite 8  
> **API Base:** `/cats_warehouse/v1/`

---

## Backend Architecture Summary

### Authentication
- **Method:** Custom token auth via Rails Signed IDs (24h expiry)
- **Login endpoint:** `POST /cats_warehouse/v1/auth/login` → `{ email, password }` → `{ token, user_id }`
- **Token usage:** `Authorization: Bearer <token>` header on all protected endpoints
- **Fallback:** `X-User-Id` header (development convenience)

### Authorization (Pundit Policies)
| Role | Access |
|------|--------|
| **Admin** | Full access to everything |
| **Hub Manager** | Hubs (CRUD) |
| **Warehouse Manager** | Warehouses, Stores, Stacks, GRNs, GINs, Inspections, Waybills, Stock Balances |
| **Storekeeper** | Stores, Stacks, GRNs, GINs, Stock Balances (read + create) |
| **Inspector** | Inspections, GRNs (read + create + confirm) |
| **Dispatcher** | Waybills, GINs (read + create + confirm) |

### Seed Users (for development/testing)
| Email | Password | Role |
|-------|----------|------|
| admin@cats.local | Password1! | Admin |
| warehouse.manager@cats.local | Password1! | Warehouse Manager |
| hub.manager@cats.local | Password1! | Hub Manager |
| receiver@cats.local | Password1! | Storekeeper |
| issuer@cats.local | Password1! | Storekeeper |
| inspector@cats.local | Password1! | Inspector |
| approver@cats.local | Password1! | Warehouse Manager |
| dispatcher@cats.local | Password1! | Dispatcher |

### API Endpoints
| Resource | Methods | Special Actions | Serializer Fields |
|----------|---------|-----------------|-------------------|
| **Auth** | POST login | — | token, user_id |
| **Hubs** | GET, POST, PUT, DELETE | — | id, code, name, hub_type, status, description, location_id, geo_id |
| **Warehouses** | GET, POST, PUT, DELETE | — | id, code, name, warehouse_type, status, description, location_id, hub_id, geo_id |
| **Stores** | GET, POST, PUT, DELETE | — | id, code, name, length, width, height, usable_space, available_space, temporary, has_gangway, gangway_*, warehouse_id |
| **Stacks** | GET, POST, PUT, DELETE | — | id, code, length, width, height, start_x, start_y, commodity_id, store_id, commodity_status, stack_status, quantity, unit_id |
| **Stock Balances** | GET (index, show) | — | id, warehouse_id, store_id, stack_id, commodity_id, quantity, unit_id |
| **GRNs** | GET, POST | POST /:id/confirm | id, reference_no, warehouse_id, received_on, source_type/id, status, received_by_id, approved_by_id + grn_items[] |
| **GINs** | GET, POST | POST /:id/confirm | id, reference_no, warehouse_id, issued_on, destination_type/id, status, issued_by_id, approved_by_id + gin_items[] |
| **Inspections** | GET, POST | POST /:id/confirm | id, reference_no, warehouse_id, inspected_on, inspector_id, source_type/id, status + inspection_items[] |
| **Waybills** | GET, POST | POST /:id/confirm | id, reference_no, dispatch_id, source/destination_location_id, issued_on, status + waybill_transport{} + waybill_items[] |

### Data Model Relationships
```
Hub (has_one: capacity, access, infra, contacts)
 └── Warehouse (has_one: capacity, access, infra, contacts)
      ├── Store
      │    └── Stack (linked to Commodity + UnitOfMeasure)
      ├── StockBalance (per warehouse/store/stack/commodity)
      ├── StackingRule
      ├── GRN → GrnItem[]
      ├── GIN → GinItem[]
      └── Inspection → InspectionItem[]

Waybill → WaybillTransport + WaybillItem[]
```

### CORS Status
- `rack-cors` gem is present but **commented out** in `config/initializers/cors.rb`
- **Must be enabled** before frontend can communicate with backend

---

## Phase Tracking

| Phase | Name | Status | Pages |
|-------|------|--------|-------|
| **0** | Cleanup & Foundation | ⬜ Not Started | — |
| **1** | Authentication & Layout | ⬜ Not Started | Login, Main Layout, Dashboard |
| **2** | Hub Management | ⬜ Not Started | Hub List, Hub Detail, Hub Form |
| **3** | Warehouse Management | ⬜ Not Started | Warehouse List, Warehouse Detail, Warehouse Form |
| **4** | Store & Stack Management | ⬜ Not Started | Store List, Store Form, Stack List, Stack Form |
| **5** | Stock & Inventory | ⬜ Not Started | Stock Balance Dashboard, Stacking Rules |
| **6** | GRN (Goods Received Notes) | ⬜ Not Started | GRN List, GRN Create, GRN Detail |
| **7** | GIN (Goods Issue Notes) | ⬜ Not Started | GIN List, GIN Create, GIN Detail |
| **8** | Inspections | ⬜ Not Started | Inspection List, Inspection Create, Inspection Detail |
| **9** | Waybills | ⬜ Not Started | Waybill List, Waybill Create, Waybill Detail |
| **10** | Integration & Error Handling | ⬜ Not Started | All pages |
| **11** | Polish, Responsiveness & Deployment | ⬜ Not Started | All pages |

---

## Phase 0: Cleanup & Foundation

> Remove Vite boilerplate and set up the project skeleton with all core dependencies.

### 0.1 — Backend: Enable CORS
- [ ] Uncomment and configure `config/initializers/cors.rb`
- [ ] Allow origin `http://localhost:5173` (Vite dev server)
- [ ] Allow headers: `Authorization`, `Content-Type`, `X-User-Id`
- [ ] Allow methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- [ ] Expose headers: `Authorization`

### 0.2 — Frontend: Remove Boilerplate
- [ ] Delete `src/App.css` (will be replaced)
- [ ] Delete `src/assets/react.svg`
- [ ] Delete `src/assets/vite.svg`
- [ ] Delete `src/assets/hero.png`
- [ ] Delete `public/icons.svg`
- [ ] Clear `src/App.tsx` to empty component
- [ ] Clear `src/index.css` to minimal reset
- [ ] Update `index.html` title to "CATS Warehouse Management"

### 0.3 — Install Core Dependencies
```
npm install react-router-dom@7         # Routing
npm install @tanstack/react-query       # Server state / data fetching
npm install axios                       # HTTP client
npm install zustand                     # Client state management
npm install @mantine/core @mantine/hooks @mantine/form @mantine/dates @mantine/notifications @mantine/modals  # UI framework
npm install @tabler/icons-react         # Icon set
npm install dayjs                       # Date formatting
npm install @mantine/charts recharts    # Charts (dashboard)
npm install react-hot-toast             # Toast notifications (lightweight alt)
```

### 0.4 — Project Structure Setup
Create the following folder structure:
```
src/
├── api/                    # API client & endpoint functions
│   ├── client.ts           # Axios instance with interceptors
│   ├── auth.ts             # Login API
│   ├── hubs.ts             # Hub endpoints
│   ├── warehouses.ts       # Warehouse endpoints
│   ├── stores.ts           # Store endpoints
│   ├── stacks.ts           # Stack endpoints
│   ├── stockBalances.ts    # Stock balance endpoints
│   ├── grns.ts             # GRN endpoints
│   ├── gins.ts             # GIN endpoints
│   ├── inspections.ts      # Inspection endpoints
│   └── waybills.ts         # Waybill endpoints
├── components/             # Shared/reusable components
│   ├── layout/             # Layout components
│   │   ├── AppShell.tsx    # Main app shell (sidebar + header + content)
│   │   ├── Sidebar.tsx     # Navigation sidebar
│   │   └── Header.tsx      # Top header bar
│   ├── common/             # Generic reusable components
│   │   ├── DataTable.tsx   # Reusable data table
│   │   ├── StatusBadge.tsx # Status badge (Draft, Confirmed, etc.)
│   │   ├── ConfirmModal.tsx# Confirmation modal
│   │   ├── EmptyState.tsx  # Empty state placeholder
│   │   ├── LoadingState.tsx# Loading skeleton
│   │   └── ErrorState.tsx  # Error display
│   └── forms/              # Shared form components
│       ├── SearchInput.tsx # Search/filter input
│       └── FormActions.tsx # Save/Cancel button group
├── hooks/                  # Custom React hooks
│   ├── useAuth.ts          # Auth hook
│   └── useQueryParams.ts   # URL query param hook
├── pages/                  # Page components (one folder per domain)
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── dashboard/
│   │   └── DashboardPage.tsx
│   ├── hubs/
│   │   ├── HubListPage.tsx
│   │   ├── HubDetailPage.tsx
│   │   └── HubFormPage.tsx
│   ├── warehouses/
│   │   ├── WarehouseListPage.tsx
│   │   ├── WarehouseDetailPage.tsx
│   │   └── WarehouseFormPage.tsx
│   ├── stores/
│   │   ├── StoreListPage.tsx
│   │   └── StoreFormPage.tsx
│   ├── stacks/
│   │   ├── StackListPage.tsx
│   │   └── StackFormPage.tsx
│   ├── stock/
│   │   └── StockBalancePage.tsx
│   ├── grns/
│   │   ├── GrnListPage.tsx
│   │   ├── GrnCreatePage.tsx
│   │   └── GrnDetailPage.tsx
│   ├── gins/
│   │   ├── GinListPage.tsx
│   │   ├── GinCreatePage.tsx
│   │   └── GinDetailPage.tsx
│   ├── inspections/
│   │   ├── InspectionListPage.tsx
│   │   ├── InspectionCreatePage.tsx
│   │   └── InspectionDetailPage.tsx
│   └── waybills/
│       ├── WaybillListPage.tsx
│       ├── WaybillCreatePage.tsx
│       └── WaybillDetailPage.tsx
├── store/                  # Zustand stores
│   └── authStore.ts        # Auth state (token, user, role)
├── types/                  # TypeScript type definitions
│   ├── auth.ts
│   ├── hub.ts
│   ├── warehouse.ts
│   ├── store.ts
│   ├── stack.ts
│   ├── stockBalance.ts
│   ├── grn.ts
│   ├── gin.ts
│   ├── inspection.ts
│   ├── waybill.ts
│   └── common.ts           # Shared types (ApiResponse, PaginatedResponse, etc.)
├── utils/                  # Utility functions
│   ├── formatters.ts       # Date, number formatting
│   └── constants.ts        # API base URL, status enums, etc.
├── router.tsx              # React Router configuration
├── App.tsx                 # Root app component
├── main.tsx                # Entry point
└── index.css               # Global styles / Mantine theme overrides
```

### 0.5 — Core Infrastructure Code
- [ ] `api/client.ts` — Axios instance with `baseURL`, auth interceptor (attach Bearer token), response interceptor (handle 401 → redirect to login)
- [ ] `store/authStore.ts` — Zustand store: `{ token, userId, role, setAuth, clearAuth, isAuthenticated }`
- [ ] `types/common.ts` — `ApiResponse<T>`, error types
- [ ] `utils/constants.ts` — `API_BASE_URL`, status enums
- [ ] `router.tsx` — Base route config with lazy-loaded pages, protected route wrapper

**Deliverable:** Clean project skeleton that compiles and shows a blank page with routing ready.

---

## Phase 1: Authentication & Layout

> Build the login flow, main application shell, sidebar navigation, and dashboard.

### 1.1 — Login Page
- [ ] `pages/auth/LoginPage.tsx`
  - Email + Password form
  - Call `POST /cats_warehouse/v1/auth/login`
  - Store token + user_id in Zustand + localStorage
  - Redirect to dashboard on success
  - Show error message on failure (invalid credentials, network error)
- [ ] Styled login card centered on screen
- [ ] Form validation (required fields, email format)

### 1.2 — Protected Route Component
- [ ] `components/layout/ProtectedRoute.tsx`
  - Check `isAuthenticated` from auth store
  - If not authenticated → redirect to `/login`
  - If authenticated → render child route
  - Optional: role-based guard (show 403 if role mismatch)

### 1.3 — App Shell (Main Layout)
- [ ] `components/layout/AppShell.tsx`
  - Mantine AppShell with sidebar + header + main content
  - Sidebar: navigation links grouped by category
  - Header: app title, user name/email, logout button
- [ ] `components/layout/Sidebar.tsx`
  - Navigation groups:
    - **Dashboard** — `/`
    - **Hub Management** — `/hubs`
    - **Warehouse Management** — `/warehouses`
    - **Store Management** — `/stores`
    - **Stack Management** — `/stacks`
    - **Stock Balances** — `/stock-balances`
    - **Operations**
      - GRNs — `/grns`
      - GINs — `/gins`
      - Inspections — `/inspections`
      - Waybills — `/waybills`
  - Active link highlighting
  - Collapsible on mobile
  - Role-based visibility (hide menu items user cannot access)
- [ ] `components/layout/Header.tsx`
  - App name/logo
  - Logged-in user display
  - Logout action (clear auth store → redirect to login)

### 1.4 — Dashboard Page
- [ ] `pages/dashboard/DashboardPage.tsx`
  - Summary stats cards:
    - Total Hubs
    - Total Warehouses
    - Total Stores
    - Total Stacks
    - Pending GRNs (Draft status)
    - Pending GINs (Draft status)
    - Pending Inspections (Draft status)
  - Quick action buttons (Create GRN, Create GIN, etc.)
  - Recent activity feed (latest GRNs, GINs, Inspections)

### 1.5 — Route Configuration
- [ ] Full route tree in `router.tsx`:
```
/login                    → LoginPage
/                         → ProtectedRoute → AppShell
  /                       → DashboardPage
  /hubs                   → HubListPage
  /hubs/new               → HubFormPage
  /hubs/:id               → HubDetailPage
  /hubs/:id/edit          → HubFormPage
  /warehouses             → WarehouseListPage
  /warehouses/new         → WarehouseFormPage
  /warehouses/:id         → WarehouseDetailPage
  /warehouses/:id/edit    → WarehouseFormPage
  /stores                 → StoreListPage
  /stores/new             → StoreFormPage
  /stores/:id/edit        → StoreFormPage
  /stacks                 → StackListPage
  /stacks/new             → StackFormPage
  /stacks/:id/edit        → StackFormPage
  /stock-balances         → StockBalancePage
  /grns                   → GrnListPage
  /grns/new               → GrnCreatePage
  /grns/:id               → GrnDetailPage
  /gins                   → GinListPage
  /gins/new               → GinCreatePage
  /gins/:id               → GinDetailPage
  /inspections            → InspectionListPage
  /inspections/new        → InspectionCreatePage
  /inspections/:id        → InspectionDetailPage
  /waybills               → WaybillListPage
  /waybills/new           → WaybillCreatePage
  /waybills/:id           → WaybillDetailPage
```

**Deliverable:** Functional login → dashboard flow with sidebar navigation. All links exist (pages can be placeholder stubs).

---

## Phase 2: Hub Management

> Full CRUD for Hubs with detail tabs for Capacity, Access, Infrastructure, and Contacts.

### 2.1 — TypeScript Types
- [ ] `types/hub.ts`
  - `Hub` — id, code, name, hub_type, status, description, location_id, geo_id
  - `HubCapacity` — total_area_sqm, total_capacity_mt, construction_year, ownership_type
  - `HubAccess` — has_loading_dock, number_of_loading_docks, loading_dock_type, access_road_type, nearest_town, distance_from_town_km, has_weighbridge
  - `HubInfra` — floor_type, roof_type, has_ventilation, has_drainage_system, has_fumigation_facility, has_pest_control, has_fire_extinguisher, has_security_guard, security_type
  - `HubContacts` — manager_name, contact_phone, contact_email

### 2.2 — API Functions
- [ ] `api/hubs.ts`
  - `getHubs()` → GET /hubs
  - `getHub(id)` → GET /hubs/:id
  - `createHub(data)` → POST /hubs
  - `updateHub(id, data)` → PUT /hubs/:id
  - `deleteHub(id)` → DELETE /hubs/:id

### 2.3 — Hub List Page
- [ ] `pages/hubs/HubListPage.tsx`
  - Data table with columns: Code, Name, Type, Status, Location, Actions
  - Search/filter by name or code
  - "Create Hub" button → navigates to `/hubs/new`
  - Row click → navigates to `/hubs/:id`
  - Delete action with confirmation modal
  - Loading skeleton while fetching
  - Empty state when no hubs

### 2.4 — Hub Detail Page
- [ ] `pages/hubs/HubDetailPage.tsx`
  - Header: Hub name, code, status badge
  - Tabs:
    - **Overview** — Basic info (type, status, description, location, geo coordinates)
    - **Capacity** — Total area, capacity, construction year, ownership
    - **Access** — Loading docks, road type, weighbridge, nearest town
    - **Infrastructure** — Floor/roof type, ventilation, drainage, pest control, fire safety, security
    - **Contacts** — Manager name, phone, email
    - **Warehouses** — List of warehouses belonging to this hub
  - Edit button → `/hubs/:id/edit`
  - Delete button with confirmation

### 2.5 — Hub Form Page (Create/Edit)
- [ ] `pages/hubs/HubFormPage.tsx`
  - Reused for both create and edit (detect via route params)
  - Form fields: code, name, hub_type (select), status (select), description, location_id (select/search), geo coordinates
  - Validation: name required
  - Submit → POST or PUT
  - Success → redirect to hub detail
  - Cancel → go back

**Deliverable:** Complete hub CRUD with detail tabs. All hub data viewable and editable.

---

## Phase 3: Warehouse Management

> Full CRUD for Warehouses with detail tabs and linked sub-resources.

### 3.1 — TypeScript Types
- [ ] `types/warehouse.ts`
  - `Warehouse` — id, code, name, warehouse_type, status, description, location_id, hub_id, geo_id
  - `WarehouseCapacity` — total_area_sqm, total_storage_capacity_mt, usable_storage_capacity_mt, no_of_stores, construction_year, ownership_type
  - `WarehouseAccess` — has_loading_dock, number_of_loading_docks, access_road_type, nearest_town, distance_from_town_km
  - `WarehouseInfra` — floor_type, roof_type, has_fumigation_facility, has_fire_extinguisher, has_security_guard
  - `WarehouseContacts` — manager_name, contact_phone, contact_email

### 3.2 — API Functions
- [ ] `api/warehouses.ts`
  - `getWarehouses()` → GET /warehouses
  - `getWarehouse(id)` → GET /warehouses/:id
  - `createWarehouse(data)` → POST /warehouses
  - `updateWarehouse(id, data)` → PUT /warehouses/:id
  - `deleteWarehouse(id)` → DELETE /warehouses/:id

### 3.3 — Warehouse List Page
- [ ] `pages/warehouses/WarehouseListPage.tsx`
  - Data table: Code, Name, Type, Status, Hub, Location, Actions
  - Search/filter by name, code, or hub
  - "Create Warehouse" button
  - Row click → detail page
  - Delete with confirmation

### 3.4 — Warehouse Detail Page
- [ ] `pages/warehouses/WarehouseDetailPage.tsx`
  - Header: Warehouse name, code, status badge, parent hub link
  - Tabs:
    - **Overview** — Basic info, linked hub, location, geo
    - **Capacity** — Area, storage capacity, stores count, year, ownership
    - **Access** — Loading docks, road type, nearest town
    - **Infrastructure** — Floor/roof type, fumigation, fire, security
    - **Contacts** — Manager, phone, email
    - **Stores** — List of stores in this warehouse (link to store management)
    - **Stock Balances** — Current stock levels in this warehouse
    - **Recent Operations** — Latest GRNs, GINs, Inspections for this warehouse
  - Edit and delete buttons

### 3.5 — Warehouse Form Page
- [ ] `pages/warehouses/WarehouseFormPage.tsx`
  - Form: code, name, warehouse_type, status, description, hub_id (select from hubs), location_id, geo
  - Validation: name required
  - Create/Edit mode

**Deliverable:** Complete warehouse CRUD with all detail tabs and linked data views.

---

## Phase 4: Store & Stack Management

> CRUD for Stores and Stacks, which are nested under Warehouses.

### 4.1 — TypeScript Types
- [ ] `types/store.ts` — Store fields (code, name, dimensions, usable/available space, gangway info, warehouse_id)
- [ ] `types/stack.ts` — Stack fields (code, dimensions, position, commodity_id, store_id, status, quantity, unit_id)

### 4.2 — API Functions
- [ ] `api/stores.ts` — getStores, getStore, createStore, updateStore, deleteStore
- [ ] `api/stacks.ts` — getStacks, getStack, createStack, updateStack, deleteStack

### 4.3 — Store List Page
- [ ] `pages/stores/StoreListPage.tsx`
  - Table: Code, Name, Warehouse, Dimensions (L x W x H), Usable Space, Available Space, Temporary, Actions
  - Filter by warehouse
  - Create/Edit/Delete
  - Click → show stacks in this store

### 4.4 — Store Form Page
- [ ] `pages/stores/StoreFormPage.tsx`
  - Fields: code, name, length, width, height, usable_space, available_space, temporary (toggle), has_gangway (toggle), gangway dimensions (conditional), warehouse_id (select)
  - Validation: name, length, width, height, usable_space, available_space required

### 4.5 — Stack List Page
- [ ] `pages/stacks/StackListPage.tsx`
  - Table: Code, Store, Commodity, Dimensions, Position (x, y), Quantity, Unit, Commodity Status, Stack Status, Actions
  - Filter by store or warehouse
  - Create/Edit/Delete

### 4.6 — Stack Form Page
- [ ] `pages/stacks/StackFormPage.tsx`
  - Fields: code, length, width, height, start_x, start_y, commodity_id (select), store_id (select), commodity_status (select), stack_status (select), quantity, unit_id (select)
  - Validation: length, width, height required

**Deliverable:** Full store and stack CRUD. Stores filterable by warehouse, stacks filterable by store.

---

## Phase 5: Stock & Inventory

> Stock balance viewing and stacking rules management.

### 5.1 — TypeScript Types
- [ ] `types/stockBalance.ts` — StockBalance fields
- [ ] `types/stackingRule.ts` — StackingRule fields (if endpoint exists)

### 5.2 — API Functions
- [ ] `api/stockBalances.ts` — getStockBalances, getStockBalance

### 5.3 — Stock Balance Dashboard
- [ ] `pages/stock/StockBalancePage.tsx`
  - Summary cards: Total stock quantity, number of warehouses with stock, number of commodities
  - Table: Warehouse, Store, Stack, Commodity, Quantity, Unit
  - Filter by warehouse, store, commodity
  - Group-by view (by warehouse or by commodity)
  - Export to CSV (optional)

**Deliverable:** Read-only stock balance view with filtering and grouping.

---

## Phase 6: GRN (Goods Received Notes)

> Create, view, and confirm GRNs with line items.

### 6.1 — TypeScript Types
- [ ] `types/grn.ts`
  - `Grn` — id, reference_no, warehouse_id, received_on, source_type/id, status, received_by_id, approved_by_id
  - `GrnItem` — id, grn_id, commodity_id, quantity, unit_id, quality_status, store_id, stack_id

### 6.2 — API Functions
- [ ] `api/grns.ts`
  - `getGrns()` → GET /grns
  - `getGrn(id)` → GET /grns/:id
  - `createGrn(data)` → POST /grns (payload includes items[])
  - `confirmGrn(id)` → POST /grns/:id/confirm

### 6.3 — GRN List Page
- [ ] `pages/grns/GrnListPage.tsx`
  - Table: Reference No, Warehouse, Received On, Source, Status (badge), Received By, Actions
  - Status filter (Draft / Confirmed)
  - "Create GRN" button
  - Row click → detail

### 6.4 — GRN Create Page
- [ ] `pages/grns/GrnCreatePage.tsx`
  - Header form: warehouse_id (select), received_on (date picker), received_by_id, reference_no, source_type + source_id
  - Line items section (dynamic add/remove):
    - Each item: commodity_id (select), quantity (number), unit_id (select), quality_status (select), store_id (select), stack_id (select)
    - "Add Item" button
    - Remove item button per row
  - Submit → creates GRN with all items in one request
  - Success → navigate to GRN detail

### 6.5 — GRN Detail Page
- [ ] `pages/grns/GrnDetailPage.tsx`
  - Header: Reference no, status badge, warehouse name, received on, received by, source info
  - Items table: Commodity, Quantity, Unit, Quality Status, Store, Stack
  - **Confirm button** (visible only for Draft GRNs, only for admin/warehouse_manager roles)
  - Confirm action → POST /:id/confirm → updates status → refreshes view
  - Print/PDF view (optional, future)

**Deliverable:** Full GRN workflow: list → create (with items) → view detail → confirm.

---

## Phase 7: GIN (Goods Issue Notes)

> Create, view, and confirm GINs with line items.

### 7.1 — TypeScript Types
- [ ] `types/gin.ts`
  - `Gin` — id, reference_no, warehouse_id, issued_on, destination_type/id, status, issued_by_id, approved_by_id
  - `GinItem` — id, gin_id, commodity_id, quantity, unit_id, store_id, stack_id

### 7.2 — API Functions
- [ ] `api/gins.ts`
  - `getGins()`, `getGin(id)`, `createGin(data)`, `confirmGin(id)`

### 7.3 — GIN List Page
- [ ] `pages/gins/GinListPage.tsx`
  - Table: Reference No, Warehouse, Issued On, Destination, Status, Issued By, Actions
  - Status filter, create button, row click → detail

### 7.4 — GIN Create Page
- [ ] `pages/gins/GinCreatePage.tsx`
  - Header: warehouse_id, issued_on, issued_by_id, reference_no, destination_type + destination_id
  - Line items: commodity_id, quantity, unit_id, store_id, stack_id
  - Dynamic add/remove items

### 7.5 — GIN Detail Page
- [ ] `pages/gins/GinDetailPage.tsx`
  - Header info + items table
  - Confirm button for Draft GINs

**Deliverable:** Full GIN workflow: list → create → view → confirm.

---

## Phase 8: Inspections

> Create, view, and confirm Inspections with line items (quality checks).

### 8.1 — TypeScript Types
- [ ] `types/inspection.ts`
  - `Inspection` — id, reference_no, warehouse_id, inspected_on, inspector_id, source_type/id, status
  - `InspectionItem` — id, inspection_id, commodity_id, quantity_received, quantity_damaged, quantity_lost, quality_status, packaging_condition, remarks

### 8.2 — API Functions
- [ ] `api/inspections.ts`
  - `getInspections()`, `getInspection(id)`, `createInspection(data)`, `confirmInspection(id)`

### 8.3 — Inspection List Page
- [ ] `pages/inspections/InspectionListPage.tsx`
  - Table: Reference No, Warehouse, Inspected On, Inspector, Source, Status, Actions
  - Status filter, create button

### 8.4 — Inspection Create Page
- [ ] `pages/inspections/InspectionCreatePage.tsx`
  - Header: warehouse_id, inspected_on, inspector_id, reference_no, source_type + source_id
  - Line items:
    - commodity_id, quantity_received, quantity_damaged, quantity_lost, quality_status (select), packaging_condition (select), remarks (text)
  - Quality/damage fields make this form more complex than GRN/GIN

### 8.5 — Inspection Detail Page
- [ ] `pages/inspections/InspectionDetailPage.tsx`
  - Header info + items table with damage/loss columns highlighted
  - Summary: total received, total damaged, total lost
  - Confirm button

**Deliverable:** Full inspection workflow with quality assessment tracking.

---

## Phase 9: Waybills

> Create, view, and confirm Waybills with transport details and line items.

### 9.1 — TypeScript Types
- [ ] `types/waybill.ts`
  - `Waybill` — id, reference_no, dispatch_id, source_location_id, destination_location_id, issued_on, status
  - `WaybillTransport` — id, waybill_id, transporter_id, vehicle_plate_no, driver_name, driver_phone
  - `WaybillItem` — id, waybill_id, commodity_id, quantity, unit_id

### 9.2 — API Functions
- [ ] `api/waybills.ts`
  - `getWaybills()`, `getWaybill(id)`, `createWaybill(data)`, `confirmWaybill(id)`

### 9.3 — Waybill List Page
- [ ] `pages/waybills/WaybillListPage.tsx`
  - Table: Reference No, Source Location, Destination Location, Issued On, Status, Transporter, Vehicle, Actions
  - Status filter, create button

### 9.4 — Waybill Create Page
- [ ] `pages/waybills/WaybillCreatePage.tsx`
  - Header: reference_no, issued_on, source_location_id (select), destination_location_id (select), dispatch_id (select/optional)
  - Transport section:
    - transporter_id (select), vehicle_plate_no, driver_name, driver_phone
  - Line items: commodity_id, quantity, unit_id
  - Three-section form (header → transport → items)

### 9.5 — Waybill Detail Page
- [ ] `pages/waybills/WaybillDetailPage.tsx`
  - Header info
  - Transport details card (transporter, vehicle, driver)
  - Items table
  - Confirm button
  - Route visualization (source → destination, optional/future)

**Deliverable:** Full waybill workflow with transport tracking.

---

## Phase 10: Integration & Error Handling

> End-to-end integration testing, error handling, loading states, and role-based access enforcement.

### 10.1 — API Error Handling
- [ ] Global axios error interceptor: 401 (logout), 403 (forbidden toast), 422 (validation display), 500 (generic error)
- [ ] Per-form error display: show backend validation errors inline next to form fields
- [ ] Network error handling: offline detection, retry logic
- [ ] Toast notifications for all successful actions (created, updated, deleted, confirmed)

### 10.2 — Loading States
- [ ] Skeleton loaders on all list pages during initial fetch
- [ ] Spinner on form submit buttons (disable during submission)
- [ ] Optimistic updates where appropriate (delete from list immediately)
- [ ] Pull-to-refresh / manual refresh button on list pages

### 10.3 — Role-Based Frontend Access
- [ ] Store user role in auth store (may need to fetch user details after login)
- [ ] Sidebar: hide nav items the user's role cannot access
- [ ] Pages: redirect to 403 if user navigates to unauthorized page
- [ ] Actions: hide Create/Edit/Delete/Confirm buttons based on Pundit policy rules:
  - Only Admin can delete hubs/warehouses/stores/stacks
  - Only Admin + Warehouse Manager can confirm GRNs/GINs
  - Inspector can confirm inspections
  - Dispatcher can confirm waybills
- [ ] Create a `usePermission(resource, action)` hook

### 10.4 — Data Relationships & Dropdowns
- [ ] Location dropdown (fetch from cats_core if endpoint available, or use seed data)
- [ ] Commodity dropdown with search
- [ ] Unit of Measure dropdown
- [ ] Transporter dropdown
- [ ] Cascading selects: Warehouse → Store → Stack
- [ ] Cache dropdown data using React Query (staleTime: 5 minutes)

### 10.5 — End-to-End Integration Testing
- [ ] Test login flow with each seed user
- [ ] Test full Hub CRUD cycle
- [ ] Test full Warehouse CRUD cycle
- [ ] Test full Store CRUD cycle
- [ ] Test full Stack CRUD cycle
- [ ] Test GRN create → confirm → verify stock balance updated
- [ ] Test GIN create → confirm → verify stock balance decreased
- [ ] Test Inspection create → confirm
- [ ] Test Waybill create → confirm
- [ ] Test role restrictions (storekeeper cannot delete, inspector sees only inspections, etc.)

**Deliverable:** Production-ready error handling, loading states, role enforcement, and verified integration.

---

## Phase 11: Polish, Responsiveness & Deployment

> Final UI refinements, responsive design, and deployment readiness.

### 11.1 — Responsive Design
- [ ] Mobile-friendly sidebar (hamburger menu, collapsible)
- [ ] Responsive data tables (horizontal scroll on small screens or card layout)
- [ ] Form layouts: single column on mobile, multi-column on desktop
- [ ] Touch-friendly buttons and inputs

### 11.2 — UI Polish
- [ ] Consistent color scheme and typography
- [ ] Dark mode support (Mantine theme toggle)
- [ ] Breadcrumb navigation on detail and form pages
- [ ] Page titles and meta tags
- [ ] Favicon update (replace Vite default)
- [ ] Empty state illustrations
- [ ] Success/error animations

### 11.3 — Performance
- [ ] Lazy loading for all page components (React.lazy + Suspense)
- [ ] React Query caching strategy (staleTime, cacheTime per resource)
- [ ] Bundle analysis and code splitting
- [ ] Image optimization

### 11.4 — Deployment Configuration
- [ ] Environment variables: `VITE_API_BASE_URL` for backend URL
- [ ] Production build: `npm run build`
- [ ] Vite proxy for development (avoid CORS issues in dev)
- [ ] Docker setup (optional): Dockerfile for frontend
- [ ] CI/CD pipeline (optional): build + lint + type-check

### 11.5 — Documentation
- [ ] Update README with setup instructions
- [ ] Document environment variables
- [ ] Document available scripts
- [ ] API endpoint reference for frontend developers

**Deliverable:** Polished, responsive, production-ready application.

---

## Page Completion Tracker

Use this table to track individual page completion status:

| # | Page | Phase | Status |
|---|------|-------|--------|
| 1 | Login Page | 1 | ⬜ |
| 2 | Dashboard Page | 1 | ⬜ |
| 3 | Hub List Page | 2 | ⬜ |
| 4 | Hub Detail Page | 2 | ⬜ |
| 5 | Hub Form Page (Create/Edit) | 2 | ⬜ |
| 6 | Warehouse List Page | 3 | ⬜ |
| 7 | Warehouse Detail Page | 3 | ⬜ |
| 8 | Warehouse Form Page (Create/Edit) | 3 | ⬜ |
| 9 | Store List Page | 4 | ⬜ |
| 10 | Store Form Page (Create/Edit) | 4 | ⬜ |
| 11 | Stack List Page | 4 | ⬜ |
| 12 | Stack Form Page (Create/Edit) | 4 | ⬜ |
| 13 | Stock Balance Page | 5 | ⬜ |
| 14 | GRN List Page | 6 | ⬜ |
| 15 | GRN Create Page | 6 | ⬜ |
| 16 | GRN Detail Page | 6 | ⬜ |
| 17 | GIN List Page | 7 | ⬜ |
| 18 | GIN Create Page | 7 | ⬜ |
| 19 | GIN Detail Page | 7 | ⬜ |
| 20 | Inspection List Page | 8 | ⬜ |
| 21 | Inspection Create Page | 8 | ⬜ |
| 22 | Inspection Detail Page | 8 | ⬜ |
| 23 | Waybill List Page | 9 | ⬜ |
| 24 | Waybill Create Page | 9 | ⬜ |
| 25 | Waybill Detail Page | 9 | ⬜ |

**Total: 25 pages across 9 build phases + 2 integration/polish phases**

---

## Notes

### Backend Dependencies (cats_core gem)
The `cats_core` gem provides models used as foreign keys across the warehouse system:
- `Cats::Core::Location` — Used by Hub, Warehouse (location_id)
- `Cats::Core::Commodity` — Used by Stack, GRN/GIN items, Inspection items, Waybill items
- `Cats::Core::UnitOfMeasure` — Used by Stack, Stock Balance, GRN/GIN items, Waybill items
- `Cats::Core::User` — Used by GRN (received_by, approved_by), GIN (issued_by, approved_by), Inspection (inspector)
- `Cats::Core::Transporter` — Used by Waybill Transport
- `Cats::Core::Dispatch` — Used by Waybill (dispatch_id)

If `cats_core` endpoints are not exposed, dropdown data for these entities may need to come from the seed data or new endpoints may need to be added to the backend.

### Request Payload Format
All create/update requests use the `payload` key:
```json
{
  "payload": {
    "name": "...",
    "code": "...",
    "items": [{ "commodity_id": 1, "quantity": 100 }]
  }
}
```

### Response Format
All responses follow:
```json
{
  "success": true,
  "data": { ... }
}
```
Or on error:
```json
{
  "success": false,
  "error": { "message": "...", "details": [...] }
}
```
