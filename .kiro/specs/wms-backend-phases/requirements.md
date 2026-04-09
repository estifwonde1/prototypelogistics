# Requirements Document: WMS Backend Phases

## Introduction

This document defines the backend requirements for implementing a three-phase Warehouse Management System (WMS) within the existing `Cats::Warehouse` engine. The system enables officer-driven orchestration of receipt and dispatch orders, inventory traceability through lot/expiry/UOM tracking, and manager/storekeeper assignment with reservation workflows. All APIs are designed from a frontend-first perspective to ensure UI components can render without additional API calls and receive proper workflow control metadata.

## Glossary

- **WMS_Backend**: The backend system implementing warehouse management APIs and business logic
- **Officer**: A warehouse-wide role responsible for creating and confirming receipt and dispatch orders
- **Hub_Manager**: A role responsible for assigning warehouses to orders at the hub level
- **Warehouse_Manager**: A role responsible for assigning stores/stacks and preparing execution at the warehouse level
- **Store_Keeper**: A role responsible for reserving space and stock at the store/stack level
- **Receipt_Order**: An orchestrating record representing an inbound warehouse operation
- **Dispatch_Order**: An orchestrating record representing an outbound warehouse operation
- **GRN**: Goods Received Note - a document recording actual receipt of goods
- **GIN**: Goods Issue Note - a document recording actual issue of goods
- **Inspection**: A document recording quality inspection of received goods
- **Waybill**: A document recording transport details for dispatch
- **Inventory_Lot**: A traceability record linking stock to batch number and expiry date
- **UOM_Conversion**: A unit of measure conversion rule between entered and base units
- **Stock_Reservation**: A record reserving specific stock quantities for dispatch orders
- **Space_Reservation**: A record reserving storage capacity for receipt orders
- **Workflow_Event**: An audit record tracking state transitions in order execution
- **API_Response**: A structured JSON response following the standard format with id, type, attributes, relationships, and meta
- **Display_Field**: A human-readable field included in API responses for immediate UI rendering
- **Action_Metadata**: Backend-controlled metadata indicating allowed user actions based on workflow state
- **Legacy_Stock**: Existing stock records without lot or UOM traceability fields


## Requirements

### Requirement 1: Officer-Driven Receipt Order Orchestration

**User Story:** As an Officer, I want to create and confirm receipt orders with draft/confirm workflow, so that I can orchestrate inbound warehouse operations before physical receipt occurs.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a `POST /cats_warehouse/v1/receipt_orders` endpoint that accepts order header data and line items
2. WHEN a receipt order is created, THE WMS_Backend SHALL assign it a `Draft` status
3. THE WMS_Backend SHALL return API_Response with Display_Field values including warehouse name, commodity names, and unit names for all line items
4. THE WMS_Backend SHALL include Action_Metadata indicating allowed actions `["edit", "confirm", "delete"]` for Draft status
5. THE WMS_Backend SHALL provide a `GET /cats_warehouse/v1/receipt_orders` endpoint that returns paginated lists scoped by Officer role
6. THE WMS_Backend SHALL provide a `GET /cats_warehouse/v1/receipt_orders/:id` endpoint that returns full order details with relationships expanded
7. THE WMS_Backend SHALL provide a `POST /cats_warehouse/v1/receipt_orders/:id/confirm` endpoint that transitions status from Draft to Confirmed
8. WHEN a receipt order is confirmed, THE WMS_Backend SHALL include Action_Metadata indicating allowed actions `["view", "assign"]` for Confirmed status
9. WHEN a receipt order is confirmed, THE WMS_Backend SHALL send notifications to Hub_Manager and Warehouse_Manager roles
10. THE WMS_Backend SHALL validate that all line items have positive quantities before allowing confirmation
11. THE WMS_Backend SHALL validate that warehouse, commodity, and unit references exist before creating the order
12. WHILE a receipt order has Draft status, THE WMS_Backend SHALL allow updates to header and line item data
13. WHILE a receipt order has Confirmed status, THE WMS_Backend SHALL prevent modifications to order data

#### API Contract Example

```json
{
  "id": "123",
  "type": "receipt_order",
  "attributes": {
    "order_number": "RO-2025-001",
    "status": "draft",
    "source_type": "purchase",
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse",
    "hub_id": 2,
    "hub_name": "Regional Hub A",
    "created_at": "2025-01-15T10:30:00Z",
    "confirmed_at": null,
    "total_lines": 3
  },
  "relationships": {
    "lines": [
      {
        "id": "456",
        "commodity_id": 10,
        "commodity_name": "Wheat Flour",
        "commodity_code": "WF-001",
        "quantity": 1000,
        "unit_id": 3,
        "unit_name": "Quintal",
        "unit_abbreviation": "qt"
      }
    ]
  },
  "meta": {
    "allowed_actions": ["edit", "confirm", "delete"],
    "workflow_state": "draft",
    "can_assign": false,
    "can_reserve": false
  }
}
```



### Requirement 2: Officer-Driven Dispatch Order Orchestration

**User Story:** As an Officer, I want to create and confirm dispatch orders with draft/confirm workflow, so that I can orchestrate outbound warehouse operations before physical dispatch occurs.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a `POST /cats_warehouse/v1/dispatch_orders` endpoint that accepts order header data and line items
2. WHEN a dispatch order is created, THE WMS_Backend SHALL assign it a `Draft` status
3. THE WMS_Backend SHALL return API_Response with Display_Field values including warehouse name, destination name, commodity names, and unit names for all line items
4. THE WMS_Backend SHALL include Action_Metadata indicating allowed actions `["edit", "confirm", "delete"]` for Draft status
5. THE WMS_Backend SHALL provide a `GET /cats_warehouse/v1/dispatch_orders` endpoint that returns paginated lists scoped by Officer role
6. THE WMS_Backend SHALL provide a `GET /cats_warehouse/v1/dispatch_orders/:id` endpoint that returns full order details with relationships expanded
7. THE WMS_Backend SHALL provide a `POST /cats_warehouse/v1/dispatch_orders/:id/confirm` endpoint that transitions status from Draft to Confirmed
8. WHEN a dispatch order is confirmed, THE WMS_Backend SHALL include Action_Metadata indicating allowed actions `["view", "assign"]` for Confirmed status
9. WHEN a dispatch order is confirmed, THE WMS_Backend SHALL send notifications to Warehouse_Manager and Store_Keeper roles
10. THE WMS_Backend SHALL validate that all line items have positive quantities before allowing confirmation
11. THE WMS_Backend SHALL validate that warehouse, commodity, unit, and destination references exist before creating the order
12. WHILE a dispatch order has Draft status, THE WMS_Backend SHALL allow updates to header and line item data
13. WHILE a dispatch order has Confirmed status, THE WMS_Backend SHALL prevent modifications to order data

#### API Contract Example

```json
{
  "id": "789",
  "type": "dispatch_order",
  "attributes": {
    "order_number": "DO-2025-001",
    "status": "confirmed",
    "destination_type": "distribution_center",
    "destination_id": 12,
    "destination_name": "District DC North",
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse",
    "created_at": "2025-01-15T11:00:00Z",
    "confirmed_at": "2025-01-15T11:15:00Z",
    "total_lines": 2
  },
  "relationships": {
    "lines": [
      {
        "id": "890",
        "commodity_id": 10,
        "commodity_name": "Wheat Flour",
        "commodity_code": "WF-001",
        "quantity": 500,
        "unit_id": 3,
        "unit_name": "Quintal",
        "unit_abbreviation": "qt"
      }
    ]
  },
  "meta": {
    "allowed_actions": ["view", "assign"],
    "workflow_state": "confirmed",
    "can_assign": true,
    "can_reserve": false
  }
}
```



### Requirement 3: Officer Role Integration

**User Story:** As an Officer, I want to authenticate and access officer-specific features, so that I can perform my warehouse orchestration responsibilities.

#### Acceptance Criteria

1. THE WMS_Backend SHALL recognize `Officer` as a valid warehouse-module role
2. WHEN an Officer authenticates, THE WMS_Backend SHALL return role information in the authentication response
3. THE WMS_Backend SHALL scope receipt order and dispatch order queries to warehouses accessible by the Officer
4. THE WMS_Backend SHALL allow Officers to create, view, and confirm receipt orders and dispatch orders
5. THE WMS_Backend SHALL prevent Officers from accessing Hub_Manager, Warehouse_Manager, or Store_Keeper exclusive functions
6. THE WMS_Backend SHALL include Officer role in seeding and role lookup services
7. THE WMS_Backend SHALL maintain backward compatibility with existing Admin, Superadmin, Hub_Manager, Warehouse_Manager, and Store_Keeper roles

#### API Contract Example

```json
{
  "id": "user-123",
  "type": "user",
  "attributes": {
    "username": "officer.john",
    "email": "john@warehouse.example",
    "full_name": "John Officer"
  },
  "relationships": {
    "roles": [
      {
        "id": "role-456",
        "role_name": "Officer",
        "module": "warehouse",
        "scope": "warehouse_wide"
      }
    ]
  },
  "meta": {
    "allowed_actions": ["create_receipt_order", "create_dispatch_order", "view_dashboard"],
    "accessible_warehouses": [5, 7, 9]
  }
}
```



### Requirement 4: Document-to-Order Linking

**User Story:** As a system integrator, I want existing GRN, GIN, Inspection, and Waybill documents to optionally link to receipt and dispatch orders, so that order-driven and manual workflows can coexist.

#### Acceptance Criteria

1. THE WMS_Backend SHALL add nullable `receipt_order_id` foreign key to Inspection and GRN models
2. THE WMS_Backend SHALL add nullable `dispatch_order_id` foreign key to Waybill and GIN models
3. WHEN a GRN is created without a receipt order link, THE WMS_Backend SHALL process it as a manual receipt
4. WHEN a GIN is created without a dispatch order link, THE WMS_Backend SHALL process it as a manual issue
5. WHEN a document is linked to an order, THE WMS_Backend SHALL include order reference in the document API response
6. THE WMS_Backend SHALL maintain backward compatibility for all existing document creation endpoints
7. THE WMS_Backend SHALL allow Legacy_Stock and legacy documents to operate with null order references

#### API Contract Example

```json
{
  "id": "grn-555",
  "type": "grn",
  "attributes": {
    "grn_number": "GRN-2025-042",
    "status": "confirmed",
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse",
    "receipt_order_id": 123,
    "receipt_order_number": "RO-2025-001",
    "received_date": "2025-01-16T09:00:00Z"
  },
  "relationships": {
    "items": [
      {
        "id": "grn-item-777",
        "commodity_id": 10,
        "commodity_name": "Wheat Flour",
        "quantity": 1000,
        "unit_name": "Quintal"
      }
    ]
  },
  "meta": {
    "allowed_actions": ["view", "print"],
    "workflow_state": "confirmed",
    "linked_to_order": true
  }
}
```



### Requirement 5: Inventory Lot Traceability

**User Story:** As a warehouse operator, I want to track inventory by lot, batch number, and expiry date, so that I can ensure product quality and comply with traceability regulations.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide an Inventory_Lot model with warehouse_id, commodity_id, batch_no, and expiry_date fields
2. THE WMS_Backend SHALL create unique lots based on the combination of warehouse, commodity, batch number, and expiry date
3. THE WMS_Backend SHALL add nullable `inventory_lot_id` to GRN items, GIN items, Waybill items, and Inspection items
4. THE WMS_Backend SHALL add nullable `inventory_lot_id` to Stock_Balance and Stack_Transaction records
5. WHEN a GRN is created with batch and expiry information, THE WMS_Backend SHALL create or resolve an Inventory_Lot
6. WHEN a GIN is created, THE WMS_Backend SHALL allow selection of specific lots for issue
7. THE WMS_Backend SHALL provide a `GET /cats_warehouse/v1/reference_data/lots` endpoint filtered by warehouse and commodity
8. THE WMS_Backend SHALL include lot details in stock balance and bin card API responses
9. THE WMS_Backend SHALL maintain backward compatibility for Legacy_Stock with null inventory_lot_id
10. WHEN lot information is unavailable, THE WMS_Backend SHALL use commodity-level batch_no and best_use_before as defaults

#### API Contract Example

```json
{
  "id": "lot-888",
  "type": "inventory_lot",
  "attributes": {
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse",
    "commodity_id": 10,
    "commodity_name": "Wheat Flour",
    "commodity_code": "WF-001",
    "batch_no": "BATCH-2025-001",
    "expiry_date": "2026-01-15",
    "days_until_expiry": 365,
    "is_expiring_soon": false
  },
  "meta": {
    "allowed_actions": ["view", "track"],
    "available_quantity": 1000,
    "reserved_quantity": 0
  }
}
```



### Requirement 6: Multi-UOM Support

**User Story:** As a warehouse operator, I want to record quantities in different units of measure and automatically convert to base units, so that I can handle commodities measured in multiple ways.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a UOM_Conversion model with from_unit_id, to_unit_id, and conversion_factor fields
2. THE WMS_Backend SHALL add nullable `entered_unit_id`, `base_unit_id`, and `base_quantity` to GRN items, GIN items, and Waybill items
3. THE WMS_Backend SHALL add nullable `base_unit_id` and `base_quantity` to Stock_Balance and Stack_Transaction records
4. WHEN a document item is created with an entered unit, THE WMS_Backend SHALL resolve the conversion and calculate base_quantity
5. WHEN no conversion exists, THE WMS_Backend SHALL use entered_unit_id as base_unit_id and entered quantity as base_quantity
6. THE WMS_Backend SHALL provide a `GET /cats_warehouse/v1/reference_data/uom_conversions` endpoint filtered by commodity
7. THE WMS_Backend SHALL include both entered and base quantities in all document and stock API responses
8. THE WMS_Backend SHALL validate that conversion factors are positive numbers
9. THE WMS_Backend SHALL maintain backward compatibility for Legacy_Stock with null base_unit_id
10. WHEN base unit information is unavailable, THE WMS_Backend SHALL fall back to the current unit_id and quantity fields

#### API Contract Example

```json
{
  "id": "grn-item-999",
  "type": "grn_item",
  "attributes": {
    "commodity_id": 10,
    "commodity_name": "Wheat Flour",
    "entered_quantity": 10,
    "entered_unit_id": 5,
    "entered_unit_name": "Metric Ton",
    "entered_unit_abbreviation": "MT",
    "base_quantity": 100,
    "base_unit_id": 3,
    "base_unit_name": "Quintal",
    "base_unit_abbreviation": "qt",
    "conversion_factor": 10.0
  },
  "meta": {
    "allowed_actions": ["view"],
    "has_conversion": true
  }
}
```



### Requirement 7: Lot and UOM Integration in Stock Reporting

**User Story:** As a warehouse manager, I want to view stock balances and bin cards with lot and UOM information, so that I can make informed decisions about inventory management.

#### Acceptance Criteria

1. THE WMS_Backend SHALL include lot details in `GET /cats_warehouse/v1/stock_balances` responses
2. THE WMS_Backend SHALL include entered and base UOM details in stock balance responses
3. THE WMS_Backend SHALL provide filtering by batch_no and expiry_date on stock balance endpoints
4. THE WMS_Backend SHALL include lot and UOM columns in `GET /cats_warehouse/v1/reports/bin_card` responses
5. THE WMS_Backend SHALL calculate expiring stock counts based on lot expiry dates
6. THE WMS_Backend SHALL include expiring stock indicators in dashboard summary endpoints
7. WHEN lot information is null, THE WMS_Backend SHALL display stock as untraced legacy inventory
8. THE WMS_Backend SHALL aggregate stock by lot when multiple lots exist for the same commodity

#### API Contract Example

```json
{
  "id": "balance-1111",
  "type": "stock_balance",
  "attributes": {
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse",
    "store_id": 15,
    "store_name": "Store A",
    "stack_id": 25,
    "stack_name": "Stack 1",
    "commodity_id": 10,
    "commodity_name": "Wheat Flour",
    "commodity_code": "WF-001",
    "inventory_lot_id": 888,
    "batch_no": "BATCH-2025-001",
    "expiry_date": "2026-01-15",
    "base_quantity": 1000,
    "base_unit_name": "Quintal",
    "base_unit_abbreviation": "qt",
    "reserved_quantity": 0,
    "available_quantity": 1000
  },
  "meta": {
    "allowed_actions": ["view", "adjust"],
    "is_expiring_soon": false,
    "days_until_expiry": 365,
    "is_legacy_stock": false
  }
}
```



### Requirement 8: Receipt Order Assignment Workflow

**User Story:** As a Hub Manager or Warehouse Manager, I want to assign receipt orders to specific warehouses and stores, so that incoming goods are directed to appropriate storage locations.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a `POST /cats_warehouse/v1/receipt_orders/:id/assign` endpoint
2. WHEN a Hub_Manager assigns a warehouse, THE WMS_Backend SHALL create a receipt order assignment record
3. WHEN a Warehouse_Manager assigns a store and stack, THE WMS_Backend SHALL update the assignment record
4. THE WMS_Backend SHALL transition receipt order status to `Assigned` after warehouse assignment
5. THE WMS_Backend SHALL include assignment details in receipt order API responses
6. THE WMS_Backend SHALL validate that assigned warehouse, store, and stack exist and are active
7. THE WMS_Backend SHALL include Action_Metadata indicating `["view", "reserve_space"]` for Assigned status
8. WHEN an assignment is created, THE WMS_Backend SHALL record a Workflow_Event
9. THE WMS_Backend SHALL prevent assignment modifications after space reservation
10. THE WMS_Backend SHALL notify Store_Keeper when store/stack assignment is completed

#### API Contract Example

```json
{
  "id": "123",
  "type": "receipt_order",
  "attributes": {
    "order_number": "RO-2025-001",
    "status": "assigned",
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse"
  },
  "relationships": {
    "assignment": {
      "id": "assign-456",
      "assigned_warehouse_id": 5,
      "assigned_warehouse_name": "Central Warehouse",
      "assigned_store_id": 15,
      "assigned_store_name": "Store A",
      "assigned_stack_id": 25,
      "assigned_stack_name": "Stack 1",
      "assigned_by_user_id": 100,
      "assigned_by_user_name": "Manager Smith",
      "assigned_at": "2025-01-15T14:00:00Z"
    }
  },
  "meta": {
    "allowed_actions": ["view", "reserve_space"],
    "workflow_state": "assigned",
    "can_assign": false,
    "can_reserve": true
  }
}
```



### Requirement 9: Dispatch Order Assignment Workflow

**User Story:** As a Warehouse Manager, I want to assign dispatch orders to specific stores and stacks, so that outbound goods are picked from appropriate locations.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a `POST /cats_warehouse/v1/dispatch_orders/:id/assign` endpoint
2. WHEN a Warehouse_Manager assigns a store and stack, THE WMS_Backend SHALL create a dispatch order assignment record
3. THE WMS_Backend SHALL transition dispatch order status to `Assigned` after assignment
4. THE WMS_Backend SHALL include assignment details in dispatch order API responses
5. THE WMS_Backend SHALL validate that assigned store and stack exist and are active
6. THE WMS_Backend SHALL include Action_Metadata indicating `["view", "reserve_stock"]` for Assigned status
7. WHEN an assignment is created, THE WMS_Backend SHALL record a Workflow_Event
8. THE WMS_Backend SHALL prevent assignment modifications after stock reservation
9. THE WMS_Backend SHALL notify Store_Keeper when assignment is completed

#### API Contract Example

```json
{
  "id": "789",
  "type": "dispatch_order",
  "attributes": {
    "order_number": "DO-2025-001",
    "status": "assigned",
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse"
  },
  "relationships": {
    "assignment": {
      "id": "assign-789",
      "assigned_store_id": 15,
      "assigned_store_name": "Store A",
      "assigned_stack_id": 25,
      "assigned_stack_name": "Stack 1",
      "assigned_by_user_id": 100,
      "assigned_by_user_name": "Manager Smith",
      "assigned_at": "2025-01-15T15:00:00Z"
    }
  },
  "meta": {
    "allowed_actions": ["view", "reserve_stock"],
    "workflow_state": "assigned",
    "can_assign": false,
    "can_reserve": true
  }
}
```



### Requirement 10: Space Reservation for Receipt Orders

**User Story:** As a Store Keeper, I want to reserve storage space for incoming receipt orders, so that I can ensure adequate capacity before goods arrive.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a `POST /cats_warehouse/v1/receipt_orders/:id/reserve_space` endpoint
2. WHEN space is reserved, THE WMS_Backend SHALL create Space_Reservation records for each order line
3. THE WMS_Backend SHALL validate that assigned store and stack have sufficient available capacity
4. THE WMS_Backend SHALL transition receipt order status to `Reserved` after space reservation
5. THE WMS_Backend SHALL include reservation details in receipt order API responses
6. THE WMS_Backend SHALL include Action_Metadata indicating `["view", "create_inspection"]` for Reserved status
7. WHEN a reservation is created, THE WMS_Backend SHALL record a Workflow_Event
8. THE WMS_Backend SHALL calculate available capacity by subtracting reserved space from total capacity
9. THE WMS_Backend SHALL prevent duplicate reservations for the same order line
10. THE WMS_Backend SHALL release space reservations when receipt order is completed or cancelled

#### API Contract Example

```json
{
  "id": "123",
  "type": "receipt_order",
  "attributes": {
    "order_number": "RO-2025-001",
    "status": "reserved",
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse"
  },
  "relationships": {
    "space_reservations": [
      {
        "id": "space-res-111",
        "receipt_order_line_id": 456,
        "store_id": 15,
        "store_name": "Store A",
        "stack_id": 25,
        "stack_name": "Stack 1",
        "commodity_id": 10,
        "commodity_name": "Wheat Flour",
        "reserved_quantity": 1000,
        "reserved_unit_name": "Quintal",
        "reserved_by_user_id": 200,
        "reserved_by_user_name": "Keeper Jane",
        "reserved_at": "2025-01-15T16:00:00Z"
      }
    ]
  },
  "meta": {
    "allowed_actions": ["view", "create_inspection"],
    "workflow_state": "reserved",
    "can_reserve": false,
    "space_fully_reserved": true
  }
}
```



### Requirement 11: Stock Reservation for Dispatch Orders

**User Story:** As a Store Keeper, I want to reserve specific stock for outbound dispatch orders, so that I can guarantee availability for planned shipments.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a `POST /cats_warehouse/v1/dispatch_orders/:id/reserve_stock` endpoint
2. WHEN stock is reserved, THE WMS_Backend SHALL create Stock_Reservation records for each order line
3. THE WMS_Backend SHALL validate that assigned store and stack have sufficient available stock
4. THE WMS_Backend SHALL allow selection of specific Inventory_Lot records for reservation
5. THE WMS_Backend SHALL transition dispatch order status to `Reserved` after stock reservation
6. THE WMS_Backend SHALL include reservation details in dispatch order API responses
7. THE WMS_Backend SHALL include Action_Metadata indicating `["view", "create_waybill"]` for Reserved status
8. WHEN a reservation is created, THE WMS_Backend SHALL record a Workflow_Event
9. THE WMS_Backend SHALL calculate available stock by subtracting reserved quantity from balance
10. THE WMS_Backend SHALL prevent duplicate reservations for the same order line
11. THE WMS_Backend SHALL release stock reservations when dispatch order is completed or cancelled
12. THE WMS_Backend SHALL enforce FEFO (First Expiry First Out) when suggesting lots for reservation

#### API Contract Example

```json
{
  "id": "789",
  "type": "dispatch_order",
  "attributes": {
    "order_number": "DO-2025-001",
    "status": "reserved",
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse"
  },
  "relationships": {
    "stock_reservations": [
      {
        "id": "stock-res-222",
        "dispatch_order_line_id": 890,
        "store_id": 15,
        "store_name": "Store A",
        "stack_id": 25,
        "stack_name": "Stack 1",
        "commodity_id": 10,
        "commodity_name": "Wheat Flour",
        "inventory_lot_id": 888,
        "batch_no": "BATCH-2025-001",
        "expiry_date": "2026-01-15",
        "reserved_quantity": 500,
        "reserved_unit_name": "Quintal",
        "reserved_by_user_id": 200,
        "reserved_by_user_name": "Keeper Jane",
        "reserved_at": "2025-01-15T17:00:00Z"
      }
    ]
  },
  "meta": {
    "allowed_actions": ["view", "create_waybill"],
    "workflow_state": "reserved",
    "can_reserve": false,
    "stock_fully_reserved": true
  }
}
```



### Requirement 12: Inspection-to-GRN Automation

**User Story:** As a warehouse operator, I want the system to automatically generate GRN drafts from confirmed inspections, so that I can reduce manual data entry and errors.

#### Acceptance Criteria

1. WHEN an Inspection linked to a receipt order is confirmed, THE WMS_Backend SHALL generate a GRN draft
2. THE WMS_Backend SHALL copy accepted quantities from Inspection items to GRN items
3. THE WMS_Backend SHALL preserve lot and UOM information from the Inspection
4. THE WMS_Backend SHALL link the generated GRN to the source Inspection and Receipt_Order
5. THE WMS_Backend SHALL include generation metadata in GRN API responses
6. THE WMS_Backend SHALL transition receipt order status to `In Progress` when inspection is confirmed
7. THE WMS_Backend SHALL include Action_Metadata indicating `["view", "confirm_grn"]` for In Progress status
8. WHEN a GRN is confirmed, THE WMS_Backend SHALL transition receipt order status to `Completed`
9. THE WMS_Backend SHALL record Workflow_Event entries for inspection confirmation and GRN generation
10. THE WMS_Backend SHALL prevent duplicate GRN generation for the same inspection
11. WHEN an Inspection is not linked to an order, THE WMS_Backend SHALL process it as manual workflow without automation

#### API Contract Example

```json
{
  "id": "grn-2222",
  "type": "grn",
  "attributes": {
    "grn_number": "GRN-2025-100",
    "status": "draft",
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse",
    "receipt_order_id": 123,
    "receipt_order_number": "RO-2025-001",
    "inspection_id": 555,
    "inspection_number": "INS-2025-050",
    "generated_from": "inspection",
    "generated_at": "2025-01-16T10:00:00Z"
  },
  "relationships": {
    "items": [
      {
        "id": "grn-item-3333",
        "commodity_id": 10,
        "commodity_name": "Wheat Flour",
        "inventory_lot_id": 888,
        "batch_no": "BATCH-2025-001",
        "expiry_date": "2026-01-15",
        "quantity": 1000,
        "unit_name": "Quintal"
      }
    ]
  },
  "meta": {
    "allowed_actions": ["view", "edit", "confirm"],
    "workflow_state": "draft",
    "is_auto_generated": true,
    "source_document_type": "inspection"
  }
}
```



### Requirement 13: Waybill-to-GIN Automation

**User Story:** As a warehouse operator, I want the system to automatically generate GIN drafts from confirmed waybills, so that I can streamline outbound processing.

#### Acceptance Criteria

1. WHEN a Waybill linked to a dispatch order is confirmed, THE WMS_Backend SHALL generate a GIN draft
2. THE WMS_Backend SHALL copy quantities from Waybill items to GIN items
3. THE WMS_Backend SHALL preserve lot and UOM information from the Waybill
4. THE WMS_Backend SHALL use reserved stock lots when generating GIN items
5. THE WMS_Backend SHALL link the generated GIN to the source Waybill and Dispatch_Order
6. THE WMS_Backend SHALL include generation metadata in GIN API responses
7. THE WMS_Backend SHALL transition dispatch order status to `In Progress` when waybill is confirmed
8. THE WMS_Backend SHALL include Action_Metadata indicating `["view", "confirm_gin"]` for In Progress status
9. WHEN a GIN is confirmed, THE WMS_Backend SHALL transition dispatch order status to `Completed`
10. THE WMS_Backend SHALL record Workflow_Event entries for waybill confirmation and GIN generation
11. THE WMS_Backend SHALL prevent duplicate GIN generation for the same waybill
12. WHEN a Waybill is not linked to an order, THE WMS_Backend SHALL process it as manual workflow without automation

#### API Contract Example

```json
{
  "id": "gin-4444",
  "type": "gin",
  "attributes": {
    "gin_number": "GIN-2025-200",
    "status": "draft",
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse",
    "dispatch_order_id": 789,
    "dispatch_order_number": "DO-2025-001",
    "waybill_id": 666,
    "waybill_number": "WB-2025-075",
    "generated_from": "waybill",
    "generated_at": "2025-01-17T11:00:00Z"
  },
  "relationships": {
    "items": [
      {
        "id": "gin-item-5555",
        "commodity_id": 10,
        "commodity_name": "Wheat Flour",
        "inventory_lot_id": 888,
        "batch_no": "BATCH-2025-001",
        "expiry_date": "2026-01-15",
        "quantity": 500,
        "unit_name": "Quintal",
        "stock_reservation_id": 222
      }
    ]
  },
  "meta": {
    "allowed_actions": ["view", "edit", "confirm"],
    "workflow_state": "draft",
    "is_auto_generated": true,
    "source_document_type": "waybill"
  }
}
```



### Requirement 14: Workflow Event Tracking

**User Story:** As a warehouse manager, I want to view the complete workflow history of orders, so that I can audit operations and identify bottlenecks.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a Workflow_Event model to record state transitions
2. WHEN an order status changes, THE WMS_Backend SHALL create a Workflow_Event record
3. WHEN an assignment is created, THE WMS_Backend SHALL create a Workflow_Event record
4. WHEN a reservation is created, THE WMS_Backend SHALL create a Workflow_Event record
5. WHEN a document is generated or confirmed, THE WMS_Backend SHALL create a Workflow_Event record
6. THE WMS_Backend SHALL provide `GET /cats_warehouse/v1/receipt_orders/:id/workflow` endpoint
7. THE WMS_Backend SHALL provide `GET /cats_warehouse/v1/dispatch_orders/:id/workflow` endpoint
8. THE WMS_Backend SHALL include event type, timestamp, user, and state change details in workflow responses
9. THE WMS_Backend SHALL order workflow events chronologically
10. THE WMS_Backend SHALL include Display_Field values for user names and state labels

#### API Contract Example

```json
{
  "id": "123",
  "type": "receipt_order",
  "attributes": {
    "order_number": "RO-2025-001",
    "status": "completed"
  },
  "relationships": {
    "workflow_events": [
      {
        "id": "event-1",
        "event_type": "order_created",
        "from_state": null,
        "to_state": "draft",
        "user_id": 50,
        "user_name": "Officer John",
        "occurred_at": "2025-01-15T10:30:00Z",
        "notes": "Initial order creation"
      },
      {
        "id": "event-2",
        "event_type": "order_confirmed",
        "from_state": "draft",
        "to_state": "confirmed",
        "user_id": 50,
        "user_name": "Officer John",
        "occurred_at": "2025-01-15T11:00:00Z",
        "notes": "Order confirmed and ready for assignment"
      },
      {
        "id": "event-3",
        "event_type": "warehouse_assigned",
        "from_state": "confirmed",
        "to_state": "assigned",
        "user_id": 100,
        "user_name": "Manager Smith",
        "occurred_at": "2025-01-15T14:00:00Z",
        "notes": "Assigned to Central Warehouse, Store A, Stack 1"
      },
      {
        "id": "event-4",
        "event_type": "space_reserved",
        "from_state": "assigned",
        "to_state": "reserved",
        "user_id": 200,
        "user_name": "Keeper Jane",
        "occurred_at": "2025-01-15T16:00:00Z",
        "notes": "Space reserved for 1000 Quintal"
      },
      {
        "id": "event-5",
        "event_type": "inspection_confirmed",
        "from_state": "reserved",
        "to_state": "in_progress",
        "user_id": 200,
        "user_name": "Keeper Jane",
        "occurred_at": "2025-01-16T09:00:00Z",
        "notes": "Inspection INS-2025-050 confirmed, GRN draft generated"
      },
      {
        "id": "event-6",
        "event_type": "grn_confirmed",
        "from_state": "in_progress",
        "to_state": "completed",
        "user_id": 200,
        "user_name": "Keeper Jane",
        "occurred_at": "2025-01-16T10:00:00Z",
        "notes": "GRN GRN-2025-100 confirmed, stock posted"
      }
    ]
  },
  "meta": {
    "allowed_actions": ["view"],
    "workflow_state": "completed",
    "total_events": 6,
    "duration_hours": 23.5
  }
}
```



### Requirement 15: API Response Structure Consistency

**User Story:** As a frontend developer, I want all API responses to follow a consistent structure with display fields and action metadata, so that I can build UI components without additional API calls.

#### Acceptance Criteria

1. THE WMS_Backend SHALL return all API responses in the format with id, type, attributes, relationships, and meta sections
2. THE WMS_Backend SHALL include Display_Field values for all foreign key references
3. WHEN an entity references a warehouse, THE WMS_Backend SHALL include warehouse_id and warehouse_name
4. WHEN an entity references a commodity, THE WMS_Backend SHALL include commodity_id, commodity_name, and commodity_code
5. WHEN an entity references a unit, THE WMS_Backend SHALL include unit_id, unit_name, and unit_abbreviation
6. WHEN an entity references a user, THE WMS_Backend SHALL include user_id and user_name
7. THE WMS_Backend SHALL include Action_Metadata in the meta section indicating allowed user actions
8. THE WMS_Backend SHALL include workflow_state in the meta section for all workflow-enabled entities
9. THE WMS_Backend SHALL compute and include derived fields such as totals, counts, and status indicators
10. THE WMS_Backend SHALL maintain consistent field naming across all endpoints
11. THE WMS_Backend SHALL include pagination metadata for list endpoints
12. THE WMS_Backend SHALL include error details in a consistent error response format

#### API Error Response Example

```json
{
  "error": {
    "type": "validation_error",
    "message": "Validation failed",
    "details": [
      {
        "field": "quantity",
        "message": "must be greater than 0",
        "code": "invalid_value"
      }
    ]
  },
  "meta": {
    "request_id": "req-abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```



### Requirement 16: Backward Compatibility Preservation

**User Story:** As a system administrator, I want all existing GRN, GIN, Inspection, Waybill, and stock operations to continue working unchanged, so that current users are not disrupted during the phased rollout.

#### Acceptance Criteria

1. THE WMS_Backend SHALL maintain all existing document creation endpoints without breaking changes
2. THE WMS_Backend SHALL allow GRN creation without receipt_order_id
3. THE WMS_Backend SHALL allow GIN creation without dispatch_order_id
4. THE WMS_Backend SHALL allow Inspection creation without receipt_order_id
5. THE WMS_Backend SHALL allow Waybill creation without dispatch_order_id
6. THE WMS_Backend SHALL process Legacy_Stock with null inventory_lot_id
7. THE WMS_Backend SHALL process Legacy_Stock with null base_unit_id
8. WHEN lot information is unavailable, THE WMS_Backend SHALL display stock as untraced inventory
9. WHEN UOM conversion is unavailable, THE WMS_Backend SHALL use entered quantity as base quantity
10. THE WMS_Backend SHALL maintain existing role permissions for Admin, Superadmin, Hub_Manager, Warehouse_Manager, and Store_Keeper
11. THE WMS_Backend SHALL preserve existing API response formats for legacy endpoints
12. THE WMS_Backend SHALL support mixed environments with both order-driven and manual workflows



### Requirement 17: Validation Rules by Workflow State

**User Story:** As a warehouse operator, I want the system to enforce appropriate validation rules based on workflow state, so that draft orders are flexible while confirmed orders maintain data integrity.

#### Acceptance Criteria

1. WHILE an order has Draft status, THE WMS_Backend SHALL allow zero or positive quantities
2. WHILE an order has Draft status, THE WMS_Backend SHALL allow incomplete line item data
3. WHEN an order is confirmed, THE WMS_Backend SHALL validate that all line items have positive quantities
4. WHEN an order is confirmed, THE WMS_Backend SHALL validate that all required fields are populated
5. WHEN an order is confirmed, THE WMS_Backend SHALL validate that referenced entities exist
6. WHILE an order has Confirmed status, THE WMS_Backend SHALL prevent modifications to order data
7. WHILE an order has Assigned status, THE WMS_Backend SHALL prevent modifications to assignment data
8. WHILE an order has Reserved status, THE WMS_Backend SHALL prevent modifications to reservation data
9. THE WMS_Backend SHALL return validation errors with specific field-level messages
10. THE WMS_Backend SHALL include validation state in Action_Metadata



### Requirement 18: Reference Data APIs for UI Components

**User Story:** As a frontend developer, I want reference data APIs that provide all necessary display information, so that I can populate dropdowns and selection components without additional lookups.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a `GET /cats_warehouse/v1/reference_data/lots` endpoint
2. WHEN lots are requested, THE WMS_Backend SHALL filter by warehouse_id and commodity_id query parameters
3. THE WMS_Backend SHALL include Display_Field values for warehouse name and commodity name in lot responses
4. THE WMS_Backend SHALL provide a `GET /cats_warehouse/v1/reference_data/uom_conversions` endpoint
5. WHEN UOM conversions are requested, THE WMS_Backend SHALL filter by commodity_id query parameter
6. THE WMS_Backend SHALL include Display_Field values for from_unit_name and to_unit_name in conversion responses
7. THE WMS_Backend SHALL include available quantity and reserved quantity in lot reference responses
8. THE WMS_Backend SHALL include expiry status indicators in lot reference responses
9. THE WMS_Backend SHALL order lots by expiry date for FEFO selection support
10. THE WMS_Backend SHALL include conversion factors in UOM conversion responses

#### API Contract Example

```json
{
  "data": [
    {
      "id": "lot-888",
      "type": "inventory_lot",
      "attributes": {
        "warehouse_id": 5,
        "warehouse_name": "Central Warehouse",
        "commodity_id": 10,
        "commodity_name": "Wheat Flour",
        "commodity_code": "WF-001",
        "batch_no": "BATCH-2025-001",
        "expiry_date": "2026-01-15",
        "days_until_expiry": 365,
        "is_expiring_soon": false,
        "total_quantity": 1000,
        "available_quantity": 500,
        "reserved_quantity": 500,
        "base_unit_name": "Quintal"
      },
      "meta": {
        "selectable": true,
        "expiry_status": "good"
      }
    }
  ],
  "meta": {
    "total_count": 1,
    "page": 1,
    "per_page": 20
  }
}
```



### Requirement 19: Dashboard and Summary APIs

**User Story:** As an Officer, I want to view a dashboard with operational summaries and alerts, so that I can monitor warehouse operations at a glance.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a `GET /cats_warehouse/v1/dashboard/officer` endpoint
2. THE WMS_Backend SHALL include counts of receipt orders by status in dashboard response
3. THE WMS_Backend SHALL include counts of dispatch orders by status in dashboard response
4. THE WMS_Backend SHALL include stock summary with total quantity by commodity
5. THE WMS_Backend SHALL include expiring stock alerts with lot details
6. THE WMS_Backend SHALL include pending assignment counts for Hub_Manager and Warehouse_Manager
7. THE WMS_Backend SHALL include pending reservation counts for Store_Keeper
8. THE WMS_Backend SHALL include recent workflow events for operational awareness
9. THE WMS_Backend SHALL scope dashboard data by user role and accessible warehouses
10. THE WMS_Backend SHALL include Display_Field values for all referenced entities

#### API Contract Example

```json
{
  "id": "dashboard-officer",
  "type": "dashboard",
  "attributes": {
    "user_id": 50,
    "user_name": "Officer John",
    "role": "Officer",
    "generated_at": "2025-01-15T10:00:00Z"
  },
  "relationships": {
    "receipt_orders_summary": {
      "draft": 5,
      "confirmed": 3,
      "assigned": 2,
      "reserved": 1,
      "in_progress": 4,
      "completed": 20
    },
    "dispatch_orders_summary": {
      "draft": 3,
      "confirmed": 2,
      "assigned": 1,
      "reserved": 1,
      "in_progress": 2,
      "completed": 15
    },
    "stock_summary": [
      {
        "commodity_id": 10,
        "commodity_name": "Wheat Flour",
        "total_quantity": 5000,
        "available_quantity": 4500,
        "reserved_quantity": 500,
        "unit_name": "Quintal"
      }
    ],
    "expiring_stock_alerts": [
      {
        "inventory_lot_id": 999,
        "commodity_name": "Rice",
        "batch_no": "BATCH-2024-050",
        "expiry_date": "2025-02-01",
        "days_until_expiry": 17,
        "quantity": 200,
        "warehouse_name": "Central Warehouse"
      }
    ],
    "pending_assignments": {
      "receipt_orders": 3,
      "dispatch_orders": 2
    },
    "recent_events": [
      {
        "event_type": "order_confirmed",
        "order_number": "RO-2025-002",
        "occurred_at": "2025-01-15T09:45:00Z",
        "user_name": "Officer John"
      }
    ]
  },
  "meta": {
    "allowed_actions": ["view", "create_receipt_order", "create_dispatch_order"],
    "accessible_warehouses": [5, 7, 9]
  }
}
```



### Requirement 20: Database Schema Additive Changes

**User Story:** As a database administrator, I want all schema changes to be additive with nullable columns, so that existing data remains valid and operational during migration.

#### Acceptance Criteria

1. THE WMS_Backend SHALL create new tables for receipt orders, dispatch orders, assignments, reservations, lots, UOM conversions, and workflow events
2. THE WMS_Backend SHALL add nullable foreign key columns to existing document tables
3. THE WMS_Backend SHALL add nullable lot and UOM columns to existing stock and transaction tables
4. THE WMS_Backend SHALL create indexes on order status, lot lookups, and reservation queries
5. THE WMS_Backend SHALL create foreign key constraints with appropriate cascade rules
6. THE WMS_Backend SHALL allow existing records to have null values for all new columns
7. THE WMS_Backend SHALL provide migration scripts that execute without data loss
8. THE WMS_Backend SHALL maintain referential integrity for all new relationships
9. THE WMS_Backend SHALL create unique indexes on lot identification fields
10. THE WMS_Backend SHALL create indexes on workflow event lookups by entity and timestamp



### Requirement 21: Transactional Consistency for Stock Operations

**User Story:** As a system architect, I want all stock posting operations to be transactionally consistent, so that inventory balances remain accurate and non-negative.

#### Acceptance Criteria

1. WHEN a GRN is confirmed, THE WMS_Backend SHALL post stock increases within a database transaction
2. WHEN a GIN is confirmed, THE WMS_Backend SHALL post stock decreases within a database transaction
3. THE WMS_Backend SHALL validate that stock balance remains non-negative before confirming GIN
4. THE WMS_Backend SHALL update stock reservations and available quantities atomically
5. THE WMS_Backend SHALL prevent duplicate stock postings for the same document
6. IF a stock posting fails, THE WMS_Backend SHALL roll back the entire transaction
7. THE WMS_Backend SHALL record stack transactions for all stock movements
8. THE WMS_Backend SHALL update stock balance aggregates consistently with transaction details
9. THE WMS_Backend SHALL enforce lot-specific stock tracking when inventory_lot_id is present
10. THE WMS_Backend SHALL maintain audit trail through workflow events for all stock changes



### Requirement 22: Notification System Integration

**User Story:** As a warehouse manager, I want to receive notifications when orders are confirmed or assigned to me, so that I can take timely action.

#### Acceptance Criteria

1. WHEN a receipt order is confirmed, THE WMS_Backend SHALL send notifications to Hub_Manager and Warehouse_Manager
2. WHEN a dispatch order is confirmed, THE WMS_Backend SHALL send notifications to Warehouse_Manager and Store_Keeper
3. WHEN a warehouse is assigned to a receipt order, THE WMS_Backend SHALL send notification to the assigned Warehouse_Manager
4. WHEN a store is assigned to an order, THE WMS_Backend SHALL send notification to the assigned Store_Keeper
5. THE WMS_Backend SHALL include order number, type, and action required in notification content
6. THE WMS_Backend SHALL include direct links to order detail pages in notifications
7. THE WMS_Backend SHALL support multiple notification channels as configured
8. THE WMS_Backend SHALL record notification delivery status
9. THE WMS_Backend SHALL prevent duplicate notifications for the same event
10. THE WMS_Backend SHALL allow users to configure notification preferences



### Requirement 23: Authorization and Role-Based Access Control

**User Story:** As a security administrator, I want all API endpoints to enforce role-based access control, so that users can only perform actions appropriate to their role.

#### Acceptance Criteria

1. THE WMS_Backend SHALL require authentication for all API endpoints
2. THE WMS_Backend SHALL authorize Officer role to create and confirm receipt and dispatch orders
3. THE WMS_Backend SHALL authorize Hub_Manager role to assign warehouses to receipt orders
4. THE WMS_Backend SHALL authorize Warehouse_Manager role to assign stores and stacks to orders
5. THE WMS_Backend SHALL authorize Store_Keeper role to reserve space and stock
6. THE WMS_Backend SHALL scope data access by user role and assigned warehouses
7. THE WMS_Backend SHALL return 403 Forbidden for unauthorized access attempts
8. THE WMS_Backend SHALL include allowed actions in Action_Metadata based on user role and entity state
9. THE WMS_Backend SHALL maintain existing authorization rules for Admin and Superadmin roles
10. THE WMS_Backend SHALL audit all authorization decisions in application logs



### Requirement 24: Performance and Scalability

**User Story:** As a system operator, I want the backend to handle high volumes of orders and stock transactions efficiently, so that warehouse operations are not delayed.

#### Acceptance Criteria

1. THE WMS_Backend SHALL respond to list endpoints within 500ms for datasets up to 10,000 records
2. THE WMS_Backend SHALL respond to detail endpoints within 200ms
3. THE WMS_Backend SHALL support pagination with configurable page sizes up to 100 records
4. THE WMS_Backend SHALL use database indexes for all frequently queried fields
5. THE WMS_Backend SHALL cache reference data for commodities, units, and warehouses
6. THE WMS_Backend SHALL use eager loading to prevent N+1 query problems
7. THE WMS_Backend SHALL process stock posting transactions within 1 second
8. THE WMS_Backend SHALL support concurrent order creation by multiple officers
9. THE WMS_Backend SHALL use optimistic locking to prevent concurrent modification conflicts
10. THE WMS_Backend SHALL log slow queries exceeding 1 second for performance monitoring



### Requirement 25: Parser and Serializer for API Responses

**User Story:** As a backend developer, I want consistent parsing and serialization of API responses, so that all endpoints return properly formatted data.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide a Response_Serializer that formats entities into the standard API_Response structure
2. THE WMS_Backend SHALL provide a Response_Parser that validates incoming request payloads
3. THE Response_Serializer SHALL include Display_Field values for all foreign key relationships
4. THE Response_Serializer SHALL compute Action_Metadata based on entity state and user role
5. THE Response_Serializer SHALL handle nested relationships with proper eager loading
6. THE Response_Parser SHALL validate required fields and data types
7. THE Response_Parser SHALL return descriptive validation errors for invalid input
8. FOR ALL valid entities, THE WMS_Backend SHALL serialize then parse then serialize and produce equivalent output (round-trip property)
9. THE WMS_Backend SHALL provide a Pretty_Printer for debugging API responses in development mode
10. THE WMS_Backend SHALL use consistent date/time formatting in ISO 8601 format across all responses



### Requirement 26: Error Handling and Recovery

**User Story:** As a warehouse operator, I want clear error messages when operations fail, so that I can understand and correct problems quickly.

#### Acceptance Criteria

1. WHEN validation fails, THE WMS_Backend SHALL return a 422 Unprocessable Entity response with field-level errors
2. WHEN authorization fails, THE WMS_Backend SHALL return a 403 Forbidden response with reason
3. WHEN a resource is not found, THE WMS_Backend SHALL return a 404 Not Found response
4. WHEN a server error occurs, THE WMS_Backend SHALL return a 500 Internal Server Error response
5. THE WMS_Backend SHALL include error type, message, and details in all error responses
6. THE WMS_Backend SHALL log full error stack traces for server errors
7. THE WMS_Backend SHALL include request_id in error responses for support tracking
8. IF a transaction fails, THE WMS_Backend SHALL roll back all changes and return appropriate error
9. THE WMS_Backend SHALL provide user-friendly error messages without exposing internal implementation details
10. THE WMS_Backend SHALL include suggested corrective actions in validation error messages



### Requirement 27: Testing and Quality Assurance

**User Story:** As a quality assurance engineer, I want comprehensive test coverage for all backend functionality, so that regressions are caught before deployment.

#### Acceptance Criteria

1. THE WMS_Backend SHALL include unit tests for all service classes
2. THE WMS_Backend SHALL include integration tests for all API endpoints
3. THE WMS_Backend SHALL include tests for workflow state transitions
4. THE WMS_Backend SHALL include tests for authorization rules
5. THE WMS_Backend SHALL include tests for stock posting transactions
6. THE WMS_Backend SHALL include tests for backward compatibility with legacy data
7. THE WMS_Backend SHALL include tests for concurrent operations
8. THE WMS_Backend SHALL include tests for error handling scenarios
9. THE WMS_Backend SHALL maintain test coverage above 80% for critical business logic
10. THE WMS_Backend SHALL include property-based tests for round-trip serialization



### Requirement 28: Documentation and API Specification

**User Story:** As a frontend developer, I want comprehensive API documentation with examples, so that I can integrate with backend endpoints efficiently.

#### Acceptance Criteria

1. THE WMS_Backend SHALL provide OpenAPI 3.0 specification for all endpoints
2. THE WMS_Backend SHALL include request and response examples for all endpoints
3. THE WMS_Backend SHALL document all query parameters and filters
4. THE WMS_Backend SHALL document all error responses with status codes
5. THE WMS_Backend SHALL document authentication and authorization requirements
6. THE WMS_Backend SHALL document workflow state transitions and allowed actions
7. THE WMS_Backend SHALL provide interactive API documentation through Swagger UI
8. THE WMS_Backend SHALL include code examples for common integration scenarios
9. THE WMS_Backend SHALL document rate limits and performance characteristics
10. THE WMS_Backend SHALL maintain API documentation in sync with implementation



### Requirement 29: Capacity Management and Validation

**User Story:** As a Store Keeper, I want the system to validate storage capacity before reserving space, so that I don't over-commit warehouse resources.

#### Acceptance Criteria

1. THE WMS_Backend SHALL calculate total capacity for each store and stack
2. THE WMS_Backend SHALL calculate used capacity from current stock balances
3. THE WMS_Backend SHALL calculate reserved capacity from active space reservations
4. THE WMS_Backend SHALL calculate available capacity as total minus used minus reserved
5. WHEN space reservation is requested, THE WMS_Backend SHALL validate that available capacity is sufficient
6. IF available capacity is insufficient, THE WMS_Backend SHALL return a validation error with capacity details
7. THE WMS_Backend SHALL include capacity information in store and stack API responses
8. THE WMS_Backend SHALL include capacity utilization percentage in warehouse summary responses
9. THE WMS_Backend SHALL release space reservations when receipt order is completed
10. THE WMS_Backend SHALL update capacity calculations in real-time as stock and reservations change

#### API Contract Example

```json
{
  "id": "stack-25",
  "type": "stack",
  "attributes": {
    "stack_name": "Stack 1",
    "store_id": 15,
    "store_name": "Store A",
    "warehouse_id": 5,
    "warehouse_name": "Central Warehouse",
    "total_capacity": 10000,
    "used_capacity": 5000,
    "reserved_capacity": 1000,
    "available_capacity": 4000,
    "capacity_utilization_percent": 60.0,
    "unit_name": "Quintal"
  },
  "meta": {
    "allowed_actions": ["view", "adjust"],
    "is_near_capacity": false,
    "capacity_status": "available"
  }
}
```



### Requirement 30: Stock Availability Validation

**User Story:** As a Store Keeper, I want the system to validate stock availability before reserving stock for dispatch, so that I don't over-commit inventory.

#### Acceptance Criteria

1. THE WMS_Backend SHALL calculate total stock for each commodity and lot
2. THE WMS_Backend SHALL calculate reserved stock from active stock reservations
3. THE WMS_Backend SHALL calculate available stock as total minus reserved
4. WHEN stock reservation is requested, THE WMS_Backend SHALL validate that available stock is sufficient
5. IF available stock is insufficient, THE WMS_Backend SHALL return a validation error with stock details
6. THE WMS_Backend SHALL include available stock information in stock balance API responses
7. THE WMS_Backend SHALL suggest alternative lots when requested lot has insufficient stock
8. THE WMS_Backend SHALL release stock reservations when dispatch order is completed
9. THE WMS_Backend SHALL update stock availability calculations in real-time
10. THE WMS_Backend SHALL prevent negative stock balances through validation

#### API Contract Example

```json
{
  "id": "balance-1111",
  "type": "stock_balance",
  "attributes": {
    "commodity_id": 10,
    "commodity_name": "Wheat Flour",
    "inventory_lot_id": 888,
    "batch_no": "BATCH-2025-001",
    "total_quantity": 1000,
    "reserved_quantity": 500,
    "available_quantity": 500,
    "base_unit_name": "Quintal"
  },
  "meta": {
    "allowed_actions": ["view", "reserve"],
    "is_available": true,
    "stock_status": "sufficient"
  }
}
```



## Implementation Phases Summary

### Phase 1: Officer-Driven Orchestration
Requirements covered: 1, 2, 3, 4, 15, 16, 17, 20, 22, 23, 26, 28

Focus: Establish officer role, receipt/dispatch order creation and confirmation, document linking, and consistent API structure.

### Phase 2: Inventory Traceability
Requirements covered: 5, 6, 7, 18, 24, 25, 29, 30

Focus: Add lot/batch/expiry tracking, multi-UOM support, enhanced stock reporting, and capacity/availability validation.

### Phase 3: Assignment and Automation
Requirements covered: 8, 9, 10, 11, 12, 13, 14, 19, 21, 27

Focus: Implement assignment workflows, space/stock reservations, inspection-to-GRN and waybill-to-GIN automation, workflow tracking, and dashboard.

## Quality Assurance Checklist

- All requirements follow EARS patterns (Ubiquitous, Event-driven, State-driven, Unwanted event, Optional, Complex)
- All requirements comply with INCOSE quality rules (clarity, testability, completeness, positive statements)
- All API contracts include Display_Field values for immediate UI rendering
- All API contracts include Action_Metadata for workflow control
- All requirements maintain backward compatibility with legacy data
- All requirements support transactional consistency
- Parser and serializer requirements include round-trip property testing
- All requirements are testable and verifiable

## Glossary Compliance

All technical terms used in requirements are defined in the Glossary section. System names (WMS_Backend, Officer, Hub_Manager, etc.) are consistently capitalized and used throughout the document.

