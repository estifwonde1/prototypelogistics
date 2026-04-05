# Implementation Plan: WMS Backend Phases

## Overview

This implementation plan breaks down the WMS Backend Phases feature into three sequential phases following the requirements and design documents. Each phase builds on the previous one, with Phase 1 establishing officer-driven orchestration, Phase 2 adding inventory traceability, and Phase 3 implementing assignment workflows and automation. The implementation uses Ruby on Rails within the existing `Cats::Warehouse` engine, maintaining backward compatibility throughout.

## Tasks

### Phase 1: Officer-Driven Orchestration

- [ ] 1. Set up database schema for receipt and dispatch orders
  - [-] 1.1 Create migration for receipt orders table
    - Create `cats_warehouse_receipt_orders` table with order_number, status, source_type, warehouse_id, hub_id, notes, created_by_id, confirmed_by_id, confirmed_at, completed_at, timestamps
    - Add status check constraint for valid states: draft, confirmed, assigned, reserved, in_progress, completed, cancelled
    - Add source_type check constraint for valid types: purchase, transfer, donation, return
    - Add indexes on status, warehouse_id, hub_id, created_by_id
    - Add unique index on order_number
    - _Requirements: 1.1, 1.2, 20.1_
  
  - [ ] 1.2 Create migration for receipt order lines table
    - Create `cats_warehouse_receipt_order_lines` table with receipt_order_id, commodity_id, quantity, unit_id, notes, timestamps
    - Add foreign key constraints with CASCADE delete
    - Add indexes on receipt_order_id and commodity_id
    - _Requirements: 1.1, 20.1_
  
  - [ ] 1.3 Create migration for dispatch orders table
    - Create `cats_warehouse_dispatch_orders` table with order_number, status, destination_type, destination_id, warehouse_id, notes, created_by_id, confirmed_by_id, confirmed_at, completed_at, timestamps
    - Add status check constraint for valid states
    - Add destination_type check constraint for valid types: distribution_center, warehouse, beneficiary, other
    - Add indexes on status and warehouse_id
    - Add unique index on order_number
    - _Requirements: 2.1, 2.2, 20.1_
  
  - [ ] 1.4 Create migration for dispatch order lines table
    - Create `cats_warehouse_dispatch_order_lines` table with dispatch_order_id, commodity_id, quantity, unit_id, notes, timestamps
    - Add foreign key constraints with CASCADE delete
    - Add indexes on dispatch_order_id and commodity_id
    - _Requirements: 2.1, 20.1_


  - [ ] 1.5 Add nullable foreign keys to existing document tables
    - Add nullable `receipt_order_id` column to `cats_warehouse_inspections` table
    - Add nullable `receipt_order_id` column to `cats_warehouse_grns` table
    - Add nullable `dispatch_order_id` column to `cats_warehouse_waybills` table
    - Add nullable `dispatch_order_id` column to `cats_warehouse_gins` table
    - Add indexes on all new foreign key columns
    - _Requirements: 4.1, 4.2, 16.2, 16.3, 16.4, 16.5, 20.2_

- [ ] 2. Implement receipt order models and validations
  - [ ] 2.1 Create ReceiptOrder model
    - Define model in `app/models/cats/warehouse/receipt_order.rb`
    - Add associations: has_many :receipt_order_lines, belongs_to :warehouse, belongs_to :hub, belongs_to :created_by, belongs_to :confirmed_by
    - Add validations: presence of order_number, status, source_type, warehouse_id, hub_id, created_by_id
    - Add enum for status and source_type
    - Include DocumentLifecycle concern for status management
    - Add before_create callback to generate unique order_number
    - _Requirements: 1.1, 1.2, 1.11, 5.1_
  
  - [ ]* 2.2 Write property test for draft status initialization
    - **Property 1: Draft Status Initialization**
    - **Validates: Requirements 1.2, 2.2**
    - Test that all created receipt orders start with draft status
    - Use rspec-propcheck with gen_receipt_order_params generator
    - _Requirements: 27.1, 27.3_
  
  - [ ] 2.3 Create ReceiptOrderLine model
    - Define model in `app/models/cats/warehouse/receipt_order_line.rb`
    - Add associations: belongs_to :receipt_order, belongs_to :commodity, belongs_to :unit
    - Add validations: presence of receipt_order_id, commodity_id, quantity, unit_id
    - Add validation: quantity >= 0 for draft orders
    - _Requirements: 1.1, 1.11, 17.1, 17.2_
  
  - [ ]* 2.4 Write unit tests for ReceiptOrder model
    - Test validations for required fields
    - Test order_number generation uniqueness
    - Test associations
    - Test status enum values
    - _Requirements: 27.1_

- [ ] 3. Implement dispatch order models and validations
  - [ ] 3.1 Create DispatchOrder model
    - Define model in `app/models/cats/warehouse/dispatch_order.rb`
    - Add associations: has_many :dispatch_order_lines, belongs_to :warehouse, belongs_to :created_by, belongs_to :confirmed_by
    - Add validations: presence of order_number, status, destination_type, warehouse_id, created_by_id
    - Add enum for status and destination_type
    - Include DocumentLifecycle concern
    - Add before_create callback to generate unique order_number
    - _Requirements: 2.1, 2.2, 2.11, 5.1_
  
  - [ ] 3.2 Create DispatchOrderLine model
    - Define model in `app/models/cats/warehouse/dispatch_order_line.rb`
    - Add associations: belongs_to :dispatch_order, belongs_to :commodity, belongs_to :unit
    - Add validations: presence of dispatch_order_id, commodity_id, quantity, unit_id
    - Add validation: quantity >= 0 for draft orders
    - _Requirements: 2.1, 2.11, 17.1, 17.2_
  
  - [ ]* 3.3 Write unit tests for DispatchOrder model
    - Test validations for required fields
    - Test order_number generation uniqueness
    - Test associations
    - Test status enum values
    - _Requirements: 27.1_


- [ ] 4. Implement order creation and confirmation services
  - [ ] 4.1 Create ReceiptOrderCreator service
    - Define service in `app/services/cats/warehouse/receipt_order_creator.rb`
    - Accept params: source_type, warehouse_id, notes, lines array
    - Validate warehouse exists and is active
    - Validate all commodity and unit references exist
    - Create receipt order with draft status
    - Create receipt order lines in transaction
    - Record workflow event for order_created
    - Return created order
    - _Requirements: 1.1, 1.2, 1.11, 5.1, 14.2_
  
  - [ ] 4.2 Create ReceiptOrderConfirmer service
    - Define service in `app/services/cats/warehouse/receipt_order_confirmer.rb`
    - Validate order is in draft status
    - Validate all line items have positive quantities
    - Transition status to confirmed
    - Set confirmed_by_id and confirmed_at
    - Record workflow event for order_confirmed
    - Send notifications to Hub Manager and Warehouse Manager
    - Return confirmed order
    - _Requirements: 1.7, 1.9, 1.10, 1.13, 14.2, 22.1_
  
  - [ ]* 4.3 Write property test for positive quantity validation
    - **Property 2: Positive Quantity Validation**
    - **Validates: Requirements 1.10, 2.10**
    - Test that confirmation is rejected when any line item has quantity <= 0
    - Use rspec-propcheck with gen_order_with_invalid_quantities generator
    - _Requirements: 27.1, 27.3_
  
  - [ ] 4.4 Create DispatchOrderCreator service
    - Define service in `app/services/cats/warehouse/dispatch_order_creator.rb`
    - Accept params: destination_type, destination_id, warehouse_id, notes, lines array
    - Validate warehouse and destination references exist
    - Validate all commodity and unit references exist
    - Create dispatch order with draft status
    - Create dispatch order lines in transaction
    - Record workflow event for order_created
    - Return created order
    - _Requirements: 2.1, 2.2, 2.11, 5.1, 14.2_
  
  - [ ] 4.5 Create DispatchOrderConfirmer service
    - Define service in `app/services/cats/warehouse/dispatch_order_confirmer.rb`
    - Validate order is in draft status
    - Validate all line items have positive quantities
    - Transition status to confirmed
    - Set confirmed_by_id and confirmed_at
    - Record workflow event for order_confirmed
    - Send notifications to Warehouse Manager and Store Keeper
    - Return confirmed order
    - _Requirements: 2.7, 2.9, 2.10, 2.13, 14.2, 22.2_
  
  - [ ]* 4.6 Write property test for referential integrity validation
    - **Property 5: Referential Integrity Validation**
    - **Validates: Requirements 1.11, 2.11**
    - Test that order creation is rejected when warehouse_id, commodity_id, or unit_id references do not exist
    - Use rspec-propcheck with gen_invalid_references generator
    - _Requirements: 27.1, 27.3_
  
  - [ ]* 4.7 Write unit tests for order creator services
    - Test successful order creation with valid params
    - Test validation errors for missing required fields
    - Test transaction rollback on failure
    - Test workflow event recording
    - _Requirements: 27.1, 27.2_
  
  - [ ]* 4.8 Write unit tests for order confirmer services
    - Test successful confirmation with valid draft order
    - Test rejection when order is not in draft status
    - Test rejection when quantities are not positive
    - Test notification sending
    - _Requirements: 27.1, 27.2_


- [ ] 5. Implement API serializers for orders
  - [ ] 5.1 Create ReceiptOrderSerializer
    - Define serializer in `app/serializers/cats/warehouse/receipt_order_serializer.rb`
    - Include id, type, attributes with all order fields
    - Include Display_Field values: warehouse_name, hub_name
    - Include relationships: lines with commodity_name, commodity_code, unit_name, unit_abbreviation
    - Include meta: allowed_actions, workflow_state, can_assign, can_reserve
    - Compute allowed_actions based on current status
    - _Requirements: 1.3, 15.1, 15.2, 15.3, 15.4, 15.5, 15.7, 15.8_
  
  - [ ] 5.2 Create ReceiptOrderLineSerializer
    - Define serializer in `app/serializers/cats/warehouse/receipt_order_line_serializer.rb`
    - Include all line fields with Display_Field values for commodity and unit
    - _Requirements: 1.3, 15.2, 15.4, 15.5_
  
  - [ ] 5.3 Create DispatchOrderSerializer
    - Define serializer in `app/serializers/cats/warehouse/dispatch_order_serializer.rb`
    - Include id, type, attributes with all order fields
    - Include Display_Field values: warehouse_name, destination_name
    - Include relationships: lines with commodity_name, unit_name
    - Include meta: allowed_actions, workflow_state, can_assign, can_reserve
    - Compute allowed_actions based on current status
    - _Requirements: 2.3, 15.1, 15.2, 15.7, 15.8_
  
  - [ ] 5.4 Create DispatchOrderLineSerializer
    - Define serializer in `app/serializers/cats/warehouse/dispatch_order_line_serializer.rb`
    - Include all line fields with Display_Field values
    - _Requirements: 2.3, 15.2_
  
  - [ ]* 5.5 Write property test for API response structure consistency
    - **Property 3: API Response Structure Consistency**
    - **Validates: Requirements 1.3, 15.1, 15.2**
    - Test that all API responses contain id, type, attributes, relationships, meta sections
    - Test that all foreign key references include both ID and display name fields
    - Use rspec-propcheck with gen_entity generator
    - _Requirements: 27.1, 27.10_
  
  - [ ]* 5.6 Write property test for action metadata correctness
    - **Property 18: Action Metadata Correctness**
    - **Validates: Requirements 1.4, 1.8**
    - Test that allowed_actions in meta section match permitted actions for each status
    - Test draft allows ["edit", "confirm", "delete"], confirmed allows ["view", "assign"], etc.
    - Use rspec-propcheck with gen_order_in_status generator
    - _Requirements: 27.1, 27.3_


- [ ] 6. Implement receipt order API endpoints
  - [ ] 6.1 Create ReceiptOrdersController
    - Define controller in `app/controllers/cats/warehouse/v1/receipt_orders_controller.rb`
    - Implement index action with pagination and filtering by status, warehouse_id
    - Implement show action with full order details
    - Implement create action calling ReceiptOrderCreator service
    - Implement confirm action calling ReceiptOrderConfirmer service
    - Add authorization using Pundit policies
    - Add error handling with consistent error response format
    - _Requirements: 1.1, 1.5, 1.6, 1.7, 23.2, 26.1_
  
  - [ ] 6.2 Create ReceiptOrderPolicy
    - Define policy in `app/policies/cats/warehouse/receipt_order_policy.rb`
    - Allow Officer role to create, view, and confirm orders
    - Scope orders by user's accessible warehouses
    - _Requirements: 3.4, 23.2, 23.6_
  
  - [ ]* 6.3 Write integration tests for receipt order endpoints
    - Test POST /cats_warehouse/v1/receipt_orders creates order with draft status
    - Test GET /cats_warehouse/v1/receipt_orders returns paginated list
    - Test GET /cats_warehouse/v1/receipt_orders/:id returns full details
    - Test POST /cats_warehouse/v1/receipt_orders/:id/confirm transitions to confirmed
    - Test authorization for Officer role
    - Test error responses for validation failures
    - _Requirements: 27.2, 27.4_
  
  - [ ] 6.4 Add routes for receipt orders
    - Add routes in `config/routes.rb` under cats_warehouse/v1 namespace
    - Define resources :receipt_orders with member action :confirm
    - _Requirements: 1.1, 1.5, 1.6, 1.7_

- [ ] 7. Implement dispatch order API endpoints
  - [ ] 7.1 Create DispatchOrdersController
    - Define controller in `app/controllers/cats/warehouse/v1/dispatch_orders_controller.rb`
    - Implement index action with pagination and filtering
    - Implement show action with full order details
    - Implement create action calling DispatchOrderCreator service
    - Implement confirm action calling DispatchOrderConfirmer service
    - Add authorization using Pundit policies
    - Add error handling with consistent error response format
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 23.2, 26.1_
  
  - [ ] 7.2 Create DispatchOrderPolicy
    - Define policy in `app/policies/cats/warehouse/dispatch_order_policy.rb`
    - Allow Officer role to create, view, and confirm orders
    - Scope orders by user's accessible warehouses
    - _Requirements: 3.4, 23.2, 23.6_
  
  - [ ]* 7.3 Write integration tests for dispatch order endpoints
    - Test POST /cats_warehouse/v1/dispatch_orders creates order with draft status
    - Test GET /cats_warehouse/v1/dispatch_orders returns paginated list
    - Test GET /cats_warehouse/v1/dispatch_orders/:id returns full details
    - Test POST /cats_warehouse/v1/dispatch_orders/:id/confirm transitions to confirmed
    - Test authorization for Officer role
    - Test error responses for validation failures
    - _Requirements: 27.2, 27.4_
  
  - [ ] 7.4 Add routes for dispatch orders
    - Add routes in `config/routes.rb` under cats_warehouse/v1 namespace
    - Define resources :dispatch_orders with member action :confirm
    - _Requirements: 2.1, 2.5, 2.6, 2.7_


- [ ] 8. Integrate Officer role into authorization system
  - [ ] 8.1 Add Officer role to warehouse module
    - Update `Cats::Warehouse::WarehouseModule` to include Officer in valid roles
    - Add Officer role to seeding scripts
    - Update role lookup services to recognize Officer
    - _Requirements: 3.1, 3.6_
  
  - [ ] 8.2 Update authentication response to include Officer role
    - Modify authentication controller to return Officer role information
    - Include accessible warehouses in auth response meta
    - _Requirements: 3.2, 3.3_
  
  - [ ] 8.3 Update existing policies to preserve current role permissions
    - Ensure Admin, Superadmin, Hub Manager, Warehouse Manager, Store Keeper roles maintain existing access
    - Prevent Officer from accessing role-specific functions of other roles
    - _Requirements: 3.5, 3.7, 16.10, 23.9_
  
  - [ ]* 8.4 Write unit tests for Officer role authorization
    - Test Officer can create and confirm orders
    - Test Officer cannot access Hub Manager exclusive functions
    - Test Officer cannot access Warehouse Manager exclusive functions
    - Test Officer cannot access Store Keeper exclusive functions
    - _Requirements: 27.4_

- [ ] 9. Implement draft mutability and confirmed immutability
  - [ ] 9.1 Add update action to ReceiptOrdersController
    - Implement update action that allows modifications only in draft status
    - Validate order is in draft status before allowing updates
    - Return 422 error if order is confirmed or later status
    - _Requirements: 1.12, 1.13, 17.6_
  
  - [ ] 9.2 Add update action to DispatchOrdersController
    - Implement update action that allows modifications only in draft status
    - Validate order is in draft status before allowing updates
    - Return 422 error if order is confirmed or later status
    - _Requirements: 2.12, 2.13, 17.6_
  
  - [ ]* 9.3 Write property test for draft mutability and confirmed immutability
    - **Property 4: Draft Mutability and Confirmed Immutability**
    - **Validates: Requirements 1.12, 1.13**
    - Test that updates succeed for draft orders and fail for confirmed orders
    - Use rspec-propcheck with gen_order_update_scenarios generator
    - _Requirements: 27.1, 27.3_
  
  - [ ]* 9.4 Write unit tests for order update actions
    - Test successful update of draft order
    - Test rejection of update for confirmed order
    - Test rejection of update for assigned order
    - _Requirements: 27.1_


- [ ] 10. Update existing document models for order linking
  - [ ] 10.1 Add receipt_order association to Inspection model
    - Add belongs_to :receipt_order, optional: true to Inspection model
    - Update InspectionSerializer to include receipt_order_id and receipt_order_number when present
    - _Requirements: 4.1, 4.5_
  
  - [ ] 10.2 Add receipt_order association to GRN model
    - Add belongs_to :receipt_order, optional: true to GRN model
    - Update GrnSerializer to include receipt_order_id and receipt_order_number when present
    - _Requirements: 4.1, 4.5_
  
  - [ ] 10.3 Add dispatch_order association to Waybill model
    - Add belongs_to :dispatch_order, optional: true to Waybill model
    - Update WaybillSerializer to include dispatch_order_id and dispatch_order_number when present
    - _Requirements: 4.2, 4.5_
  
  - [ ] 10.4 Add dispatch_order association to GIN model
    - Add belongs_to :dispatch_order, optional: true to GIN model
    - Update GinSerializer to include dispatch_order_id and dispatch_order_number when present
    - _Requirements: 4.2, 4.5_
  
  - [ ]* 10.5 Write property test for backward compatibility
    - **Property 6: Backward Compatibility for Manual Documents**
    - **Validates: Requirements 4.3, 16.2, 16.3, 16.4, 16.5**
    - Test that GRN, GIN, Inspection, Waybill created without order links process normally
    - Use rspec-propcheck with gen_manual_document generator
    - _Requirements: 27.1, 27.6_
  
  - [ ]* 10.6 Write unit tests for document-to-order linking
    - Test creating inspection with receipt_order_id
    - Test creating GRN with receipt_order_id
    - Test creating waybill with dispatch_order_id
    - Test creating GIN with dispatch_order_id
    - Test creating documents without order links (manual workflow)
    - _Requirements: 27.1, 27.6_

- [ ] 11. Checkpoint - Phase 1 core functionality complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: Inventory Traceability

- [ ] 12. Set up database schema for lot and UOM tracking
  - [ ] 12.1 Create migration for inventory lots table
    - Create `cats_warehouse_inventory_lots` table with warehouse_id, commodity_id, batch_no, expiry_date, timestamps
    - Add unique constraint on (warehouse_id, commodity_id, batch_no, expiry_date)
    - Add indexes on warehouse_id, commodity_id, and expiry_date
    - _Requirements: 5.1, 5.2, 20.1, 20.9_
  
  - [ ] 12.2 Create migration for UOM conversions table
    - Create `cats_warehouse_uom_conversions` table with commodity_id (nullable), from_unit_id, to_unit_id, conversion_factor, timestamps
    - Add unique constraint on (commodity_id, from_unit_id, to_unit_id)
    - Add check constraint for positive conversion_factor
    - Add index on commodity_id
    - _Requirements: 6.1, 6.8, 20.1_
  
  - [ ] 12.3 Add lot and UOM columns to GRN items table
    - Add nullable `inventory_lot_id` column to `cats_warehouse_grn_items`
    - Add nullable `entered_unit_id`, `base_unit_id`, `base_quantity` columns
    - Add indexes on inventory_lot_id
    - _Requirements: 5.3, 6.2, 20.3_
  
  - [ ] 12.4 Add lot and UOM columns to GIN items table
    - Add nullable `inventory_lot_id` column to `cats_warehouse_gin_items`
    - Add nullable `entered_unit_id`, `base_unit_id`, `base_quantity` columns
    - Add index on inventory_lot_id
    - _Requirements: 5.3, 6.2, 20.3_
  
  - [ ] 12.5 Add lot and UOM columns to Inspection items table
    - Add nullable `inventory_lot_id` column to `cats_warehouse_inspection_items`
    - Add nullable `entered_unit_id`, `base_unit_id`, `base_quantity` columns
    - Add index on inventory_lot_id
    - _Requirements: 5.3, 6.2, 20.3_
  
  - [ ] 12.6 Add lot and UOM columns to Waybill items table
    - Add nullable `inventory_lot_id` column to `cats_warehouse_waybill_items`
    - Add nullable `entered_unit_id`, `base_unit_id`, `base_quantity` columns
    - Add index on inventory_lot_id
    - _Requirements: 5.3, 6.2, 20.3_


  - [ ] 12.7 Add lot and UOM columns to stock balances table
    - Add nullable `inventory_lot_id`, `base_unit_id`, `base_quantity`, `reserved_quantity` columns to `cats_warehouse_stock_balances`
    - Drop old unique constraint on (warehouse_id, store_id, stack_id, commodity_id, unit_id)
    - Add new unique constraint including inventory_lot_id
    - Add index on inventory_lot_id
    - Set default value 0 for reserved_quantity
    - _Requirements: 5.4, 6.3, 20.3_
  
  - [ ] 12.8 Add lot and UOM columns to stack transactions table
    - Add nullable `inventory_lot_id`, `entered_unit_id`, `base_unit_id`, `base_quantity` columns to `cats_warehouse_stack_transactions`
    - Add index on inventory_lot_id
    - _Requirements: 5.4, 6.3, 20.3_

- [ ] 13. Implement inventory lot models and services
  - [ ] 13.1 Create InventoryLot model
    - Define model in `app/models/cats/warehouse/inventory_lot.rb`
    - Add associations: belongs_to :warehouse, belongs_to :commodity, has_many :stock_balances, has_many :grn_items, has_many :gin_items
    - Add validations: presence of warehouse_id, commodity_id, batch_no, expiry_date
    - Add validation: expiry_date must be in the future
    - Add scope for expiring_soon (within 30 days)
    - Add method to calculate days_until_expiry
    - _Requirements: 5.1, 5.2_
  
  - [ ] 13.2 Create InventoryLotResolver service
    - Define service in `app/services/cats/warehouse/inventory_lot_resolver.rb`
    - Accept params: warehouse_id, commodity_id, batch_no, expiry_date
    - Find existing lot matching all four fields
    - Create new lot if no match found
    - Return resolved lot
    - _Requirements: 5.2, 5.5, 5.10_
  
  - [ ]* 13.3 Write property test for inventory lot uniqueness
    - **Property 7: Inventory Lot Uniqueness**
    - **Validates: Requirements 5.2, 5.5**
    - Test that only one lot exists for each combination of warehouse, commodity, batch, expiry
    - Test that duplicate creation attempts resolve to existing lot
    - Use rspec-propcheck with gen_lot_params generator
    - _Requirements: 27.1_
  
  - [ ]* 13.4 Write unit tests for InventoryLot model
    - Test validations for required fields
    - Test unique constraint enforcement
    - Test expiry_date future validation
    - Test expiring_soon scope
    - Test days_until_expiry calculation
    - _Requirements: 27.1_
  
  - [ ]* 13.5 Write unit tests for InventoryLotResolver service
    - Test finding existing lot
    - Test creating new lot when no match
    - Test handling of duplicate batch/expiry combinations
    - _Requirements: 27.1_


- [ ] 14. Implement UOM conversion models and services
  - [ ] 14.1 Create UomConversion model
    - Define model in `app/models/cats/warehouse/uom_conversion.rb`
    - Add associations: belongs_to :commodity (optional: true), belongs_to :from_unit, belongs_to :to_unit
    - Add validations: presence of from_unit_id, to_unit_id, conversion_factor
    - Add validation: conversion_factor > 0
    - Add scope for commodity_specific and global conversions
    - _Requirements: 6.1, 6.8_
  
  - [ ] 14.2 Create UomConversionResolver service
    - Define service in `app/services/cats/warehouse/uom_conversion_resolver.rb`
    - Accept params: commodity_id, from_unit_id, to_unit_id, entered_quantity
    - Find commodity-specific conversion first
    - Fall back to global conversion if commodity-specific not found
    - Return 1.0 if from_unit == to_unit
    - Return nil if no conversion exists
    - Calculate base_quantity = entered_quantity × conversion_factor
    - Return hash with base_unit_id, base_quantity, conversion_factor
    - _Requirements: 6.4, 6.5, 6.9_
  
  - [ ]* 14.3 Write property test for UOM conversion calculation
    - **Property 8: UOM Conversion Calculation**
    - **Validates: Requirements 6.4, 6.5**
    - Test that base_quantity equals entered_quantity × conversion_factor when conversion exists
    - Test that base_unit_id equals entered_unit_id when no conversion exists
    - Use rspec-propcheck with gen_uom_conversion_scenarios generator
    - _Requirements: 27.1_
  
  - [ ]* 14.4 Write unit tests for UomConversion model
    - Test validations for required fields
    - Test positive conversion_factor validation
    - Test unique constraint enforcement
    - Test commodity_specific and global scopes
    - _Requirements: 27.1_
  
  - [ ]* 14.5 Write unit tests for UomConversionResolver service
    - Test finding commodity-specific conversion
    - Test falling back to global conversion
    - Test returning 1.0 for same unit
    - Test returning nil when no conversion exists
    - Test base_quantity calculation
    - _Requirements: 27.1_

- [ ] 15. Enhance InventoryLedger service for lot and UOM support
  - [ ] 15.1 Update InventoryLedger to accept lot and UOM parameters
    - Modify `app/services/cats/warehouse/inventory_ledger.rb` to accept inventory_lot_id, entered_unit_id, base_unit_id, base_quantity
    - Update stock balance lookup to include inventory_lot_id in unique key
    - Update stock balance creation to include lot and UOM fields
    - Update stack transaction creation to include lot and UOM fields
    - Maintain backward compatibility for calls without lot/UOM parameters
    - _Requirements: 5.4, 6.3, 16.6, 16.7_
  
  - [ ]* 15.2 Write unit tests for enhanced InventoryLedger
    - Test stock posting with lot and UOM parameters
    - Test stock posting without lot/UOM (legacy mode)
    - Test stock balance lookup with lot
    - Test stack transaction creation with lot and UOM
    - _Requirements: 27.1, 27.6_


- [ ] 16. Update GRN services to support lot and UOM tracking
  - [ ] 16.1 Update GrnCreator service to accept lot and UOM data
    - Modify `app/services/cats/warehouse/grn_creator.rb` to accept batch_no, expiry_date, entered_unit_id for each item
    - Call InventoryLotResolver to create or find lot
    - Call UomConversionResolver to calculate base quantity
    - Store inventory_lot_id, entered_unit_id, base_unit_id, base_quantity on GRN items
    - _Requirements: 5.5, 6.4_
  
  - [ ] 16.2 Update GrnConfirmer service to post stock with lot and UOM
    - Modify `app/services/cats/warehouse/grn_confirmer.rb` to pass lot and UOM data to InventoryLedger
    - Ensure stock balance is created/updated with inventory_lot_id
    - Ensure stack transaction includes lot and UOM fields
    - _Requirements: 5.5, 6.4_
  
  - [ ]* 16.3 Write unit tests for enhanced GRN services
    - Test GRN creation with batch/expiry creates lot
    - Test GRN creation with entered unit calculates base quantity
    - Test GRN confirmation posts stock with lot
    - Test GRN creation without lot/UOM (legacy mode)
    - _Requirements: 27.1, 27.6_

- [ ] 17. Update GIN services to support lot and UOM tracking
  - [ ] 17.1 Update GinCreator service to accept lot and UOM data
    - Modify `app/services/cats/warehouse/gin_creator.rb` to accept inventory_lot_id, entered_unit_id for each item
    - Call UomConversionResolver to calculate base quantity
    - Store inventory_lot_id, entered_unit_id, base_unit_id, base_quantity on GIN items
    - _Requirements: 5.6, 6.4_
  
  - [ ] 17.2 Update GinConfirmer service to post stock with lot and UOM
    - Modify `app/services/cats/warehouse/gin_confirmer.rb` to pass lot and UOM data to InventoryLedger
    - Ensure stock balance is updated for specific inventory_lot_id
    - Ensure stack transaction includes lot and UOM fields
    - _Requirements: 5.6, 6.4_
  
  - [ ]* 17.3 Write unit tests for enhanced GIN services
    - Test GIN creation with lot selection
    - Test GIN creation with entered unit calculates base quantity
    - Test GIN confirmation deducts stock from specific lot
    - Test GIN creation without lot/UOM (legacy mode)
    - _Requirements: 27.1, 27.6_

- [ ] 18. Update Inspection and Waybill services for lot and UOM
  - [ ] 18.1 Update InspectionCreator to accept lot and UOM data
    - Modify service to accept batch_no, expiry_date, entered_unit_id for each item
    - Call InventoryLotResolver and UomConversionResolver
    - Store lot and UOM data on inspection items
    - _Requirements: 5.5, 6.4_
  
  - [ ] 18.2 Update WaybillCreator to accept lot and UOM data
    - Modify service to accept inventory_lot_id, entered_unit_id for each item
    - Call UomConversionResolver
    - Store lot and UOM data on waybill items
    - _Requirements: 5.6, 6.4_
  
  - [ ]* 18.3 Write unit tests for enhanced Inspection and Waybill services
    - Test inspection creation with lot and UOM
    - Test waybill creation with lot and UOM
    - Test backward compatibility without lot/UOM
    - _Requirements: 27.1, 27.6_


- [ ] 19. Implement reference data APIs for lots and UOM conversions
  - [ ] 19.1 Create ReferenceDataController
    - Define controller in `app/controllers/cats/warehouse/v1/reference_data_controller.rb`
    - Implement lots action filtered by warehouse_id and commodity_id
    - Implement uom_conversions action filtered by commodity_id
    - Add authorization checks
    - _Requirements: 5.7, 6.6, 18.1, 18.4_
  
  - [ ] 19.2 Create InventoryLotSerializer for reference data
    - Define serializer in `app/serializers/cats/warehouse/inventory_lot_serializer.rb`
    - Include all lot fields with Display_Field values
    - Include days_until_expiry, is_expiring_soon computed fields
    - Include available_quantity, reserved_quantity from stock balances
    - Include meta with selectable flag and expiry_status
    - _Requirements: 18.3, 18.7, 18.8_
  
  - [ ] 19.3 Create UomConversionSerializer for reference data
    - Define serializer in `app/serializers/cats/warehouse/uom_conversion_serializer.rb`
    - Include all conversion fields with Display_Field values for units
    - Include conversion_factor
    - _Requirements: 18.6, 18.10_
  
  - [ ] 19.4 Add routes for reference data endpoints
    - Add routes in `config/routes.rb` under cats_warehouse/v1/reference_data namespace
    - Define get :lots and get :uom_conversions
    - _Requirements: 5.7, 6.6_
  
  - [ ]* 19.5 Write integration tests for reference data endpoints
    - Test GET /cats_warehouse/v1/reference_data/lots with filters
    - Test GET /cats_warehouse/v1/reference_data/uom_conversions with filters
    - Test Display_Field values are included
    - Test FEFO ordering for lots
    - _Requirements: 27.2_

- [ ] 20. Update stock balance and bin card APIs for lot and UOM display
  - [ ] 20.1 Update StockBalanceSerializer to include lot and UOM fields
    - Modify serializer to include inventory_lot_id, batch_no, expiry_date
    - Include base_quantity, base_unit_name, base_unit_abbreviation
    - Include reserved_quantity, available_quantity
    - Include is_expiring_soon, days_until_expiry computed fields
    - Include is_legacy_stock flag when inventory_lot_id is null
    - _Requirements: 7.1, 7.2, 7.7, 7.8_
  
  - [ ] 20.2 Update BinCardReportController to include lot and UOM columns
    - Modify bin card report to include lot details
    - Include entered and base UOM details
    - Include source document reference
    - _Requirements: 7.4_
  
  - [ ] 20.3 Add filtering by batch_no and expiry_date to stock balance endpoint
    - Add query parameters for batch_no and expiry_date filtering
    - Update StockBalancesController to support new filters
    - _Requirements: 7.3_
  
  - [ ]* 20.4 Write integration tests for enhanced stock reporting
    - Test stock balance API includes lot and UOM fields
    - Test filtering by batch_no and expiry_date
    - Test bin card includes lot and UOM columns
    - Test legacy stock displays correctly with null lot
    - _Requirements: 27.2_


- [ ] 21. Update document serializers to include lot and UOM information
  - [ ] 21.1 Update GrnItemSerializer to include lot and UOM fields
    - Add inventory_lot_id, batch_no, expiry_date to serialized output
    - Add entered_unit_id, entered_unit_name, base_unit_id, base_unit_name, base_quantity
    - Add conversion_factor when applicable
    - _Requirements: 6.7_
  
  - [ ] 21.2 Update GinItemSerializer to include lot and UOM fields
    - Add inventory_lot_id, batch_no, expiry_date to serialized output
    - Add entered_unit_id, entered_unit_name, base_unit_id, base_unit_name, base_quantity
    - Add conversion_factor when applicable
    - _Requirements: 6.7_
  
  - [ ] 21.3 Update InspectionItemSerializer to include lot and UOM fields
    - Add lot and UOM fields to serialized output
    - _Requirements: 6.7_
  
  - [ ] 21.4 Update WaybillItemSerializer to include lot and UOM fields
    - Add lot and UOM fields to serialized output
    - _Requirements: 6.7_
  
  - [ ]* 21.5 Write property test for serialization round-trip
    - **Property 16: Serialization Round-Trip**
    - **Validates: Requirements 25.8**
    - Test that serializing, parsing, and re-serializing produces equivalent output
    - Test for all entity types: receipt orders, dispatch orders, inventory lots
    - Use rspec-propcheck with gen_entity generator
    - _Requirements: 27.1, 27.10_

- [ ] 22. Checkpoint - Phase 2 lot and UOM tracking complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: Assignment and Automation

- [ ] 23. Set up database schema for assignments and reservations
  - [ ] 23.1 Create migration for receipt order assignments table
    - Create `cats_warehouse_receipt_order_assignments` table with receipt_order_id (unique), assigned_warehouse_id, assigned_store_id, assigned_stack_id, assigned_by_id, assigned_at, timestamps
    - Add foreign key constraints with CASCADE delete
    - Add index on receipt_order_id
    - _Requirements: 8.2, 20.1_
  
  - [ ] 23.2 Create migration for dispatch order assignments table
    - Create `cats_warehouse_dispatch_order_assignments` table with dispatch_order_id (unique), assigned_store_id, assigned_stack_id, assigned_by_id, assigned_at, timestamps
    - Add foreign key constraints with CASCADE delete
    - Add index on dispatch_order_id
    - _Requirements: 9.2, 20.1_
  
  - [ ] 23.3 Create migration for space reservations table
    - Create `cats_warehouse_space_reservations` table with receipt_order_line_id, store_id, stack_id, commodity_id, reserved_quantity, reserved_unit_id, reserved_by_id, reserved_at, released_at, timestamps
    - Add unique constraint on (receipt_order_line_id, store_id, stack_id)
    - Add indexes on receipt_order_line_id and stack_id
    - _Requirements: 10.2, 20.1_
  
  - [ ] 23.4 Create migration for stock reservations table
    - Create `cats_warehouse_stock_reservations` table with dispatch_order_line_id, store_id, stack_id, commodity_id, inventory_lot_id, reserved_quantity, reserved_unit_id, reserved_by_id, reserved_at, released_at, timestamps
    - Add unique constraint on (dispatch_order_line_id, inventory_lot_id, store_id, stack_id)
    - Add indexes on dispatch_order_line_id and inventory_lot_id
    - _Requirements: 11.2, 20.1_


  - [ ] 23.5 Create migration for workflow events table
    - Create `cats_warehouse_workflow_events` table with entity_type, entity_id, event_type, from_state, to_state, user_id, notes, occurred_at, created_at
    - Add check constraint for valid event_type values
    - Add index on (entity_type, entity_id, occurred_at)
    - Add index on user_id
    - _Requirements: 14.1, 20.1, 20.10_
  
  - [ ] 23.6 Add generation metadata columns to GRN and GIN tables
    - Add nullable `generated_from` and `generated_at` columns to `cats_warehouse_grns`
    - Add nullable `generated_from` and `generated_at` columns to `cats_warehouse_gins`
    - _Requirements: 12.5, 13.6, 20.2_

- [ ] 24. Implement assignment models and services
  - [ ] 24.1 Create ReceiptOrderAssignment model
    - Define model in `app/models/cats/warehouse/receipt_order_assignment.rb`
    - Add associations: belongs_to :receipt_order, belongs_to :assigned_warehouse, belongs_to :assigned_store, belongs_to :assigned_stack, belongs_to :assigned_by
    - Add validations: presence of receipt_order_id, assigned_warehouse_id, assigned_by_id
    - Add validation: assigned_store and assigned_stack must belong to assigned_warehouse
    - _Requirements: 8.2, 8.6_
  
  - [ ] 24.2 Create DispatchOrderAssignment model
    - Define model in `app/models/cats/warehouse/dispatch_order_assignment.rb`
    - Add associations: belongs_to :dispatch_order, belongs_to :assigned_store, belongs_to :assigned_stack, belongs_to :assigned_by
    - Add validations: presence of dispatch_order_id, assigned_store_id, assigned_stack_id, assigned_by_id
    - _Requirements: 9.2, 9.5_
  
  - [ ] 24.3 Create ReceiptOrderAssignmentService
    - Define service in `app/services/cats/warehouse/receipt_order_assignment_service.rb`
    - Accept params: receipt_order_id, assigned_warehouse_id, assigned_store_id, assigned_stack_id, assigned_by_id
    - Validate order is in confirmed status
    - Validate warehouse, store, stack exist and are active
    - Create assignment record
    - Transition order status to assigned
    - Record workflow event
    - Send notification to Store Keeper
    - _Requirements: 8.1, 8.2, 8.4, 8.6, 8.8, 8.10_
  
  - [ ] 24.4 Create DispatchOrderAssignmentService
    - Define service in `app/services/cats/warehouse/dispatch_order_assignment_service.rb`
    - Accept params: dispatch_order_id, assigned_store_id, assigned_stack_id, assigned_by_id
    - Validate order is in confirmed status
    - Validate store, stack exist and are active
    - Create assignment record
    - Transition order status to assigned
    - Record workflow event
    - Send notification to Store Keeper
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.7, 9.9_
  
  - [ ]* 24.5 Write unit tests for assignment models
    - Test validations for required fields
    - Test warehouse/store/stack relationship validation
    - Test associations
    - _Requirements: 27.1_
  
  - [ ]* 24.6 Write unit tests for assignment services
    - Test successful assignment with valid params
    - Test rejection when order is not in confirmed status
    - Test rejection when facilities don't exist
    - Test status transition to assigned
    - Test workflow event recording
    - Test notification sending
    - _Requirements: 27.1, 27.3_


- [ ] 25. Implement reservation models and services
  - [ ] 25.1 Create SpaceReservation model
    - Define model in `app/models/cats/warehouse/space_reservation.rb`
    - Add associations: belongs_to :receipt_order_line, belongs_to :store, belongs_to :stack, belongs_to :commodity, belongs_to :reserved_unit, belongs_to :reserved_by
    - Add validations: presence of all required fields, positive reserved_quantity
    - Add scope for active reservations (released_at is null)
    - _Requirements: 10.2, 10.9_
  
  - [ ] 25.2 Create StockReservation model
    - Define model in `app/models/cats/warehouse/stock_reservation.rb`
    - Add associations: belongs_to :dispatch_order_line, belongs_to :store, belongs_to :stack, belongs_to :commodity, belongs_to :inventory_lot (optional), belongs_to :reserved_unit, belongs_to :reserved_by
    - Add validations: presence of all required fields, positive reserved_quantity
    - Add scope for active reservations (released_at is null)
    - _Requirements: 11.2, 11.10_
  
  - [ ] 25.3 Create SpaceReservationService
    - Define service in `app/services/cats/warehouse/space_reservation_service.rb`
    - Accept params: receipt_order_id
    - Validate order is in assigned status
    - Calculate available capacity for assigned store/stack
    - Validate sufficient capacity exists
    - Create space reservation records for each order line
    - Transition order status to reserved
    - Record workflow event
    - Return order with reservations
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7, 10.8, 10.9, 29.5_
  
  - [ ] 25.4 Create StockReservationService
    - Define service in `app/services/cats/warehouse/stock_reservation_service.rb`
    - Accept params: dispatch_order_id, reservations array with lot selections
    - Validate order is in assigned status
    - Calculate available stock for each lot in assigned store/stack
    - Validate sufficient stock exists
    - Create stock reservation records for each order line
    - Transition order status to reserved
    - Record workflow event
    - Return order with reservations
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 11.8, 11.9, 11.10, 30.4_
  
  - [ ]* 25.5 Write property test for capacity validation
    - **Property 9: Capacity Validation**
    - **Validates: Requirements 10.3, 29.4, 29.5**
    - Test that space reservation is rejected when available capacity is insufficient
    - Test that available_capacity = total_capacity - used_capacity - reserved_capacity
    - Use rspec-propcheck with gen_capacity_scenarios generator
    - _Requirements: 27.1_
  
  - [ ]* 25.6 Write property test for stock availability validation
    - **Property 10: Stock Availability Validation**
    - **Validates: Requirements 11.3, 30.3, 30.4**
    - Test that stock reservation is rejected when available stock is insufficient
    - Test that available_quantity = total_quantity - reserved_quantity
    - Use rspec-propcheck with gen_stock_scenarios generator
    - _Requirements: 27.1_
  
  - [ ]* 25.7 Write unit tests for reservation models
    - Test validations for required fields
    - Test positive quantity validation
    - Test active reservations scope
    - Test associations
    - _Requirements: 27.1_
  
  - [ ]* 25.8 Write unit tests for reservation services
    - Test successful space reservation with sufficient capacity
    - Test rejection when capacity is insufficient
    - Test successful stock reservation with sufficient stock
    - Test rejection when stock is insufficient
    - Test FEFO lot suggestion
    - Test status transition to reserved
    - Test workflow event recording
    - _Requirements: 27.1, 27.3_


- [ ] 26. Implement workflow event tracking
  - [ ] 26.1 Create WorkflowEvent model
    - Define model in `app/models/cats/warehouse/workflow_event.rb`
    - Add associations: belongs_to :entity (polymorphic), belongs_to :user
    - Add validations: presence of entity_type, entity_id, event_type, to_state, user_id, occurred_at
    - Add enum for event_type with all valid event types
    - Add default scope ordering by occurred_at descending
    - _Requirements: 14.1, 14.2_
  
  - [ ] 26.2 Create WorkflowEventRecorder service
    - Define service in `app/services/cats/warehouse/workflow_event_recorder.rb`
    - Accept params: entity, event_type, from_state, to_state, user_id, notes
    - Create workflow event record
    - Set occurred_at to current timestamp
    - Return created event
    - _Requirements: 14.2, 14.3, 14.4, 14.5_
  
  - [ ] 26.3 Update all order services to record workflow events
    - Update ReceiptOrderCreator to call WorkflowEventRecorder
    - Update ReceiptOrderConfirmer to call WorkflowEventRecorder
    - Update DispatchOrderCreator to call WorkflowEventRecorder
    - Update DispatchOrderConfirmer to call WorkflowEventRecorder
    - Update assignment services to call WorkflowEventRecorder
    - Update reservation services to call WorkflowEventRecorder
    - _Requirements: 14.2, 14.3, 14.4_
  
  - [ ]* 26.4 Write property test for workflow event recording
    - **Property 17: Workflow Event Recording**
    - **Validates: Requirements 14.2, 14.3, 14.4, 14.5**
    - Test that every state transition creates a workflow event
    - Test that events include entity type, entity ID, event type, from/to states, user ID, timestamp
    - Use rspec-propcheck with gen_state_transition generator
    - _Requirements: 27.1, 27.3_
  
  - [ ]* 26.5 Write unit tests for WorkflowEvent model
    - Test validations for required fields
    - Test polymorphic association
    - Test event_type enum values
    - Test default ordering
    - _Requirements: 27.1_

- [ ] 27. Implement workflow history API endpoints
  - [ ] 27.1 Add workflow action to ReceiptOrdersController
    - Implement workflow action that returns workflow events for a receipt order
    - Include Display_Field values for user names and state labels
    - Order events chronologically
    - _Requirements: 14.6, 14.8, 14.9, 14.10_
  
  - [ ] 27.2 Add workflow action to DispatchOrdersController
    - Implement workflow action that returns workflow events for a dispatch order
    - Include Display_Field values for user names and state labels
    - Order events chronologically
    - _Requirements: 14.7, 14.8, 14.9, 14.10_
  
  - [ ] 27.3 Create WorkflowEventSerializer
    - Define serializer in `app/serializers/cats/warehouse/workflow_event_serializer.rb`
    - Include all event fields with Display_Field values for user
    - _Requirements: 14.8, 14.10_
  
  - [ ] 27.4 Add routes for workflow endpoints
    - Add member action :workflow to receipt_orders and dispatch_orders routes
    - _Requirements: 14.6, 14.7_
  
  - [ ]* 27.5 Write integration tests for workflow endpoints
    - Test GET /cats_warehouse/v1/receipt_orders/:id/workflow returns events
    - Test GET /cats_warehouse/v1/dispatch_orders/:id/workflow returns events
    - Test events are ordered chronologically
    - Test Display_Field values are included
    - _Requirements: 27.2_


- [ ] 28. Implement assignment API endpoints
  - [ ] 28.1 Add assign action to ReceiptOrdersController
    - Implement assign action calling ReceiptOrderAssignmentService
    - Accept assigned_warehouse_id, assigned_store_id, assigned_stack_id
    - Return order with assignment details in relationships
    - Add authorization for Hub Manager and Warehouse Manager roles
    - _Requirements: 8.1, 8.3, 8.5, 23.3, 23.4_
  
  - [ ] 28.2 Add assign action to DispatchOrdersController
    - Implement assign action calling DispatchOrderAssignmentService
    - Accept assigned_store_id, assigned_stack_id
    - Return order with assignment details in relationships
    - Add authorization for Warehouse Manager role
    - _Requirements: 9.1, 9.3, 9.5, 23.4_
  
  - [ ] 28.3 Update ReceiptOrderSerializer to include assignment relationship
    - Add assignment details to relationships section
    - Include Display_Field values for assigned facilities and user
    - _Requirements: 8.5_
  
  - [ ] 28.4 Update DispatchOrderSerializer to include assignment relationship
    - Add assignment details to relationships section
    - Include Display_Field values for assigned facilities and user
    - _Requirements: 9.4_
  
  - [ ]* 28.5 Write integration tests for assignment endpoints
    - Test POST /cats_warehouse/v1/receipt_orders/:id/assign creates assignment
    - Test POST /cats_warehouse/v1/dispatch_orders/:id/assign creates assignment
    - Test authorization for Hub Manager and Warehouse Manager roles
    - Test validation errors for invalid facilities
    - Test status transition to assigned
    - _Requirements: 27.2, 27.4_

- [ ] 29. Implement reservation API endpoints
  - [ ] 29.1 Add reserve_space action to ReceiptOrdersController
    - Implement reserve_space action calling SpaceReservationService
    - Return order with space_reservations in relationships
    - Add authorization for Store Keeper role
    - _Requirements: 10.1, 10.5, 10.6, 23.5_
  
  - [ ] 29.2 Add reserve_stock action to DispatchOrdersController
    - Implement reserve_stock action calling StockReservationService
    - Accept reservations array with lot selections
    - Return order with stock_reservations in relationships
    - Add authorization for Store Keeper role
    - _Requirements: 11.1, 11.5, 11.6, 23.5_
  
  - [ ] 29.3 Update ReceiptOrderSerializer to include space_reservations relationship
    - Add space_reservations details to relationships section
    - Include Display_Field values for facilities, commodity, unit, and user
    - Include space_fully_reserved flag in meta
    - _Requirements: 10.5_
  
  - [ ] 29.4 Update DispatchOrderSerializer to include stock_reservations relationship
    - Add stock_reservations details to relationships section
    - Include Display_Field values for facilities, commodity, lot, unit, and user
    - Include stock_fully_reserved flag in meta
    - _Requirements: 11.6_
  
  - [ ]* 29.5 Write integration tests for reservation endpoints
    - Test POST /cats_warehouse/v1/receipt_orders/:id/reserve_space creates reservations
    - Test POST /cats_warehouse/v1/dispatch_orders/:id/reserve_stock creates reservations
    - Test authorization for Store Keeper role
    - Test validation errors for insufficient capacity/stock
    - Test status transition to reserved
    - _Requirements: 27.2, 27.4_


- [ ] 30. Implement inspection-to-GRN automation
  - [ ] 30.1 Create GrnGeneratorFromInspection service
    - Define service in `app/services/cats/warehouse/grn_generator_from_inspection.rb`
    - Accept params: inspection_id
    - Validate inspection is linked to a receipt order
    - Copy accepted quantities from inspection items to GRN items
    - Preserve lot and UOM information from inspection
    - Link GRN to source inspection and receipt order
    - Set generated_from = 'inspection' and generated_at timestamp
    - Transition receipt order status to in_progress
    - Record workflow event
    - Return generated GRN draft
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.9_
  
  - [ ] 30.2 Update InspectionConfirmer to trigger GRN generation
    - Modify `app/services/cats/warehouse/inspection_confirmer.rb` to check if inspection is linked to receipt order
    - Call GrnGeneratorFromInspection when linked
    - Skip automation when not linked (manual workflow)
    - _Requirements: 12.1, 12.11_
  
  - [ ] 30.3 Add duplicate generation prevention
    - Check if GRN already exists for inspection before generating
    - Return existing GRN if already generated
    - Prevent duplicate GRN creation
    - _Requirements: 12.10_
  
  - [ ]* 30.4 Write property test for document automation generation
    - **Property 11: Document Automation Generation**
    - **Validates: Requirements 12.1, 12.2, 13.1**
    - Test that confirming inspection linked to receipt order generates GRN draft
    - Test that confirming waybill linked to dispatch order generates GIN draft
    - Test that quantities are copied correctly
    - Use rspec-propcheck with gen_linked_document generator
    - _Requirements: 27.1_
  
  - [ ]* 30.5 Write property test for idempotent document generation
    - **Property 12: Idempotent Document Generation**
    - **Validates: Requirements 12.10, 13.11**
    - Test that confirming inspection multiple times generates only one GRN
    - Test that confirming waybill multiple times generates only one GIN
    - Use rspec-propcheck with gen_repeated_confirmation generator
    - _Requirements: 27.1_
  
  - [ ]* 30.6 Write unit tests for GrnGeneratorFromInspection
    - Test successful GRN generation from inspection
    - Test lot and UOM preservation
    - Test linking to source inspection and receipt order
    - Test status transition to in_progress
    - Test workflow event recording
    - Test duplicate prevention
    - Test skipping automation for manual inspections
    - _Requirements: 27.1, 27.5_

- [ ] 31. Implement waybill-to-GIN automation
  - [ ] 31.1 Create GinGeneratorFromWaybill service
    - Define service in `app/services/cats/warehouse/gin_generator_from_waybill.rb`
    - Accept params: waybill_id
    - Validate waybill is linked to a dispatch order
    - Copy quantities from waybill items to GIN items
    - Preserve lot and UOM information from waybill
    - Use reserved stock lots when generating GIN items
    - Link GIN to source waybill and dispatch order
    - Set generated_from = 'waybill' and generated_at timestamp
    - Transition dispatch order status to in_progress
    - Record workflow event
    - Return generated GIN draft
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.10_
  
  - [ ] 31.2 Update WaybillConfirmer to trigger GIN generation
    - Modify `app/services/cats/warehouse/waybill_confirmer.rb` to check if waybill is linked to dispatch order
    - Call GinGeneratorFromWaybill when linked
    - Skip automation when not linked (manual workflow)
    - _Requirements: 13.1, 13.12_
  
  - [ ] 31.3 Add duplicate generation prevention
    - Check if GIN already exists for waybill before generating
    - Return existing GIN if already generated
    - Prevent duplicate GIN creation
    - _Requirements: 13.11_
  
  - [ ]* 31.4 Write unit tests for GinGeneratorFromWaybill
    - Test successful GIN generation from waybill
    - Test lot and UOM preservation
    - Test linking to source waybill and dispatch order
    - Test status transition to in_progress
    - Test workflow event recording
    - Test duplicate prevention
    - Test skipping automation for manual waybills
    - _Requirements: 27.1, 27.5_


- [ ] 32. Update GRN and GIN confirmers for order completion
  - [ ] 32.1 Update GrnConfirmer to complete receipt orders
    - Modify service to check if GRN is linked to receipt order
    - Transition receipt order status to completed when GRN is confirmed
    - Set completed_at timestamp
    - Release space reservations
    - Record workflow event
    - _Requirements: 12.8, 10.10_
  
  - [ ] 32.2 Update GinConfirmer to complete dispatch orders
    - Modify service to check if GIN is linked to dispatch order
    - Transition dispatch order status to completed when GIN is confirmed
    - Set completed_at timestamp
    - Release stock reservations
    - Record workflow event
    - _Requirements: 13.9, 11.11_
  
  - [ ]* 32.3 Write property test for state transition correctness
    - **Property 13: State Transition Correctness**
    - **Validates: Requirements 8.4, 10.4**
    - Test that state transitions follow the defined state machine
    - Test that transitions are only allowed from immediate predecessor state
    - Use rspec-propcheck with gen_state_machine_transitions generator
    - _Requirements: 27.1, 27.3_
  
  - [ ]* 32.4 Write unit tests for order completion
    - Test receipt order completion when GRN is confirmed
    - Test dispatch order completion when GIN is confirmed
    - Test space reservation release
    - Test stock reservation release
    - Test workflow event recording
    - _Requirements: 27.1, 27.5_

- [ ] 33. Implement transactional stock posting with reservations
  - [ ] 33.1 Update GrnConfirmer for transactional consistency
    - Wrap all stock posting operations in database transaction
    - Update stock balance
    - Create stack transaction
    - Update order status
    - Record workflow event
    - Release space reservations
    - Rollback entire transaction on any failure
    - _Requirements: 21.1, 21.5, 21.6, 21.7, 21.8_
  
  - [ ] 33.2 Update GinConfirmer for transactional consistency
    - Wrap all stock posting operations in database transaction
    - Validate stock balance remains non-negative
    - Update stock balance
    - Create stack transaction
    - Update order status
    - Record workflow event
    - Release stock reservations
    - Rollback entire transaction on any failure
    - _Requirements: 21.2, 21.3, 21.5, 21.6, 21.7, 21.8_
  
  - [ ]* 33.3 Write property test for transactional stock posting
    - **Property 14: Transactional Stock Posting**
    - **Validates: Requirements 21.1, 21.5**
    - Test that if any step fails, entire transaction rolls back
    - Test that no partial changes persist
    - Use rspec-propcheck with gen_transaction_failure_scenarios generator
    - _Requirements: 27.1, 27.5_
  
  - [ ]* 33.4 Write property test for stock non-negativity invariant
    - **Property 15: Stock Non-Negativity Invariant**
    - **Validates: Requirements 21.3, 30.10**
    - Test that stock balances never go negative after any operation
    - Test that attempts to reduce stock below zero are rejected
    - Use rspec-propcheck with gen_stock_operations generator
    - _Requirements: 27.1, 27.5_
  
  - [ ]* 33.5 Write unit tests for transactional consistency
    - Test successful transaction with all steps completing
    - Test transaction rollback on stock balance update failure
    - Test transaction rollback on stack transaction creation failure
    - Test transaction rollback on order status update failure
    - Test negative stock prevention
    - _Requirements: 27.1, 27.5, 27.7_


- [ ] 34. Implement capacity management and validation
  - [ ] 34.1 Add capacity calculation methods to Store and Stack models
    - Add method to calculate total_capacity from store/stack capacity fields
    - Add method to calculate used_capacity from current stock balances
    - Add method to calculate reserved_capacity from active space reservations
    - Add method to calculate available_capacity = total - used - reserved
    - Add method to calculate capacity_utilization_percent
    - _Requirements: 29.1, 29.2, 29.3, 29.4_
  
  - [ ] 34.2 Update SpaceReservationService to validate capacity
    - Call capacity calculation methods before creating reservations
    - Validate available_capacity >= requested_quantity
    - Return validation error with capacity details if insufficient
    - _Requirements: 29.5, 29.6_
  
  - [ ] 34.3 Update Store and Stack serializers to include capacity information
    - Add total_capacity, used_capacity, reserved_capacity, available_capacity to serialized output
    - Add capacity_utilization_percent
    - Add is_near_capacity flag in meta
    - _Requirements: 29.7, 29.8_
  
  - [ ]* 34.4 Write property test for capacity calculation invariant
    - **Property 19: Capacity Calculation Invariant**
    - **Validates: Requirements 29.4**
    - Test that available_capacity = total_capacity - used_capacity - reserved_capacity always holds
    - Use rspec-propcheck with gen_capacity_state generator
    - _Requirements: 27.1_
  
  - [ ]* 34.5 Write unit tests for capacity management
    - Test capacity calculation methods
    - Test capacity validation in reservation service
    - Test capacity information in serializers
    - Test real-time capacity updates
    - _Requirements: 27.1_

- [ ] 35. Implement stock availability validation
  - [ ] 35.1 Add stock availability calculation methods to StockBalance model
    - Add method to calculate total_quantity from balance
    - Add method to calculate reserved_quantity from active stock reservations
    - Add method to calculate available_quantity = total - reserved
    - Add scope for available_stock filtering
    - _Requirements: 30.1, 30.2, 30.3_
  
  - [ ] 35.2 Update StockReservationService to validate stock availability
    - Call stock availability calculation methods before creating reservations
    - Validate available_quantity >= requested_quantity
    - Return validation error with stock details if insufficient
    - Suggest alternative lots when requested lot has insufficient stock
    - _Requirements: 30.4, 30.5, 30.7_
  
  - [ ] 35.3 Update StockBalanceSerializer to include availability information
    - Add total_quantity, reserved_quantity, available_quantity to serialized output
    - Add is_available flag in meta
    - Add stock_status indicator
    - _Requirements: 30.6_
  
  - [ ]* 35.4 Write property test for stock availability calculation invariant
    - **Property 20: Stock Availability Calculation Invariant**
    - **Validates: Requirements 30.3**
    - Test that available_quantity = total_quantity - reserved_quantity always holds
    - Use rspec-propcheck with gen_stock_state generator
    - _Requirements: 27.1_
  
  - [ ]* 35.5 Write unit tests for stock availability validation
    - Test stock availability calculation methods
    - Test stock validation in reservation service
    - Test alternative lot suggestions
    - Test real-time availability updates
    - Test negative stock prevention
    - _Requirements: 27.1, 27.5_


- [ ] 36. Implement dashboard and summary APIs
  - [ ] 36.1 Create DashboardController
    - Define controller in `app/controllers/cats/warehouse/v1/dashboard_controller.rb`
    - Implement officer action for Officer dashboard
    - Include receipt_orders_summary with counts by status
    - Include dispatch_orders_summary with counts by status
    - Include stock_summary with total quantity by commodity
    - Include expiring_stock_alerts with lot details
    - Include pending_assignments counts
    - Include recent_events from workflow events
    - Scope data by user role and accessible warehouses
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9_
  
  - [ ] 36.2 Create DashboardSerializer
    - Define serializer in `app/serializers/cats/warehouse/dashboard_serializer.rb`
    - Include all summary sections with Display_Field values
    - Include allowed_actions in meta based on user role
    - _Requirements: 19.10_
  
  - [ ] 36.3 Add routes for dashboard endpoint
    - Add route in `config/routes.rb` for dashboard/officer
    - _Requirements: 19.1_
  
  - [ ]* 36.4 Write integration tests for dashboard endpoint
    - Test GET /cats_warehouse/v1/dashboard/officer returns summaries
    - Test data is scoped by user role
    - Test expiring stock alerts are included
    - Test recent events are included
    - _Requirements: 27.2_

- [ ] 37. Implement error handling and consistent error responses
  - [ ] 37.1 Create custom error classes
    - Define error classes in `app/services/cats/warehouse/errors.rb`
    - Create ValidationError, InsufficientCapacityError, InsufficientStockError, InvalidStateTransitionError, DuplicateOperationError, AuthorizationError
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5_
  
  - [ ] 37.2 Create error response formatter
    - Define formatter in `app/controllers/concerns/cats/warehouse/error_handler.rb`
    - Map error classes to HTTP status codes
    - Format errors with type, message, details structure
    - Include request_id and timestamp in error responses
    - _Requirements: 26.5, 26.7, 26.9_
  
  - [ ] 37.3 Add error handling to all controllers
    - Include ErrorHandler concern in ApplicationController
    - Add rescue_from blocks for all custom error classes
    - Add rescue_from for ActiveRecord::RecordNotFound
    - Add rescue_from for StandardError with logging
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.6_
  
  - [ ]* 37.4 Write unit tests for error handling
    - Test validation error response format
    - Test authorization error response
    - Test not found error response
    - Test server error response with logging
    - Test request_id inclusion
    - _Requirements: 27.1, 27.8_


- [ ] 38. Implement notification system integration
  - [ ] 38.1 Create NotificationService for order events
    - Define service in `app/services/cats/warehouse/notification_service.rb`
    - Implement notify_order_confirmed method
    - Implement notify_warehouse_assigned method
    - Implement notify_store_assigned method
    - Include order number, type, and action required in notification content
    - Include direct links to order detail pages
    - Support multiple notification channels as configured
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7_
  
  - [ ] 38.2 Update order services to send notifications
    - Update ReceiptOrderConfirmer to call NotificationService
    - Update DispatchOrderConfirmer to call NotificationService
    - Update assignment services to call NotificationService
    - Record notification delivery status
    - Prevent duplicate notifications for same event
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.8, 22.9_
  
  - [ ]* 38.3 Write unit tests for notification service
    - Test notification content includes required fields
    - Test notification is sent to correct roles
    - Test notification includes order links
    - Test duplicate prevention
    - _Requirements: 27.1_

- [ ] 39. Add performance optimizations
  - [ ] 39.1 Add eager loading to prevent N+1 queries
    - Update all controller index actions to use includes for associations
    - Update serializers to use preloaded associations
    - Add bullet gem to detect N+1 queries in tests
    - _Requirements: 24.6_
  
  - [ ] 39.2 Add caching for reference data
    - Cache commodities, units, warehouses in Redis
    - Set appropriate cache expiration times
    - Invalidate cache on reference data updates
    - _Requirements: 24.5_
  
  - [ ] 39.3 Add database indexes for query optimization
    - Review slow query logs
    - Add composite indexes for common query patterns
    - Add indexes on foreign keys not already indexed
    - _Requirements: 24.4_
  
  - [ ]* 39.4 Write performance tests
    - Test list endpoints respond within 500ms for 10,000 records
    - Test detail endpoints respond within 200ms
    - Test stock posting transactions complete within 1 second
    - _Requirements: 24.1, 24.2, 24.7_

- [ ] 40. Implement optimistic locking for concurrent operations
  - [ ] 40.1 Add lock_version column to order tables
    - Add lock_version column to receipt_orders and dispatch_orders
    - Enable optimistic locking in models
    - _Requirements: 24.9_
  
  - [ ] 40.2 Handle StaleObjectError in controllers
    - Add rescue_from for ActiveRecord::StaleObjectError
    - Return 409 Conflict with appropriate error message
    - _Requirements: 24.9_
  
  - [ ]* 40.3 Write unit tests for concurrent operations
    - Test concurrent order updates with optimistic locking
    - Test StaleObjectError handling
    - _Requirements: 27.1, 27.7_


- [ ] 41. Add comprehensive test data generators for property tests
  - [ ] 41.1 Create property test generators module
    - Define module in `spec/support/property_generators.rb`
    - Implement gen_receipt_order_params generator
    - Implement gen_dispatch_order_params generator
    - Implement gen_order_with_invalid_quantities generator
    - Implement gen_invalid_references generator
    - Implement gen_order_in_status generator
    - Implement gen_entity generator
    - Implement gen_order_update_scenarios generator
    - Implement gen_manual_document generator
    - Implement gen_lot_params generator
    - Implement gen_uom_conversion_scenarios generator
    - Implement gen_capacity_scenarios generator
    - Implement gen_stock_scenarios generator
    - Implement gen_state_transition generator
    - Implement gen_linked_document generator
    - Implement gen_repeated_confirmation generator
    - Implement gen_stock_operations generator
    - Implement gen_transaction_failure_scenarios generator
    - Implement gen_capacity_state generator
    - Implement gen_stock_state generator
    - Implement gen_state_machine_transitions generator
    - _Requirements: 27.1_
  
  - [ ] 41.2 Configure rspec-propcheck
    - Add rspec-propcheck gem to Gemfile test group
    - Configure in spec/spec_helper.rb
    - Set minimum 100 iterations per property test
    - _Requirements: 27.1_
  
  - [ ]* 41.3 Write unit tests for generators
    - Test that generators produce valid data
    - Test that generators cover edge cases
    - _Requirements: 27.1_

- [ ] 42. Implement factory definitions for test data
  - [ ] 42.1 Create factories for new models
    - Define factory for receipt_order in `spec/factories/receipt_orders.rb`
    - Define factory for receipt_order_line
    - Define factory for dispatch_order
    - Define factory for dispatch_order_line
    - Define factory for inventory_lot
    - Define factory for uom_conversion
    - Define factory for receipt_order_assignment
    - Define factory for dispatch_order_assignment
    - Define factory for space_reservation
    - Define factory for stock_reservation
    - Define factory for workflow_event
    - Include traits for different statuses and scenarios
    - _Requirements: 27.1_
  
  - [ ]* 42.2 Write unit tests using factories
    - Test factory definitions produce valid records
    - Test factory traits work correctly
    - _Requirements: 27.1_

- [ ] 43. Checkpoint - Phase 3 assignment and automation complete
  - Ensure all tests pass, ask the user if questions arise.


### Integration and Documentation

- [ ] 44. Create API documentation
  - [ ] 44.1 Generate OpenAPI 3.0 specification
    - Document all endpoints with request/response schemas
    - Include authentication and authorization requirements
    - Include error response examples
    - Include workflow state transition documentation
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6_
  
  - [ ] 44.2 Set up Swagger UI for interactive documentation
    - Configure Swagger UI in development environment
    - Mount Swagger UI at /api-docs endpoint
    - _Requirements: 28.7_
  
  - [ ] 44.3 Add code examples for common integration scenarios
    - Document complete receipt order workflow example
    - Document complete dispatch order workflow example
    - Document manual document creation example
    - Document lot and UOM tracking example
    - _Requirements: 28.8_
  
  - [ ] 44.4 Document rate limits and performance characteristics
    - Document expected response times
    - Document pagination limits
    - Document concurrent operation handling
    - _Requirements: 28.9, 28.10_

- [ ] 45. End-to-end integration testing
  - [ ]* 45.1 Write end-to-end test for complete receipt order workflow
    - Test: Create receipt order → Confirm → Assign → Reserve space → Create inspection → Confirm inspection → Auto-generate GRN → Confirm GRN → Order completed
    - Verify stock is posted correctly
    - Verify workflow events are recorded
    - Verify notifications are sent
    - _Requirements: 27.1_
  
  - [ ]* 45.2 Write end-to-end test for complete dispatch order workflow
    - Test: Create dispatch order → Confirm → Assign → Reserve stock → Create waybill → Confirm waybill → Auto-generate GIN → Confirm GIN → Order completed
    - Verify stock is deducted correctly
    - Verify reservations are released
    - Verify workflow events are recorded
    - _Requirements: 27.1_
  
  - [ ]* 45.3 Write end-to-end test for manual document workflows
    - Test: Create GRN without receipt order → Confirm → Stock posted
    - Test: Create GIN without dispatch order → Confirm → Stock deducted
    - Verify backward compatibility
    - _Requirements: 27.1, 27.6_
  
  - [ ]* 45.4 Write end-to-end test for lot and UOM traceability
    - Test: Create receipt with batch/expiry → Lot created → Stock tracked by lot → Dispatch from specific lot → Stock deducted from correct lot
    - Test: Create receipt with entered unit → Base quantity calculated → Stock posted in base unit → Issue in different unit → Conversion applied
    - _Requirements: 27.1_

- [ ] 46. Final checkpoint - All phases complete
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- All database changes use nullable columns to maintain backward compatibility
- Property-based tests validate the 20 correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Integration tests validate API endpoints and workflows
- End-to-end tests validate complete workflows across multiple components
- Checkpoints ensure incremental validation at phase boundaries
- All stock operations are transactionally consistent
- Officer role is added without disrupting existing roles
- Manual document workflows continue to work alongside order-driven workflows

## Implementation Context

This task list assumes:
- Ruby on Rails 7.0+ backend with PostgreSQL database
- Existing `Cats::Warehouse` engine with GRN, GIN, Inspection, Waybill, Stock Balance models
- Existing InventoryLedger service for stock posting
- Existing DocumentLifecycle concern for status management
- Pundit for authorization
- ActiveModelSerializers for JSON serialization
- RSpec for testing with rspec-propcheck for property-based tests
- FactoryBot for test data generation

## Execution Guidance

To execute these tasks:
1. Open this tasks.md file in Kiro
2. Click "Start task" next to any task item to begin implementation
3. Complete tasks sequentially within each phase
4. Run tests at checkpoints to validate progress
5. Optional test tasks can be skipped if time is constrained
6. All core implementation tasks must be completed for production readiness

