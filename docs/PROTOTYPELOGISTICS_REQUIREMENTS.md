# Prototypelogistics — Remaining Requirements

## Introduction

This document describes what is still needed to make the prototypelogistics system fully match the business process of the original warehouse management system. It is written for anyone — developer or non-developer — to understand what has been built, what is partially done, and what is completely missing.

Each requirement has:
- A plain-language explanation with a real-world example
- A User Story in the format: As a [role], I want to [do something], so that [reason]
- Acceptance Criteria — the specific things that must be true for this to be done
- A status: Done, Partial, or Missing

Every sub-requirement (3.1, 3.2, etc.) is its own standalone requirement with its own user story and acceptance criteria. Each one is a single Jira ticket.

---

## Key Decisions Made With the Product Owner

- Officer role replaces any external planning module. Officers register incoming shipments manually.
- Hub distribution to FDPs and beneficiaries is NOT in scope for this version.
- Lost Commodity records are created by the Storekeeper with no approval needed.
- Driver confirmation means the Storekeeper looks up the delivery by reference number — no signature or SMS.
- One Receipt Authorization can cover multiple stores (large shipments split across stores).
- Dispatcher is a separate role with their own dashboard.
- No external system integrations needed — system is self-contained.
- Document templates (.docx) will be replicated from the old system.
- English first, Amharic support planned for a later version.

---

## Status Legend

- Done: fully implemented and working
- Partial: exists but missing key business rules
- Missing: not built at all

---

## Requirement 1: Routes Registry

**Status: Missing**

**What this means:**
Before dispatches can be planned, the system needs to know the standard paths goods travel between locations. A Route is a named path — for example 'Addis Ababa Warehouse to Dire Dawa Hub.' When a Dispatcher or Officer creates a dispatch, they pick a route instead of manually typing source and destination every time. It also helps with reporting — you can filter all dispatches that went on a specific route.

**Real example:**
The logistics team knows that every week, trucks go from Addis Ababa Warehouse to Dire Dawa Hub. Instead of typing both locations every time, they select the route 'Addis-Dire Dawa' and both fields fill in automatically.

**User Story:**
As a system administrator, I want to create and manage Routes between locations, so that dispatchers and officers can select a standard route when creating dispatches instead of manually entering source and destination every time.

**Acceptance Criteria:**
1. The system SHALL maintain a registry of Routes, each with a name, a source location, and a destination location.
2. An administrator SHALL be able to create, edit, and delete Routes from the admin setup pages.
3. Routes SHALL be available as a dropdown when creating a Dispatch Order or Waybill.
4. WHEN a Route is selected, the system SHALL auto-fill the source and destination location fields.
5. The system SHALL prevent creating a Route where source and destination are the same location.

---

## Requirement 2: Store Keeper Contact on Store

**Status: Missing**

**What this means:**
Each Store inside a warehouse is managed by a specific Storekeeper. The system should record that person's name and phone number on the Store itself, so that anyone looking at a Store knows who is responsible for it and how to reach them.

**Real example:**
Store A in Addis Warehouse is managed by Abebe. His phone is 0911-123456. When the Warehouse Manager looks at Store A in the system, they can see Abebe's name and number without having to ask around.

**User Story:**
As a warehouse manager, I want each Store to display the name and phone number of the assigned Storekeeper, so that I can quickly identify who is responsible for each store and contact them when needed.

**Acceptance Criteria:**
1. Each Store SHALL have a store keeper name field and a store keeper phone number field.
2. These fields SHALL be visible on the Store detail page.
3. An administrator or warehouse manager SHALL be able to set or update these fields.
4. WHEN a Storekeeper user is assigned to a Store via the user assignment system, the system SHOULD auto-populate these fields from the user's profile name and phone number.

---

## Requirement 3: Donor, Program, and Project Registration

**Status: Missing**

**What this means:**
Every commodity in this system was paid for by someone — a donor like WFP or USAID — under a specific program like Emergency Relief or School Feeding. The system needs to track this linkage so that every shipment can be traced back to its funding source. This is how the organization proves to donors that their money was used correctly.

**Real example:**
WFP funded an Emergency Relief program and bought 10,000 bags of wheat. In the system, WFP is the Donor, Emergency Relief is the Program, and the Project links them together with the wheat commodity. Every GRN and GIN that moves that wheat shows 'WFP — Emergency Relief' so the audit trail is complete.

**User Story:**
As a warehouse manager, I want commodities to be registered under projects with donor and program linkages, so that all stock movements are traceable to their funding source and program purpose.

**Acceptance Criteria:**
1. The system SHALL maintain a Donor registry with name and contact details.
2. The system SHALL maintain a Program registry with name and program type.
3. The system SHALL maintain a Project registry that links one Donor, one Program, and one or more Commodities.
4. An administrator SHALL be able to create and manage Donors, Programs, and Projects from the admin setup pages.
5. WHEN creating a Receipt Order or Dispatch Order, the Officer SHALL be able to link it to a Project.
6. All GRN and GIN documents SHALL display the associated Project, Donor, and Program when a project is linked.
7. The system SHALL prevent deleting a Donor or Program that is linked to an active Project.

---

## Requirement 4: Role-Based Login and Dashboard Routing

**Status: Done**

**What this means:**
Right now every user who logs in sees the same navigation and the same pages regardless of their role. A Storekeeper should only see their store's work. A Hub Manager should only see their hub. A Warehouse Manager should only see their warehouse. The system needs to detect each user's role when they log in and send them to the right place automatically.

**Real example:**
Abebe is a Storekeeper assigned to Store A. When he logs in, he should land on his Storekeeper dashboard showing his pending receipts and dispatch tasks for Store A only. He should not see the Officer's order management pages or the Warehouse Manager's approval screens. Right now he sees everything.

**User Story:**
As any operational user, I want to be taken to my own dashboard when I log in, so that I only see the work that is relevant to my role and do not get confused by screens that are not meant for me.

**Acceptance Criteria:**
1. WHEN a user logs in, the system SHALL detect their assigned role from the user assignment records.
2. The system SHALL redirect each role to their dedicated dashboard automatically: Officer goes to Officer Dashboard, Warehouse Manager goes to Warehouse Manager Dashboard, Storekeeper goes to Storekeeper Dashboard, Hub Manager goes to Hub Manager Dashboard, Dispatcher goes to Dispatcher Dashboard.
3. IF a user has no role assigned yet, the system SHALL show a clear message: 'Your account has not been assigned to a facility yet. Please contact your administrator.'
4. IF a user has multiple roles, the system SHALL show them a role selection screen before redirecting.
5. Each dashboard SHALL only show data scoped to that user's assigned facility — a Storekeeper assigned to Store A SHALL NOT see data from Store B.

---

## Requirement 5: Warehouse Manager Dashboard

**Status: Partial**

**What this means:**
The Warehouse Manager is responsible for approving incoming shipments, assigning Storekeepers to receive goods, authorizing outgoing dispatches, and overseeing the warehouse's stock. Right now there is no dedicated screen for the Warehouse Manager. They have no central place to see what needs their attention.

**Real example:**
Tigist is the Warehouse Manager at Addis Warehouse. She logs in and needs to see: three Receipt Orders waiting for her to assign Storekeepers, two Dispatch Authorizations she needs to approve, and the current stock levels in her warehouse. Right now she has to navigate through multiple unrelated pages to find all of this.

**User Story:**
As a warehouse manager, I want a dedicated dashboard that shows me everything requiring my attention in my warehouse, so that I can manage incoming and outgoing shipments efficiently without hunting through multiple pages.

**Acceptance Criteria:**
1. The Warehouse Manager SHALL have a dedicated dashboard scoped to their assigned Warehouse.
2. The dashboard SHALL show a summary of: Receipt Orders pending Storekeeper assignment, Dispatch Orders pending authorization, active Dispatch Authorizations awaiting Storekeeper confirmation, pending Inventory Adjustments awaiting approval, and current stock levels by commodity.
3. The Warehouse Manager SHALL be able to click any item in the summary to go directly to that record.
4. All data on the dashboard SHALL be scoped to the Warehouse Manager's assigned warehouse only — they SHALL NOT see data from other warehouses.
5. The dashboard SHALL show a count of unread notifications.

---

## Requirement 6: Storekeeper Dashboard

**Status: Partial**

**What this means:**
The Storekeeper is the person physically handling the goods — receiving trucks, stacking bags, picking goods for dispatch. Right now the Storekeeper only has an assignments page where they accept or reject assignments. They have no dashboard showing their daily work queue.

**Real example:**
Abebe is a Storekeeper at Store A. He logs in in the morning and needs to see: one incoming delivery he needs to receive today, one dispatch authorization he needs to confirm, and one stacking task still in progress from yesterday. Right now he has no single screen showing all of this.

**User Story:**
As a storekeeper, I want a dashboard that shows me all my pending tasks for my store, so that I know exactly what I need to do each day without having to check multiple pages.

**Acceptance Criteria:**
1. The Storekeeper SHALL have a dedicated dashboard scoped to their assigned Store.
2. The dashboard SHALL show: pending Receipt Authorizations to confirm, receipts currently in progress (stacking), pending Dispatch Authorizations to confirm, dispatch transactions currently in progress, and recent completed transactions.
3. The dashboard SHALL have a prominent search box labeled 'Driver Arrival — Enter Reference Number' so the Storekeeper can quickly look up an incoming delivery when a truck arrives.
4. All data SHALL be scoped to the Storekeeper's assigned Store only.
5. The dashboard SHALL show a count of unread notifications.

---

## Requirement 7: Multi-Store Storekeeper Assignment on Receipt Order

**Status: Partial**

**What this means:**
When a large shipment arrives, it often gets split across multiple stores in the same warehouse. The Warehouse Manager needs to assign a different Storekeeper to each store's portion. Right now the system only supports assigning one person to the whole Receipt Order. It does not support splitting the assignment across multiple stores.

**Real example:**
A truck arrives with 1,000 bags of wheat. The Warehouse Manager decides: 600 bags go to Store A (Storekeeper Abebe) and 400 bags go to Store B (Storekeeper Tigist). The system needs to create two separate assignments — one for Abebe covering 600 bags in Store A, and one for Tigist covering 400 bags in Store B. Both Abebe and Tigist get notified separately about their portion only.

**User Story:**
As a warehouse manager, I want to assign different storekeepers to different stores when receiving a large shipment, so that each storekeeper only handles their portion of the goods and receives a notification for their specific store.

**Acceptance Criteria:**
1. WHEN confirming a Receipt Order, the Warehouse Manager SHALL be able to add multiple store assignments, each specifying: the Store, the Storekeeper assigned to that store, and the quantity allocated to that store.
2. The total quantity across all store assignments SHALL NOT exceed the total quantity on the Receipt Order.
3. EACH assigned Storekeeper SHALL receive a separate notification showing only their store and their quantity.
4. Each store assignment SHALL be tracked independently — Abebe finishing Store A does not affect Tigist's progress in Store B.
5. The Receipt Order detail page SHALL show all store assignments and their individual status.
6. The Warehouse Manager dashboard SHALL show Receipt Orders that have no store assignments yet as 'Pending Assignment.'

---

## Requirement 8: Driver Arrival — Reference Number Lookup

**Status: Missing**

**What this means:**
When a truck arrives at the warehouse or hub, the driver has a reference number from the dispatch. The Storekeeper needs to type that reference number into the system to find the expected delivery and start the receipt process. Right now there is no screen for this. The Storekeeper has no way to look up an incoming delivery when a driver shows up.

**Real example:**
A driver arrives at Addis Warehouse and hands Abebe a paper with reference number 'DO-2026-0042.' Abebe goes to his Storekeeper dashboard, types 'DO-2026-0042' into the search box, and the system shows him: 500 bags of wheat, coming from Dire Dawa, expected today. He clicks 'Start Receipt' and the process begins.

**User Story:**
As a storekeeper, I want to look up an incoming delivery by its reference number when a driver arrives, so that I can quickly find the expected shipment and begin the receipt process without searching through lists manually.

**Acceptance Criteria:**
1. The Storekeeper dashboard SHALL have a clearly visible search field for entering a delivery reference number.
2. WHEN a reference number is entered, the system SHALL search across Dispatch Orders, Waybills, and Receipt Orders for a match.
3. WHEN a match is found, the system SHALL display the delivery details: commodity, quantity, source location, expected date, and the Officer who created the order.
4. From the search result, the Storekeeper SHALL be able to click 'Start Receipt' to begin recording the receipt directly.
5. IF no match is found, the system SHALL display: 'No expected delivery found for this reference number. Please check the reference and try again.'
6. The search SHALL work from the Storekeeper dashboard without requiring the Storekeeper to navigate to any other page first.

---

## Requirement 9: Staged Receipt Recording — Condition and Grade

**Status: Missing**

**What this means:**
After the driver arrives and the Storekeeper finds the expected delivery, the next step is to record what actually arrived — how many bags, what condition they are in, and what grade. This is a separate step from stacking. The Storekeeper records the receipt first, then starts the physical stacking process. Right now the GRN is created in one shot with no intermediate receipt recording step.

**Real example:**
Abebe confirms the driver has arrived with 500 bags of wheat. He now records the receipt: 480 bags arrived in Good condition, Grade A. He notes '20 bags were damaged in transit' as a remark. He has not started stacking yet — he is just recording what came off the truck. Only after this step does he click 'Start Stacking.'

**User Story:**
As a storekeeper, I want to record the quantity, condition, and grade of goods as they come off the truck before I start stacking, so that the receipt record accurately captures the physical state of the goods at the moment of arrival.

**Acceptance Criteria:**
1. AFTER confirming a driver arrival, the Storekeeper SHALL be presented with a receipt recording form.
2. The form SHALL capture: quantity received, commodity condition (Good / Damaged / Infested / Wet / Other), commodity grade, and remarks.
3. The Storekeeper SHALL be able to record multiple receipt entries against the same authorization (for example, if goods arrive in multiple batches).
4. The system SHALL show a running total of quantity recorded vs. quantity authorized.
5. WHEN the total recorded quantity is greater than zero, the 'Start Stacking' button SHALL become available.
6. The system SHALL prevent recording a quantity that exceeds the authorized quantity minus any Lost Commodity already recorded.
7. All receipt records SHALL be visible on the Receipt Order detail page with their condition, grade, and remarks.

---

## Requirement 10: Lost Commodity Recording

**Status: Missing**

**What this means:**
Sometimes goods are lost between the warehouse and the destination — bags get stolen, damaged beyond use, or go missing. When the Storekeeper records a receipt and the quantity that arrived is less than what was dispatched, they need to formally record the shortfall as a Lost Commodity entry. This creates an official record of the loss with a reason.

**Real example:**
Abebe is receiving a shipment of 500 bags. Only 480 bags came off the truck. He records 480 bags received, then records a Lost Commodity entry: 20 bags, reason: Damage, remark: 'Bags were torn and contents spilled during transport.' The system now shows that 480 were received and 20 were lost, which adds up to the 500 that were dispatched.

**User Story:**
As a storekeeper, I want to record any commodity that was dispatched but did not arrive, so that losses are formally documented with a reason and the records stay accurate.

**Acceptance Criteria:**
1. WHEN recording a receipt, IF the quantity received is less than the authorized quantity, the Storekeeper SHALL be able to add a Lost Commodity entry.
2. The Lost Commodity entry SHALL capture: quantity lost, loss type (Theft / Damage / Infested / Wet / Other), and a remark explaining what happened.
3. The system SHALL assign a unique reference number to each Lost Commodity record automatically.
4. The system SHALL enforce that quantity received plus quantity lost does not exceed the authorized quantity. If it does, the system SHALL show an error.
5. Lost Commodity records SHALL be visible on the Receipt Order detail page.
6. The Warehouse Manager SHALL be able to view all Lost Commodity records for their warehouse from their dashboard.
7. No approval is required — the Storekeeper's record is final.

---

## Requirement 11: Start Stacking, Receipt Transactions, and Finish Stacking

**Status: Missing**

**What this means:**
After recording what arrived off the truck, the Storekeeper physically moves the bags into specific stacks inside the store. The system needs to track this process step by step. The Storekeeper clicks 'Start Stacking,' records each batch of bags placed into a specific stack, and when everything is placed, clicks 'Finish Stacking.' Only then does the system update the stock and generate the GRN document.

**Real example:**
Abebe recorded 480 bags received. Now he starts stacking. He places 200 bags into Stack A1 — he records this as a Receipt Transaction. Then 180 bags into Stack A2 — another transaction. Then 100 bags into Stack A3 — another transaction. Total: 480 bags placed. He clicks 'Finish Stacking.' The system adds 200 to Stack A1, 180 to Stack A2, 100 to Stack A3, and generates the GRN document.

**User Story:**
As a storekeeper, I want to record exactly which stacks I place goods into during the stacking process, so that the system knows precisely where every bag is located and the stock balances are accurate at the stack level.

**Acceptance Criteria:**
1. WHEN the Storekeeper clicks 'Start Stacking,' the receipt status SHALL change to 'Stacking In Progress.'
2. WHILE stacking is in progress, the Storekeeper SHALL be able to add Receipt Transactions, each specifying: the destination Stack and the quantity placed into it.
3. The system SHALL show a running total: how many bags have been placed so far vs. how many still need to be placed.
4. The system SHALL only allow selecting Stacks that belong to the Storekeeper's assigned Store.
5. WHEN the Storekeeper clicks 'Finish Stacking,' the system SHALL validate that the total placed equals the total received quantity.
6. WHEN 'Finish Stacking' is confirmed, the system SHALL update the quantity of each affected Stack immediately.
7. WHEN 'Finish Stacking' is confirmed, the system SHALL generate a GRN document and make it available for download.
8. The receipt status SHALL change to 'Stacking Completed.'
9. The system SHALL prevent adding more Receipt Transactions after 'Finish Stacking' is clicked.

---

## Requirement 12A: Admin Assigns Dispatcher to a Warehouse

**Status: Missing**

**What this means:**
Before a Dispatcher can log in and do their job, an admin needs to assign them to a specific warehouse. Right now "Dispatcher" does not exist as a role option anywhere in the system — not in the admin assignment page, not in the backend. An admin has no way to set up a Dispatcher at all.

**Real example:**
The admin opens the User Assignments page, selects the role "Dispatcher," picks the user Kebede, selects Addis Warehouse, and clicks Save. Kebede is now the Dispatcher for Addis Warehouse. When he logs in, the system knows his role and sends him to the Dispatcher dashboard. Right now "Dispatcher" does not even appear in the role dropdown.

**User Story:**
As an admin, I want to assign a user as a Dispatcher to a specific warehouse, so that they can log in and access the dispatch queue for that warehouse.

**Acceptance Criteria:**
1. "Dispatcher" SHALL appear as an option in the Role dropdown on the User Assignments admin page.
2. WHEN "Dispatcher" is selected, the admin SHALL be able to select one or more warehouses to assign the Dispatcher to.
3. The backend SHALL accept "Dispatcher" as a valid role name and store the assignment linked to a warehouse.
4. The assignment SHALL appear in the assignments table on the admin page showing: role, user name, and warehouse name.
5. The admin SHALL be able to remove a Dispatcher assignment by selecting the user and saving with no warehouses selected.
6. A user assigned as Dispatcher SHALL only be able to see and act on data from their assigned warehouse.

---

## Requirement 12B: Dispatcher Dashboard and Menus

**Status: Missing**

**What this means:**
Once a Dispatcher is assigned (Requirement 12A), they need their own dashboard and navigation menus when they log in. The Dispatcher's job is to organize the trucks — they take confirmed Dispatch Orders and create the actual truck-level dispatch records (which truck, which driver, which transporter, how many bags).

**Real example:**
Kebede logs in as Dispatcher at Addis Warehouse. He sees his dashboard: two confirmed Dispatch Orders waiting for truck assignment. He clicks the first one — 500 bags of wheat to Dire Dawa — and creates a Dispatch record: Truck AA-12345, Driver Haile, Transporter ABC Logistics, 500 bags, Good condition. The system saves it, assigns a reference number, and notifies the Storekeeper that goods are ready to be picked.

**User Story:**
As a dispatcher, I want a dedicated dashboard showing confirmed dispatch orders ready for truck assignment, so that I can create dispatch records for each truck without having to ask the warehouse manager which orders are ready.

**Acceptance Criteria:**
1. WHEN a Dispatcher logs in, the system SHALL redirect them to the Dispatcher dashboard (see Requirement 4).
2. The Dispatcher dashboard SHALL show all confirmed Dispatch Orders from their assigned warehouse that do not yet have a Dispatch record created.
3. The Dispatcher SHALL be able to click a Dispatch Order and create a Dispatch record specifying: transporter, truck plate number, driver name, driver phone number, quantity, commodity condition, and remarks.
4. The system SHALL assign a unique reference number to each Dispatch record automatically.
5. WHEN a Dispatch record is created, the system SHALL notify the Storekeeper assigned to the source store.
6. The Dispatcher navigation menu SHALL include: Dashboard, Dispatch Orders (confirmed, ready to assign), and My Dispatches (dispatches they have created).
7. The Dispatcher SHALL NOT see Officer pages, Warehouse Manager pages, or Storekeeper pages.

---

## Requirement 13: Dispatch Authorization

**Status: Missing**

**What this means:**
Before the Storekeeper starts picking bags from the stacks, the Warehouse Manager must formally authorize the release. This is the Dispatch Authorization — it says 'you are allowed to take X bags from Store A for this dispatch.' The Storekeeper then confirms they are ready, and only then does the picking begin. Right now this authorization step does not exist.

**Real example:**
Kebede (Dispatcher) has created a Dispatch record for 500 bags. The Warehouse Manager Tigist now creates a Dispatch Authorization: '500 bags from Store A, authorized for release.' Abebe (Storekeeper at Store A) gets a notification. He confirms: 'Yes, I have these bags ready.' Now he can start picking.

**User Story:**
As a warehouse manager, I want to formally authorize the release of goods from a specific store before the storekeeper starts picking, so that no goods leave the warehouse without my explicit approval.

**Acceptance Criteria:**
1. The Warehouse Manager SHALL be able to create a Dispatch Authorization for a Dispatch record, specifying: the source Store and the quantity authorized for release.
2. WHEN a Dispatch Authorization is created, the Storekeeper assigned to that Store SHALL receive a notification.
3. The Storekeeper SHALL be able to confirm the Dispatch Authorization from their dashboard, signaling that the goods are ready to be picked.
4. The Dispatch Authorization SHALL have a status of: Pending, Confirmed, Completed.
5. The system SHALL prevent the Storekeeper from recording Dispatch Transactions until the Dispatch Authorization is in Confirmed status.
6. The Warehouse Manager dashboard SHALL show all pending Dispatch Authorizations awaiting Storekeeper confirmation.

---

## Requirement 14: Dispatch Transactions — Stack-Level Picking

**Status: Missing**

**What this means:**
After the Storekeeper confirms the Dispatch Authorization, they physically go to the stacks and pick the bags. The system needs to track exactly which stacks the bags came from. This is a Dispatch Transaction — 'I picked 200 bags from Stack A1.' Multiple transactions can be recorded until the full authorized quantity is picked. Only then is the dispatch finalized and the GIN generated.

**Real example:**
Abebe has confirmed the Dispatch Authorization for 500 bags. He goes to Stack A1 and picks 300 bags — records a Dispatch Transaction: 300 bags from Stack A1. Then he goes to Stack A2 and picks 200 bags — records another transaction: 200 bags from Stack A2. Total: 500 bags picked. He clicks 'Finalize Dispatch.' The system reduces Stack A1 by 300 and Stack A2 by 200, and generates the GIN document.

**User Story:**
As a storekeeper, I want to record exactly which stacks I pick goods from during the dispatch process, so that the system knows which stacks were depleted and the stock balances are accurate after the truck leaves.

**Acceptance Criteria:**
1. AFTER confirming a Dispatch Authorization, the Storekeeper SHALL be able to record Dispatch Transactions, each specifying: the source Stack and the quantity picked from it.
2. The system SHALL show a running total: how many bags have been picked so far vs. how many still need to be picked.
3. The system SHALL prevent picking more than the available quantity in a Stack.
4. The system SHALL only allow selecting Stacks that belong to the Storekeeper's assigned Store.
5. WHEN the total picked equals the authorized quantity, the Storekeeper SHALL be able to click 'Finalize Dispatch.'
6. WHEN 'Finalize Dispatch' is clicked, the system SHALL reduce the quantity of each picked Stack immediately.
7. WHEN 'Finalize Dispatch' is clicked, the system SHALL generate a GIN document and make it available for download.
8. The Dispatch Authorization status SHALL change to 'Completed.'
9. The system SHALL prevent adding more Dispatch Transactions after 'Finalize Dispatch' is clicked.

---

## Requirement 15: Hub Authorization

**Status: Missing**

**What this means:**
Before a truck leaves the warehouse heading to a Hub, the Warehouse Manager sends an official advance notice to the Hub Manager. This is the Hub Authorization — it tells the Hub Manager exactly what is coming, how much, and when. The Hub Manager uses this to prepare their stores and assign their own Storekeepers. Without this, the Hub Manager has no warning until the truck physically arrives.

**Real example:**
Tigist (Warehouse Manager) is about to dispatch 500 bags of wheat to Dire Dawa Hub. Before the truck leaves, she creates a Hub Authorization: '500 bags of wheat, coming from Addis Warehouse, expected April 22, destination Store B at Dire Dawa Hub.' The Hub Manager at Dire Dawa gets a notification and a document they can download. They start preparing Store B to receive the goods.

**User Story:**
As a warehouse manager, I want to issue a Hub Authorization to the destination hub before dispatching goods, so that the hub manager is officially notified and can prepare to receive the commodity before the truck arrives.

**Acceptance Criteria:**
1. The Warehouse Manager SHALL be able to create a Hub Authorization for a Dispatch Order line that targets a Hub destination, specifying: the destination Hub, the destination Store at the Hub, the commodity, the quantity, and the authorization type.
2. The system SHALL assign a unique reference number to each Hub Authorization automatically.
3. WHEN a Hub Authorization is created, the Hub Manager of the destination Hub SHALL receive a notification.
4. The system SHALL generate a Hub Authorization document (.docx) available for download and printing.
5. The Hub Manager SHALL be able to view all Hub Authorizations addressed to their Hub from their dashboard.
6. The Hub Manager SHALL use the Hub Authorization as the basis for creating a Receipt Authorization on their side.
7. The Hub Authorization document SHALL include: authorization reference number, commodity name and batch number, authorized quantity, source warehouse, destination hub and store, and signature fields.

---

## Requirement 16: Hub Manager Dashboard

**Status: Missing**

**What this means:**
The Hub Manager receives goods from the warehouse and manages the hub's stock. Right now the Hub Manager has no dedicated dashboard. They cannot see incoming Hub Authorizations, cannot create Receipt Authorizations for their hub, and have no view of their hub's current stock.

**Real example:**
Sarah is the Hub Manager at Dire Dawa Hub. She logs in and needs to see: one Hub Authorization just received from Addis Warehouse (500 bags of wheat coming), one active receipt in progress at Store B, and the current stock levels at her hub. Right now she has no screen for any of this.

**User Story:**
As a hub manager, I want a dedicated dashboard showing incoming shipments and my hub's stock, so that I can prepare to receive goods and manage my hub's inventory without navigating through pages meant for other roles.

**Acceptance Criteria:**
1. The Hub Manager SHALL have a dedicated dashboard scoped to their assigned Hub.
2. The dashboard SHALL show: incoming Hub Authorizations not yet acted on, active Receipt Authorizations in progress, current stock levels at the Hub by commodity, and recent GRNs.
3. The Hub Manager SHALL be able to create a Receipt Authorization directly from an incoming Hub Authorization.
4. All data SHALL be scoped to the Hub Manager's assigned Hub only — they SHALL NOT see data from other Hubs or Warehouses.
5. The Hub Manager dashboard SHALL support the same driver arrival reference number lookup as the Storekeeper dashboard (Requirement 8), since Hub Managers also receive trucks.

---

## Requirement 17: Stack Transaction UI

**Status: Partial — backend exists, frontend missing**

**What this means:**
Sometimes a Storekeeper needs to move bags from one stack to another inside the same warehouse — for example, to consolidate two half-full stacks into one, or to move goods to a better location. The backend can handle this but there is no screen in the frontend where the Storekeeper can actually do it.

**Real example:**
Stack A1 has 100 bags and Stack A2 has 80 bags of the same wheat. Abebe wants to consolidate them into Stack A1. He creates a Stack Transaction: move 80 bags from Stack A2 to Stack A1. Stack A2 goes to 0, Stack A1 goes to 180. Right now he cannot do this from the UI.

**User Story:**
As a storekeeper, I want to move commodity from one stack to another within my store, so that I can reorganize the physical storage without losing track of the quantities in the system.

**Acceptance Criteria:**
1. The Storekeeper SHALL be able to create a Stack Transaction from their dashboard or from the Stack detail page.
2. The form SHALL capture: source Stack, destination Stack, commodity, quantity, unit of measure, and transaction date.
3. WHEN submitted, the system SHALL reduce the source Stack quantity and increase the destination Stack quantity by the specified amount.
4. The system SHALL prevent a Stack Transaction that would make the source Stack quantity go below zero.
5. The system SHALL prevent selecting the same Stack as both source and destination.
6. A full history of Stack Transactions SHALL be visible on the Stack detail page.

---

## Requirement 18: Inventory Adjustment UI and Approval

**Status: Partial — backend exists, frontend missing**

**What this means:**
Sometimes a physical count of a stack reveals a discrepancy — the system says 500 bags but there are actually 480. The Storekeeper needs to record this correction as an Inventory Adjustment. The Warehouse Manager then approves it before the system updates the stock. The backend model exists but there is no UI for either the Storekeeper to create one or the Warehouse Manager to approve it.

**Real example:**
Abebe does a physical count of Stack A1 and finds 480 bags, but the system shows 500. He creates an Inventory Adjustment: Stack A1, adjustment of -20 bags, reason: 'Physical count discrepancy found during monthly audit.' The Warehouse Manager Tigist sees this in her dashboard, reviews it, and approves it. The system updates Stack A1 to 480.

**User Story:**
As a storekeeper, I want to record inventory discrepancies when a physical count does not match the system, so that the stock records stay accurate and the Warehouse Manager is aware of any corrections being made.

**Acceptance Criteria:**
1. The Storekeeper SHALL be able to create an Inventory Adjustment from their dashboard or from the Stack detail page.
2. The form SHALL capture: the Stack, the quantity adjustment (positive to add, negative to remove), and the reason for the adjustment.
3. WHEN submitted, the Inventory Adjustment SHALL have a status of 'Pending Approval' and the Warehouse Manager SHALL receive a notification.
4. The Warehouse Manager SHALL see all pending Inventory Adjustments in their dashboard and be able to approve or reject each one.
5. WHEN approved, the system SHALL update the affected Stack quantity immediately.
6. WHEN rejected, the Stack quantity SHALL remain unchanged and the Storekeeper SHALL receive a notification with the rejection reason.
7. The system SHALL prevent an Inventory Adjustment that would make the Stack quantity go below zero.

---

## Requirement 19: GIN Document Generation (.docx)

**Status: Missing**

**What this means:**
The GIN (Goods Issue Note) is the official document that travels with the truck when goods leave the warehouse. It is printed and signed before the truck departs. Right now the system has GIN records but cannot generate a downloadable document. Field staff cannot print anything.

**Real example:**
Abebe finalizes a dispatch of 500 bags of wheat. The system should immediately make a GIN document available to download. The document shows: reference number DO-2026-0042, wheat, 500 bags, Truck AA-12345, Driver Haile, Transporter ABC Logistics, from Addis Warehouse Store A, to Dire Dawa Hub, with blank signature lines for the Warehouse Manager and Storekeeper. Abebe prints it, signs it, and it goes with the truck.

**User Story:**
As a storekeeper or warehouse manager, I want to download and print a GIN document when a dispatch is finalized, so that the official release document can accompany the truck as required by the business process.

**Acceptance Criteria:**
1. WHEN a dispatch is finalized (Requirement 14), the system SHALL make a GIN document available for download in .docx format.
2. The GIN document SHALL include: dispatch reference number, commodity name and batch number, quantity, unit of measure, truck plate number, driver name, driver phone number, transporter name, source warehouse and store, destination, and signature fields for the Warehouse Manager and Storekeeper.
3. The document layout SHALL match the template from the original system.
4. A download button SHALL be visible on the GIN detail page and the Dispatch Authorization detail page.
5. The system SHALL be structured to support additional language templates (e.g., Amharic) in a future version.

---

## Requirement 20: GRN Document Generation (.docx)

**Status: Missing**

**What this means:**
The GRN (Goods Received Note) is the official proof of delivery. It is generated after stacking is complete and signed by the Storekeeper and Warehouse Manager. Right now the system has GRN records but cannot generate a downloadable document.

**Real example:**
Abebe finishes stacking 480 bags of wheat. The system generates a GRN document: reference GRN-2026-0018, wheat, 480 bags received, Good condition, Grade A, at Addis Warehouse Store A, linked to dispatch DO-2026-0042, with signature lines. The Warehouse Manager signs it as proof that the goods were received and stored.

**User Story:**
As a storekeeper or warehouse manager, I want to download and print a GRN document when stacking is completed, so that there is an official signed record of what was received and where it was stored.

**Acceptance Criteria:**
1. WHEN stacking is completed (Requirement 11), the system SHALL make a GRN document available for download in .docx format.
2. The GRN document SHALL include: receipt reference number, dispatch reference number, commodity name and batch number, quantity received, commodity condition, commodity grade, destination warehouse and store, and signature fields.
3. The document layout SHALL match the template from the original system.
4. A download button SHALL be visible on the GRN detail page.
5. The system SHALL be structured to support additional language templates (e.g., Amharic) in a future version.

---

## Requirement 21: In-App Notification Center

**Status: Partial — backend infrastructure exists, frontend missing**

**What this means:**
Every time one person finishes their part of the process, the next person needs to know it is their turn. The backend already sends notifications via webhook, but the frontend has no notification center. Users have no way to see their pending tasks without manually checking every page.

**Real example:**
Tigist (Warehouse Manager) confirms a Receipt Order and assigns Abebe as Storekeeper. Abebe should see a notification bell in the top right corner of the screen with a red badge showing '1 new notification.' He clicks it and sees: 'New receipt assignment: 500 bags of wheat arriving at Store A.' He clicks the notification and goes directly to the receipt. Right now nothing appears.

**User Story:**
As any operational user, I want to see in-app notifications when something requires my attention, so that I know immediately when it is my turn to act without having to check every page manually.

**Acceptance Criteria:**
1. The system SHALL display a notification bell icon in the application header at all times for all logged-in users.
2. The bell SHALL show a red badge with the count of unread notifications.
3. WHEN clicked, the bell SHALL open a panel listing notifications showing: what happened, which document it relates to, and when it happened.
4. WHEN a user clicks a notification, the system SHALL navigate them directly to the relevant document.
5. The system SHALL mark a notification as read when the user views it.
6. The following events SHALL trigger notifications to the relevant role: Receipt Order confirmed (notify assigned Storekeepers), Dispatch Authorization created (notify Storekeeper), Hub Authorization created (notify Hub Manager), Dispatch Order confirmed (notify Dispatcher), Inventory Adjustment submitted (notify Warehouse Manager), Inventory Adjustment approved or rejected (notify Storekeeper).

---

## Requirement 22: Dispatch History Report

**Status: Missing**

**What this means:**
Managers need to look back at what was dispatched — when, how much, to where, and in what status. Right now there is no dedicated dispatch history report with filtering.

**User Story:**
As a warehouse manager, I want to view a filterable history of all dispatches from my warehouse, so that I can monitor outbound operations and provide accountability to program managers and donors.

**Acceptance Criteria:**
1. The system SHALL provide a dispatch history report accessible from the Warehouse Manager dashboard.
2. The report SHALL be filterable by: date range, commodity, destination, and dispatch status.
3. Each row SHALL show: reference number, commodity, quantity, destination, driver name, plate number, dispatch date, and status.
4. The report SHALL be exportable or printable.

---

## Requirement 23: Receipt History Report

**Status: Missing**

**What this means:**
Managers need to look back at what was received — when, how much, from where, and in what condition. Right now there is no dedicated receipt history report with filtering.

**User Story:**
As a warehouse manager, I want to view a filterable history of all receipts at my warehouse, so that I can monitor inbound operations and verify that all expected shipments were received correctly.

**Acceptance Criteria:**
1. The system SHALL provide a receipt history report accessible from the Warehouse Manager dashboard.
2. The report SHALL be filterable by: date range, commodity, source, and receipt status.
3. Each row SHALL show: reference number, commodity, quantity received, source, condition, grade, receipt date, and status.
4. The report SHALL be exportable or printable.

---

## Requirement 24: Lost Commodity Report

**Status: Missing**

**What this means:**
Donors and program managers need to see a record of all losses — what was lost, when, why, and on which dispatch. This is a critical accountability document.

**User Story:**
As a warehouse manager, I want to view a report of all lost commodity records, so that I can provide accurate loss documentation to donors and program managers.

**Acceptance Criteria:**
1. The system SHALL provide a Lost Commodity report accessible from the Warehouse Manager dashboard.
2. The report SHALL be filterable by: date range, commodity, loss type, and warehouse.
3. Each row SHALL show: reference number, dispatch reference, commodity, quantity lost, loss type, remark, date recorded, and the Storekeeper who recorded it.
4. The report SHALL be exportable or printable.

---

## Requirement 25: Space Availability Report

**Status: Missing**

**What this means:**
Before a new shipment arrives, the Warehouse Manager needs to know how much space is available in each store. Right now there is no report showing used vs. available capacity per store.

**User Story:**
As a warehouse manager, I want to see how much space is available in each store, so that I can plan where to put incoming goods before they arrive.

**Acceptance Criteria:**
1. The system SHALL provide a space availability report accessible from the Warehouse Manager dashboard.
2. The report SHALL show for each Store: store name, total capacity (from dimensions), used capacity (from current stacks), available capacity, and a list of current stacks with their quantities.
3. The report SHALL update in real time as stacking transactions are recorded.

---

---

## Build Priority Order

Based on the product owner's input, the full inbound flow must work first. Below is the recommended order for Jira tickets.

**Phase 1 — Core Inbound Flow (Highest Priority)**
- Requirement 4: Role-Based Login and Dashboard Routing
- Requirement 5: Warehouse Manager Dashboard
- Requirement 6: Storekeeper Dashboard
- Requirement 7: Multi-Store Storekeeper Assignment on Receipt Order
- Requirement 8: Driver Arrival — Reference Number Lookup
- Requirement 9: Staged Receipt Recording — Condition and Grade
- Requirement 10: Lost Commodity Recording
- Requirement 11: Start Stacking, Receipt Transactions, and Finish Stacking

**Phase 2 — Outbound Flow**
- Requirement 12A: Admin Assigns Dispatcher to a Warehouse
- Requirement 12B: Dispatcher Dashboard and Menus
- Requirement 13: Dispatch Authorization
- Requirement 14: Dispatch Transactions — Stack-Level Picking
- Requirement 15: Hub Authorization
- Requirement 16: Hub Manager Dashboard

**Phase 3 — Documents and Notifications**
- Requirement 19: GIN Document Generation (.docx)
- Requirement 20: GRN Document Generation (.docx)
- Requirement 15 (doc part): Hub Authorization Document (.docx)
- Requirement 21: In-App Notification Center

**Phase 4 — Internal Operations**
- Requirement 17: Stack Transaction UI
- Requirement 18: Inventory Adjustment UI and Approval

**Phase 5 — Reports and Supporting Data**
- Requirement 22: Dispatch History Report
- Requirement 23: Receipt History Report
- Requirement 24: Lost Commodity Report
- Requirement 25: Space Availability Report
- Requirement 1: Routes Registry
- Requirement 2: Store Keeper Contact on Store
- Requirement 3: Donor, Program, and Project Registration

