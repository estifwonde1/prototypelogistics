# 07 — Warehouse Manager

## Role purpose

The **Warehouse Manager** runs operational activity at one **warehouse**: stores, stacks, inbound GRNs, outbound GINs, inspections, waybills, transfer requests, and receipt authorizations (when enabled for your warehouse). You execute officer plans and hub manager warehouse assignments.

## Workspace

Select **warehouse** at login. Sidebar badge shows warehouse name.

Default home: **Warehouse Dashboard** (`/warehouse/dashboard`).

## Sidebar

### Warehouse Management

| Menu | Path | Purpose |
|------|------|---------|
| **Dashboard** | `/warehouse/dashboard` | Single-load summary: orders, GRNs, capacity, assignments |
| **Warehouses** | `/warehouses` | Your warehouse detail; update settings |
| **Stores** | `/stores` | Create/edit stores in your warehouse |
| **Stacks** | `/stacks` | List stacks; link to layout |
| **Transfer Requests** | `/transfer-requests` | Approve/process inter-store transfers |
| **Receipts** | `/receipts` | Receipt orders assigned to your warehouse |
| **Receipt Authorizations** | `/warehouse/receipt-authorizations` | *(Shown only if RA workspace access enabled for your warehouse)* |

### Warehouse Operations

| Menu | Path | Purpose |
|------|------|---------|
| **GRN** | `/grns` | Goods receipt notes |
| **Stock Balances** | `/stock-balances` | Current stock by commodity/location |
| **Bin Card** | `/reports/bin-card` | Movement ledger report |

## Permissions summary

| Resource | Actions |
|----------|---------|
| warehouses | read, update |
| stores, stacks | read, create, update |
| grns, gins | read, create, **confirm** |
| inspections | read, create, **confirm** |
| waybills | read, create, **confirm** |
| receipt_orders | read |
| receipt_authorizations | read, create, update *(if enabled)* |
| transfer_requests | read, **update** |
| dispatch_orders | read |
| stock_balances, receipts, dispatches, reports | read |

## Warehouse Dashboard

The dashboard loads in **one API call** (progressive sections — no full-page blocking spinner).

Typical sections:

- Receipt order counts by status for **this warehouse**
- Pending assignments needing store assignment
- GRN/GIN activity summaries
- Store/stack capacity highlights
- Quick links to create GRN or open receipts

Use it as your operational control panel.

## Assign store to receipt order

When hub manager or officer assigned the order to your warehouse:

1. Open **Receipts** or notification link → receipt order detail.
2. **Assignments** tab → **+ Assign Store**.
3. Select **store** in your warehouse (capacity-aware).
4. Storekeeper may be auto-linked to the store’s assigned user.
5. **Create Assignment**.

Storekeeper receives notification and uses **My Assignments** to accept and open **Stack Layout**.

## Stores & stacks

### Stores

- **Create store**: dimensions (length, width, height), usable space, temporary flag
- **Edit** to adjust capacity or name
- View assigned storekeeper (via assignments/admin data)

### Stacks

- **Stacks** list — commodity, dimensions, store
- **Stack Layout** (`/stacks/layout?store_id=X`) — visual board to place stacks
- Warehouse managers can create/edit stacks; storekeepers also create stacks in preparation mode

## GRN — Goods Receipt Note

### When to create

Physical goods arrived; RA (if used) is cleared; quantities and quality are known.

### Create (`/grns/new`)

1. Link **receipt order** (shows reference e.g. RO-xxx).
2. Add lines: commodity, quantity, unit, batch/expiry if captured.
3. Select **store** and **stack** locations.
4. Save as **Draft**.

### Confirm

1. Open GRN detail (`/grns/:id`).
2. Review totals match physical count and RA.
3. Click **Confirm**.

**Effect:** Stock balances **increase**; workflow timeline on receipt order updates.

## GIN — Goods Issue Note

For **dispatch orders**:

1. **GIN** → **New** (`/gins/new`)
2. Link dispatch order
3. Select lots/stacks to issue from
4. Draft → **Confirm**

**Effect:** Stock **decreases**.

## Inspections

Warehouse managers may record inspections from receipt context where the inspections menu is available. Day-to-day receipt is driven by **GRN** confirm.

## Receipt Authorizations (warehouse path)

If **Receipt Authorizations** appears in your menu, your warehouse uses the RA workspace feature.

Paths mirror hub manager:

- List: `/warehouse/receipt-authorizations`
- New: `/warehouse/receipt-authorizations/new`
- Edit/detail: `/warehouse/receipt-authorizations/:id`

Use when trucks arrive **directly to warehouse-scoped** orders or when hub delegates RA creation.

## Transfer requests

**Storekeepers** create transfer requests to move stock between stacks/stores.

Warehouse manager:

1. Open **Transfer Requests**
2. Review request lines and quantities
3. **Approve**, **reject**, or **update** status per form actions

## Waybills

Create and confirm waybills for outbound or inter-facility transport (`/waybills`).

## Reports

- **Stock Balances** — point-in-time quantities
- **Bin Card** — filter by commodity/store; export/print per UI

## Receipt order visibility

**Receipts** lists orders where your warehouse is destination or assignment target. Read-only header/lines; assignments you can action on **Assignments** tab.

## Notifications

- Officer or hub manager assigned an order to you
- Storekeeper accepted assignment
- Transfer request submitted
- GRN/GIN confirmation needed (policy-dependent)

## Daily workflow checklist

1. **Dashboard** — unassigned store lines on receipt orders.
2. **Assign stores** and notify storekeepers.
3. When trucks arrive: verify **RA**, oversee **GRN** confirmation.
4. For outbound: process **GIN** against dispatch orders.
5. Review **transfer requests** and **stock balances** for discrepancies.

## Common issues

| Issue | Resolution |
|-------|------------|
| Receipt Authorizations menu missing | RA workspace not enabled for your warehouse |
| Cannot confirm GRN | Draft lines incomplete; stacks not selected; permission |
| Stock balance mismatch | Check unconfirmed drafts; bin card movements |
| Slow dashboard after role switch | Wait for section skeletons; data prefetch runs on switch |

Next: [Storekeeper](08-storekeeper.md)
