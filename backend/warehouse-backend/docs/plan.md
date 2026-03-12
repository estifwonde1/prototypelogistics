# Backend Modification Plan - CATS Warehouse Engine (Revised)

## Summary
This plan defines the revised data model for a new `cats_warehouse` engine. The engine owns warehouse infrastructure, inventory tracking, and document lifecycle (GRN - Inspection - GIN - Waybill). The geography hierarchy remains in Cats Core (`cats_core_locations`). This document includes all model details and adds normalization guidance starting with the Hub model.

## Model Classification
### Migrated from Cats Core - Warehouse Engine
1. `cats_warehouse_stores` (from `cats_core_stores`)
   - `warehouse_id` FK now points to `cats_warehouse_warehouses.id` instead of `cats_core_locations.id`.
2. `cats_warehouse_stacks` (from `cats_core_stacks`)
   - Serves as bin/slot model.
3. `cats_warehouse_stack_transactions` (from `cats_core_stack_transactions`)
   - Extended into a unified stock movement ledger.
4. `cats_warehouse_stacking_rules` (from `cats_core_stacking_rules`)
   - Rules tied to specific warehouse.
5. `cats_warehouse_inventory_adjustments` (from `cats_core_inventory_adjustments`)
   - FK updated to new stack table.

### New Models in Warehouse Engine
1. `cats_warehouse_hubs`
2. `cats_warehouse_warehouses`
3. `cats_warehouse_grns`
4. `cats_warehouse_grn_items`
5. `cats_warehouse_gins`
6. `cats_warehouse_gin_items`
7. `cats_warehouse_inspections`
8. `cats_warehouse_inspection_items`
9. `cats_warehouse_waybills`
10. `cats_warehouse_waybill_items`
11. `cats_warehouse_stock_balances`


## Detailed Model Specifications 

### 1) Migrated: Stores (`cats_warehouse_stores`)
Fields:
- `id` bigint PK
- `code` string
- `name` string (required)
- `length` float (required)
- `width` float (required)
- `height` float (required)
- `usable_space` float (required)
- `available_space` float (required)
- `temporary` boolean (default false)
- `has_gangway` boolean (default false)
- `gangway_length` float (optional)
- `gangway_width` float (optional)
- `gangway_corner_dist` float (optional)
- `warehouse_id` bigint FK -> `cats_warehouse_warehouses.id`
- timestamps
Relationships:
- `Store belongs_to :warehouse`
- `Store has_many :stacks`

### 2) Migrated: Stacks / Bins (`cats_warehouse_stacks`)
Fields:
- `id` bigint PK
- `code` string
- `length` float (required)
- `width` float (required)
- `height` float (required)
- `start_x` float (position in store plan)
- `start_y` float (position in store plan)
- `commodity_id` bigint FK -> `cats_core_commodities.id`
- `store_id` bigint FK -> `cats_warehouse_stores.id`
- `commodity_status` string (default "Good")
- `stack_status` string (default "Reserved")
- `quantity` float (default 0)
- `unit_id` bigint FK -> `cats_core_unit_of_measures.id`
- timestamps
Relationships:
- `Stack belongs_to :store`
- `Stack belongs_to :commodity (Cats::Core::Commodity)`

### 3) Migrated: Stacking Rules (`cats_warehouse_stacking_rules`)
Fields:
- `id` bigint PK
- `warehouse_id` bigint FK -> `cats_warehouse_warehouses.id`
- `distance_from_wall` float (required)
- `space_between_stack` float (required)
- `distance_from_ceiling` float (required)
- `maximum_height` float (required)
- `maximum_length` float (required)
- `maximum_width` float (required)
- `distance_from_gangway` float (required)
- timestamps

### 4) Migrated: Inventory Adjustments (`cats_warehouse_inventory_adjustments`)
Fields:
- `id` bigint PK
- `reference_no` string
- `quantity` float
- `reason_for_adjustment` string
- `adjustment_date` date (required)
- `status` string (default "Draft")
- `unit_id` bigint FK -> `cats_core_unit_of_measures.id`
- `stack_id` bigint FK -> `cats_warehouse_stacks.id`
- timestamps

### 5) New: Hubs (`cats_warehouse_hubs`)
Fields:
- `id` bigint PK
- `location_id` bigint FK -> `cats_core_locations.id` (required)
- `code` string
- `name` string (required)
- `hub_type` string
- `status` string
- `description` string
- `address` string
- `latitude` float
- `longitude` float
- `total_area_sqm` float
- `total_capacity_mt` float
- `construction_year` integer
- `ownership_type` string
- `has_loading_dock` boolean
- `number_of_loading_docks` integer
- `loading_dock_type` string
- `access_road_type` string
- `nearest_town` string
- `distance_from_town_km` float
- `has_weighbridge` boolean
- `floor_type` string
- `roof_type` string
- `has_ventilation` boolean
- `has_drainage_system` boolean
- `has_fumigation_facility` boolean
- `has_pest_control` boolean
- `has_fire_extinguisher` boolean
- `has_security_guard` boolean
- `security_type` string
- `manager_name` string
- `contact_phone` string
- `contact_email` string
- timestamps
Relationships:
- `Hub belongs_to :location, class_name: 'Cats::Core::Location'`
- `Hub has_many :warehouses`

### 6) New: Warehouses (`cats_warehouse_warehouses`)
Fields:
- `id` bigint PK
- `location_id` bigint FK -> `cats_core_locations.id` (required)
- `hub_id` bigint FK -> `cats_warehouse_hubs.id` (optional)
- `code` string
- `name` string (required)
- `warehouse_type` string
- `status` string
- `description` string
- `address` string
- `latitude` float
- `longitude` float
- `altitude_m` float
- `total_area_sqm` float
- `total_storage_capacity_mt` float
- `usable_storage_capacity_mt` float
- `no_of_stores` integer
- `construction_year` integer
- `ownership_type` string
- `floor_type` string
- `roof_type` string
- `has_loading_dock` boolean
- `number_of_loading_docks` integer
- `has_fumigation_facility` boolean
- `has_fire_extinguisher` boolean
- `has_security_guard` boolean
- `access_road_type` string
- `nearest_town` string
- `distance_from_town_km` float
- `manager_name` string
- `contact_phone` string
- `contact_email` string
- timestamps
Relationships:
- `Warehouse belongs_to :location, class_name: 'Cats::Core::Location'`
- `Warehouse belongs_to :hub, optional: true`
- `Warehouse has_many :stores`
- `Warehouse has_many :stacking_rules`

### 7) New: Stock Balances (`cats_warehouse_stock_balances`)
Fields:
- `id` bigint PK
- `warehouse_id` bigint FK -> `cats_warehouse_warehouses.id`
- `store_id` bigint FK -> `cats_warehouse_stores.id` (optional)
- `stack_id` bigint FK -> `cats_warehouse_stacks.id` (optional)
- `commodity_id` bigint FK -> `cats_core_commodities.id`
- `quantity` float (required)
- `unit_id` bigint FK -> `cats_core_unit_of_measures.id`
- timestamps
Relationships:
- `StockBalance belongs_to :warehouse`
- `StockBalance belongs_to :store, optional: true`
- `StockBalance belongs_to :stack, optional: true`
- `StockBalance belongs_to :commodity, class_name: 'Cats::Core::Commodity'`

### 8) GRN � Goods Receipt Note
`cats_warehouse_grns` (header)
- `id` bigint PK
- `reference_no` string
- `warehouse_id` bigint FK -> `cats_warehouse_warehouses.id`
- `received_on` date (required)
- `source_type` string (polymorphic: PO / GiftCertificate / Transfer)
- `source_id` bigint (polymorphic)
- `status` string (draft / confirmed)
- `received_by_id` bigint FK -> `cats_core_users.id`
- `approved_by_id` bigint FK -> `cats_core_users.id` (optional)
- timestamps

`cats_warehouse_grn_items` (lines)
- `id` bigint PK
- `grn_id` bigint FK -> `cats_warehouse_grns.id`
- `commodity_id` bigint FK -> `cats_core_commodities.id`
- `quantity` float (required)
- `unit_id` bigint FK -> `cats_core_unit_of_measures.id`
- `quality_status` string
- `store_id` bigint FK -> `cats_warehouse_stores.id` (optional)
- `stack_id` bigint FK -> `cats_warehouse_stacks.id` (optional)
- timestamps

Confirmation triggers stack transactions + stock balance updates.

### 9) GIN � Goods Issue Note
`cats_warehouse_gins` (header)
- `id` bigint PK
- `reference_no` string
- `warehouse_id` bigint FK -> `cats_warehouse_warehouses.id`
- `issued_on` date (required)
- `destination_type` string (polymorphic)
- `destination_id` bigint (polymorphic)
- `status` string (draft / confirmed)
- `issued_by_id` bigint FK -> `cats_core_users.id`
- `approved_by_id` bigint FK -> `cats_core_users.id` (optional)
- timestamps

`cats_warehouse_gin_items` (lines)
- `id` bigint PK
- `gin_id` bigint FK -> `cats_warehouse_gins.id`
- `commodity_id` bigint FK -> `cats_core_commodities.id`
- `quantity` float (required)
- `unit_id` bigint FK -> `cats_core_unit_of_measures.id`
- `store_id` bigint FK -> `cats_warehouse_stores.id` (optional)
- `stack_id` bigint FK -> `cats_warehouse_stacks.id` (optional)
- timestamps

Confirmation creates issue movements and reduces stock balance.

### 10) Inspection Report
`cats_warehouse_inspections` (header)
- `id` bigint PK
- `reference_no` string
- `warehouse_id` bigint FK -> `cats_warehouse_warehouses.id`
- `inspected_on` date (required)
- `inspector_id` bigint FK -> `cats_core_users.id`
- `source_type` string (polymorphic: GRN or inbound notice)
- `source_id` bigint (polymorphic)
- `status` string (draft / confirmed)
- timestamps

`cats_warehouse_inspection_items` (lines)
- `id` bigint PK
- `inspection_id` bigint FK -> `cats_warehouse_inspections.id`
- `commodity_id` bigint FK -> `cats_core_commodities.id`
- `quantity_received` float (required)
- `quantity_damaged` float (default 0)
- `quantity_lost` float (default 0)
- `quality_status` string
- `packaging_condition` string
- `remarks` text
- timestamps

On confirmation: updates GRN line quality and creates loss/damage movements.

### 11) Waybill
`cats_warehouse_waybills` (header)
- `id` bigint PK
- `reference_no` string
- `dispatch_id` bigint FK -> `cats_core_dispatches.id` (transition only)
- `transporter_id` bigint FK -> `cats_core_transporters.id`
- `vehicle_plate_no` string
- `driver_name` string
- `driver_phone` string
- `source_location_id` bigint FK -> `cats_core_locations.id`
- `destination_location_id` bigint FK -> `cats_core_locations.id`
- `issued_on` date (required)
- `status` string
- timestamps

`cats_warehouse_waybill_items` (lines)
- `id` bigint PK
- `waybill_id` bigint FK -> `cats_warehouse_waybills.id`
- `commodity_id` bigint FK -> `cats_core_commodities.id`
- `quantity` float (required)
- `unit_id` bigint FK -> `cats_core_unit_of_measures.id`
- timestamps

## Additive Changes to Cats Core
### Commodity Category Enhancements
Add to `cats_core_commodity_categories`:
- `commodity_class` (Food / Non-Food)
- `commodity_group`
- `is_perishable`
- `requires_cold_storage`
- `requires_dry_storage`
- `hazard_level`
- `handling_notes`
- `max_storage_days`
- `default_unit_id` FK -> `cats_core_unit_of_measures.id`

### Purchase Order Enhancements
Add to `cats_core_purchase_orders`:
- `status` string
- `expected_delivery_date` date
- `actual_delivery_date` date
- `destination_warehouse_id` bigint FK -> `cats_warehouse_warehouses.id`
- `approved_by_id` bigint FK -> `cats_core_users.id`

### Gift Certificate Enhancements
Add to `cats_core_gift_certificates`:
- `status` string
- `expected_arrival_date` date
- `actual_arrival_date` date
- `approved_by_id` bigint FK -> `cats_core_users.id`

Note: `cats_core_gift_certificates.destination_warehouse_id` currently points to `cats_core_locations.id`; update to `cats_warehouse_warehouses.id` in Phase 2.

## Overlap Resolution
- `cats_core_stacks` vs. bins: use stacks as the bin model; drop separate bins proposal.
- `cats_core_stack_transactions` vs. stock movements: merge by extending stack transactions.
- `cats_core_commodities` vs. stock_lots: drop stock_lots.
- `cats_core_receipt_authorizations/receipts` vs. GRN: coexist in Phase 1, replace in Phase 3.
- `cats_core_dispatches/dispatch_authorizations` vs. GIN: coexist in Phase 1, replace in Phase 3.

## Entity Relationship Summary
- `Cats::Core::Location` -> `Hub` -> `Warehouse` -> `Store` -> `Stack` -> `InventoryAdjustment/StackTransaction`
- `Cats::Core::Commodity` links to `GRN items`, `GIN items`, `Inspection items`, `Waybill items`, and `StockBalance`
- GRN/GIN/Inspection confirmations drive `StackTransactions` + `StockBalances`
- Waybill links to dispatch during transition

## Normalization -> Hub Model (Breakdown)
To reduce null-heavy columns and improve maintainability, split hub details into normalized sub-tables. Base hub identity remains in `cats_warehouse_hubs`.

### 1) Base Hub (`cats_warehouse_hubs`)
Core identity and linkage:
- `id`, `location_id` (required), `code`, `name`, `hub_type`, `status`, `description`
Relationships:
- `Hub belongs_to :location, class_name: 'Cats::Core::Location'`
- `Hub has_one :hub_geo`
- `Hub has_one :hub_capacity`
- `Hub has_one :hub_access`
- `Hub has_one :hub_infra`
- `Hub has_one :hub_contacts`
- `Hub has_many :warehouses`

### 2) Hub Geography (`cats_warehouse_hub_geo`)
- `hub_id` FK -> `cats_warehouse_hubs.id`
- `address`, `latitude`, `longitude`
Relationships:
- `HubGeo belongs_to :hub`

### 3) Hub Capacity (`cats_warehouse_hub_capacity`)
- `hub_id` FK
- `total_area_sqm`, `total_capacity_mt`, `construction_year`, `ownership_type`
Relationships:
- `HubCapacity belongs_to :hub`

### 4) Hub Access & Loading (`cats_warehouse_hub_access`)
- `hub_id` FK
- `has_loading_dock`, `number_of_loading_docks`, `loading_dock_type`
- `access_road_type`, `nearest_town`, `distance_from_town_km`, `has_weighbridge`
Relationships:
- `HubAccess belongs_to :hub`

### 5) Hub Infrastructure & Safety (`cats_warehouse_hub_infra`)
- `hub_id` FK
- `floor_type`, `roof_type`
- `has_ventilation`, `has_drainage_system`
- `has_fumigation_facility`, `has_pest_control`
- `has_fire_extinguisher`, `has_security_guard`, `security_type`
Relationships:
- `HubInfra belongs_to :hub`

### 6) Hub Contacts (`cats_warehouse_hub_contacts`)
- `hub_id` FK
- `manager_name`, `contact_phone`, `contact_email`
Relationships:
- `HubContacts belongs_to :hub`

### Mapping from Original Hub Columns
All hub fields listed in section "New: Hubs" map to one of the normalized tables above. The base hub table retains only identity, type, status, and description.

## Normalization -> Warehouse Model (Breakdown)
Break down warehouse details into normalized sub-tables while keeping identity in `cats_warehouse_warehouses`.

### 1) Base Warehouse (`cats_warehouse_warehouses`)
Core identity and linkage:
- `id`, `location_id` (required), `hub_id` (optional)
- `code`, `name`, `warehouse_type`, `status`, `description`
Relationships:
- `Warehouse belongs_to :location, class_name: 'Cats::Core::Location'`
- `Warehouse belongs_to :hub, optional: true`
- `Warehouse has_one :warehouse_geo`
- `Warehouse has_one :warehouse_capacity`
- `Warehouse has_one :warehouse_access`
- `Warehouse has_one :warehouse_infra`
- `Warehouse has_one :warehouse_contacts`
- `Warehouse has_many :stores`
- `Warehouse has_many :stacking_rules`

### 2) Warehouse Geography (`cats_warehouse_warehouse_geo`)
- `warehouse_id` FK -> `cats_warehouse_warehouses.id`
- `address`, `latitude`, `longitude`, `altitude_m`
Relationships:
- `WarehouseGeo belongs_to :warehouse`

### 3) Warehouse Capacity (`cats_warehouse_warehouse_capacity`)
- `warehouse_id` FK
- `total_area_sqm`, `total_storage_capacity_mt`, `usable_storage_capacity_mt`, `no_of_stores`, `construction_year`
- `ownership_type`
Relationships:
- `WarehouseCapacity belongs_to :warehouse`

### 4) Warehouse Access & Loading (`cats_warehouse_warehouse_access`)
- `warehouse_id` FK
- `has_loading_dock`, `number_of_loading_docks`
- `access_road_type`, `nearest_town`, `distance_from_town_km`
Relationships:
- `WarehouseAccess belongs_to :warehouse`

### 5) Warehouse Infrastructure & Safety (`cats_warehouse_warehouse_infra`)
- `warehouse_id` FK
- `floor_type`, `roof_type`
- `has_fumigation_facility`, `has_fire_extinguisher`, `has_security_guard`
Relationships:
- `WarehouseInfra belongs_to :warehouse`

### 6) Warehouse Contacts (`cats_warehouse_warehouse_contacts`)
- `warehouse_id` FK
- `manager_name`, `contact_phone`, `contact_email`
Relationships:
- `WarehouseContacts belongs_to :warehouse`

### Mapping from Original Warehouse Columns
All warehouse fields listed in section New: Warehouses map to one of the normalized tables above. The base warehouse table retains only identity, linkage, type/status, and description.

## Normalization - Inspection Model (Breakdown)
Split inspection header from inspection items and optional inspector profile to reduce duplication.

### 1) Base Inspection (`cats_warehouse_inspections`)
Core identity and linkage:
- `id`, `warehouse_id`, `inspected_on`, `inspector_id`, `source_type`, `source_id`, `status`, `reference_no`
Relationships:
- `Inspection belongs_to :warehouse`
- `Inspection belongs_to :inspector, class_name: 'Cats::Core::User'`
- `Inspection belongs_to :source, polymorphic: true`
- `Inspection has_many :inspection_items`

### 2) Inspection Items (`cats_warehouse_inspection_items`)
Line-level quantities and condition:
- `inspection_id`, `commodity_id`
- `quantity_received`, `quantity_damaged`, `quantity_lost`
- `quality_status`, `packaging_condition`, `remarks`
Relationships:
- `InspectionItem belongs_to :inspection`
- `InspectionItem belongs_to :commodity, class_name: 'Cats::Core::Commodity'`

### 3) Optional Inspector Profile (`cats_warehouse_inspectors`)
Use only if you need inspector directory beyond core users.
- `user_id` FK -> `cats_core_users.id`
- `qualification`, `license_no`, `organization`, `phone`
Relationships:
- `Inspector belongs_to :user`

## Normalization - Waybill Model (Breakdown)
Split waybill header, transport details, and line items.

### 1) Base Waybill (`cats_warehouse_waybills`)
Core identity and linkage:
- `id`, `reference_no`, `dispatch_id`, `issued_on`, `status`
- `source_location_id`, `destination_location_id`
Relationships:
- `Waybill belongs_to :dispatch, class_name: 'Cats::Core::Dispatch', optional: true`
- `Waybill belongs_to :source_location, class_name: 'Cats::Core::Location'`
- `Waybill belongs_to :destination_location, class_name: 'Cats::Core::Location'`
- `Waybill has_one :waybill_transport`
- `Waybill has_many :waybill_items`

### 2) Waybill Transport (`cats_warehouse_waybill_transport`)
Vehicle and driver details:
- `waybill_id` FK
- `transporter_id` FK -> `cats_core_transporters.id`
- `vehicle_plate_no`, `driver_name`, `driver_phone`
Relationships:
- `WaybillTransport belongs_to :waybill`
- `WaybillTransport belongs_to :transporter, class_name: 'Cats::Core::Transporter'`

### 3) Waybill Items (`cats_warehouse_waybill_items`)
Line items:
- `waybill_id`, `commodity_id`, `quantity`, `unit_id`
Relationships:
- `WaybillItem belongs_to :waybill`
- `WaybillItem belongs_to :commodity, class_name: 'Cats::Core::Commodity'`
- `WaybillItem belongs_to :unit, class_name: 'Cats::Core::UnitOfMeasure'`

