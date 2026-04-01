# models.md

This document defines the current and planned database models for the `Cats::Warehouse` engine. It is intended to be implementation-ready and aligned with the existing Rails engine structure, current naming conventions, `InventoryLedger`, `DocumentLifecycle`, and the current `StockBalance` / `StackTransaction` inventory model.

Guiding rules:
- Extend the current `Cats::Warehouse` engine only
- Keep `Hub -> Warehouse -> Store -> Stack`
- Keep existing tables valid and readable
- Prefer additive migrations and nullable foreign keys for new links
- Preserve manual GRN / GIN / Inspection / Waybill flows while adding orchestration, traceability, reservation, and backorder support

## Current Status Snapshot

Status legend used below:
- `LIVE IN CURRENT DB`: model/table is present in the current backend database snapshot and used by the running manual flow
- `IMPLEMENTED IN CODE, PENDING DB`: model/service/controller support exists in the engine codebase, but the current checked database/schema snapshot does not yet expose the table or columns
- `LEGACY LIVE, NOT FULLY CATALOGED BELOW`: model/table is active in the current backend database but belongs to older workflow structures that are only partially represented in this blueprint

Current backend status as of this revision:
- `Hub`, `Warehouse`, `Store`, `Stack`, `StockBalance`, `StackTransaction`, `Grn`, `GrnItem`, `Gin`, `GinItem`, `Inspection`, `InspectionItem`, `Waybill`, and `WaybillItem` are `LIVE IN CURRENT DB`
- `ReceiptOrder`, `ReceiptOrderLine`, `DispatchOrder`, and their richer draft/confirm workflow are `IMPLEMENTED IN CODE, PENDING DB`
- `InventoryLot` and `UomConversion` are `IMPLEMENTED IN CODE, PENDING DB`
- `ReceiptOrderAssignment`, `DispatchOrderAssignment`, `StockReservation`, `SpaceReservation`, and `WorkflowEvent` are `IMPLEMENTED IN CODE, PENDING DB`
- `reserved_quantity` / `available_quantity` behavior for `StockBalance` is implemented in code, but the current checked `schema.rb` snapshot does not yet show those columns as live
- Legacy tables such as `ReceiptAdvice`, `ReceiptAdviceItem`, `DispatchPreparation`, `DispatchOrderItem`, `StackReservation`, `GinStackReservation`, `OperationalTask`, and related older execution helpers are `LEGACY LIVE, NOT FULLY CATALOGED BELOW`

Practical interpretation:
- The current database still supports the established manual warehouse flow and the older orchestration structures
- The newer Phase 1 to Phase 3 orchestration / lot / reservation backend has been added in code, but this document should not imply those tables are already present in every local database unless the corresponding migrations have actually been applied

## Existing Models

### Hub

#### Table Name
- `cats_warehouse_hubs`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `location_id` | `bigint` | Core geographic location for the hub | `null: false`, indexed, FK to `cats_core_locations` |
| `geo_id` | `bigint` | Optional GPS / geo reference | `null: true`, indexed, FK to `cats_warehouse_geos` |
| `code` | `string` | Optional hub code | nullable |
| `name` | `string` | Hub display name | `null: false` |
| `hub_type` | `string` | Optional classification | nullable |
| `status` | `string` | Optional operational status | nullable |
| `description` | `text` | Optional notes | nullable |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :location, class_name: "Cats::Core::Location"`
- `belongs_to :geo, class_name: "Cats::Warehouse::Geo", optional: true`
- `has_one :hub_capacity, class_name: "Cats::Warehouse::HubCapacity"`
- `has_one :hub_access, class_name: "Cats::Warehouse::HubAccess"`
- `has_one :hub_infra, class_name: "Cats::Warehouse::HubInfra"`
- `has_one :hub_contacts, class_name: "Cats::Warehouse::HubContacts"`
- `has_many :warehouses, class_name: "Cats::Warehouse::Warehouse"`
- planned `has_many :receipt_order_assignments`
- planned `has_many :dispatch_order_assignments`
- planned `has_many :user_assignments`

#### Key Indexes
- `index_cats_warehouse_hubs_on_location_id`
- `index_cats_warehouse_hubs_on_geo_id`

#### APIs
- `GET /cats_warehouse/v1/hubs`
  - Purpose: list hubs visible to the current user
  - Roles: Admin, Superadmin, Hub Manager
- `GET /cats_warehouse/v1/hubs/:id`
  - Purpose: show hub detail, capacities, access, contacts, and downstream warehouse rollups
  - Roles: Admin, Superadmin, Hub Manager
- `POST /cats_warehouse/v1/hubs`
  - Purpose: create a new hub
  - Roles: Admin, Superadmin
- `PATCH /cats_warehouse/v1/hubs/:id`
  - Purpose: update a hub
  - Roles: Admin, Superadmin
- `DELETE /cats_warehouse/v1/hubs/:id`
  - Purpose: remove a hub
  - Roles: Admin, Superadmin

#### Notes
- Status: `EXISTING (KEEP)`
- Migration strategy: no destructive changes; any future rollups should stay in serializers or detail tables

### Warehouse

#### Table Name
- `cats_warehouse_warehouses`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `location_id` | `bigint` | Core location | `null: false`, indexed |
| `hub_id` | `bigint` | Optional owning hub | `null: true`, indexed |
| `geo_id` | `bigint` | Optional GPS / geo | `null: true`, indexed |
| `code` | `string` | Optional warehouse code | nullable |
| `name` | `string` | Warehouse display name | `null: false` |
| `warehouse_type` | `string` | Optional type | nullable |
| `status` | `string` | Optional status | nullable |
| `description` | `text` | Optional notes | nullable |
| `managed_under` | `string` | Current ownership/management context | nullable, indexed |
| `ownership_type` | `string` | Self-owned vs rental | `null: false`, default `self_owned`, indexed |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :location, class_name: "Cats::Core::Location"`
- `belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true`
- `belongs_to :geo, class_name: "Cats::Warehouse::Geo", optional: true`
- `has_one :warehouse_capacity, class_name: "Cats::Warehouse::WarehouseCapacity"`
- `has_one :warehouse_access, class_name: "Cats::Warehouse::WarehouseAccess"`
- `has_one :warehouse_infra, class_name: "Cats::Warehouse::WarehouseInfra"`
- `has_one :warehouse_contacts, class_name: "Cats::Warehouse::WarehouseContacts"`
- `has_many :stores, class_name: "Cats::Warehouse::Store"`
- `has_many :stacking_rules, class_name: "Cats::Warehouse::StackingRule"`
- `has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance"`
- `has_many :grns, class_name: "Cats::Warehouse::Grn"`
- `has_many :gins, class_name: "Cats::Warehouse::Gin"`
- `has_many :inspections, class_name: "Cats::Warehouse::Inspection"`
- planned `has_many :receipt_orders`
- planned `has_many :dispatch_orders`
- planned `has_many :inventory_lots`
- planned `has_many :stock_reservations`
- planned `has_many :space_reservations`

#### Key Indexes
- `index_cats_warehouse_warehouses_on_location_id`
- `index_cats_warehouse_warehouses_on_hub_id`
- `index_cats_warehouse_warehouses_on_geo_id`
- `index_cats_warehouse_warehouses_on_managed_under`
- `index_cats_warehouse_warehouses_on_ownership_type`

#### APIs
- `GET /cats_warehouse/v1/warehouses`
  - Purpose: list visible warehouses
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `GET /cats_warehouse/v1/warehouses/:id`
  - Purpose: show warehouse detail, operational summaries, child stores, and stock/document rollups
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `POST /cats_warehouse/v1/warehouses`
  - Purpose: create a warehouse
  - Roles: Admin, Superadmin, Hub Manager
- `PATCH /cats_warehouse/v1/warehouses/:id`
  - Purpose: update a warehouse
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager
- `DELETE /cats_warehouse/v1/warehouses/:id`
  - Purpose: delete a warehouse
  - Roles: Admin, Superadmin
- `GET/POST/PATCH /cats_warehouse/v1/warehouses/:id/capacity`
- `GET/POST/PATCH /cats_warehouse/v1/warehouses/:id/access`
- `GET/POST/PATCH /cats_warehouse/v1/warehouses/:id/infra`
- `GET/POST/PATCH /cats_warehouse/v1/warehouses/:id/contacts`
  - Purpose: maintain warehouse sub-records
  - Roles: Admin, Superadmin, Warehouse Manager as currently allowed

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy: column/association extension only; do not change ownership/location inheritance rules

### Store

#### Table Name
- `cats_warehouse_stores`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `warehouse_id` | `bigint` | Parent warehouse | `null: false`, indexed |
| `code` | `string` | Optional store code | nullable |
| `name` | `string` | Store name | `null: false` |
| `length` | `float` | Physical length | `null: false` |
| `width` | `float` | Physical width | `null: false` |
| `height` | `float` | Physical height | `null: false` |
| `usable_space` | `float` | Computed / stored usable volume | `null: false` |
| `available_space` | `float` | Current available volume | `null: false` |
| `temporary` | `boolean` | Temporary storage flag | `null: false`, default `false` |
| `has_gangway` | `boolean` | Gangway enabled flag | `null: false`, default `false` |
| `gangway_length` | `float` | Optional gangway length | nullable |
| `gangway_width` | `float` | Optional gangway width | nullable |
| `gangway_corner_dist` | `float` | Optional corner distance | nullable |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"`
- `has_many :stacks, class_name: "Cats::Warehouse::Stack"`
- `has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance"`
- `has_many :user_assignments, class_name: "Cats::Warehouse::UserAssignment"`
- planned `has_many :receipt_order_assignments`
- planned `has_many :dispatch_order_assignments`
- planned `has_many :space_reservations`
- planned `has_many :stock_reservations`

#### Key Indexes
- `index_cats_warehouse_stores_on_warehouse_id`

#### APIs
- `GET /cats_warehouse/v1/stores`
  - Purpose: list visible stores
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `GET /cats_warehouse/v1/stores/:id`
  - Purpose: show store detail and stack occupancy
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `POST /cats_warehouse/v1/stores`
  - Purpose: create a store
  - Roles: Admin, Superadmin, Warehouse Manager
- `PATCH /cats_warehouse/v1/stores/:id`
  - Purpose: update a store
  - Roles: Admin, Superadmin, Warehouse Manager
- `DELETE /cats_warehouse/v1/stores/:id`
  - Purpose: delete a store
  - Roles: Admin, Superadmin

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy: additive only; reservations should complement current capacity math rather than replace it

### Stack

#### Table Name
- `cats_warehouse_stacks`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `store_id` | `bigint` | Parent store | `null: false`, indexed |
| `commodity_id` | `bigint` | Current commodity reference | `null: false`, indexed |
| `unit_id` | `bigint` | Current unit reference | `null: false`, indexed |
| `code` | `string` | Optional stack code | nullable |
| `length` | `float` | Physical length | `null: false` |
| `width` | `float` | Physical width | `null: false` |
| `height` | `float` | Physical height | `null: false` |
| `start_x` | `float` | Layout X coordinate | nullable |
| `start_y` | `float` | Layout Y coordinate | nullable |
| `commodity_status` | `string` | Commodity condition/status | `null: false`, default `Good` |
| `stack_status` | `string` | Operational stack status | `null: false`, default `Reserved` |
| `quantity` | `float` | Current stack quantity | `null: false`, default `0`, check non-negative |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :store, class_name: "Cats::Warehouse::Store"`
- `belongs_to :commodity, class_name: "Cats::Core::Commodity"`
- `belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"`
- `has_many :incoming_stack_transactions, class_name: "Cats::Warehouse::StackTransaction", foreign_key: :destination_id`
- `has_many :outgoing_stack_transactions, class_name: "Cats::Warehouse::StackTransaction", foreign_key: :source_id`
- `has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance"`
- planned `has_many :stock_reservations`

#### Key Indexes
- `index_cats_warehouse_stacks_on_store_id`
- `index_cats_warehouse_stacks_on_commodity_id`
- `index_cats_warehouse_stacks_on_unit_id`
- check constraint `cw_stacks_quantity_non_negative`

#### APIs
- `GET /cats_warehouse/v1/stacks`
  - Purpose: list visible stacks
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `GET /cats_warehouse/v1/stacks/:id`
  - Purpose: show stack details and current contents
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `POST /cats_warehouse/v1/stacks`
  - Purpose: create stack layout/placement
  - Roles: Admin, Superadmin, Warehouse Manager, Storekeeper
- `PATCH /cats_warehouse/v1/stacks/:id`
  - Purpose: update stack dimensions/status/placement
  - Roles: Admin, Superadmin, Warehouse Manager, Storekeeper
- `DELETE /cats_warehouse/v1/stacks/:id`
  - Purpose: remove a stack
  - Roles: Admin, Superadmin

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy: keep stack as the current execution-level location; lot and reservation links should be nullable extensions

### StockBalance

#### Table Name
- `cats_warehouse_stock_balances`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `warehouse_id` | `bigint` | Warehouse-level balance key | `null: false`, indexed |
| `store_id` | `bigint` | Optional store dimension | nullable, indexed |
| `stack_id` | `bigint` | Optional stack dimension | nullable, indexed |
| `commodity_id` | `bigint` | Commodity dimension | `null: false`, indexed |
| `unit_id` | `bigint` | Current unit dimension | `null: false`, indexed |
| `quantity` | `float` | Current on-hand quantity | `null: false`, check non-negative |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

Planned additive fields:
| Field | Type | Description | Constraints |
|---|---|---|---|
| `inventory_lot_id` | `bigint` | Optional lot-level dimension | nullable, indexed |
| `base_unit_id` | `bigint` | Normalized/base unit | nullable |
| `base_quantity` | `float` | Quantity in base unit | nullable |
| `reserved_quantity` | `float` | Reserved quantity | nullable, default `0` |
| `available_quantity` | `float` | Derived/denormalized available quantity | nullable |

#### Relationships
- `belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"`
- `belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true`
- `belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true`
- `belongs_to :commodity, class_name: "Cats::Core::Commodity"`
- `belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"`
- planned `belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true`
- planned `belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true`

#### Key Indexes
- Current unique dimension index on warehouse/store/stack/commodity/unit
- `index_cats_warehouse_stock_balances_on_warehouse_id`
- `index_cats_warehouse_stock_balances_on_store_id`
- `index_cats_warehouse_stock_balances_on_stack_id`
- `index_cats_warehouse_stock_balances_on_commodity_id`
- `index_cats_warehouse_stock_balances_on_unit_id`
- check constraint `cw_stock_balances_quantity_non_negative`

#### APIs
- `GET /cats_warehouse/v1/stock_balances`
  - Purpose: list scoped stock balances
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `GET /cats_warehouse/v1/stock_balances/:id`
  - Purpose: show a single stock balance record
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy:
  - add nullable lot/UOM/reservation fields first
  - keep legacy balance rows with `inventory_lot_id = null`
  - replace uniqueness strategy only after additive backfill and ledger support
  - `reserved_quantity` and `available_quantity` are deferred to the reservation phase; they are not required for Phase 2 lot/UOM closure

### StackTransaction

#### Table Name
- `cats_warehouse_stack_transactions`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `source_id` | `bigint` | Source stack | nullable |
| `destination_id` | `bigint` | Destination stack | nullable |
| `unit_id` | `bigint` | Current movement unit | `null: false` |
| `reference_type` | `string` | Polymorphic reference type | nullable |
| `reference_id` | `bigint` | Polymorphic reference id | nullable |
| `transaction_date` | `date` | Movement date | `null: false` |
| `quantity` | `float` | Movement quantity | required, positive |
| `status` | `string` | Movement status | nullable |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

Planned additive fields:
| Field | Type | Description | Constraints |
|---|---|---|---|
| `inventory_lot_id` | `bigint` | Lot traced in the movement | nullable |
| `entered_unit_id` | `bigint` | User-entered unit | nullable |
| `base_unit_id` | `bigint` | Base / normalized unit | nullable |
| `base_quantity` | `float` | Base / normalized quantity | nullable |
| `movement_reason` | `string` | Reason code / event type | nullable |

#### Relationships
- `belongs_to :source, class_name: "Cats::Warehouse::Stack", optional: true`
- `belongs_to :destination, class_name: "Cats::Warehouse::Stack", optional: true`
- `belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"`
- `belongs_to :reference, polymorphic: true, optional: true`
- planned `belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true`
- planned `belongs_to :entered_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true`
- planned `belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true`

#### Key Indexes
- `source_id`
- `destination_id`
- lookup by polymorphic `reference_type/reference_id`
- planned `inventory_lot_id`

#### APIs
- `GET /cats_warehouse/v1/reports/bin_card`
  - Purpose: render bin-card-style movement history from transactions
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy: enrich rather than replace; keep this table as the inventory movement audit trail

### Grn

#### Table Name
- `cats_warehouse_grns`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `warehouse_id` | `bigint` | Receiving warehouse | `null: false`, indexed |
| `source_type` | `string` | Polymorphic source type | nullable |
| `source_id` | `bigint` | Polymorphic source id | nullable |
| `received_by_id` | `bigint` | Receiving user | `null: false` |
| `approved_by_id` | `bigint` | Approving user | nullable |
| `reference_no` | `string` | GRN reference | nullable |
| `received_on` | `date` | Goods received date | `null: false` |
| `status` | `string` | Current document status | `null: false`, default `Draft` |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

Planned additive fields:
| Field | Type | Description | Constraints |
|---|---|---|---|
| `receipt_order_id` | `bigint` | Optional inbound order link | nullable, indexed |
| `workflow_status` | `string` | Richer operational state | nullable |

#### Relationships
- `belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"`
- `belongs_to :source, polymorphic: true, optional: true`
- `belongs_to :received_by, class_name: "Cats::Core::User"`
- `belongs_to :approved_by, class_name: "Cats::Core::User", optional: true`
- `has_many :grn_items, class_name: "Cats::Warehouse::GrnItem", dependent: :destroy`
- planned `belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder", optional: true`

#### Key Indexes
- `warehouse_id`
- current polymorphic `source_type/source_id` access path
- planned `receipt_order_id`

#### APIs
- `GET /cats_warehouse/v1/grns`
  - Purpose: list GRNs for visible warehouses
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `GET /cats_warehouse/v1/grns/:id`
  - Purpose: show GRN detail and confirmability
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `POST /cats_warehouse/v1/grns`
  - Purpose: create a draft GRN manually or from an order-linked workflow
  - Roles: Admin, Superadmin, Warehouse Manager, Storekeeper
- `POST /cats_warehouse/v1/grns/:id/confirm`
  - Purpose: confirm GRN and post stock through `InventoryLedger`
  - Roles: Admin, Superadmin, Warehouse Manager

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy: optional order linkage and richer workflow only; preserve manual GRN path

### GrnItem

#### Table Name
- `cats_warehouse_grn_items`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `grn_id` | `bigint` | Parent GRN | `null: false`, indexed |
| `commodity_id` | `bigint` | Commodity | `null: false`, indexed |
| `unit_id` | `bigint` | Current unit | `null: false`, indexed |
| `store_id` | `bigint` | Optional destination store | nullable, indexed |
| `stack_id` | `bigint` | Optional destination stack | nullable, indexed |
| `quantity` | `float` | Current line quantity | required |
| `quality_status` | `string` | Optional quality result | nullable |

Planned additive fields:
| Field | Type | Description | Constraints |
|---|---|---|---|
| `inventory_lot_id` | `bigint` | Linked lot | nullable, indexed |
| `batch_no` | `string` | Batch reference captured at receipt | nullable |
| `expiry_date` | `date` | Lot expiry | nullable |
| `entered_unit_id` | `bigint` | Entered unit | nullable |
| `base_unit_id` | `bigint` | Normalized/base unit | nullable |
| `base_quantity` | `float` | Normalized/base quantity | nullable |
| `accepted_quantity` | `float` | Accepted quantity after inspection | nullable |
| `rejected_quantity` | `float` | Rejected quantity after inspection | nullable |

#### Relationships
- `belongs_to :grn, class_name: "Cats::Warehouse::Grn"`
- `belongs_to :commodity, class_name: "Cats::Core::Commodity"`
- `belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"`
- `belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true`
- `belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true`
- planned `belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true`
- planned `belongs_to :entered_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true`
- planned `belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true`

#### Key Indexes
- `grn_id`
- `commodity_id`
- `store_id`
- `stack_id`
- planned `inventory_lot_id`

#### APIs
- Managed through parent GRN endpoints only

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy: additive line-level traceability and inspection-aligned quantity fields

### Gin

#### Table Name
- `cats_warehouse_gins`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `warehouse_id` | `bigint` | Issuing warehouse | `null: false`, indexed |
| `destination_type` | `string` | Polymorphic destination type | nullable |
| `destination_id` | `bigint` | Polymorphic destination id | nullable |
| `issued_by_id` | `bigint` | Issuing user | `null: false` |
| `approved_by_id` | `bigint` | Approving user | nullable |
| `reference_no` | `string` | GIN reference | nullable |
| `issued_on` | `date` | Issue date | `null: false` |
| `status` | `string` | Current document status | `null: false`, default `Draft` |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

Planned additive fields:
| Field | Type | Description | Constraints |
|---|---|---|---|
| `dispatch_order_id` | `bigint` | Optional outbound order link | nullable, indexed |
| `workflow_status` | `string` | Richer operational state | nullable |

#### Relationships
- `belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"`
- `belongs_to :destination, polymorphic: true, optional: true`
- `belongs_to :issued_by, class_name: "Cats::Core::User"`
- `belongs_to :approved_by, class_name: "Cats::Core::User", optional: true`
- `has_many :gin_items, class_name: "Cats::Warehouse::GinItem", dependent: :destroy`
- planned `belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder", optional: true`

#### Key Indexes
- `warehouse_id`
- current `destination_type/destination_id` access path
- planned `dispatch_order_id`

#### APIs
- `GET /cats_warehouse/v1/gins`
  - Purpose: list GINs for visible warehouses
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `GET /cats_warehouse/v1/gins/:id`
  - Purpose: show GIN detail and confirmability
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `POST /cats_warehouse/v1/gins`
  - Purpose: create draft GIN manually or from order-linked outbound flow
  - Roles: Admin, Superadmin, Warehouse Manager, Storekeeper
- `POST /cats_warehouse/v1/gins/:id/confirm`
  - Purpose: confirm GIN and deduct stock through `InventoryLedger`
  - Roles: Admin, Superadmin, Warehouse Manager

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy: preserve current issue flow while adding order linkage and workflow state

### GinItem

#### Table Name
- `cats_warehouse_gin_items`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `gin_id` | `bigint` | Parent GIN | `null: false`, indexed |
| `commodity_id` | `bigint` | Commodity | `null: false`, indexed |
| `unit_id` | `bigint` | Current unit | `null: false`, indexed |
| `store_id` | `bigint` | Optional source store | nullable, indexed |
| `stack_id` | `bigint` | Optional source stack | nullable, indexed |
| `quantity` | `float` | Current line quantity | required |

Planned additive fields:
| Field | Type | Description | Constraints |
|---|---|---|---|
| `inventory_lot_id` | `bigint` | Linked lot | nullable, indexed |
| `entered_unit_id` | `bigint` | Entered unit | nullable |
| `base_unit_id` | `bigint` | Normalized/base unit | nullable |
| `base_quantity` | `float` | Normalized/base quantity | nullable |
| `reserved_quantity` | `float` | Quantity reserved before issue | nullable |
| `issued_quantity` | `float` | Quantity actually issued | nullable |
| `backordered_quantity` | `float` | Unfulfilled quantity | nullable |

#### Relationships
- `belongs_to :gin, class_name: "Cats::Warehouse::Gin"`
- `belongs_to :commodity, class_name: "Cats::Core::Commodity"`
- `belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"`
- `belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true`
- `belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true`
- planned `belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true`
- planned `belongs_to :entered_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true`
- planned `belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true`

#### Key Indexes
- `gin_id`
- `commodity_id`
- `store_id`
- `stack_id`
- planned `inventory_lot_id`

#### APIs
- Managed through parent GIN endpoints only

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy: line-level allocation, issue, and backorder support should extend this table rather than replace it

### Inspection

#### Table Name
- `cats_warehouse_inspections`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `warehouse_id` | `bigint` | Inspection warehouse | `null: false`, indexed |
| `inspector_id` | `bigint` | Inspecting user | `null: false` |
| `source_type` | `string` | Polymorphic source type | nullable |
| `source_id` | `bigint` | Polymorphic source id | nullable |
| `reference_no` | `string` | Inspection reference | nullable |
| `inspected_on` | `date` | Inspection date | `null: false` |
| `status` | `string` | Document status | `null: false`, default `Draft` |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

Planned additive fields:
| Field | Type | Description | Constraints |
|---|---|---|---|
| `receipt_order_id` | `bigint` | Optional inbound order link | nullable, indexed |
| `dispatch_order_id` | `bigint` | Optional outbound order link | nullable, indexed |
| `result_status` | `string` | Richer inspection result state | nullable |
| `auto_generated_grn_id` | `bigint` | Optional generated GRN | nullable, indexed |
| `auto_generated_gin_id` | `bigint` | Optional generated GIN | nullable, indexed |

#### Relationships
- `belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"`
- `belongs_to :inspector, class_name: "Cats::Core::User"`
- `belongs_to :source, polymorphic: true, optional: true`
- `has_many :inspection_items, class_name: "Cats::Warehouse::InspectionItem", dependent: :destroy`
- planned `belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder", optional: true`
- planned `belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder", optional: true`
- planned `belongs_to :auto_generated_grn, class_name: "Cats::Warehouse::Grn", optional: true`
- planned `belongs_to :auto_generated_gin, class_name: "Cats::Warehouse::Gin", optional: true`

#### Key Indexes
- `warehouse_id`
- current `source_type/source_id` access path
- planned `receipt_order_id`
- planned `dispatch_order_id`
- planned generated-document indexes

#### APIs
- `GET /cats_warehouse/v1/inspections`
  - Purpose: list inspections for visible warehouses
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `GET /cats_warehouse/v1/inspections/:id`
  - Purpose: show inspection detail and generated document linkage
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `POST /cats_warehouse/v1/inspections`
  - Purpose: create inspection manually or from an order-linked flow
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `POST /cats_warehouse/v1/inspections/:id/confirm`
  - Purpose: confirm inspection, apply discrepancies, and optionally generate GRN / GIN
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy: extend to order linkage and automation; preserve current inspection path

### Waybill

#### Table Name
- `cats_warehouse_waybills`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `dispatch_id` | `bigint` | Optional core dispatch link | nullable, indexed |
| `source_location_id` | `bigint` | Source core location | `null: false`, indexed |
| `destination_location_id` | `bigint` | Destination core location | `null: false`, indexed |
| `reference_no` | `string` | Waybill reference | nullable |
| `issued_on` | `date` | Issue date | `null: false` |
| `status` | `string` | Current status | nullable |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

Planned additive fields:
| Field | Type | Description | Constraints |
|---|---|---|---|
| `dispatch_order_id` | `bigint` | Optional outbound order link | nullable, indexed |
| `prepared_by_id` | `bigint` | Optional preparing user | nullable |
| `workflow_status` | `string` | Richer outbound workflow state | nullable |
| `auto_generated_gin_id` | `bigint` | Optional generated GIN | nullable, indexed |

#### Relationships
- `belongs_to :dispatch, class_name: "Cats::Core::Dispatch", optional: true`
- `belongs_to :source_location, class_name: "Cats::Core::Location"`
- `belongs_to :destination_location, class_name: "Cats::Core::Location"`
- `has_one :waybill_transport, class_name: "Cats::Warehouse::WaybillTransport", dependent: :destroy`
- `has_many :waybill_items, class_name: "Cats::Warehouse::WaybillItem", dependent: :destroy`
- planned `belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder", optional: true`
- planned `belongs_to :prepared_by, class_name: "Cats::Core::User", optional: true`
- planned `belongs_to :auto_generated_gin, class_name: "Cats::Warehouse::Gin", optional: true`

#### Key Indexes
- `dispatch_id`
- `source_location_id`
- `destination_location_id`
- planned `dispatch_order_id`
- planned generated-document index

#### APIs
- `GET /cats_warehouse/v1/waybills`
  - Purpose: list waybills
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `GET /cats_warehouse/v1/waybills/:id`
  - Purpose: show waybill detail and linked outbound execution
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager, Storekeeper
- `POST /cats_warehouse/v1/waybills`
  - Purpose: create a waybill manually or from dispatch order execution
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager
- `POST /cats_warehouse/v1/waybills/:id/confirm`
  - Purpose: confirm waybill and optionally trigger GIN preparation
  - Roles: Admin, Superadmin, Hub Manager, Warehouse Manager

#### Notes
- Status: `EXISTING (MODIFY)`
- Migration strategy: extend for outbound workflow linkage while preserving current transport document semantics

## Planned Models

### ReceiptOrder

#### Table Name
- `cats_warehouse_receipt_orders`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `reference_no` | `string` | External reference number | nullable in draft, unique when set/confirmed |
| `name` | `string` | Business name/title | nullable in draft |
| `description` | `text` | Free-form description | nullable |
| `source_type` | `string` | Receipt source classification such as purchase, gift, loan, return, transfer | nullable |
| `expected_arrival_date` | `date` | Planned arrival date | nullable |
| `status` | `string` | Workflow state | `null: false`, default `Draft`, indexed |
| `created_by_id` | `bigint` | Creating officer | `null: false`, indexed |
| `confirmed_by_id` | `bigint` | Confirming officer | nullable |
| `confirmed_at` | `datetime` | Confirmation timestamp | nullable |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :created_by, class_name: "Cats::Core::User"`
- `belongs_to :confirmed_by, class_name: "Cats::Core::User", optional: true`
- `has_many :receipt_order_lines, class_name: "Cats::Warehouse::ReceiptOrderLine", dependent: :destroy`
- `has_many :inspections, class_name: "Cats::Warehouse::Inspection"`
- `has_many :grns, class_name: "Cats::Warehouse::Grn"`
- `has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation"`
- `has_many :workflow_events, as: :entity, class_name: "Cats::Warehouse::WorkflowEvent"`
- `has_many :receipt_order_assignments, class_name: "Cats::Warehouse::ReceiptOrderAssignment"`

#### Key Indexes
- Unique partial index on `reference_no` where `reference_no IS NOT NULL`
- `status`
- `created_by_id`

#### APIs
- `GET /cats_warehouse/v1/receipt_orders`
  - Purpose: list receipt orders
  - Roles: Officer, Hub Manager, Warehouse Manager
- `POST /cats_warehouse/v1/receipt_orders`
  - Purpose: create a draft receipt order
  - Roles: Officer
- `GET /cats_warehouse/v1/receipt_orders/:id`
  - Purpose: show receipt order detail and linked execution
  - Roles: Officer, Hub Manager, Warehouse Manager, Storekeeper as scoped
- `PATCH /cats_warehouse/v1/receipt_orders/:id`
  - Purpose: update draft order header/details
  - Roles: Officer
- `POST /cats_warehouse/v1/receipt_orders/:id/confirm`
  - Purpose: confirm a draft receipt order and start workflow
  - Roles: Officer
- `POST /cats_warehouse/v1/receipt_orders/:id/assign`
  - Purpose: assign warehouse/store execution
  - Roles: Hub Manager, Warehouse Manager
- `POST /cats_warehouse/v1/receipt_orders/:id/reserve_space`
  - Purpose: reserve destination capacity
  - Roles: Storekeeper, Warehouse Manager
- `GET /cats_warehouse/v1/receipt_orders/:id/workflow`
  - Purpose: list workflow events
  - Roles: Officer, Hub Manager, Warehouse Manager

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive table, no impact on legacy receipt or GRN records

### ReceiptOrderLine

#### Table Name
- `cats_warehouse_receipt_order_lines`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `receipt_order_id` | `bigint` | Parent receipt order | `null: false`, indexed |
| `commodity_id` | `bigint` | Commodity | `null: false`, indexed |
| `unit_id` | `bigint` | Planned unit | `null: false` |
| `planned_quantity` | `float` | Planned inbound quantity | `null: false` |
| `expected_arrival_date` | `date` | Optional line-level expected date | nullable |
| `destination_warehouse_id` | `bigint` | Optional planned warehouse | nullable, indexed |
| `destination_store_id` | `bigint` | Optional planned store | nullable, indexed |
| `batch_required` | `boolean` | Whether batch capture is required | `null: false`, default `false` |
| `expiry_required` | `boolean` | Whether expiry capture is required | `null: false`, default `false` |
| `received_quantity` | `float` | Quantity received so far | nullable, default `0` |
| `status` | `string` | Line workflow state | `null: false`, default `Draft` |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder"`
- `belongs_to :commodity, class_name: "Cats::Core::Commodity"`
- `belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"`
- `belongs_to :destination_warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true`
- `belongs_to :destination_store, class_name: "Cats::Warehouse::Store", optional: true`
- `has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation"`
- `has_many :workflow_events, as: :entity, class_name: "Cats::Warehouse::WorkflowEvent"`
- `has_many :receipt_order_assignments, class_name: "Cats::Warehouse::ReceiptOrderAssignment"`

#### Key Indexes
- `receipt_order_id`
- `commodity_id`
- `destination_warehouse_id`
- `destination_store_id`

#### APIs
- Nested under receipt order create/update/show payloads

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive child table, no replacement of `GrnItem`

### DispatchOrder

#### Table Name
- `cats_warehouse_dispatch_orders`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `reference_no` | `string` | External reference number | nullable in draft, unique when set/confirmed |
| `name` | `string` | Business name/title | nullable in draft |
| `description` | `text` | Free-form description | nullable |
| `expected_dispatch_date` | `date` | Planned dispatch date | nullable |
| `status` | `string` | Workflow state | `null: false`, default `Draft`, indexed |
| `created_by_id` | `bigint` | Creating officer | `null: false`, indexed |
| `confirmed_by_id` | `bigint` | Confirming officer | nullable |
| `confirmed_at` | `datetime` | Confirmation timestamp | nullable |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :created_by, class_name: "Cats::Core::User"`
- `belongs_to :confirmed_by, class_name: "Cats::Core::User", optional: true`
- `has_many :dispatch_order_lines, class_name: "Cats::Warehouse::DispatchOrderLine", dependent: :destroy`
- `has_many :waybills, class_name: "Cats::Warehouse::Waybill"`
- `has_many :gins, class_name: "Cats::Warehouse::Gin"`
- `has_many :workflow_events, as: :entity, class_name: "Cats::Warehouse::WorkflowEvent"`
- `has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation"`
- `has_many :dispatch_order_assignments, class_name: "Cats::Warehouse::DispatchOrderAssignment"`
- `has_many :backorders, class_name: "Cats::Warehouse::Backorder"`

#### Key Indexes
- Unique partial index on `reference_no` where `reference_no IS NOT NULL`
- `status`
- `created_by_id`

#### APIs
- `GET /cats_warehouse/v1/dispatch_orders`
  - Purpose: list dispatch orders
  - Roles: Officer, Hub Manager, Warehouse Manager
- `POST /cats_warehouse/v1/dispatch_orders`
  - Purpose: create a draft dispatch order
  - Roles: Officer
- `GET /cats_warehouse/v1/dispatch_orders/:id`
  - Purpose: show dispatch order detail and linked execution
  - Roles: Officer, Hub Manager, Warehouse Manager, Storekeeper as scoped
- `PATCH /cats_warehouse/v1/dispatch_orders/:id`
  - Purpose: update a draft dispatch order
  - Roles: Officer
- `POST /cats_warehouse/v1/dispatch_orders/:id/confirm`
  - Purpose: confirm dispatch order and start workflow
  - Roles: Officer
- `POST /cats_warehouse/v1/dispatch_orders/:id/assign`
  - Purpose: assign source warehouse/store execution
  - Roles: Hub Manager, Warehouse Manager
- `POST /cats_warehouse/v1/dispatch_orders/:id/reserve_stock`
  - Purpose: reserve inventory for fulfillment
  - Roles: Storekeeper, Warehouse Manager
- `GET /cats_warehouse/v1/dispatch_orders/:id/workflow`
  - Purpose: list workflow events
  - Roles: Officer, Hub Manager, Warehouse Manager

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive table, no impact on legacy dispatch / waybill / GIN records

### DispatchOrderLine

#### Table Name
- `cats_warehouse_dispatch_order_lines`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `dispatch_order_id` | `bigint` | Parent dispatch order | `null: false`, indexed |
| `commodity_id` | `bigint` | Commodity | `null: false`, indexed |
| `unit_id` | `bigint` | Planned unit | `null: false` |
| `planned_quantity` | `float` | Planned outbound quantity | `null: false` |
| `source_warehouse_id` | `bigint` | Optional source warehouse | nullable, indexed |
| `source_store_id` | `bigint` | Optional source store | nullable, indexed |
| `requested_lot_id` | `bigint` | Preferred lot for fulfillment | nullable, indexed |
| `issued_quantity` | `float` | Quantity issued so far | nullable, default `0` |
| `backordered_quantity` | `float` | Remaining backordered quantity | nullable, default `0` |
| `status` | `string` | Line workflow state | `null: false`, default `Draft` |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder"`
- `belongs_to :commodity, class_name: "Cats::Core::Commodity"`
- `belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"`
- `belongs_to :source_warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true`
- `belongs_to :source_store, class_name: "Cats::Warehouse::Store", optional: true`
- `belongs_to :requested_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true`
- `has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation"`
- `has_many :backorders, class_name: "Cats::Warehouse::Backorder"`
- `has_many :dispatch_order_assignments, class_name: "Cats::Warehouse::DispatchOrderAssignment"`

#### Key Indexes
- `dispatch_order_id`
- `commodity_id`
- `source_warehouse_id`
- `source_store_id`
- `requested_lot_id`

#### APIs
- Nested under dispatch order create/update/show payloads

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive child table; should coexist cleanly with `GinItem`

### InventoryLot

#### Table Name
- `cats_warehouse_inventory_lots`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `warehouse_id` | `bigint` | Warehouse owning the lot | `null: false`, indexed |
| `commodity_id` | `bigint` | Commodity carried by the lot | `null: false`, indexed |
| `source_type` | `string` | Polymorphic source type | nullable |
| `source_id` | `bigint` | Polymorphic source id | nullable |
| `lot_code` | `string` | Internal lot code | nullable |
| `batch_no` | `string` | Batch number | nullable, indexed |
| `expiry_date` | `date` | Expiry / best-use-before date | nullable, indexed |
| `manufactured_on` | `date` | Optional manufacture date | nullable |
| `received_on` | `date` | Optional warehouse receipt date | nullable |
| `status` | `string` | Lot lifecycle status | `null: false`, default `Active`, indexed |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"`
- `belongs_to :commodity, class_name: "Cats::Core::Commodity"`
- `belongs_to :source, polymorphic: true, optional: true`
- `has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance"`
- `has_many :stack_transactions, class_name: "Cats::Warehouse::StackTransaction"`
- `has_many :grn_items, class_name: "Cats::Warehouse::GrnItem"`
- `has_many :gin_items, class_name: "Cats::Warehouse::GinItem"`
- `has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation"`

#### Key Indexes
- composite index on `(warehouse_id, commodity_id, batch_no, expiry_date)`
- `status`
- polymorphic `source_type/source_id`

#### APIs
- `GET /cats_warehouse/v1/reference_data/lots`
  - Purpose: list selectable lots for receipt, issue, and stock screens
  - Roles: Officer, Hub Manager, Warehouse Manager, Storekeeper
- optional future `GET /cats_warehouse/v1/inventory_lots/:id`
  - Purpose: lot detail view
  - Roles: Manager roles

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive lot layer; legacy stock remains valid with null lot linkage

### UomConversion

#### Table Name
- `cats_warehouse_uom_conversions`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `commodity_id` | `bigint` | Optional commodity-specific conversion | nullable, indexed |
| `from_unit_id` | `bigint` | Source unit | `null: false` |
| `to_unit_id` | `bigint` | Target/base unit | `null: false` |
| `multiplier` | `decimal` / `float` | Conversion multiplier | `null: false` |
| `conversion_type` | `string` | Optional conversion classification | nullable |
| `active` | `boolean` | Conversion active flag | `null: false`, default `true`, indexed |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :commodity, class_name: "Cats::Core::Commodity", optional: true`
- `belongs_to :from_unit, class_name: "Cats::Core::UnitOfMeasure"`
- `belongs_to :to_unit, class_name: "Cats::Core::UnitOfMeasure"`

#### Key Indexes
- unique index on `(commodity_id, from_unit_id, to_unit_id)`
- `active`

#### APIs
- `GET /cats_warehouse/v1/reference_data/uom_conversions`
  - Purpose: fetch valid conversions for forms, ledger normalization, and stock display
  - Roles: Officer, Hub Manager, Warehouse Manager, Storekeeper

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive support model; does not invalidate current `unit_id` semantics

### ReceiptOrderAssignment

#### Table Name
- `cats_warehouse_receipt_order_assignments`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `receipt_order_id` | `bigint` | Parent order | `null: false`, indexed |
| `receipt_order_line_id` | `bigint` | Optional line-level assignment | nullable, indexed |
| `hub_id` | `bigint` | Optional hub target | nullable |
| `warehouse_id` | `bigint` | Optional warehouse target | nullable, indexed |
| `store_id` | `bigint` | Optional store target | nullable, indexed |
| `assigned_by_id` | `bigint` | Assigning user | `null: false` |
| `assigned_to_id` | `bigint` | Optional assignee user | nullable |
| `quantity` | `float` | Quantity assigned | nullable |
| `status` | `string` | Assignment status | `null: false`, default `Assigned` |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder"`
- `belongs_to :receipt_order_line, class_name: "Cats::Warehouse::ReceiptOrderLine", optional: true`
- `belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true`
- `belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true`
- `belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true`
- `belongs_to :assigned_by, class_name: "Cats::Core::User"`
- `belongs_to :assigned_to, class_name: "Cats::Core::User", optional: true`
- `has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation"`

#### Key Indexes
- `receipt_order_id`
- `receipt_order_line_id`
- `warehouse_id`
- `store_id`

#### APIs
- Managed through `POST /cats_warehouse/v1/receipt_orders/:id/assign`

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive assignment/audit trail for inbound execution

### DispatchOrderAssignment

#### Table Name
- `cats_warehouse_dispatch_order_assignments`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `dispatch_order_id` | `bigint` | Parent order | `null: false`, indexed |
| `dispatch_order_line_id` | `bigint` | Optional line-level assignment | nullable, indexed |
| `hub_id` | `bigint` | Optional hub target | nullable |
| `warehouse_id` | `bigint` | Optional warehouse target | nullable, indexed |
| `store_id` | `bigint` | Optional store target | nullable, indexed |
| `assigned_by_id` | `bigint` | Assigning user | `null: false` |
| `assigned_to_id` | `bigint` | Optional assignee user | nullable |
| `quantity` | `float` | Quantity assigned | nullable |
| `status` | `string` | Assignment status | `null: false`, default `Assigned` |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder"`
- `belongs_to :dispatch_order_line, class_name: "Cats::Warehouse::DispatchOrderLine", optional: true`
- `belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true`
- `belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true`
- `belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true`
- `belongs_to :assigned_by, class_name: "Cats::Core::User"`
- `belongs_to :assigned_to, class_name: "Cats::Core::User", optional: true`

#### Key Indexes
- `dispatch_order_id`
- `dispatch_order_line_id`
- `warehouse_id`
- `store_id`

#### APIs
- Managed through `POST /cats_warehouse/v1/dispatch_orders/:id/assign`

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive assignment/audit trail for outbound execution

### StockReservation

#### Table Name
- `cats_warehouse_stock_reservations`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `dispatch_order_id` | `bigint` | Parent dispatch order | `null: false`, indexed |
| `dispatch_order_line_id` | `bigint` | Parent line | `null: false`, indexed |
| `warehouse_id` | `bigint` | Reserved warehouse | `null: false`, indexed |
| `store_id` | `bigint` | Optional reserved store | nullable, indexed |
| `stack_id` | `bigint` | Optional reserved stack | nullable, indexed |
| `commodity_id` | `bigint` | Reserved commodity | `null: false` |
| `unit_id` | `bigint` | Reservation unit | `null: false` |
| `inventory_lot_id` | `bigint` | Optional reserved lot | nullable, indexed |
| `reserved_quantity` | `float` | Reserved quantity | `null: false` |
| `issued_quantity` | `float` | Issued from this reservation | nullable, default `0` |
| `status` | `string` | Reservation state | `null: false`, default `Reserved`, indexed |
| `reserved_by_id` | `bigint` | Reserving user | `null: false` |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder"`
- `belongs_to :dispatch_order_line, class_name: "Cats::Warehouse::DispatchOrderLine"`
- `belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"`
- `belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true`
- `belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true`
- `belongs_to :commodity, class_name: "Cats::Core::Commodity"`
- `belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"`
- `belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true`
- `belongs_to :reserved_by, class_name: "Cats::Core::User"`
- `has_many :backorders, class_name: "Cats::Warehouse::Backorder"`

#### Key Indexes
- `dispatch_order_id`
- `dispatch_order_line_id`
- `warehouse_id`
- `store_id`
- `stack_id`
- `inventory_lot_id`
- `status`

#### APIs
- `POST /cats_warehouse/v1/dispatch_orders/:id/reserve_stock`
  - Purpose: reserve stock for outbound fulfillment
  - Roles: Storekeeper, Warehouse Manager
- optional `GET /cats_warehouse/v1/dispatch_orders/:id/reservations`
  - Purpose: list reservations for the order
  - Roles: Officer, Hub Manager, Warehouse Manager, Storekeeper

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive reservation layer; creating a reservation must not directly mutate legacy stock rows

### SpaceReservation

#### Table Name
- `cats_warehouse_space_reservations`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `receipt_order_id` | `bigint` | Parent receipt order | `null: false`, indexed |
| `receipt_order_line_id` | `bigint` | Parent line | `null: false`, indexed |
| `warehouse_id` | `bigint` | Reserved warehouse | `null: false`, indexed |
| `store_id` | `bigint` | Optional reserved store | nullable, indexed |
| `reserved_quantity` | `float` | Quantity space reserved for | nullable |
| `reserved_volume` | `float` | Reserved volume/capacity | nullable |
| `status` | `string` | Reservation state | `null: false`, default `Reserved`, indexed |
| `reserved_by_id` | `bigint` | Reserving user | `null: false` |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder"`
- `belongs_to :receipt_order_line, class_name: "Cats::Warehouse::ReceiptOrderLine"`
- `belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"`
- `belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true`
- `belongs_to :reserved_by, class_name: "Cats::Core::User"`

#### Key Indexes
- `receipt_order_id`
- `receipt_order_line_id`
- `warehouse_id`
- `store_id`
- `status`

#### APIs
- `POST /cats_warehouse/v1/receipt_orders/:id/reserve_space`
  - Purpose: reserve destination capacity for inbound goods
  - Roles: Storekeeper, Warehouse Manager

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive reservation layer; do not hard-replace current `Store.available_space`

### Backorder

#### Table Name
- `cats_warehouse_backorders`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `dispatch_order_id` | `bigint` | Parent dispatch order | `null: false`, indexed |
| `dispatch_order_line_id` | `bigint` | Parent line | `null: false`, indexed |
| `stock_reservation_id` | `bigint` | Optional originating reservation | nullable, indexed |
| `commodity_id` | `bigint` | Commodity | `null: false` |
| `unit_id` | `bigint` | Unit | `null: false` |
| `requested_quantity` | `float` | Requested quantity | `null: false` |
| `backordered_quantity` | `float` | Unfulfilled quantity | `null: false` |
| `reason` | `string` | Backorder reason | nullable |
| `status` | `string` | Backorder state | `null: false`, default `Open`, indexed |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder"`
- `belongs_to :dispatch_order_line, class_name: "Cats::Warehouse::DispatchOrderLine"`
- `belongs_to :stock_reservation, class_name: "Cats::Warehouse::StockReservation", optional: true`
- `belongs_to :commodity, class_name: "Cats::Core::Commodity"`
- `belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"`

#### Key Indexes
- `dispatch_order_id`
- `dispatch_order_line_id`
- `stock_reservation_id`
- `status`

#### APIs
- surfaced through dispatch order and GIN detail endpoints
- optional `GET /cats_warehouse/v1/dispatch_orders/:id/backorders`
  - Purpose: list unresolved backorders for an order
  - Roles: Officer, Hub Manager, Warehouse Manager

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive line-level backorder model; do not overload GIN header status for backlog tracking

### WorkflowEvent

#### Table Name
- `cats_warehouse_workflow_events`

#### Attributes
| Field | Type | Description | Constraints |
|---|---|---|---|
| `entity_type` | `string` | Polymorphic entity type | `null: false` |
| `entity_id` | `bigint` | Polymorphic entity id | `null: false` |
| `event_type` | `string` | Workflow event code | `null: false`, indexed |
| `from_status` | `string` | Previous status | nullable |
| `to_status` | `string` | New status | nullable |
| `actor_id` | `bigint` | Acting user | nullable, indexed |
| `payload` | `jsonb` | Additional event metadata | nullable |
| `occurred_at` | `datetime` | Event time | `null: false` |
| `created_at` | `datetime` | Rails timestamp | `null: false` |
| `updated_at` | `datetime` | Rails timestamp | `null: false` |

#### Relationships
- `belongs_to :entity, polymorphic: true`
- `belongs_to :actor, class_name: "Cats::Core::User", optional: true`

#### Key Indexes
- composite index on `(entity_type, entity_id, occurred_at)`
- `event_type`
- `actor_id`

#### APIs
- `GET /cats_warehouse/v1/receipt_orders/:id/workflow`
  - Purpose: list workflow/audit history for a receipt order
  - Roles: Officer, Hub Manager, Warehouse Manager
- `GET /cats_warehouse/v1/dispatch_orders/:id/workflow`
  - Purpose: list workflow/audit history for a dispatch order
  - Roles: Officer, Hub Manager, Warehouse Manager
- optional future workflow timelines for GRN / GIN / Inspection / Waybill

#### Notes
- Status: `NEW (ADD)`
- Migration strategy: additive audit log; should not disturb current transaction tables

## Implementation Notes

- Use current Rails naming:
  - model namespace `Cats::Warehouse::<Model>`
  - explicit `self.table_name = "cats_warehouse_..."`
- Keep all new APIs inside the existing engine namespace under `/cats_warehouse/v1/...`
- Preserve the current facility hierarchy:
  - `Hub -> Warehouse -> Store -> Stack`
- Do not introduce `Aisle`, `Rack`, or `Bin` in this document
- Align new stock semantics with:
  - `InventoryLedger`
  - `DocumentLifecycle`
  - `StockBalance`
  - `StackTransaction`
- Extend `DocumentLifecycle` carefully so `Draft` and `Confirmed` remain valid for all existing documents
- Keep current manual controllers/services as valid entry points even after order-linked automation is introduced

## Test and Migration Guidance

- Every new model should be introduced through additive migrations only
- Use nullable foreign keys for all links from legacy models to new orchestration or traceability models
- Legacy records must remain readable and valid when:
  - `receipt_order_id` is null
  - `dispatch_order_id` is null
  - `inventory_lot_id` is null
  - `base_unit_id` / `base_quantity` are null
- `StockBalance` uniqueness should be migrated in phases:
  - Phase 1: add nullable lot/base/reservation columns
  - Phase 2: backfill where needed
  - Phase 3: add extended uniqueness/index strategy if the ledger writes the new dimensions consistently
- GRN / GIN / Inspection / Waybill endpoints must continue accepting old payloads until all forms send the new fields
- Reservation creation should not directly mutate existing on-hand stock rows; reserve through additive records first, then let issue/receipt confirmation reconcile totals
