# Warehouse Automated Reports Module

## 1. Overview

This document outlines the automated reporting system for the CATS Warehouse Management System. The reporting module provides real-time visibility into stock balances, losses, distributions, and enables business users to generate custom reports without requiring code changes.

### 1.1 Current State

| Report | Status | Implementation |
|--------|--------|----------------|
| Bin Card Report | ✅ Implemented | `reports_controller.rb#bin_card` |
| Stock Balances | ✅ Implemented | `stock_balances_controller.rb` |
| Commodity Status Report (CSR) | ❌ Missing | Planned |
| Losses & Adjustments Report | ❌ Missing | Planned |
| User-Defined Query Reports | ❌ Missing | Planned |

### 1.2 Report Categories

| Category | Description |
|----------|-------------|
| **Operational Reports** | Day-to-day inventory visibility (Bin Card, Stock Balance) |
| **Analytical Reports** | Trend analysis and insights (CSR, Losses) |
| **Custom Reports** | User-defined queries with flexible filters |

---

## 2. Report Types

### 2.1 Commodity Status Report (CSR)

**Purpose**: Provide a comprehensive summary of all commodities showing current status, quantity, and expiry information.

**Description**: 
The CSR report aggregates commodity data across all warehouses, showing current status, available quantities, and expiry tracking. This enables warehouse managers to quickly identify:
- Commodities approaching expiration (BUBD)
- Commodities with quality issues
- Stock levels by location

**Data Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `commodity_id` | integer | Unique commodity identifier |
| `commodity_code` | string | Commodity code (e.g., "CSB-001") |
| `commodity_name` | string | Full commodity name |
| `warehouse_id` | integer | Warehouse identifier |
| `warehouse_name` | string | Warehouse name |
| `store_id` | integer | Store identifier |
| `store_name` | string | Store name |
| `total_quantity` | decimal | Total quantity across all lots |
| `unit_name` | string | Unit of measure |
| `commodity_status` | enum | Good, Damaged, Expired |
| `earliest_expiry` | date | Earliest expiry date among lots |
| `days_until_expiry` | integer | Days until earliest expiry |
| `last_movement_date` | date | Date of last stock movement |

**Filters**:
| Filter | Type | Required | Description |
|--------|------|----------|-------------|
| `warehouse_id` | integer | No | Filter by specific warehouse |
| `store_id` | integer | No | Filter by specific store |
| `commodity_id` | integer | No | Filter by specific commodity |
| `status` | string | No | Filter by commodity status |
| `expiry_within_days` | integer | No | Commodities expiring within N days |
| `include_zero_balance` | boolean | No | Include commodities with zero stock |

**Example API Call**:
```
GET /cats_warehouse/v1/reports/csr?warehouse_id=1&expiry_within_days=30
```

**Example Response**:
```json
{
  "data": [
    {
      "id": 1,
      "commodity_code": "CSB-001",
      "commodity_name": "Corn Soya Blend",
      "warehouse_name": "Addis Warehouse",
      "store_name": "Store A",
      "total_quantity": 5000,
      "unit_name": "MT",
      "commodity_status": "Good",
      "earliest_expiry": "2026-06-15",
      "days_until_expiry": 72,
      "last_movement_date": "2026-04-01"
    }
  ],
  "meta": {
    "total_records": 15,
    "total_quantity_by_status": {
      "Good": 45000,
      "Damaged": 500,
      "Expired": 0
    }
  }
}
```

---

### 2.2 Stock Balance Report

**Purpose**: Provide a detailed snapshot of current inventory levels across the warehouse hierarchy.

**Description**:
The Stock Balance Report shows current stock levels organized by warehouse → store → stack hierarchy, with support for filtering by commodity and lot.

**Data Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `warehouse_id` | integer | Warehouse identifier |
| `warehouse_code` | string | Warehouse code |
| `warehouse_name` | string | Warehouse name |
| `store_id` | integer | Store identifier |
| `store_code` | string | Store code |
| `store_name` | string | Store name |
| `stack_id` | integer | Stack identifier |
| `stack_code` | string | Stack code |
| `commodity_id` | integer | Commodity identifier |
| `commodity_name` | string | Commodity name |
| `lot_id` | integer | Lot identifier |
| `batch_no` | string | Batch number |
| `expiry_date` | date | Lot expiry date |
| `quantity` | decimal | Current quantity |
| `reserved_quantity` | decimal | Quantity reserved for orders |
| `available_quantity` | decimal | Quantity minus reservations |
| `unit_name` | string | Unit of measure |
| `commodity_status` | string | Quality status |
| `last_updated` | datetime | Last modification timestamp |

**Filters**:
| Filter | Type | Required | Description |
|--------|------|----------|-------------|
| `warehouse_id` | integer | No | Filter by warehouse |
| `store_id` | integer | No | Filter by store |
| `stack_id` | integer | No | Filter by stack |
| `commodity_id` | integer | No | Filter by commodity |
| `lot_id` | integer | No | Filter by specific lot |
| `include_zero_balance` | boolean | No | Include stacks with zero stock |
| `show_reserved_only` | boolean | No | Show only reserved quantities |

**Example API Call**:
```
GET /cats_warehouse/v1/reports/stock_balance?warehouse_id=1&include_zero_balance=false
```

**Example Response**:
```json
{
  "data": [
    {
      "warehouse_code": "WH-ADD-001",
      "warehouse_name": "Addis Central Warehouse",
      "store_code": "ST-A-001",
      "store_name": "Store A",
      "stack_code": "ST-A-001-S01",
      "commodity_name": "Wheat",
      "batch_no": "WHT-2026-001",
      "expiry_date": "2027-01-15",
      "quantity": 2500,
      "reserved_quantity": 500,
      "available_quantity": 2000,
      "unit_name": "MT",
      "commodity_status": "Good"
    }
  ],
  "summary": {
    "total_warehouses": 3,
    "total_stores": 12,
    "total_quantity": 125000,
    "total_reserved": 15000,
    "total_available": 110000
  }
}
```

---

### 2.3 Bin Card Report (Existing)

**Purpose**: Track all stock movements for a specific stack or store over a time period.

**Description**:
The Bin Card Report provides a transaction history showing all inbound, outbound, and adjustment movements for inventory tracking and auditing.

**Status**: Already implemented at `GET /cats_warehouse/v1/reports/bin_card`

**Current Implementation**:
- Endpoint: `reports_controller.rb#bin_card`
- Filters: `store_id`, `stack_id`, `from`, `to`
- Returns: StackTransaction records with full context

**Enhancements Planned**:
- Add `commodity_id` filter
- Add `movement_type` filter (inbound/outbound/adjustment)
- Add pagination support
- Add running balance calculation per lot

---

### 2.4 Losses & Adjustments Report

**Purpose**: Track all inventory adjustments and discrepancies for auditing and loss prevention.

**Description**:
The Losses & Adjustments Report captures all positive and negative inventory movements that are not part of standard receipt/dispatch workflows. This includes:
- Physical count corrections
- Damage write-offs
- Theft/loss记录
- Quality-based reductions

**Data Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `adjustment_id` | integer | Unique adjustment identifier |
| `adjustment_date` | date | Date of adjustment |
| `warehouse_id` | integer | Warehouse identifier |
| `warehouse_name` | string | Warehouse name |
| `store_id` | integer | Store identifier |
| `store_name` | string | Store name |
| `stack_id` | integer | Stack identifier |
| `stack_code` | string | Stack code |
| `commodity_id` | integer | Commodity identifier |
| `commodity_name` | string | Commodity name |
| `batch_no` | string | Batch number |
| `quantity_before` | decimal | Quantity before adjustment |
| `quantity_after` | decimal | Quantity after adjustment |
| `adjustment_amount` | decimal | Net change (+/-) |
| `unit_name` | string | Unit of measure |
| `reason_for_adjustment` | string | Adjustment reason |
| `reference_type` | string | Related document type |
| `reference_no` | string | Related document number |
| `created_by_id` | integer | User who created adjustment |
| `created_by_name` | string | User full name |
| `created_at` | datetime | Timestamp of creation |

**Filters**:
| Filter | Type | Required | Description |
|--------|------|----------|-------------|
| `from_date` | date | No | Start of date range |
| `to_date` | date | No | End of date range |
| `warehouse_id` | integer | No | Filter by warehouse |
| `store_id` | integer | No | Filter by store |
| `commodity_id` | integer | No | Filter by commodity |
| `reason` | string | No | Filter by reason |
| `created_by_id` | integer | No | Filter by user |
| `adjustment_type` | enum | No | positive, negative, or all |
| `min_amount` | decimal | No | Minimum adjustment amount |
| `max_amount` | decimal | No | Maximum adjustment amount |

**Example API Call**:
```
GET /cats_warehouse/v1/reports/losses?from_date=2026-01-01&to_date=2026-04-01&adjustment_type=negative
```

**Example Response**:
```json
{
  "data": [
    {
      "adjustment_id": 42,
      "adjustment_date": "2026-03-15",
      "warehouse_name": "Addis Central",
      "store_name": "Store B",
      "stack_code": "ST-B-001-S03",
      "commodity_name": "Sorghum",
      "batch_no": "SOR-2025-003",
      "quantity_before": 500,
      "quantity_after": 480,
      "adjustment_amount": -20,
      "unit_name": "MT",
      "reason_for_adjustment": "Damage - Water moisture",
      "created_by_name": "John Doe",
      "created_at": "2026-03-15T14:30:00Z"
    }
  ],
  "summary": {
    "total_adjustments": 25,
    "total_positive": 150,
    "total_negative": -320,
    "net_adjustment": -170,
    "adjustments_by_reason": {
      "Damage - Water moisture": -150,
      "Physical count correction": 100,
      "Quality degradation": -70,
      "Theft/loss": -100
    }
  }
}
```

---

### 2.5 User-Defined Query Reports

**Purpose**: Allow non-technical users to create custom reports by selecting fields and defining filters without requiring code changes.

**Description**:
The Query Builder provides a flexible interface for users to:
- Select which fields to display
- Define filter conditions
- Set sort order
- Save custom report configurations
- Export results

**Query Builder Interface**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Query Builder                                                   │
├─────────────────────────────────────────────────────────────────┤
│  Select Fields:                                                  │
│  [x] Commodity Name    [x] Quantity    [ ] Warehouse             │
│  [x] Batch No         [ ] Expiry      [x] Status               │
│  [ ] Store Name       [ ] Stack Code   [ ] Reserved Qty         │
├─────────────────────────────────────────────────────────────────┤
│  Filters:                                                        │
│  Warehouse: [Addis Central     ▼]                                │
│  Status:    [Good              ▼]                                │
│  Quantity:  [>                ] [1000                        ]   │
│  + Add Filter                                                    │
├─────────────────────────────────────────────────────────────────┤
│  Sort By: [Commodity Name ▼]  Order: [Ascending ▼]              │
├─────────────────────────────────────────────────────────────────┤
│  Preview | Save Report | Export CSV | Export Excel                │
└─────────────────────────────────────────────────────────────────┘
```

**Available Fields for Selection**:
| Field | Type | Filterable | Sortable |
|-------|------|-----------|----------|
| Commodity Code | string | Yes | Yes |
| Commodity Name | string | Yes | Yes |
| Warehouse | string | Yes | Yes |
| Store | string | Yes | Yes |
| Stack | string | Yes | Yes |
| Batch No | string | Yes | Yes |
| Expiry Date | date | Yes | Yes |
| Quantity | decimal | Yes | Yes |
| Reserved Qty | decimal | Yes | Yes |
| Available Qty | decimal | Yes | Yes |
| Status | enum | Yes | Yes |
| Last Movement | date | Yes | Yes |

**Filter Operators**:
| Operator | Applicable Types | Example |
|----------|-----------------|---------|
| equals | string, number, date | status = "Good" |
| not equals | string, number, date | status != "Damaged" |
| contains | string | name contains "Wheat" |
| starts with | string | code starts with "CSB" |
| ends with | string | batch ends with "2026" |
| greater than | number, date | quantity > 100 |
| less than | number, date | expiry < 2026-07-01 |
| between | number, date | quantity between 100 and 500 |
| in | string, number | warehouse in ["Addis", "Bahir"] |
| is empty | string, date | expiry is empty |
| is not empty | string, date | batch is not empty |

**Saved Report Configuration Schema**:
```json
{
  "name": "Monthly Wheat Stock",
  "description": "Wheat stock levels by warehouse",
  "created_by": 5,
  "created_at": "2026-04-01T10:00:00Z",
  "fields": ["commodity_name", "warehouse", "quantity", "status"],
  "filters": [
    { "field": "commodity_name", "operator": "contains", "value": "Wheat" }
  ],
  "sort": { "field": "warehouse", "direction": "asc" },
  "is_public": true
}
```

---

## 3. API Endpoints

### 3.1 Endpoint Summary

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/reports/csr` | GET | Commodity Status Report | Yes |
| `/reports/stock_balance` | GET | Stock Balance Report | Yes |
| `/reports/bin_card` | GET | Bin Card Report | Yes |
| `/reports/losses` | GET | Losses & Adjustments | Yes |
| `/reports/query` | POST | User-defined query | Yes |
| `/reports/saved` | GET | List saved reports | Yes |
| `/reports/saved` | POST | Save a report config | Yes |
| `/reports/saved/:id` | GET | Get saved report | Yes |
| `/reports/saved/:id` | DELETE | Delete saved report | Yes |

### 3.2 Common Response Format

All report endpoints return a consistent response format:

```json
{
  "data": [...],
  "meta": {
    "total_records": 150,
    "page": 1,
    "per_page": 50,
    "total_pages": 3
  },
  "filters_applied": {
    "warehouse_id": 1,
    "status": "Good"
  },
  "generated_at": "2026-04-04T12:00:00Z",
  "generated_by": "system"
}
```

### 3.3 Pagination

All list endpoints support pagination:

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `page` | 1 | - | Page number |
| `per_page` | 50 | 500 | Records per page |

---

## 4. Frontend Pages

### 4.1 Report Navigation

All reports accessible from: **Reports** menu item in sidebar

```
Reports
├── Dashboard
├── Commodity Status (CSR)
├── Stock Balance
├── Bin Card
├── Losses & Adjustments
├── Query Builder
└── Saved Reports
```

### 4.2 Page Specifications

#### CSR Page (`/reports/csr`)

**Layout**:
- Header with report title and description
- Filter bar (collapsible)
- Summary cards (total commodities, by status)
- Data table with sorting
- Export buttons

**Filters**:
- Warehouse (dropdown)
- Store (dependent dropdown)
- Commodity (searchable dropdown)
- Status (multi-select)
- Expiry within days (number input)

#### Stock Balance Page (`/reports/stock-balance`)

**Layout**:
- Hierarchical view: Warehouse → Store → Stack
- Expandable/collapsible sections
- Quantity badges
- Status indicators

**Features**:
- Drill-down navigation
- Inline editing disabled (read-only)
- Export per level

#### Losses Page (`/reports/losses`)

**Layout**:
- Date range selector (default: current month)
- Filter sidebar
- Summary statistics cards
- Timeline visualization
- Detailed table

**Summary Cards**:
- Total adjustments
- Net loss/gain
- Top reasons for adjustment

#### Query Builder Page (`/reports/builder`)

**Layout**:
- Field selector (checkbox grid)
- Filter builder (dynamic rows)
- Live preview panel
- Save/export actions

**Features**:
- Drag-and-drop field ordering
- Real-time SQL preview
- Save as template
- Share with team

---

## 5. Database Schema

### 5.1 New Tables Required

#### Saved Reports Table

```sql
CREATE TABLE cats_warehouse_saved_reports (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id INTEGER NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  configuration JSONB NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_saved_reports_user ON cats_warehouse_saved_reports(user_id);
CREATE INDEX idx_saved_reports_type ON cats_warehouse_saved_reports(report_type);
```

#### Report Audit Log (Optional Enhancement)

```sql
CREATE TABLE cats_warehouse_report_audit (
  id SERIAL PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL,
  parameters JSONB,
  user_id INTEGER NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INTEGER,
  records_returned INTEGER
);
```

### 5.2 Existing Tables Used

| Table | Usage |
|-------|-------|
| `cats_warehouse_stacks` | Stack-level quantity data |
| `cats_warehouse_inventory_lots` | Batch and expiry tracking |
| `cats_warehouse_stock_balances` | Current stock levels |
| `cats_warehouse_inventory_adjustments` | Adjustment records |
| `cats_warehouse_stack_transactions` | Movement history |
| `cats_core_commodities` | Commodity master data |
| `cats_core_users` | User attribution |

---

## 6. Security & Authorization

### 6.1 Role-Based Access

| Role | CSR | Stock Balance | Bin Card | Losses | Query Builder |
|------|-----|---------------|----------|--------|---------------|
| Admin | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| Hub Manager | ✅ Own Hub | ✅ Own Hub | ✅ Own Hub | ✅ Own Hub | ✅ Full |
| Warehouse Manager | ✅ Own WH | ✅ Own WH | ✅ Own WH | ✅ Own WH | ✅ Own WH |
| Storekeeper | ❌ None | ✅ Own Store | ✅ Own Store | ❌ None | ❌ None |
| Officer | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Read |

### 6.2 Data Filtering

All reports automatically filter data based on user's location assignments:
- Warehouse managers see only their assigned warehouse
- Storekeepers see only their assigned store
- Admins see all data

---

## 7. Implementation Tasks

### 7.1 Backend Tasks

| # | Task | Priority | Estimate |
|---|------|----------|----------|
| 1 | Create `ReportService` class | High | 4 hours |
| 2 | Implement CSR endpoint | High | 8 hours |
| 3 | Implement Stock Balance endpoint | High | 6 hours |
| 4 | Enhance Bin Card with new filters | Medium | 4 hours |
| 5 | Implement Losses endpoint | Medium | 8 hours |
| 6 | Implement Query Builder endpoint | Low | 16 hours |
| 7 | Add saved reports CRUD | Low | 8 hours |
| 8 | Create serializers | High | 6 hours |
| 9 | Add authorization policies | High | 4 hours |
| 10 | Write unit tests | High | 12 hours |

**Total Backend Estimate**: ~76 hours

### 7.2 Frontend Tasks

| # | Task | Priority | Estimate |
|---|------|----------|----------|
| 1 | Create CSR page | High | 8 hours |
| 2 | Create Stock Balance page | High | 8 hours |
| 3 | Enhance Bin Card page | Medium | 4 hours |
| 4 | Create Losses page | Medium | 8 hours |
| 5 | Create Query Builder page | Low | 16 hours |
| 6 | Create Saved Reports page | Low | 6 hours |
| 7 | Add export functionality | Medium | 8 hours |
| 8 | Add shared report components | Medium | 6 hours |
| 9 | Add report navigation | Low | 4 hours |
| 10 | Write integration tests | Medium | 8 hours |

**Total Frontend Estimate**: ~76 hours

---

## 8. Testing Plan

### 8.1 Unit Tests

Each report endpoint must have tests covering:
- Successful data retrieval
- Filter combinations
- Authorization constraints
- Edge cases (empty results, invalid params)
- Pagination

### 8.2 Integration Tests

| Scenario | Expected Result |
|----------|-----------------|
| CSR with warehouse filter | Only that warehouse's commodities |
| Stock Balance with zero balance | Includes/excludes per param |
| Losses with date range | Only adjustments in range |
| Query with multiple filters | Correct AND/OR logic |
| Unauthorized user access | 403 Forbidden |

### 8.3 Performance Tests

| Metric | Target |
|--------|--------|
| CSR response time | < 2 seconds |
| Stock Balance response time | < 3 seconds |
| Losses with 1-year range | < 5 seconds |
| Query Builder preview | < 1 second |

---

## 9. Acceptance Criteria

| # | Criteria | Verification |
|---|----------|---------------|
| 1 | All 5 reports accessible from frontend | Manual testing |
| 2 | Reports filterable by warehouse, store, commodity | Integration tests |
| 3 | Date range filtering works for all time-based reports | Unit tests |
| 4 | Export to CSV available for all reports | Manual testing |
| 5 | Role-based access control enforced | Security tests |
| 6 | Saved reports persist across sessions | Integration tests |
| 7 | Query Builder produces correct results | Unit tests |
| 8 | Performance meets targets under load | Performance tests |
| 9 | Empty states handled gracefully | UI tests |
| 10 | Error states display meaningful messages | UI tests |

---

## 10. Future Enhancements

| Feature | Priority | Description |
|---------|----------|-------------|
| Scheduled Reports | Medium | Auto-email reports daily/weekly |
| Dashboard Widgets | Medium | Embed report summaries on dashboard |
| Chart Visualizations | Low | Add charts (bar, line, pie) to reports |
| Drill-through Reports | Low | Click-through from CSR to Stock Balance |
| Mobile Optimization | Low | Responsive report views |
| Print-optimized Layout | Low | Print-friendly CSS |

---

## 11. Dependencies

### External Dependencies
| Dependency | Purpose | Status |
|------------|---------|--------|
| Ruby on Rails | Backend framework | ✅ Available |
| React + TypeScript | Frontend framework | ✅ Available |
| PostgreSQL | Database | ✅ Available |
| ActiveModel Serializers | API serialization | ✅ Available |
| react-query | Data fetching | ✅ Available |

### Internal Dependencies
| Component | Required By |
|-----------|-------------|
| StockBalance model | CSR, Stock Balance |
| StackTransaction model | Bin Card, Losses |
| InventoryAdjustment model | Losses |
| InventoryLot model | All reports |
| Authorization policies | All endpoints |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **BUBD** | Best Use Before Date - expiry tracking metric |
| **CSR** | Commodity Status Report |
| **Lot** | Inventory lot with batch number and expiry date |
| **Stack** | Physical stack location within a store |
| **UOM** | Unit of Measure |
| **Stock Balance** | Current quantity of inventory at a location |

---

*Document Version: 1.0*  
*Last Updated: 2026-04-04*  
*Author: Development Team*
