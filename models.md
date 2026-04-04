# Cats::Warehouse Database Design & Data Models

This document defines the database models for the `Cats::Warehouse` engine. It provides a formal structural blueprint of the system architecture, detailing both existing entities supporting current manual operations, and planned entities intended to introduce order orchestration, traceability, and stock reservations.

---

## 1. Core Facility Models

### Hub

Core geographic grouping for warehouses.
- **Table:** `cats_warehouse_hubs`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `location_id` | `bigint` | Core geographic location |
| `geo_id` | `bigint` | GPS / geo reference |
| `name` | `string` | Hub display name |
| `hub_type` | `string` | Classification |
| `status` | `string` | Operational status |

**Relationships:**
- Belongs to `Location`, `Geo`
- Has many `Warehouses`
- Has one `HubCapacity`, `HubAccess`, `HubInfra`, `HubContacts`

### Warehouse

Operational warehouse facility under a specific hub.
- **Table:** `cats_warehouse_warehouses`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `location_id` | `bigint` | Core geographic location |
| `hub_id` | `bigint` | Owning hub |
| `geo_id` | `bigint` | GPS / geo reference |
| `name` | `string` | Warehouse name |
| `managed_under` | `string` | Management context |
| `ownership_type` | `string` | Self-owned vs rental |

**Relationships:**
- Belongs to `Location`, `Hub`, `Geo`
- Has many `Stores`, `StockBalances`, `Grns`, `Gins`, `Inspections`
- Has one `WarehouseCapacity`, `WarehouseAccess`, `WarehouseInfra`, `WarehouseContacts`

### Store

Physical or logical division within a warehouse (e.g., shed, tent, or bay).
- **Table:** `cats_warehouse_stores`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `warehouse_id` | `bigint` | Parent warehouse |
| `name` | `string` | Store name |
| `length` | `float` | Physical length |
| `width` | `float` | Physical width |
| `height` | `float` | Physical height |
| `usable_space` | `float` | Computed usable volume |
| `available_space` | `float` | Current available volume |
| `temporary` | `boolean` | Temporary storage flag |

**Relationships:**
- Belongs to `Warehouse`
- Has many `Stacks`, `StockBalances`

### Stack

Specific delineated area inside a store where commodities are piled.
- **Table:** `cats_warehouse_stacks`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `store_id` | `bigint` | Parent store |
| `commodity_id` | `bigint` | Commodity type stored here |
| `unit_id` | `bigint` | Current unit of measure |
| `length`, `width`, `height` | `float` | Stack dimensions |
| `commodity_status` | `string` | Condition (e.g., Good, Damaged) |
| `stack_status` | `string` | Operational status |
| `quantity` | `float` | Current quantity on hand |

**Relationships:**
- Belongs to `Store`, `Commodity`, `Unit`
- Has many `StockBalances`

---

## 2. Inventory ledger

### StockBalance

Rollup snapshot of stock on hand at different dimensions (warehouse, store, stack, lot).
- **Table:** `cats_warehouse_stock_balances`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `warehouse_id` | `bigint` | Required warehouse context |
| `store_id`, `stack_id` | `bigint` | Optional deep location context |
| `commodity_id` | `bigint` | Valid commodity |
| `unit_id` | `bigint` | Unit of measure |
| `quantity` | `float` | Positive numeric balance |
| `inventory_lot_id` | `bigint` | (Planned) Nullable tracked lot |
| `reserved_quantity` | `float` | (Planned) Reserved quantity |
| `available_quantity` | `float` | (Planned) Available derived quantity |

### StackTransaction

Immutable ledger entry representing historical movement of stock in/out of a location.
- **Table:** `cats_warehouse_stack_transactions`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `source_id` | `bigint` | Source stack |
| `destination_id` | `bigint` | Destination stack |
| `unit_id` | `bigint` | UoM for the movement |
| `reference_type`, `reference_id`| `poly` | Target document (GRN, GIN, etc.) |
| `transaction_date` | `date` | Effective movement date |
| `quantity` | `float` | Always absolute positive |
| `inventory_lot_id` | `bigint` | (Planned) Tracked lot |

### InventoryLot (Planned)

Batch and expiry traceability layer.
- **Table:** `cats_warehouse_inventory_lots`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `warehouse_id` | `bigint` | Owning warehouse |
| `commodity_id` | `bigint` | Traced commodity |
| `batch_no` | `string` | External/internal batch no |
| `expiry_date` | `date` | Lot shelf-life end |
| `status` | `string` | Lifecycle (Active, Expired, Quarantined) |

### UomConversion (Planned)

Handles custom multi-unit of measure conversions.
- **Table:** `cats_warehouse_uom_conversions`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `commodity_id` | `bigint` | Optional specific context |
| `from_unit_id` | `bigint` | Source unit |
| `to_unit_id` | `bigint` | Base standard unit |
| `multiplier` | `decimal` | Ratio representation |
| `active` | `boolean` | Flag |

---

## 3. Inbound Flow

### ReceiptOrder (Planned)

Orchestrating intent-to-receive header. Replaces legacy `ReceiptAdvice`.
- **Table:** `cats_warehouse_receipt_orders`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `reference_no` | `string` | Ext. order number |
| `source_type` | `string` | Origin type (Purchase, Transfer) |
| `expected_arrival_date` | `date` | Due date |
| `status` | `string` | State (Draft, Confirmed, Completed) |

**Relationships:**
- Has many `ReceiptOrderLines`, `Grns`, `SpaceReservations`

### ReceiptOrderLine (Planned)

Detailed plan for incoming commodities.
- **Table:** `cats_warehouse_receipt_order_lines`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `receipt_order_id` | `bigint` | Parent Order |
| `commodity_id`, `unit_id` | `bigint` | Planned item |
| `planned_quantity` | `float` | Base expected quantity |
| `received_quantity` | `float` | Accumulated received qty |
| `batch_required` | `boolean` | Should capture lot data? |
| `expiry_required`| `boolean` | Should capture expiry? |

**Relationships:**
- Belongs to `ReceiptOrder`

### Grn (Goods Receiving Note)

Execution document capturing physical inbound flow.
- **Table:** `cats_warehouse_grns`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `warehouse_id` | `bigint` | Intake facility |
| `source_type`, `source_id`| `poly` | Originator reference |
| `reference_no` | `string` | Document number |
| `received_by_id` | `bigint` | Storekeeper |
| `status` | `string` | State (Draft, Confirmed) |
| `receipt_order_id`| `bigint` | (Planned) Traceability to plan |

**Relationships:**
- Has many `GrnItems`
- Belongs to `ReceiptOrder` (Planned)

### GrnItem

Line-level detail for the execution.
- **Table:** `cats_warehouse_grn_items`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `grn_id` | `bigint` | Parent GRN |
| `commodity_id`, `unit_id` | `bigint` | Executed context |
| `store_id`, `stack_id` | `bigint` | Put-away location |
| `quantity` | `float` | Actual stock intake count |
| `inventory_lot_id`| `bigint` | (Planned) Allocated lot at intake |

---

## 4. Outbound Flow

### DispatchOrder (Planned)

Orchestrating intent-to-issue header.
- **Table:** `cats_warehouse_dispatch_orders`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `reference_no` | `string` | Ext. reference |
| `status` | `string` | State |
| `expected_dispatch_date` | `date` | Due date |

**Relationships:**
- Has many `DispatchOrderLines`, `Gins`, `Waybills`, `StockReservations`

### DispatchOrderLine (Planned)

Detailed plan for outgoing commodities.
- **Table:** `cats_warehouse_dispatch_order_lines`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `dispatch_order_id` | `bigint` | Parent order |
| `commodity_id`, `unit_id` | `bigint` | Planned Item |
| `planned_quantity` | `float` | Requested |
| `issued_quantity` | `float` | Fulfilled so far |
| `requested_lot_id`| `bigint` | Preferential fulfillment request |

### Gin (Goods Issue Note)

Execution document for formal inventory removal/issue.
- **Table:** `cats_warehouse_gins`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `warehouse_id` | `bigint` | Issuing location |
| `destination_type`/`id` | `poly` | Destination reference |
| `issued_by_id` | `bigint` | Initiator |
| `status` | `string` | Lifecycle |
| `dispatch_order_id` | `bigint` | (Planned) Order origin |

**Relationships:**
- Has many `GinItems`

### GinItem

Line-level fulfilled issue count.
- **Table:** `cats_warehouse_gin_items`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `gin_id` | `bigint` | Parent GIN |
| `commodity_id`, `unit_id` | `bigint` | Item configuration |
| `store_id`, `stack_id` | `bigint` | Pick location |
| `quantity` | `float` | Amount dispensed |
| `inventory_lot_id`| `bigint` | (Planned) Lot picked |

### Waybill

Logistics transportation document.
- **Table:** `cats_warehouse_waybills`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `dispatch_id` | `bigint` | Core Dispatch connection |
| `source_location_id` | `bigint` | Source tracking |
| `destination_location_id`| `bigint` | Target tracking |
| `reference_no` | `string` | Number |
| `dispatch_order_id` | `bigint` | (Planned) Connected flow |

**Relationships:**
- Has many `WaybillItems`

### WaybillItem (New)

Line-level detail defining transported items linked to the waybill.
- **Table:** `cats_warehouse_waybill_items`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `waybill_id` | `bigint` | Parent Waybill |
| `commodity_id` | `bigint` | Traced commodity |
| `unit_id` | `bigint` | Associated unit |
| `quantity` | `float` | Goods quantities transported |

### WaybillTransport (New)

Carrier and vehicular transport particulars attached to a Waybill.
- **Table:** `cats_warehouse_waybill_transports`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `waybill_id` | `bigint` | Parent Waybill reference |
| `transporter_id` | `bigint` | Courier / transport agency |
| `driver_name` | `string` | Logged driver details |
| `plate_no` | `string` | License plate details |

---

## 5. Operations & Workflows

### Inspection

Quality control document for receipts or random audits.
- **Table:** `cats_warehouse_inspections`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `warehouse_id` | `bigint` | Audited facility |
| `inspector_id` | `bigint` | Authenticated audit officer |
| `status` | `string` | State |
| `receipt_order_id`| `bigint` | (Planned) Pre-receiving inspection |

**Relationships:**
- Has many `InspectionItems`

### InspectionItem (New)

Details out the expected quantities vs accepted/rejected counts.
- **Table:** `cats_warehouse_inspection_items`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `inspection_id` | `bigint` | Parent inspection document |
| `commodity_id` | `bigint` | Target commodity |
| `unit_id` | `bigint` | Used unit |
| `quantity` | `float` | Base expected/inspected size |
| `accepted_quantity` | `float` | Standard validated size |
| `rejected_quantity` | `float` | Sub-standard size |
| `remarks` | `text` | Assessment notes |

### StockReservation (Planned)

Soft-locking available stock before formal issue.
- **Table:** `cats_warehouse_stock_reservations`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `dispatch_order_id`| `bigint` | Triggers reservation |
| `warehouse_id` | `bigint` | Target facility |
| `reserved_quantity`| `float` | Amount to earmark |
| `issued_quantity` | `float` | Fulfilled chunk of reservation|

### SpaceReservation (Planned)

Capacity reservation handling for incoming cargo.
- **Table:** `cats_warehouse_space_reservations`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `receipt_order_id`| `bigint` | Expected order source |
| `warehouse_id` | `bigint` | Facility reserved against |
| `reserved_volume`| `float` | Approximate area allocated |

### WorkflowEvent (Planned)

Entity generic state-machine logging pattern.
- **Table:** `cats_warehouse_workflow_events`

**Attributes:**
| Field | Type | Description |
|---|---|---|
| `entity_type`/`id`| `poly` | Audited target |
| `event_type` | `string` | Enum Action Name |
| `from_status` | `string` | Past state |
| `to_status` | `string` | Current state |
| `payload` | `jsonb` | Context dump |
