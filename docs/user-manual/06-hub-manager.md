# 06 — Hub Manager

## Role purpose

The **Hub Manager** oversees one **hub** and its warehouses. After an officer sends a receipt order to the hub, the hub manager:

- Assigns the order to a **warehouse** under the hub
- Creates **Receipt Authorizations** (RA) for trucks delivering goods
- Monitors hub dashboard metrics, receipts, and warehouse capacity
- Creates and confirms **waybills** where transport documentation is required

Hub managers **read** stores and stacks but do not normally manage day-to-day GRN stacking — that is the warehouse manager and storekeeper.

## Workspace

On login, select your **hub**. The sidebar badge shows the hub name (blue badge).

Default home: **Hub Dashboard** (`/hub/dashboard`).

## Sidebar — Hub Management

| Menu | Path | Purpose |
|------|------|---------|
| **Dashboard** | `/hub/dashboard` | Hub KPIs, pending orders, capacity snapshot |
| **Hubs** | `/hubs` | View hub list and your hub’s detail |
| **Warehouses** | `/warehouses` | Warehouses under your hub; create/edit warehouses |
| **Stores** | `/stores` | Read-only view of stores in hub warehouses |
| **Receipts** | `/receipts` | Inbound receipt document list (read) |
| **Receipt Authorizations** | `/hub/receipt-authorizations` | Create and manage RAs |

## Permissions summary

| Resource | Allowed actions |
|----------|-----------------|
| hubs | read |
| warehouses | read, create, update |
| stores, stacks | read |
| grns, gins, inspections | read |
| waybills | read, **create**, **confirm** |
| receipt_orders | read, **update** (assign warehouse) |
| receipt_authorizations | read, **create**, **update** |
| dispatch_orders | read |
| stock_balances, receipts, dispatches, reports | read |

## Hub Dashboard

Typical content:

- Counts of receipt orders awaiting warehouse assignment
- Warehouse capacity summary under the hub
- Links to urgent receipt orders or authorizations

Use the dashboard as your **start-of-day** view.

## Assign warehouse to receipt order

When an officer creates a hub-scoped receipt order and assigns you:

1. Open **Receipt Orders** (via notification link or officer-shared reference — hub managers often reach orders through assignments on order detail if linked from receipts workflow).
2. On the order **Assignments** tab, click **+ Assign Warehouse**.
3. Select a warehouse **under your hub** (system enforces hub membership).
4. Add optional notes.
5. Click **Create Assignment**.

The **Warehouse Manager** for that warehouse receives a notification and can assign a **store**.

### What you see vs ignore

- You see assignments where **store is not yet assigned** (hub/warehouse level).
- You do **not** see storekeeper-only assignments.

## Receipt Authorizations (RA)

Path: **Receipt Authorizations** (`/hub/receipt-authorizations`).

### List

- Filter by status, receipt order, warehouse
- Open existing RA or create new

### Create (`/hub/receipt-authorizations/new`)

Typical steps:

1. Select **receipt order** (or assignment) the truck fulfills.
2. Select target **warehouse** (must belong to your hub).
3. Enter truck/load details: vehicle plate, driver, expected quantity, commodity lines aligned with order.
4. Optionally link to **assignment** row on the order.
5. **Save** as draft or submit per form labels.

### Edit (`/hub/receipt-authorizations/:id/edit`)

- Update draft RA before warehouse/store processing
- Cannot violate business rules (quantities exceeding authorized order lines, etc.)

### Detail (`/hub/receipt-authorizations/:id`)

- View status and line quantities
- Track whether warehouse/storekeeper has received against this RA

**Business meaning:** An RA is permission for a specific delivery event. One receipt order may have **multiple RAs** (multiple trucks). One RA may span planned allocation across stores when configured.

## Warehouses

Hub managers may **create** warehouses under the hub:

1. **Warehouses** → **+ New Warehouse**
2. Set name, location, capacity fields, management/ownership metadata
3. Save

Edit existing warehouses to update capacity or status. Ensure **warehouse managers** are assigned via Admin → User Assignments.

## Waybills

From waybill menu (when navigated via URL `/waybills` or linked flows):

- **Create** waybill for goods movement
- **Confirm** when transport details are final

Policy matches hub manager create/confirm on waybills.

## Receipts list

**Receipts** (`/receipts`) — read-only consolidated inbound receipt view for monitoring; detailed GRN work happens at warehouse.

## Notifications

You receive notifications when:

- An officer assigns you a receipt order
- Warehouse manager completes a step needing hub visibility
- RA or waybill events concern your hub

Click notification → jump to order or RA detail.

## Daily workflow checklist

1. Check **Dashboard** for unassigned hub receipt orders.
2. **Assign warehouses** with available capacity (check **Facilities** or warehouse detail capacity).
3. Create **Receipt Authorizations** when trucks are scheduled.
4. Monitor **Receipt Authorizations** until storekeeper/warehouse confirms receipt (GRN).
5. Confirm **waybills** when transport documentation is complete.

## Common issues

| Issue | Resolution |
|-------|------------|
| Cannot assign warehouse | Warehouse must belong to your hub; order destination must be hub-scoped |
| RA creation blocked | Receipt order not confirmed or assignment missing |
| Empty store list | Expected — hub manager has read-only store access |
| No menu item | Verify active hub assignment on account |

Next: [Warehouse Manager](07-warehouse-manager.md)
