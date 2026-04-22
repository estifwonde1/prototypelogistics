# WMS Implementation Roadmap

## Summary
This roadmap adds officer-driven orchestration, richer workflow states, lot/expiry/UOM traceability, and a reservation/allocation layer **inside the existing `Cats::Warehouse` engine**. It preserves the current facility model (`Hub -> Warehouse -> Store -> Stack`), reuses `InventoryLedger`, `DocumentLifecycle`, existing GRN/GIN/Inspection/Waybill controllers/services, and introduces only additive schema/API changes. Intended output file: `end to end.md` at repo root.

Important public additions across phases:
- New warehouse orchestration APIs for `receipt_orders` and `dispatch_orders`
- New workflow states for order execution and selected documents
- New lot/UOM-aware fields on stock and document items
- New assignment and reservation endpoints for managers/store keepers
- Existing GRN/GIN/Inspection/Waybill endpoints remain valid and backward compatible

## Phase 1

### Objective
Introduce officer-driven receipt and dispatch order orchestration with draft/confirm workflow, role visibility, and first-class officer UI, while keeping current GRN/GIN/Inspection/Waybill behavior unchanged.

### Backend Changes

#### Models
Add:
- `Cats::Warehouse::ReceiptOrder`
- `Cats::Warehouse::ReceiptOrderLine`
- `Cats::Warehouse::DispatchOrder`
- `Cats::Warehouse::DispatchOrderLine`

Modify:
- `ContractConstants` and `DocumentLifecycle` to support additional statuses while preserving `Draft` and `Confirmed`
- `AccessContext`, policies, and scoped queries to add `Officer` as a warehouse-wide role
- Existing document models only enough to link optionally back to `receipt_order` / `dispatch_order`

#### Services
Add:
- `ReceiptOrderCreator`
- `ReceiptOrderConfirmer`
- `DispatchOrderCreator`
- `DispatchOrderConfirmer`

Extend:
- `WarehouseModule` seeding/role lookup so `Officer` is a valid warehouse-module role
- Existing notification delivery to support order confirmation notifications to hub/warehouse managers

#### APIs
Add:
- `GET/POST /cats_warehouse/v1/receipt_orders`
- `GET /cats_warehouse/v1/receipt_orders/:id`
- `POST /cats_warehouse/v1/receipt_orders/:id/confirm`
- `GET/POST /cats_warehouse/v1/dispatch_orders`
- `GET /cats_warehouse/v1/dispatch_orders/:id`
- `POST /cats_warehouse/v1/dispatch_orders/:id/confirm`

Modify:
- Auth response and frontend role handling to include `Officer`
- Reference-data endpoints only if needed to supply source type choices and commodity/unit defaults for orders

#### Database
Migrations:
- create `cats_warehouse_receipt_orders`
- create `cats_warehouse_receipt_order_lines`
- create `cats_warehouse_dispatch_orders`
- create `cats_warehouse_dispatch_order_lines`
- add nullable `receipt_order_id` to `cats_warehouse_inspections` and `cats_warehouse_grns`
- add nullable `dispatch_order_id` to `cats_warehouse_waybills` and `cats_warehouse_gins`

Indexes:
- order status indexes
- foreign keys on order header/detail
- optional links from docs back to order headers

Backward compatibility:
- all new links are nullable
- existing GRN/GIN/Inspection/Waybill records remain valid without orders
- existing document create/confirm endpoints remain unchanged

### Frontend Changes

#### Pages
Add:
- Officer receipt order list/create/detail pages
- Officer dispatch order list/create/detail pages
- Officer dashboard page in current app shell

Modify:
- `LoginPage` role normalization for `Officer`
- `Sidebar` and router to expose officer pages
- `DashboardPage` into officer/global operations entry point
- `ReceiptListPage` and `DispatchListPage` to show linked warehouse order reference when present

Keep:
- Existing GRN, GIN, Inspection, Waybill, Stock, Warehouse, Store, Stack pages

#### Components / UX
- Reuse current document-form style for order create pages: header card + multi-line item table
- Order detail pages show `Draft` / `Confirmed` state, source/destination lines, and linked downstream documents
- Officer dashboard shows hubs, warehouses, independent warehouses, stock summary, inbound/outbound counts, and operational alerts from existing datasets plus order counts
- No redesign of app shell; officer uses the same Mantine layout and route guards

### Frontend Testable Checkpoint ✅
- Login as Officer -> see Officer dashboard and order menus
- Create receipt order as draft -> view it in detail -> confirm it
- Create dispatch order as draft -> view it in detail -> confirm it
- Login as Hub Manager / Warehouse Manager -> see confirmed orders in scoped lists or linked views
- Existing GRN, GIN, Inspection, Waybill flows still work unchanged

### Expected System Behavior
New:
- Officer can create and confirm warehouse receipt/dispatch intents
- Orders exist as orchestrating records inside `Cats::Warehouse`
- Role model now includes `Officer`

Still limited:
- No lot/UOM traceability yet
- No assignment/reservation execution yet
- No automatic GRN/GIN generation yet

## Phase 2

### Objective
Add inventory traceability through lot/expiry and multi-UOM support, and make existing stock/document flows lot-aware without breaking legacy stock.

### Backend Changes

#### Models
Add:
- `Cats::Warehouse::InventoryLot`
- `Cats::Warehouse::UomConversion`

Modify:
- `StockBalance`
- `StackTransaction`
- `Stack`
- `GrnItem`
- `GinItem`
- `WaybillItem`
- optionally `InspectionItem` for accepted/rejected quantity traceability
- `Cats::Core::Commodity` only add optional base-tracking metadata if needed

#### Services
Add:
- `InventoryLotResolver`
- `UomConversionResolver`

Extend:
- `InventoryLedger` to accept `inventory_lot_id`, `entered_unit_id`, `base_unit_id`, `base_quantity`
- `GrnCreator` / `GrnConfirmer` to create or attach lots on receipt
- `GinCreator` / `GinConfirmer` to issue against selected lot/base quantity
- `WaybillCreator` to carry selected lot/UOM data forward
- `ReferenceDataController` to return lot- and UOM-aware reference payloads

#### APIs
Add:
- `GET /cats_warehouse/v1/reference_data/lots`
- `GET /cats_warehouse/v1/reference_data/uom_conversions`

Modify:
- `POST /grns` and `GET /grns/:id` to accept/return lot, expiry, entered/base UOM fields
- `POST /gins` and `GET /gins/:id` similarly
- `POST /waybills` and `GET /waybills/:id` similarly
- `GET /stock_balances` and `GET /reports/bin_card` to include lot and UOM columns

#### Database
Migrations:
- create `cats_warehouse_inventory_lots`
- create `cats_warehouse_uom_conversions`
- add nullable `inventory_lot_id`, `entered_unit_id`, `base_unit_id`, `base_quantity` to GRN/GIN/Waybill item tables
- add nullable `inventory_lot_id`, `base_unit_id`, `base_quantity` to `cats_warehouse_stock_balances`
- add nullable `inventory_lot_id`, `entered_unit_id`, `base_unit_id`, `base_quantity` to `cats_warehouse_stack_transactions`
- optionally add nullable `inventory_lot_id` to `cats_warehouse_stacks`

Indexes:
- `(warehouse_id, commodity_id, batch_no, expiry_date)` on lots
- lot foreign key indexes on stock and document items

Backward compatibility:
- all new columns nullable
- legacy balances continue to work with `inventory_lot_id = null`
- if no conversion exists, `base_unit_id` falls back to current `unit_id` and `base_quantity` to current `quantity`
- current commodity `batch_no` and `best_use_before` remain usable as lot defaults

### Frontend Changes

#### Pages
Modify:
- Receipt/dispatch order detail pages to display lot/UOM expectations where entered
- `GrnCreatePage`, `GrnDetailPage`
- `GinCreatePage`, `GinDetailPage`
- `WaybillCreatePage`, `WaybillDetailPage`
- `InspectionCreatePage`, `InspectionDetailPage`
- `StockBalancePage`
- `BinCardReportPage`
- officer dashboard KPIs to include expiring stock and lot-aware stock counts

Keep:
- No new page category required in this phase

#### Components / UX
- Extend existing line-item tables with optional lot, batch, expiry, entered UOM, base quantity columns
- Commodity selection auto-suggests default unit and, on receipt, can create a lot candidate from batch/expiry
- Stock pages show lot-aware filters and badges for expiring stock
- Bin card shows lot, entered unit, base quantity, and source document reference

### Frontend Testable Checkpoint ✅
- Create a receipt order
- Create a GRN linked to that order with batch/expiry and entered unit
- Confirm the GRN -> stock balance and bin card show lot-aware movement
- Create a dispatch order
- Create a GIN from traced stock using selected lot/UOM
- Confirm the GIN -> stock is deducted from the expected lot and reported correctly

### Expected System Behavior
New:
- Stock and movements can be traced by lot/batch/expiry
- Documents can capture entered UOM and normalized/base quantity
- Existing inventory flows become traceability-aware

Still limited:
- Orders are not yet assigned/reserved through a dedicated workflow
- Inspection does not yet auto-generate GRN/GIN
- Officers can orchestrate and trace, but not yet drive end-to-end execution automatically

## Phase 3

### Objective
Add manager/storekeeper assignment and reservation workflow, then automate Inspection -> GRN and Dispatch/Waybill -> GIN execution while preserving manual document flows.

### Backend Changes

#### Models
Add:
- `Cats::Warehouse::ReceiptOrderAssignment`
- `Cats::Warehouse::DispatchOrderAssignment`
- `Cats::Warehouse::StockReservation`
- `Cats::Warehouse::SpaceReservation`
- `Cats::Warehouse::WorkflowEvent`

Modify:
- `ReceiptOrder` and `DispatchOrder` with richer execution states
- `Inspection`
- `Grn`
- `Gin`
- `Waybill`
- `StockBalance` if reservation rollups need cached fields

#### Services
Add:
- `ReceiptOrderAssignmentService`
- `DispatchOrderAssignmentService`
- `StockReservationService`
- `SpaceReservationService`
- `InspectionResultApplier`
- `GrnGeneratorFromInspection`
- `WaybillPreparationService`
- `GinGeneratorFromWaybill`
- `WorkflowEventRecorder`

Extend:
- `InventoryLedger` to account for reserved vs available quantity calculations
- `InspectionCreator` / `InspectionConfirmer` to write back into receipt-order execution and generate GRN drafts
- `WaybillCreator` / `WaybillConfirmer` to prepare outbound execution and generate GIN drafts
- existing confirmers to update linked order statuses and workflow events

#### APIs
Add:
- `POST /receipt_orders/:id/assign`
- `POST /receipt_orders/:id/reserve_space`
- `POST /dispatch_orders/:id/assign`
- `POST /dispatch_orders/:id/reserve_stock`
- `GET /receipt_orders/:id/workflow`
- `GET /dispatch_orders/:id/workflow`

Modify:
- `POST /inspections` and `POST /inspections/:id/confirm` to support order-linked automation
- `POST /waybills` and `POST /waybills/:id/confirm` to support order-linked automation
- `GET /grns/:id` and `GET /gins/:id` to expose generated-from-order/generated-from-inspection/generated-from-waybill metadata

#### Database
Migrations:
- create `cats_warehouse_receipt_order_assignments`
- create `cats_warehouse_dispatch_order_assignments`
- create `cats_warehouse_stock_reservations`
- create `cats_warehouse_space_reservations`
- create `cats_warehouse_workflow_events`
- add nullable generated-from/source metadata where needed on `grns`, `gins`, `waybills`, `inspections`

Indexes:
- order assignment status indexes
- reservation uniqueness by order line + location
- workflow event lookup by entity and created_at

Backward compatibility:
- manual GRN/GIN/Inspection/Waybill creation remains supported
- automation only runs when a linked order/workflow path is present
- reservation records are additive and do not invalidate legacy stock totals

### Frontend Changes

#### Pages
Modify:
- Officer receipt/dispatch order detail pages with `Assignments`, `Reservations`, `Execution`, and `Documents` sections
- Existing GRN/GIN/Inspection/Waybill pages to show generated-from metadata and workflow state
- `WarehouseDetailPage` and `Store`/`Stack` views to show reserved capacity and reserved stock
- `DashboardPage` / officer dashboard to show open assignments, reservations, delays, and generated-doc completion

Keep:
- Existing manual document pages stay available as fallback/manual path

Add:
- No new top-level page category required beyond the order pages added in Phase 1

#### Components / UX
- Hub Manager assigns warehouse from receipt/dispatch order detail page
- Warehouse Manager assigns store/stack and prepares execution
- Store Keeper reserves space or stock from the same workflow page
- Inspection detail can show “Generate GRN Draft” or auto-generated GRN result
- Waybill detail can show “Generate GIN Draft” or auto-generated GIN result
- Timeline/status chip pattern reused everywhere: `Draft -> Confirmed -> Assigned -> Reserved -> In Progress -> Completed`

### Frontend Testable Checkpoint ✅
- Create receipt order -> confirm -> hub manager assigns warehouse -> warehouse manager assigns store/stack -> store keeper reserves space -> create inspection from order -> confirm inspection -> system generates GRN draft -> confirm GRN -> stock updated and workflow marked completed
- Create dispatch order -> confirm -> warehouse manager/store keeper assign and reserve stock -> warehouse manager prepares waybill -> confirm waybill -> system generates GIN draft -> confirm GIN -> stock deducted and workflow marked completed
- Existing manual GRN/GIN creation still works for users with current permissions

### Expected System Behavior
New:
- Full officer-driven execution exists inside `Cats::Warehouse`
- Receipt and dispatch move through assignable, reservable, traceable workflows
- Inspection can generate GRN drafts
- Waybill can generate GIN drafts
- Inventory is traceable by lot and UOM end to end

Still limited:
- No aisle/rack/bin
- No partial fulfillment
- No backorders

## Test Plan
- Regression: all current GRN, GIN, Inspection, Waybill, Stock Balance, Bin Card, Warehouse, Store, Stack, and admin pages continue loading and existing create/confirm flows still succeed
- Role regression: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper keep current access; Officer gains only planned new access
- Data migration: legacy stock and legacy documents render correctly with null order/lot/base-unit fields
- Workflow regression: order-linked automation cannot trigger duplicate stock postings if GRN/GIN is already confirmed
- Traceability: stock movements remain non-negative and transactionally consistent after lot/UOM fields are introduced

## Assumptions
- Chosen default: officer orchestration lives in **new `Cats::Warehouse` order models**, not by repurposing `Cats::Core::Receipt` / `Dispatch`
- Chosen default: **full officer UI** is included in roadmap scope
- `Officer` is added as a warehouse-module role; current admin/superadmin behavior remains unchanged
- Facility scope stays `Hub -> Warehouse -> Store -> Stack` for this roadmap
- Reservation is implemented at store/stack level only in this plan
- Legacy inventory continues to operate with null lot and null base-unit fields until new flows populate them
