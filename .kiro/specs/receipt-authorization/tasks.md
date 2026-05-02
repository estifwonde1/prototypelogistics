# Implementation Plan: Receipt Authorization

## Overview

Implement the Receipt Authorization (RA) feature as a new per-truck authorization layer between a confirmed Receipt Order and physical goods receipt. The plan follows the existing Rails engine architecture under `Cats::Warehouse` and the React/TypeScript frontend. Tasks are ordered so each step builds on the previous one, ending with full integration.

## Tasks

- [ ] 1. Database migrations
  - [ ] 1.1 Create migration for `cats_warehouse_receipt_authorizations` table
    - Add all columns per the design: `receipt_order_id`, `receipt_order_assignment_id` (nullable), `store_id`, `warehouse_id`, `transporter_id`, `created_by_id`, `driver_confirmed_by_id`, `cancelled_by_id`, `reference_no` (unique), `status` (default `"pending"`), `authorized_quantity`, `driver_name`, `driver_id_number`, `truck_plate_number`, `waybill_number`, `driver_confirmed_at`, `cancelled_at`, timestamps
    - Add composite index on `[receipt_order_id, status]` named `idx_cw_ra_order_status`
    - Add unique index on `reference_no`
    - Add index on `status`
    - _Requirements: 2.2, 2.3, 3.1_

  - [ ] 1.2 Create migration to add `receipt_authorization_id` FK to `cats_warehouse_inspections`
    - `add_reference :cats_warehouse_inspections, :receipt_authorization, foreign_key: { to_table: :cats_warehouse_receipt_authorizations }`
    - _Requirements: 4.1, 4.3_

  - [ ] 1.3 Create migration to add `receipt_authorization_id` FK to `cats_warehouse_grns`
    - `add_reference :cats_warehouse_grns, :receipt_authorization, foreign_key: { to_table: :cats_warehouse_receipt_authorizations }`
    - _Requirements: 6.1, 6.2_

  - [ ] 1.4 Create migration to add `receipt_authorization_id` FK to `cats_warehouse_stack_transactions`
    - `add_reference :cats_warehouse_stack_transactions, :receipt_authorization, foreign_key: { to_table: :cats_warehouse_receipt_authorizations }`
    - _Requirements: 7.3_

- [ ] 2. `ReceiptAuthorization` model
  - [ ] 2.1 Create `app/models/cats/warehouse/receipt_authorization.rb`
    - Define `self.table_name`, all `belongs_to` associations (receipt_order, receipt_order_assignment optional, store, warehouse, transporter, created_by, driver_confirmed_by optional, cancelled_by optional)
    - Add `has_one :inspection` and `has_one :grn`
    - Define status constants: `PENDING`, `ACTIVE`, `CLOSED`, `CANCELLED`
    - Add `validates :authorized_quantity, numericality: { greater_than: 0 }`
    - Add presence validations for all mandatory fields
    - Add `validates :reference_no, uniqueness: true, allow_blank: true`
    - _Requirements: 2.2, 2.3, 3.1_

  - [ ]* 2.2 Write property test: RA creation always produces Pending status (Property 3)
    - **Property 3: RA creation always produces Pending status**
    - **Validates: Requirements 2.7**

  - [ ]* 2.3 Write property test: RA reference numbers are unique (Property 4)
    - **Property 4: RA reference numbers are unique**
    - **Validates: Requirements 2.3**

  - [ ]* 2.4 Write unit tests for `ReceiptAuthorization` model
    - Test presence validations, `authorized_quantity > 0`, status constants, associations
    - _Requirements: 2.2, 3.1_

- [ ] 3. `Receipt Authorizer` role and `AccessContext` extensions
  - [ ] 3.1 Add `"Receipt Authorizer"` to `UserAssignment` role_name inclusion validation
    - Edit `app/models/cats/warehouse/user_assignment.rb` to include `"Receipt Authorizer"` in the allowed role names list
    - _Requirements: 1.1, 1.2_

  - [ ] 3.2 Add Receipt Authorizer helper methods to `AccessContext`
    - Add `receipt_authorizer?`, `assigned_receipt_authorizer_hub_ids`, `assigned_receipt_authorizer_warehouse_ids`, and `can_create_receipt_authorization_for_warehouse?(warehouse_id)` as specified in the design
    - _Requirements: 1.3, 1.4, 1.5, 1.7_

  - [ ]* 3.3 Write property test: Hub Manager has implicit Receipt Authorizer privileges (Property 1)
    - **Property 1: Hub Manager has implicit Receipt Authorizer privileges**
    - **Validates: Requirements 1.4**

  - [ ]* 3.4 Write property test: Unauthorized users cannot create Receipt Authorizations (Property 2)
    - **Property 2: Unauthorized users cannot create Receipt Authorizations**
    - **Validates: Requirements 1.7**

  - [ ] 3.5 Add `"Receipt Authorizer"` role to seeds
    - Add the role to `db/seeds.rb` alongside existing roles
    - _Requirements: 1.1_

- [ ] 4. `ReceiptAuthorizationService` — creation and cancellation
  - [ ] 4.1 Create `app/services/cats/warehouse/receipt_authorization_service.rb`
    - Accept `receipt_order`, `actor`, `store`, `authorized_quantity`, `driver_name`, `driver_id_number`, `truck_plate_number`, `transporter`, `waybill_number`
    - Validate store belongs to an allocated warehouse for the receipt order
    - Validate sum of non-cancelled RA quantities ≤ assignment allocation
    - Generate unique `reference_no` using `"RA-#{SecureRandom.hex(4).upcase}"`
    - Create RA with status `pending`
    - Enqueue notification to Storekeeper of destination store
    - Record `WorkflowEvent`
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 2.7, 2.8_

  - [ ]* 4.2 Write property test: RA quantity sum never exceeds assignment allocation (Property 5)
    - **Property 5: RA quantity sum never exceeds assignment allocation**
    - **Validates: Requirements 2.6**

  - [ ]* 4.3 Write property test: RA destination store must belong to an allocated warehouse (Property 6)
    - **Property 6: RA destination store must belong to an allocated warehouse**
    - **Validates: Requirements 2.4**

  - [ ]* 4.4 Write unit tests for `ReceiptAuthorizationService`
    - Test quantity cap enforcement, store validation, reference number generation, notification enqueue
    - _Requirements: 2.4, 2.6, 2.7, 2.8_

- [ ] 5. `ReceiptAuthorizationPolicy` (Pundit)
  - [ ] 5.1 Create `app/policies/cats/warehouse/receipt_authorization_policy.rb`
    - Implement `index?`, `show?`, `create?`, `update?`, `cancel?`, `driver_confirm?` as specified in the design
    - `create?` / `update?` / `cancel?` allow admin, hub_manager, warehouse_manager, receipt_authorizer
    - `update?` additionally guards `record.status == "pending"`
    - `cancel?` additionally guards `record.status == "pending" && record.inspection.nil?`
    - `driver_confirm?` allows storekeeper and admin only
    - _Requirements: 1.7, 3.4, 3.5, 3.6, 5.1_

  - [ ]* 5.2 Write unit tests for `ReceiptAuthorizationPolicy`
    - Test each role/action combination including edge cases (Active RA edit, cancel with inspection)
    - _Requirements: 1.7, 3.4, 3.5, 3.6_

- [ ] 6. Modified `InspectionCreator` service — link RA
  - [ ] 6.1 Modify `InspectionCreator` (or `InspectionsController#create`) to accept `receipt_authorization_id`
    - When `receipt_authorization_id` is provided: link the Inspection to the RA, transition RA from `pending` → `active`, validate only one active Inspection per RA, validate `quantity_received` ≤ `authorized_quantity`
    - _Requirements: 4.1, 4.3, 4.4, 4.6_

  - [ ]* 6.2 Write property test: Linking an Inspection transitions RA from Pending to Active (Property 7)
    - **Property 7: Linking an Inspection transitions RA from Pending to Active**
    - **Validates: Requirements 3.2, 4.3**

  - [ ]* 6.3 Write property test: Only one active Inspection per RA (Property 8)
    - **Property 8: Only one active Inspection per RA**
    - **Validates: Requirements 4.4**

  - [ ]* 6.4 Write property test: Inspection quantity cannot exceed RA authorized quantity (Property 9)
    - **Property 9: Inspection quantity cannot exceed RA authorized quantity**
    - **Validates: Requirements 4.6**

- [ ] 7. `DriverConfirmService`
  - [ ] 7.1 Create `app/services/cats/warehouse/driver_confirm_service.rb`
    - Accept `receipt_authorization` and `actor`
    - Guard: RA must be `active` and have a linked Inspection; raise if not
    - Guard: `driver_confirmed_at` must be nil (idempotency guard)
    - Set `driver_confirmed_at = Time.current` and `driver_confirmed_by = actor`
    - Create GRN in `draft` status linked to the RA and its Inspection (`receipt_authorization_id`, `generated_from_inspection_id`)
    - Enqueue notification to Hub Manager / Warehouse Manager
    - Record `WorkflowEvent`
    - _Requirements: 5.4, 5.5, 5.6, 6.1, 6.2_

  - [ ]* 7.2 Write property test: Driver Confirm records timestamp and actor, and creates Draft GRN (Property 10)
    - **Property 10: Driver Confirm records timestamp and actor, and creates Draft GRN**
    - **Validates: Requirements 5.4, 5.5, 6.1, 6.2**

  - [ ]* 7.3 Write property test: GRN cannot be generated without Driver Confirm (Property 11)
    - **Property 11: GRN cannot be generated without Driver Confirm**
    - **Validates: Requirements 5.1, 5.6**

  - [ ]* 7.4 Write unit tests for `DriverConfirmService`
    - Test GRN creation in Draft, timestamp recording, notification enqueue, guard clauses
    - _Requirements: 5.4, 5.5, 5.6, 6.1, 6.2_

- [ ] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. `ReceiptOrderCompletionChecker` service
  - [ ] 9.1 Create `app/services/cats/warehouse/receipt_order_completion_checker.rb`
    - Accept `receipt_order` and `actor`
    - Query all non-cancelled RAs for the order
    - If all are `closed`, transition Receipt Order to `completed` and record `WorkflowEvent`
    - Enqueue notification to the Officer who created the Receipt Order
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

  - [ ]* 9.2 Write property test: Receipt Order completes only when all non-cancelled RAs are Closed (Property 15)
    - **Property 15: Receipt Order completes only when all non-cancelled RAs are Closed**
    - **Validates: Requirements 8.1, 8.3, 8.4, 8.6**

  - [ ]* 9.3 Write property test: Cancelled RA releases its quantity allocation (Property 16)
    - **Property 16: Cancelled RA releases its quantity allocation**
    - **Validates: Requirements 3.7, 8.7**

  - [ ]* 9.4 Write unit tests for `ReceiptOrderCompletionChecker`
    - Test completion with all closed, partial closure, cancelled RA exclusion, notification enqueue
    - _Requirements: 8.1, 8.3, 8.4, 8.7_

- [ ] 10. Modified `ReceiptOrdersController#finish_stacking`
  - [ ] 10.1 Update `finish_stacking` action to accept `receipt_authorization_id` parameter
    - Find the RA by `receipt_authorization_id`; raise if not found or not `active`
    - Validate RA has a Draft GRN; raise if not
    - Validate total stacked = inspection quantity (existing check, now scoped to RA)
    - Confirm the linked GRN (Draft → Confirmed), apply inventory ledger entries
    - Transition RA from `active` → `closed`
    - Call `ReceiptOrderCompletionChecker` instead of directly setting order to `completed`
    - Associate each stack transaction with the RA (`receipt_authorization_id`)
    - _Requirements: 6.3, 6.4, 6.5, 7.3, 7.4, 7.5, 7.6, 8.2_

  - [ ]* 10.2 Write property test: finish_stacking confirms GRN and closes RA (Property 12)
    - **Property 12: finish_stacking confirms GRN and closes RA**
    - **Validates: Requirements 3.3, 6.3, 6.4, 7.4, 7.5**

  - [ ]* 10.3 Write property test: finish_stacking fails when stacked quantity does not match inspection quantity (Property 13)
    - **Property 13: finish_stacking fails when stacked quantity does not match inspection quantity**
    - **Validates: Requirements 7.6**

  - [ ]* 10.4 Write property test: GRN confirmation requires Active RA (Property 14)
    - **Property 14: GRN confirmation requires Active RA**
    - **Validates: Requirements 6.5, 6.8**

- [ ] 11. `ReceiptAuthorizationSerializer`
  - [ ] 11.1 Create `app/serializers/cats/warehouse/receipt_authorization_serializer.rb`
    - Expose all fields listed in the design: `id`, `reference_no`, `status`, `receipt_order_id`, `receipt_order_reference_no`, `store_id`, `store_name`, `warehouse_id`, `warehouse_name`, `authorized_quantity`, `driver_name`, `driver_id_number`, `truck_plate_number`, `transporter_id`, `transporter_name`, `waybill_number`, `driver_confirmed_at`, `driver_confirmed_by_name`, `inspection_id`, `grn_id`, `grn_reference_no`, `grn_status`, `created_by_name`, `created_at`, `updated_at`
    - _Requirements: 2.2, 5.7, 6.6_

- [ ] 12. `ReceiptAuthorizationsController` and routes
  - [ ] 12.1 Create `app/controllers/cats/warehouse/receipt_authorizations_controller.rb`
    - Inherit from `BaseController`
    - Implement `index` (scoped by role — hub manager sees hub's RAs, warehouse manager sees warehouse's RAs, storekeeper sees pending RAs for their stores)
    - Implement `show`, `create` (calls `ReceiptAuthorizationService`), `update` (Pending only), `cancel`, `driver_confirm` (calls `DriverConfirmService`)
    - Apply Pundit `authorize` and `policy_scope` on each action
    - _Requirements: 1.7, 2.1, 3.4, 3.5, 3.6, 4.2, 5.1, 5.2_

  - [ ]* 12.2 Write property test: Storekeeper only sees Pending RAs for their assigned stores (Property 17)
    - **Property 17: Storekeeper only sees Pending RAs for their assigned stores**
    - **Validates: Requirements 4.2**

  - [ ] 12.3 Register routes in `engines/cats_warehouse/config/routes.rb`
    - Add `resources :receipt_authorizations` with member actions `:cancel` and `:driver_confirm`
    - _Requirements: 2.1, 3.4, 3.5, 3.6, 5.1_

- [ ] 13. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Frontend API client — `api/receiptAuthorizations.ts`
  - [ ] 14.1 Create `frontend/src/api/receiptAuthorizations.ts`
    - Define `ReceiptAuthorization` TypeScript interface matching the serializer fields
    - Define `CreateRAPayload` interface
    - Implement `getReceiptAuthorizations(params?)`, `getReceiptAuthorization(id)`, `createReceiptAuthorization(payload)`, `updateReceiptAuthorization(id, payload)`, `cancelReceiptAuthorization(id)`, `driverConfirm(id)`
    - _Requirements: 2.1, 3.4, 3.5, 3.6, 5.1_

  - [ ]* 14.2 Write unit tests for `receiptAuthorizations.ts` API client
    - Test each function with mocked axios responses
    - _Requirements: 2.1, 5.1_

- [ ] 15. Frontend — `ReceiptAuthorizationListPage`
  - [ ] 15.1 Create `frontend/src/pages/hub-manager/ReceiptAuthorizationListPage.tsx`
    - Route: `/hub-manager/receipt-authorizations`
    - Display all RAs for the Hub Manager's hub, filterable by status and warehouse
    - Show summary counts: Pending / Active / Closed
    - Include "New Receipt Authorization" button linking to the form page
    - _Requirements: 9.1, 9.2, 9.5_

  - [ ]* 15.2 Write Vitest tests for `ReceiptAuthorizationListPage`
    - Test filter controls, summary counts, and "New" button visibility
    - _Requirements: 9.1, 9.2, 9.5_

- [ ] 16. Frontend — `ReceiptAuthorizationFormPage`
  - [ ] 16.1 Create `frontend/src/pages/hub-manager/ReceiptAuthorizationFormPage.tsx`
    - Route: `/hub-manager/receipt-authorizations/new`
    - Select Receipt Order (confirmed, with assignments)
    - Select warehouse (pre-filtered to hub's warehouses)
    - Select store (pre-filtered to selected warehouse)
    - Inputs: authorized quantity, driver name, driver ID, plate number, transporter (from reference data), waybill number
    - On submit, call `createReceiptAuthorization`; show validation errors inline
    - _Requirements: 2.1, 2.2, 2.4, 2.6, 9.3, 9.6_

  - [ ]* 16.2 Write Vitest tests for `ReceiptAuthorizationFormPage`
    - Test form validation, store pre-filtering by warehouse, submission success and error paths
    - _Requirements: 2.2, 2.4, 9.6_

- [ ] 17. Frontend — `ReceiptAuthorizationDetailPage`
  - [ ] 17.1 Create `frontend/src/pages/hub-manager/ReceiptAuthorizationDetailPage.tsx`
    - Route: `/hub-manager/receipt-authorizations/:id`
    - Show all RA fields, status badge, linked Inspection summary, Driver Confirm status, GRN link
    - Show Edit button when status is Pending
    - Show Cancel button when status is Pending and no Inspection is linked
    - _Requirements: 3.4, 3.5, 3.6, 5.7, 9.4_

  - [ ]* 17.2 Write Vitest tests for `ReceiptAuthorizationDetailPage`
    - Test status-conditional button visibility (Edit/Cancel only when Pending, no Inspection)
    - _Requirements: 3.4, 3.5, 3.6_

- [ ] 18. Frontend — Modified `ReceiptOrderDetailPage`
  - [ ] 18.1 Add "Receipt Authorizations" tab to `ReceiptOrderDetailPage`
    - Import and call `getReceiptAuthorizations({ receipt_order_id: id })` for the tab data
    - Display a table of RAs with status, store, quantity, driver, and a link to the RA detail page
    - Show progress indicator: "X of Y trucks completed" (Closed count vs total non-cancelled count)
    - _Requirements: 8.5, 9.4_

  - [ ] 18.2 Remove direct "Start Stacking" / "Finish Stacking" buttons from the order-level view
    - These actions are now RA-scoped; remove or hide the order-level stacking buttons
    - _Requirements: 7.1_

- [ ] 19. Frontend — Modified Storekeeper Inspection flow
  - [ ] 19.1 Add Receipt Authorization selector to the Inspection creation form
    - Fetch Pending RAs for the storekeeper's store via `getReceiptAuthorizations({ store_id, status: 'pending' })`
    - Pass `receipt_authorization_id` in the `createInspection` payload
    - _Requirements: 4.1, 4.2_

  - [ ] 19.2 Add "Driver Confirmed Delivery" button to the RA detail / storekeeper view
    - Show the button when RA is Active and `driver_confirmed_at` is null
    - On click, call `driverConfirm(ra.id)` and refresh the RA
    - After Driver Confirm, show a link to the generated Draft GRN
    - _Requirements: 5.1, 5.2, 5.4, 5.7_

  - [ ] 19.3 Wire stacking flow to RA
    - On the stacking form, require selection of the RA (Active RAs with a Draft GRN for the storekeeper's store)
    - Pass `receipt_authorization_id` in the `finish_stacking` API call
    - _Requirements: 7.1, 7.2_

  - [ ]* 19.4 Write Vitest tests for modified Storekeeper Inspection flow
    - Test RA selector shows only Pending RAs for the storekeeper's store
    - Test Driver Confirm button appears after Inspection, triggers correct API call
    - _Requirements: 4.2, 5.2_

- [ ] 20. Notifications — wire up `receipt_authorization` notification rule
  - [ ] 20.1 Ensure notification rule `receipt_authorization` exists in seeds and is used by services
    - Verify `db/seeds.rb` already seeds the `receipt_authorization` notification rule (it does — confirm and update if needed)
    - Ensure `ReceiptAuthorizationService`, `DriverConfirmService`, and `ReceiptOrderCompletionChecker` all call `enqueue_notification` with the correct rule code and recipients
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 20.2 Write property test: Notifications are sent at each key lifecycle event (Property 18)
    - **Property 18: Notifications are sent at each key lifecycle event**
    - **Validates: Requirements 2.8, 12.1, 12.2, 12.3, 12.4, 12.6**

- [ ] 21. Integration test — end-to-end RA lifecycle
  - [ ]* 21.1 Write integration test for the full RA lifecycle
    - RA creation → Inspection linked → RA Active → Driver Confirm → GRN Draft → finish_stacking → GRN Confirmed → RA Closed → Receipt Order Completed
    - Verify `NotificationJob` is enqueued at each lifecycle event
    - Verify role-based scoping: each role sees only their authorized RAs
    - _Requirements: 2.7, 3.2, 3.3, 5.4, 5.5, 6.1, 6.3, 8.1, 8.3, 12.1, 12.2, 12.3, 12.4_

- [ ] 22. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use RSpec with randomized input generation (minimum 100 iterations per property), tagged with `# Feature: receipt-authorization, Property N: ...`
- The existing `finish_stacking` action is modified in place (Task 10); the old direct-completion path is replaced by `ReceiptOrderCompletionChecker`
- The `InspectionCreator` modification (Task 6) is additive — existing inspections without an RA continue to work unchanged
- Frontend routes for the Hub Manager pages should be registered in the router alongside existing hub-manager routes
