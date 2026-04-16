# Requirements Document

## Introduction

This document describes the end-to-end business process of the Warehouse Management Module used in humanitarian food aid operations (originally designed for NDRMC — Ethiopia). It is written as a business analyst's process document, not a technical specification. The goal is to give any reader — human or AI — a complete understanding of who does what, when, why, what documents are exchanged, what triggers each step, and how one process hands off to the next.

The system manages the full commodity lifecycle: from the moment a warehouse receives notice that goods are arriving, through physical intake and storage, through planning and executing outbound dispatch, to final receipt confirmation at destination hubs and Food Distribution Points (FDPs). It also handles hub-level distribution to beneficiaries and tracks any commodity losses in transit.

---

## Glossary

- **Warehouse**: A physical storage facility that holds food aid commodities. Managed by a Warehouse Manager. Contains one or more Stores.
- **Hub**: An intermediate distribution point between a Warehouse and FDPs. Managed by a Hub Manager. Receives commodities from a Warehouse and redistributes them to FDPs.
- **FDP (Food Distribution Point)**: The final delivery location where beneficiaries receive food aid. Located within a Woreda.
- **Store**: A physical room or section inside a Warehouse or Hub. Has defined dimensions (length × width × height). Managed by a Store Keeper. Contains Stacks.
- **Stack**: A named physical pile of a specific commodity inside a Store. Tracks current quantity on hand.
- **Warehouse Manager**: The role responsible for approving dispatch plans, authorizing dispatches, and overseeing all warehouse operations.
- **Hub Manager**: The role responsible for receiving commodities at a Hub, authorizing hub-level receipts, and managing hub distribution to FDPs.
- **Store Keeper**: The role responsible for physically handling commodities — stacking received goods, picking goods for dispatch, and recording transactions at the stack level.
- **Dispatcher**: The role responsible for executing the physical loading and transport of commodities from a Warehouse to a destination.
- **Commodity**: A food aid item (e.g., wheat, oil, pulses) identified by name, batch number, and unit of measure.
- **Project**: A funded aid program under which commodities are procured and distributed. Links Donors, Programs, and Commodities.
- **Donor**: The funding organization that provided the commodity (e.g., WFP, USAID).
- **Program**: The aid program category (e.g., Emergency Relief, School Feeding).
- **Monthly Plan (Plan)**: A high-level allocation plan created upstream (outside this module) that specifies how much of a commodity should be distributed in a given month, to which locations.
- **Round Plan**: A sub-division of a Monthly Plan. Represents one distribution round within a month, specifying the number of distribution days and the month.
- **Dispatch Plan**: A warehouse-level document that links a Monthly Plan or Round Plan to a specific commodity batch and initiates the dispatch process. Status: Draft → Approved.
- **Dispatch Plan Item**: A line item within a Dispatch Plan specifying the source location (Warehouse/Store), destination location (Hub/FDP), commodity, and planned quantity.
- **Dispatch**: The actual vehicle-level dispatch event. Records the transporter, truck plate number, driver name, driver phone, quantity loaded, and commodity condition. Status: Draft → Dispatched.
- **Dispatch Authorization**: The Store Keeper's authorization to release a specific quantity from a specific Store for a specific Dispatch. Confirmed by the Store Keeper before goods leave.
- **Dispatch Transaction**: A record of the actual quantity picked from a specific Stack to fulfill a Dispatch Authorization. Multiple transactions can fulfill one authorization.
- **GIN (Goods Issue Note)**: A printed document generated at dispatch time. Serves as the official release document accompanying the truck. Contains dispatch details, driver info, commodity, quantity, and authorized signatures.
- **Receipt Authorization**: The destination-side authorization (at Hub or Warehouse) to receive a specific quantity from a specific Dispatch. Confirmed by the receiving Store Keeper.
- **Receipt**: The actual record of commodity received at the destination. Records quantity received, commodity condition/grade, and any remarks. Status: Draft → Stacking Started → Stacking Completed.
- **Receipt Transaction**: A record of the actual quantity placed into a specific Stack during the receipt/stacking process.
- **GRN (Goods Received Note / Receiving Receipt)**: A printed document generated after receipt is confirmed. Official proof of delivery. Contains receipt details, quantities, commodity condition, and signatures.
- **Hub Authorization**: A document issued by the Warehouse Manager authorizing a Hub to receive a specific quantity of a commodity from a specific Dispatch Plan Item. Triggers the Hub's receipt process.
- **Lost Commodity**: A record of commodity that was dispatched but not received — due to theft, damage, or other loss in transit. Linked to a specific Dispatch.
- **Inventory Adjustment**: A correction record used to adjust the quantity of a Stack when a discrepancy is found (e.g., physical count differs from system count). Requires a reason. Status: Draft → Committed.
- **Stack Transaction**: A record of commodity movement between two Stacks within the same warehouse (internal transfer/re-stacking). Status: Draft → Committed.
- **Transporter**: A transport company or individual contracted to move commodities. Has a name and is associated with specific Dispatches.
- **Unit of Measure (UOM)**: The measurement unit for a commodity (e.g., MT — metric ton, Quintal, Bag). Unit conversions are supported.
- **Route**: A defined transport path from a source location to a destination location.
- **Location Hierarchy**: Region → Zone → Woreda → FDP / Kebele. Warehouses and Hubs are also location types.
- **Upstream Flow**: Commodity movement from an external source (port, supplier) into a Warehouse.
- **Downstream Flow**: Commodity movement from a Warehouse outward to Hubs or FDPs.
- **Notification**: An in-system alert sent to a role when an action requires their attention (e.g., a new dispatch authorization is waiting for confirmation).
- **Commodity Status**: The physical condition of a commodity at time of dispatch or receipt. Values: Good, Damaged, Infested, etc.
- **Commodity Grade**: A quality classification assigned at receipt time.

---

## Requirements

---

### Requirement 1: System Setup and Master Data

**User Story:** As a system administrator, I want to configure locations, stores, routes, and units of measure, so that all operational roles have the reference data they need to perform their work.

#### Acceptance Criteria

1. THE System SHALL maintain a hierarchical location registry with types: Region, Zone, Woreda, FDP, Kebele, Hub, and Warehouse.
2. THE System SHALL allow each Warehouse location to contain one or more Stores, each with defined physical dimensions (length, width, height) and an optional gangway.
3. THE System SHALL record a Store Keeper name and phone number for each Store.
4. THE System SHALL support temporary Stores in addition to permanent Stores.
5. THE System SHALL maintain a registry of Routes, each defining a named source-to-destination path between two locations.
6. THE System SHALL maintain Units of Measure and support unit conversion factors between them.
7. THE System SHALL maintain a registry of Transporters with name and contact details.
8. WHEN a Store is created, THE System SHALL initialize it with zero commodity quantity.

---

### Requirement 2: Commodity and Project Registration

**User Story:** As a warehouse manager, I want commodities to be registered under projects with donor and program linkages, so that all stock movements are traceable to their funding source and program purpose.

#### Acceptance Criteria

1. THE System SHALL maintain a Commodity registry with name, batch number, and unit of measure.
2. THE System SHALL maintain a Project registry linking a Donor, a Program, and one or more Commodities.
3. THE System SHALL associate every Dispatch Plan with a specific Commodity and Project.
4. WHEN a commodity is registered, THE System SHALL record its batch number to enable lot-level traceability.

---

### Requirement 3: Upstream Receipt — Receiving Commodities into the Warehouse

**User Story:** As a warehouse manager, I want to record the receipt of commodities arriving from an external source (port, supplier, or upstream warehouse), so that the warehouse inventory is accurately updated when goods arrive.

#### Acceptance Criteria

1. WHEN an upstream shipment is expected, THE Warehouse_Manager SHALL create a Dispatch Plan with the `upstream` flag set to true, referencing the source and the commodity batch.
2. WHEN an upstream Dispatch Plan is approved, THE System SHALL notify the relevant Store Keeper that a receipt authorization is pending.
3. THE Warehouse_Manager SHALL create a Receipt Authorization specifying the destination Store and the expected quantity to be received.
4. WHEN a Receipt Authorization is confirmed by the Store Keeper, THE System SHALL allow the Store Keeper to begin recording Receipts against it.
5. THE Store_Keeper SHALL record one or more Receipt records, each capturing: quantity received, commodity status (Good/Damaged/etc.), commodity grade, and any remarks.
6. WHEN the total quantity recorded in Receipts equals the authorized quantity, THE Store_Keeper SHALL trigger "Start Stacking" to begin the physical stacking process.
7. WHILE stacking is in progress, THE Store_Keeper SHALL record Receipt Transactions, each specifying the destination Stack and the quantity placed into it.
8. WHEN all commodity has been placed into Stacks, THE Store_Keeper SHALL trigger "Finish Stacking" to complete the receipt process.
9. WHEN stacking is finished, THE System SHALL update the quantity of each affected Stack to reflect the newly received commodity.
10. WHEN stacking is finished, THE System SHALL generate a GRN (Goods Received Note / Receiving Receipt) document available for download and printing.
11. IF the quantity physically received is less than the authorized quantity, THEN THE Store_Keeper SHALL record a Lost Commodity entry specifying the shortfall quantity, commodity status (e.g., Theft, Damage), and a remark.

---

### Requirement 4: Monthly Planning and Round Plan Creation

**User Story:** As a warehouse manager, I want to receive and work from approved monthly distribution plans, so that I know how much commodity to prepare for dispatch in a given month and round.

#### Acceptance Criteria

1. THE System SHALL receive Monthly Plans from an upstream planning system, each specifying commodity, quantity, target locations, and month.
2. THE Warehouse_Manager SHALL be able to view all Monthly Plans assigned to their warehouse.
3. THE Warehouse_Manager SHALL create Round Plans under a Monthly Plan, each specifying the number of distribution days and the month of the round.
4. WHEN a Round Plan is created, THE System SHALL allow the Warehouse_Manager to generate prospective Dispatch Plan Items from it, pre-populated with source, destination, commodity, and quantity based on the plan.
5. THE Warehouse_Manager SHALL review and adjust the generated Dispatch Plan Items before committing them.
6. WHEN a Dispatch Plan is created from a Round Plan, THE System SHALL mark the associated Monthly Plan as "Reserved" to prevent double-planning.

---

### Requirement 5: Dispatch Planning — Creating and Approving the Dispatch Plan

**User Story:** As a warehouse manager, I want to create and approve a dispatch plan that specifies which commodity goes from which store to which destination, so that the dispatch process has a clear, authorized basis.

#### Acceptance Criteria

1. THE Warehouse_Manager SHALL create a Dispatch Plan referencing a Monthly Plan or Round Plan, specifying the commodity, batch number, and request type.
2. THE System SHALL assign a unique reference number to each Dispatch Plan upon creation.
3. THE Warehouse_Manager SHALL add one or more Dispatch Plan Items to the Dispatch Plan, each specifying: source location (Warehouse/Store), destination location (Hub/FDP), commodity, and planned quantity.
4. WHEN a Dispatch Plan Item is created, THE System SHALL validate that the source location has sufficient stock to cover the planned quantity.
5. THE Warehouse_Manager SHALL approve the Dispatch Plan, changing its status from Draft to Approved.
6. WHEN a Dispatch Plan is approved, THE System SHALL notify the Dispatcher and Store Keeper that dispatch planning is ready to proceed.
7. WHILE a Dispatch Plan is in Draft status, THE Warehouse_Manager SHALL be able to edit or delete Dispatch Plan Items.
8. WHEN a Dispatch Plan is approved, THE System SHALL prevent further modification of its Dispatch Plan Items.

---

### Requirement 6: Hub Authorization — Notifying the Hub to Prepare for Receipt

**User Story:** As a warehouse manager, I want to issue a Hub Authorization to the destination hub before dispatching goods, so that the hub is officially notified and can prepare to receive the commodity.

#### Acceptance Criteria

1. THE Warehouse_Manager SHALL create a Hub Authorization for each Dispatch Plan Item that targets a Hub destination, specifying: the Dispatch Plan Item, the destination Store at the Hub, the quantity, and the authorization type.
2. THE System SHALL assign a unique reference number to each Hub Authorization.
3. WHEN a Hub Authorization is created, THE System SHALL notify the Hub_Manager that a shipment is authorized and incoming.
4. THE System SHALL generate a Hub Authorization document (.docx) available for download and printing, to be sent to the Hub as official advance notice.
5. THE Hub_Manager SHALL be able to view all Hub Authorizations addressed to their hub.
6. WHEN a Hub Authorization is received, THE Hub_Manager SHALL use it as the basis for creating a Receipt Authorization at the hub side.

---

### Requirement 7: Dispatch Execution — Loading and Sending the Truck

**User Story:** As a dispatcher, I want to record the details of each truck dispatch, so that there is a complete record of what left the warehouse, on which vehicle, with which driver, and in what condition.

#### Acceptance Criteria

1. THE Dispatcher SHALL create a Dispatch record under an approved Dispatch Plan Item, specifying: transporter, truck plate number, driver name, driver phone number, quantity to be dispatched, commodity status, and any remarks.
2. THE System SHALL assign a unique reference number to each Dispatch upon creation.
3. WHEN a Dispatch is created, THE System SHALL notify the Store Keeper that a Dispatch Authorization is pending their confirmation.
4. THE Warehouse_Manager SHALL create a Dispatch Authorization for the Dispatch, specifying the source Store and the quantity authorized for release.
5. WHEN a Dispatch Authorization is created, THE Store_Keeper SHALL receive a notification to confirm the release.
6. THE Store_Keeper SHALL confirm the Dispatch Authorization, signaling that the goods are ready to be picked from the store.
7. WHEN a Dispatch Authorization is confirmed, THE Store_Keeper SHALL record one or more Dispatch Transactions, each specifying the source Stack and the quantity picked from it.
8. WHEN the total quantity in Dispatch Transactions equals the authorized quantity, THE Store_Keeper SHALL finalize the dispatch, reducing the Stack quantities accordingly.
9. THE System SHALL generate a GIN (Goods Issue Note) document (.docx) available for download and printing, to accompany the truck as the official release document.
10. THE GIN SHALL contain: dispatch reference number, commodity name and batch, quantity, truck plate number, driver name, driver phone, source warehouse and store, destination, and authorized signatures.
11. WHEN a Dispatch is finalized, THE System SHALL update the source Stack quantities to reflect the goods that have left.

---

### Requirement 8: Downstream Receipt — Receiving Commodities at the Hub or FDP

**User Story:** As a hub manager or store keeper at the destination, I want to record the receipt of commodities arriving from the warehouse, so that the destination inventory is accurately updated and any discrepancies are captured.

#### Acceptance Criteria

1. WHEN a truck arrives at the destination Hub or Warehouse, THE Hub_Manager OR Store_Keeper SHALL locate the corresponding Dispatch record using the dispatch reference number or the GIN document.
2. THE Hub_Manager OR Warehouse_Manager SHALL create a Receipt Authorization for the incoming Dispatch, specifying the destination Store and the expected quantity.
3. WHEN a Receipt Authorization is created, THE Store_Keeper at the destination SHALL receive a notification to begin the receipt process.
4. THE Store_Keeper SHALL confirm the Receipt Authorization, signaling readiness to receive.
5. WHEN the driver arrives, THE System SHALL support a driver confirmation step where the driver's delivery is acknowledged.
6. THE Store_Keeper SHALL record one or more Receipt records against the Receipt Authorization, each capturing: quantity received, commodity status, commodity grade, and remarks.
7. IF the quantity received is less than the dispatched quantity, THEN THE Store_Keeper SHALL record a Lost Commodity entry for the shortfall, specifying: quantity lost, commodity status (Theft, Damage, etc.), and a remark.
8. WHEN all received quantity is recorded, THE Store_Keeper SHALL trigger "Start Stacking" to begin placing goods into Stacks.
9. WHILE stacking is in progress, THE Store_Keeper SHALL record Receipt Transactions, each specifying the destination Stack and the quantity placed.
10. WHEN all commodity has been stacked, THE Store_Keeper SHALL trigger "Finish Stacking" to complete the receipt.
11. WHEN stacking is finished, THE System SHALL update the destination Stack quantities.
12. WHEN stacking is finished, THE System SHALL generate a GRN (Goods Received Note) document (.docx) available for download and printing.
13. THE GRN SHALL contain: receipt reference number, dispatch reference number, commodity name and batch, quantity received, commodity status and grade, destination warehouse and store, and authorized signatures.

---

### Requirement 9: Lost Commodity Tracking

**User Story:** As a store keeper or hub manager, I want to record any commodity that was dispatched but not received, so that losses are formally documented and traceable to the specific dispatch event.

#### Acceptance Criteria

1. THE Store_Keeper OR Hub_Manager SHALL be able to record a Lost Commodity entry linked to a specific Dispatch, specifying: quantity lost, commodity status (Theft, Damage, Infested, etc.), and a remark explaining the loss.
2. THE System SHALL assign a unique reference number to each Lost Commodity record.
3. THE System SHALL maintain the status of Lost Commodity records (Draft → Approved).
4. THE System SHALL ensure that the sum of (quantity received + quantity lost) does not exceed the dispatched quantity for any given Dispatch.
5. THE Warehouse_Manager SHALL be able to view all Lost Commodity records for dispatches originating from their warehouse.

---

### Requirement 10: Hub Distribution — Distributing to FDPs and Beneficiaries

**User Story:** As a hub manager, I want to manage the distribution of commodities from the hub to FDPs and ultimately to beneficiaries, so that the final-mile delivery is tracked and recorded.

#### Acceptance Criteria

1. THE Hub_Manager SHALL create a Round Plan at the hub level, specifying the distribution round, number of days, and the plan it belongs to.
2. THE Hub_Manager SHALL register Round Beneficiaries under a Round Plan, each specifying: beneficiary ID, commodity category, quantity, and unit of measure.
3. WHEN a Round Plan is active, THE Hub_Manager SHALL be able to generate Dispatch Plan Items from it, pre-populated with source (Hub Store), destination (FDP), commodity, and quantity.
4. THE Hub_Manager SHALL execute the distribution checkout process, recording that each beneficiary has received their allocation.
5. WHEN a beneficiary's allocation is marked as received, THE System SHALL update the beneficiary's `received` flag to true.
6. THE System SHALL track the total quantity distributed per round and per commodity category.

---

### Requirement 11: Internal Stock Management — Stacking and Inventory Adjustments

**User Story:** As a store keeper, I want to move commodity between stacks and adjust inventory when discrepancies are found, so that the physical stock always matches the system record.

#### Acceptance Criteria

1. THE Store_Keeper SHALL be able to create a Stack Transaction to move commodity from one Stack to another within the same warehouse, specifying: source Stack, destination Stack, quantity, unit of measure, and transaction date.
2. WHEN a Stack Transaction is committed, THE System SHALL reduce the source Stack quantity and increase the destination Stack quantity by the specified amount.
3. THE Store_Keeper SHALL be able to create an Inventory Adjustment record when a physical count reveals a discrepancy, specifying: Hub, Warehouse, Store, Stack, quantity adjustment, and reason for adjustment.
4. WHEN an Inventory Adjustment is committed, THE System SHALL update the affected Stack quantity accordingly.
5. THE Warehouse_Manager SHALL approve Inventory Adjustments before they are committed to the stock record.
6. THE System SHALL maintain a full audit trail of all Stack Transactions and Inventory Adjustments, including who created them and when.

---

### Requirement 12: Floor Plan and Space Availability

**User Story:** As a warehouse manager or store keeper, I want to visualize the warehouse floor plan and see which stacks are where, so that I can make informed decisions about where to place incoming commodity.

#### Acceptance Criteria

1. THE System SHALL provide a visual floor plan view of each Warehouse, showing all Stores and their Stacks.
2. THE Floor_Plan SHALL display the current quantity and commodity in each Stack.
3. THE System SHALL provide a space availability view showing how much capacity remains in each Store based on its physical dimensions and current stack occupancy.
4. WHEN a Store has a gangway, THE System SHALL account for the gangway dimensions when calculating available floor space.
5. THE Store_Keeper SHALL be able to use the floor plan to select destination Stacks when recording Receipt Transactions.

---

### Requirement 13: Notifications and Workflow Handoffs

**User Story:** As any operational role, I want to receive in-system notifications when an action requires my attention, so that the workflow moves forward without delays caused by manual communication.

#### Acceptance Criteria

1. WHEN a Dispatch Authorization is created by the Warehouse Manager, THE System SHALL send a notification to the Store Keeper assigned to the source Store.
2. WHEN a Receipt Authorization is created, THE System SHALL send a notification to the Store Keeper assigned to the destination Store.
3. WHEN a Hub Authorization is issued, THE System SHALL send a notification to the Hub Manager of the destination Hub.
4. WHEN a Dispatch Plan is approved, THE System SHALL send a notification to the Dispatcher.
5. THE System SHALL maintain a list of unread notifications for each user.
6. WHEN a user reads a notification, THE System SHALL mark it as read.
7. THE System SHALL allow a user to mark a notification as unread.
8. THE System SHALL display the count of unread notifications in the application header at all times.

---

### Requirement 14: Document Generation

**User Story:** As a warehouse manager, dispatcher, or store keeper, I want to generate and download official documents at key process steps, so that physical paperwork accompanies every commodity movement.

#### Acceptance Criteria

1. WHEN a Dispatch Authorization is confirmed, THE System SHALL make a GIN (Goods Issue Note) document available for download in .docx format.
2. THE GIN SHALL include: dispatch reference number, commodity name, batch number, quantity, unit of measure, truck plate number, driver name, driver phone, source warehouse and store, destination, transporter name, and fields for authorized signatures.
3. WHEN a Receipt Authorization stacking is completed, THE System SHALL make a GRN (Goods Received Note / Receiving Receipt) document available for download in .docx format.
4. THE GRN SHALL include: receipt reference number, dispatch reference number, commodity name, batch number, quantity received, commodity status, commodity grade, destination warehouse and store, and fields for authorized signatures.
5. WHEN a Hub Authorization is created, THE System SHALL make a Hub Authorization document available for download in .docx format.
6. THE Hub Authorization document SHALL include: authorization reference number, commodity name, batch number, authorized quantity, source warehouse, destination hub and store, and fields for authorized signatures.

---

### Requirement 15: Reporting and Audit Trail

**User Story:** As a warehouse manager or system administrator, I want to view reports on stock levels, dispatch history, and receipt history, so that I can monitor operations and provide accountability to donors and program managers.

#### Acceptance Criteria

1. THE System SHALL provide a report view showing current stock levels per Warehouse, Store, and Stack, broken down by commodity and batch.
2. THE System SHALL provide a dispatch history report filterable by date range, commodity, destination, and dispatch status.
3. THE System SHALL provide a receipt history report filterable by date range, commodity, source, and receipt status.
4. THE System SHALL provide a lost commodity report showing all recorded losses by dispatch, commodity, and loss type.
5. THE System SHALL maintain a complete audit trail of all status changes, recording the user who made the change and the timestamp.
6. THE System SHALL provide a space availability report showing used and available capacity per Store.

---

## End-to-End Business Flow Summary

The following narrative describes the complete flow from start to finish, connecting all the requirements above into a single coherent process.

### Phase 1 — Setup (One-time / Periodic)

Before any commodity moves, the system administrator configures the location hierarchy (Regions, Zones, Woredas, FDPs, Hubs, Warehouses), creates Stores within each Warehouse, registers Transporters, defines Routes, and sets up Units of Measure. Commodities are registered with batch numbers and linked to Projects, Donors, and Programs.

### Phase 2 — Planning (Monthly / Per Round)

The Warehouse Manager receives a Monthly Plan from the upstream planning system. This plan specifies how much of a commodity should be distributed, to which locations, in a given month. The Warehouse Manager creates one or more Round Plans under the Monthly Plan, each representing a distribution round. From a Round Plan, the system can auto-generate prospective Dispatch Plan Items, which the Warehouse Manager reviews and adjusts before committing.

### Phase 3 — Dispatch Plan Creation and Approval

The Warehouse Manager creates a Dispatch Plan, linking it to the Monthly Plan or Round Plan and specifying the commodity batch. Dispatch Plan Items are added, each defining a source Store, a destination (Hub or FDP), and a planned quantity. Once all items are correct, the Warehouse Manager approves the Dispatch Plan. Approval locks the plan and triggers notifications to the Dispatcher and Store Keeper.

### Phase 4 — Hub Authorization (for Hub Destinations)

For each Dispatch Plan Item targeting a Hub, the Warehouse Manager issues a Hub Authorization. This is the official advance notice to the Hub Manager that a shipment is coming. The Hub Authorization document (.docx) is generated and can be physically sent or emailed to the Hub. The Hub Manager receives an in-system notification and begins preparing to receive the goods.

### Phase 5 — Dispatch Execution (at the Warehouse)

The Dispatcher creates a Dispatch record for each truck, recording the transporter, plate number, driver details, quantity, and commodity condition. The Warehouse Manager creates a Dispatch Authorization specifying which Store the goods will come from. The Store Keeper receives a notification, confirms the authorization, and then records Dispatch Transactions — picking from specific Stacks until the full authorized quantity is accounted for. The GIN (Goods Issue Note) is generated and printed to accompany the truck. Stack quantities are reduced.

### Phase 6 — Transit

The truck travels from the Warehouse to the destination Hub or FDP. The GIN travels with the truck as the official release document. Any losses during transit (theft, damage) will be recorded in the next phase.

### Phase 7 — Receipt at Destination (at the Hub or Warehouse)

When the truck arrives, the Hub Manager or Store Keeper at the destination locates the corresponding Dispatch using the GIN reference number. A Receipt Authorization is created for the incoming goods, specifying the destination Store. The Store Keeper confirms the authorization. If the quantity received is less than dispatched, a Lost Commodity record is created for the shortfall. The Store Keeper records Receipts (quantity, condition, grade), then triggers "Start Stacking" and records Receipt Transactions to place goods into specific Stacks. When complete, "Finish Stacking" is triggered, Stack quantities are updated, and the GRN (Goods Received Note) is generated and printed.

### Phase 8 — Hub Distribution to FDPs and Beneficiaries

At the Hub, the Hub Manager creates a Round Plan for the hub-level distribution round. Beneficiaries are registered under the round. The Hub Manager generates Dispatch Plan Items from the round plan (Hub Store → FDP) and executes the distribution checkout, marking each beneficiary as received when they collect their allocation.

### Phase 9 — Ongoing Stock Management

Throughout all phases, the Store Keeper can perform internal Stack Transactions to reorganize commodity between stacks. If a physical count reveals a discrepancy, an Inventory Adjustment is created, approved by the Warehouse Manager, and committed to update the Stack quantity. The floor plan view helps the Store Keeper visualize available space and plan stacking locations.

### Phase 10 — Reporting and Accountability

At any point, the Warehouse Manager can run reports on current stock levels, dispatch history, receipt history, and lost commodities. All actions are logged with user and timestamp for full audit trail and donor accountability.
