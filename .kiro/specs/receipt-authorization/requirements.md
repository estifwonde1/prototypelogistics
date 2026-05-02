# Requirements Document

## Introduction

This document describes the **Receipt Authorization** feature for the CATS Warehouse Management System. Receipt Authorization (RA) is the formal per-truck authorization that bridges a confirmed Receipt Order and the physical arrival of goods at a store. It captures vehicle and driver details, assigns a specific store and quantity to each truck, and gates the downstream receipt recording, driver confirmation, and GRN lifecycle.

The feature covers:
- A new **Receipt Authorizer** role and its assignment model
- RA creation by Hub Manager, Warehouse Manager, or a delegated Receipt Authorizer
- Storekeeper notification and receipt recording linked to the RA
- A **Driver Confirm** step that must precede GRN creation
- A revised **GRN lifecycle** (Draft after driver confirmation → Confirmed after stacking)
- **Receipt Order completion logic** — an order completes only when every RA across all allocated hubs/warehouses has been fully stacked

The Receipt Order flow (Steps 1–4) and the stacking flow (Steps 10–11) already exist in the system. This feature integrates with them without replacing them.

---

## Glossary

- **Receipt_Order**: An existing document created by an Officer specifying commodity, destination hub/warehouse, quantity, and expected date. Status: Draft → Confirmed → Completed.
- **Receipt_Order_Assignment**: An existing record that splits a confirmed Receipt Order across warehouses under a hub.
- **Receipt_Authorization (RA)**: A new per-truck document linking a Receipt Order to a specific store, quantity, and vehicle. One RA per truck. Status: Pending → Active → Closed.
- **Receipt_Authorizer**: A new role that can create and manage Receipt Authorizations. Assigned per hub or warehouse, similar to how Storekeeper is assigned per store.
- **Hub_Manager**: An existing role that manages a hub and all warehouses under it. Can create RAs for any warehouse under their hub.
- **Warehouse_Manager**: An existing role that manages a single warehouse. Can create RAs for their warehouse when acting as Receipt Authorizer (holds both roles).
- **Storekeeper**: An existing role assigned per store. Receives notification when an RA is created for their store and records the physical receipt.
- **Driver_Confirm**: A new step where the driver's delivery is acknowledged before the GRN is generated. On desktop, the Storekeeper clicks a "Driver Confirmed Delivery" button. On mobile, the driver and Storekeeper co-sign.
- **GRN (Goods Received Note)**: An existing document. Under the new lifecycle: created in Draft status after Driver Confirm, confirmed after stacking is finished.
- **Inspection**: An existing record (Step 7) where the Storekeeper records quantity received, condition, grade, and losses when the truck arrives.
- **Space_Reservation**: An existing optional pre-planning tool. Remains unchanged; RA is the mandatory actual store assignment.
- **Transporter**: An existing registry of transport companies. Referenced by RA vehicle details.
- **Waybill_Number**: A transport document reference number captured on the RA.

---

## Requirements

---

### Requirement 1: Receipt Authorizer Role

**User Story:** As a system administrator, I want a dedicated Receipt Authorizer role that can be assigned per hub or warehouse, so that the right person is authorized to create Receipt Authorizations without requiring full Hub Manager or Warehouse Manager privileges.

#### Acceptance Criteria

1. THE System SHALL define a **Receipt Authorizer** role within the CATS Warehouse application module.
2. THE System SHALL allow the Receipt Authorizer role to be assigned to a user scoped to a specific hub or warehouse, using the same assignment mechanism as the Storekeeper role.
3. THE System SHALL allow a single user to hold both the Warehouse Manager role and the Receipt Authorizer role simultaneously for the same warehouse.
4. WHEN a user holds the Hub Manager role for a hub, THE System SHALL grant that user Receipt Authorizer privileges for all warehouses under that hub without requiring a separate role assignment.
5. WHEN a user holds the Warehouse Manager role for a warehouse that has no hub, THE System SHALL allow that user to act as Receipt Authorizer for that warehouse by also being assigned the Receipt Authorizer role.
6. THE System SHALL display the Receipt Authorization menu item in the Hub Manager dashboard for users with Hub Manager or Receipt Authorizer role.
7. IF a user attempts to create a Receipt Authorization without the Hub Manager, Warehouse Manager, or Receipt Authorizer role for the relevant hub or warehouse, THEN THE System SHALL return an authorization error and prevent the creation.

---

### Requirement 2: Receipt Authorization Creation

**User Story:** As a Hub Manager, Warehouse Manager, or Receipt Authorizer, I want to create a Receipt Authorization for each truck delivering goods, so that every truck arrival is formally authorized with store assignment and vehicle details before goods are received.

#### Acceptance Criteria

1. WHEN a Receipt Order has been confirmed and assignments have been made, THE Hub_Manager OR Receipt_Authorizer SHALL be able to create one or more Receipt Authorizations against that Receipt Order.
2. THE Receipt_Authorization SHALL capture the following mandatory fields:
   - Linked Receipt Order
   - Destination store
   - Authorized quantity
   - Driver name
   - Driver ID number
   - Truck plate number
   - Transporter (from the existing Transporter registry)
   - Waybill number
3. THE System SHALL assign a unique reference number to each Receipt Authorization upon creation.
4. THE System SHALL enforce that the destination store belongs to a warehouse that is allocated under the linked Receipt Order's assignment.
5. THE System SHALL allow multiple Receipt Authorizations to be created against a single Receipt Order (one per truck).
6. THE System SHALL validate that the sum of authorized quantities across all RAs for a given Receipt Order assignment does not exceed the quantity allocated to that warehouse in the Receipt Order assignment.
7. WHEN a Receipt Authorization is created, THE System SHALL set its status to **Pending**.
8. WHEN a Receipt Authorization is created, THE System SHALL send a notification to the Storekeeper assigned to the destination store.
9. WHERE a Receipt Order targets a warehouse directly (no hub), THE Warehouse_Manager OR Receipt_Authorizer SHALL create the Receipt Authorization directly against that Receipt Order without a hub assignment step.

---

### Requirement 3: Receipt Authorization Lifecycle

**User Story:** As a Hub Manager or Receipt Authorizer, I want Receipt Authorizations to have a clear lifecycle, so that each RA's status accurately reflects whether goods are pending, being received, or fully stacked.

#### Acceptance Criteria

1. THE Receipt_Authorization SHALL support the following statuses: **Pending**, **Active**, **Closed**.
2. WHEN a Storekeeper begins recording an Inspection (receipt recording) against a Receipt Authorization, THE System SHALL transition the RA status from Pending to **Active**.
3. WHEN stacking is finished for all goods covered by a Receipt Authorization, THE System SHALL transition the RA status from Active to **Closed**.
4. WHILE a Receipt Authorization is in Pending status, THE Hub_Manager OR Receipt_Authorizer SHALL be able to edit the vehicle details (driver name, driver ID, plate number, transporter, waybill number) and authorized quantity.
5. WHEN a Receipt Authorization is in Active or Closed status, THE System SHALL prevent modification of its core fields.
6. IF a Receipt Authorization is in Pending status and no Inspection has been linked to it, THEN THE Hub_Manager OR Receipt_Authorizer SHALL be able to cancel the RA.
7. WHEN a Receipt Authorization is cancelled, THE System SHALL release the quantity it held against the Receipt Order assignment allocation.

---

### Requirement 4: Linking Inspection (Receipt Recording) to Receipt Authorization

**User Story:** As a Storekeeper, I want to record the physical receipt of goods against a specific Receipt Authorization, so that every quantity received is traceable to the truck and authorization that brought it.

#### Acceptance Criteria

1. WHEN a Storekeeper records an Inspection (Step 7 — quantity received, condition, grade, losses), THE System SHALL require the Storekeeper to select the Receipt Authorization the truck corresponds to.
2. THE System SHALL only present Receipt Authorizations in **Pending** status that are assigned to a store the Storekeeper is responsible for.
3. WHEN an Inspection is linked to a Receipt Authorization, THE System SHALL transition the RA status from Pending to Active.
4. THE System SHALL allow only one active Inspection per Receipt Authorization at a time.
5. IF the quantity recorded in the Inspection is less than the RA authorized quantity, THEN THE Storekeeper SHALL be able to record a loss entry specifying quantity lost, loss type (Theft, Damage, etc.), and a remark.
6. THE System SHALL validate that the quantity recorded in the Inspection does not exceed the authorized quantity on the linked Receipt Authorization.

---

### Requirement 5: Driver Confirmation Step

**User Story:** As a Storekeeper, I want to formally confirm that the driver has acknowledged delivery before the GRN is generated, so that there is a documented acknowledgment from the driver that goods were delivered.

#### Acceptance Criteria

1. WHEN an Inspection linked to a Receipt Authorization has been recorded, THE System SHALL require a Driver Confirm step before generating the GRN.
2. THE System SHALL present a **"Driver Confirmed Delivery"** action on the desktop interface, which the Storekeeper clicks to record driver acknowledgment.
3. WHERE the mobile interface is used, THE System SHALL support a co-sign flow where both the driver and the Storekeeper sign to confirm delivery.
4. WHEN the Driver Confirm action is completed, THE System SHALL record the confirmation timestamp and the user who performed it.
5. WHEN the Driver Confirm action is completed, THE System SHALL generate a GRN in **Draft** status linked to the Receipt Authorization and the Inspection.
6. IF the Driver Confirm step has not been completed, THEN THE System SHALL prevent GRN generation for that Receipt Authorization.
7. THE System SHALL display the current Driver Confirm status (Pending / Confirmed) on the Receipt Authorization detail view.

---

### Requirement 6: GRN Lifecycle Change

**User Story:** As a Storekeeper, I want the GRN to be created in Draft after driver confirmation and confirmed only after stacking is complete, so that the GRN accurately reflects the fully stacked and verified receipt rather than just the truck arrival.

#### Acceptance Criteria

1. THE System SHALL create the GRN in **Draft** status immediately after the Driver Confirm step is completed (not at finish_stacking as currently implemented).
2. THE GRN SHALL be linked to the Receipt Authorization that triggered it.
3. WHEN the Storekeeper completes stacking (finish_stacking), THE System SHALL transition the GRN status from Draft to **Confirmed**.
4. WHEN the GRN is confirmed, THE System SHALL update the stack quantities to reflect the received commodity.
5. THE System SHALL prevent a GRN from being confirmed unless its linked Receipt Authorization is in Active status.
6. THE GRN SHALL include: GRN reference number, Receipt Authorization reference number, Receipt Order reference number, commodity name and batch, quantity received, commodity status, commodity grade, destination warehouse and store, driver name, truck plate number, transporter, waybill number, and fields for authorized signatures.
7. WHEN a GRN is confirmed, THE System SHALL make the GRN document available for download and printing in .docx format.
8. IF a GRN is in Draft status, THEN THE Storekeeper SHALL be able to view it but not confirm it manually — confirmation is triggered only by finish_stacking.

---

### Requirement 7: Stacking Linked to Receipt Authorization

**User Story:** As a Storekeeper, I want the stacking process to be linked to a specific Receipt Authorization, so that stack updates are traceable to the truck and authorization that delivered the goods.

#### Acceptance Criteria

1. WHEN a Storekeeper begins stacking (start_stacking), THE System SHALL require the Storekeeper to select the Receipt Authorization the stacking corresponds to.
2. THE System SHALL only allow stacking to begin for a Receipt Authorization that has a Driver Confirm recorded and a GRN in Draft status.
3. WHEN the Storekeeper records stack placements, THE System SHALL associate each stack transaction with the linked Receipt Authorization.
4. WHEN finish_stacking is triggered, THE System SHALL confirm the linked GRN (transition from Draft to Confirmed) and update stack quantities.
5. WHEN finish_stacking is triggered, THE System SHALL transition the Receipt Authorization status from Active to **Closed**.
6. THE System SHALL prevent finish_stacking from being triggered if the total quantity placed into stacks is less than the quantity recorded in the linked Inspection.

---

### Requirement 8: Receipt Order Completion Logic

**User Story:** As an Officer or Hub Manager, I want the Receipt Order to be marked as Completed only when all trucks across all allocated warehouses have been fully stacked, so that the order status accurately reflects the complete physical receipt of all goods.

#### Acceptance Criteria

1. THE System SHALL mark a Receipt Order as **Completed** only when every Receipt Authorization linked to that Receipt Order is in **Closed** status.
2. WHEN a Receipt Authorization transitions to Closed, THE System SHALL check whether all other RAs for the same Receipt Order are also Closed.
3. IF all Receipt Authorizations for a Receipt Order are Closed, THEN THE System SHALL automatically transition the Receipt Order status to **Completed**.
4. IF one or more Receipt Authorizations for a Receipt Order are not yet Closed, THEN THE System SHALL keep the Receipt Order in its current status (Confirmed or in-progress).
5. THE System SHALL display a progress indicator on the Receipt Order showing the count of Closed RAs versus total RAs (e.g., "3 of 5 trucks completed").
6. THE System SHALL prevent manual completion of a Receipt Order if any linked Receipt Authorization is not in Closed status.
7. WHEN a Receipt Authorization is cancelled, THE System SHALL exclude it from the completion count and re-evaluate whether the Receipt Order can be completed.

---

### Requirement 9: Hub Manager Dashboard — Receipt Authorization Menu

**User Story:** As a Hub Manager, I want a dedicated Receipt Authorization section in my dashboard, so that I can create, view, and manage all RAs for warehouses under my hub from a single place.

#### Acceptance Criteria

1. THE System SHALL add a **Receipt Authorization** menu item to the Hub Manager dashboard.
2. THE Hub_Manager SHALL be able to view all Receipt Authorizations for all warehouses under their hub, filterable by status (Pending, Active, Closed) and by warehouse.
3. THE Hub_Manager SHALL be able to create a new Receipt Authorization from the dashboard, selecting the Receipt Order, warehouse, store, quantity, and vehicle details.
4. THE Hub_Manager SHALL be able to view the detail of any Receipt Authorization, including its linked Inspection, Driver Confirm status, and GRN.
5. THE System SHALL display a summary count of Pending, Active, and Closed RAs on the Hub Manager dashboard.
6. WHEN a Receipt Authorization is created from the Hub Manager dashboard, THE System SHALL pre-filter the store selection to only stores belonging to warehouses under the Hub Manager's hub.

---

### Requirement 10: Warehouse-Only Receipt Authorization Flow

**User Story:** As a Warehouse Manager or Receipt Authorizer for a standalone warehouse, I want to create Receipt Authorizations directly against a Receipt Order without a hub assignment step, so that the same RA flow works for both hub-managed and standalone warehouse orders.

#### Acceptance Criteria

1. WHEN a Receipt Order targets a warehouse directly (no hub), THE Warehouse_Manager OR Receipt_Authorizer SHALL create the Receipt Authorization directly against the Receipt Order.
2. THE System SHALL apply the same RA creation, lifecycle, Driver Confirm, GRN, and completion logic for warehouse-only orders as for hub-managed orders.
3. THE System SHALL add a Receipt Authorization menu item to the Warehouse Manager dashboard for standalone warehouse orders.
4. THE System SHALL validate that the destination store on the RA belongs to the warehouse specified in the Receipt Order.
5. THE System SHALL enforce the same quantity validation rules (RA quantity ≤ Receipt Order line quantity) for warehouse-only orders.

---

### Requirement 11: Space Reservation Compatibility

**User Story:** As a Hub Manager or Warehouse Manager, I want the optional Space Reservation tool to remain available as a pre-planning step, so that teams can optionally reserve store space before creating the mandatory Receipt Authorization.

#### Acceptance Criteria

1. THE System SHALL retain the existing Space Reservation functionality as an optional pre-planning step.
2. THE Space_Reservation SHALL remain independent of the Receipt Authorization — creating a Space Reservation SHALL NOT be required before creating a Receipt Authorization.
3. WHEN a Receipt Authorization is created for a store that has an existing Space Reservation, THE System SHALL display the reservation details as informational context but SHALL NOT enforce or consume the reservation automatically.
4. THE System SHALL allow a Space Reservation to exist without a corresponding Receipt Authorization.
5. THE System SHALL allow a Receipt Authorization to be created without a prior Space Reservation.

---

### Requirement 12: Notifications for Receipt Authorization Workflow

**User Story:** As a Storekeeper, Hub Manager, or Warehouse Manager, I want to receive in-system notifications at each key step of the Receipt Authorization workflow, so that I know when action is required without relying on manual communication.

#### Acceptance Criteria

1. WHEN a Receipt Authorization is created, THE System SHALL send a notification to the Storekeeper assigned to the destination store.
2. WHEN a Driver Confirm is recorded, THE System SHALL send a notification to the Hub_Manager OR Warehouse_Manager that a GRN has been generated in Draft status.
3. WHEN a GRN is confirmed (after finish_stacking), THE System SHALL send a notification to the Hub_Manager OR Warehouse_Manager.
4. WHEN a Receipt Order is marked Completed, THE System SHALL send a notification to the Officer who created the Receipt Order.
5. THE System SHALL use the existing notification rule mechanism (notification code: `receipt_authorization`) for RA-related notifications.
6. WHEN a Receipt Authorization is cancelled, THE System SHALL send a notification to the Storekeeper of the affected store informing them the RA has been cancelled.

---

## End-to-End Flow Summary (Steps 1–11)

The following narrative connects the Receipt Authorization feature to the existing system flow:

**Step 1 — Officer** registers a commodity batch in the system.

**Step 2 — Officer** creates a Receipt Order specifying commodity, destination hub/warehouse, quantity, and expected date.

**Step 3 — Officer** confirms the Receipt Order. The Hub Manager and/or Warehouse Manager receive a notification.

**Step 4 — Hub Manager** assigns the Receipt Order to warehouses under the hub, splitting quantity across them.

**Step 5 — Hub Manager OR Receipt Authorizer** creates one Receipt Authorization per truck. Each RA links to the Receipt Order, specifies a store and quantity, and captures driver name, driver ID, plate number, transporter, and waybill number. The Storekeeper of the destination store is notified.

**Step 6 — [Removed]** The Storekeeper does NOT confirm the RA. The RA moves to Active automatically when the Storekeeper begins recording the Inspection.

**Step 7 — Storekeeper** records the Inspection when the truck arrives: quantity received, condition, grade, and any losses. The Inspection is linked to the RA.

**Step 8 — Driver Confirm** (before GRN). The Storekeeper clicks "Driver Confirmed Delivery" on desktop, or the driver and Storekeeper co-sign on mobile. This triggers GRN creation in Draft status.

**Step 9 — GRN (Draft)** is created after Driver Confirm. The driver may sign the GRN at this point.

**Step 10 — Storekeeper** stacks the goods: selects stacks and enters quantities per stack.

**Step 11 — Storekeeper** finishes stacking. The GRN transitions from Draft to Confirmed. Stack quantities are updated. The RA transitions to Closed. When all RAs for the Receipt Order are Closed, the Receipt Order transitions to Completed.
