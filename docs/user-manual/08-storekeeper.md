# 08 — Storekeeper

## Role purpose

The **Storekeeper** works at **store** level inside a warehouse. You:

- Accept **assignments** from warehouse managers to prepare space for incoming goods
- Use **Stack Layout** to create and dimension stacks
- **Receive** trucks against **Receipt Authorizations**
- Create draft **GRNs** at store level (warehouse manager confirms)
- Submit **transfer requests** to move stock
- View **bin card** and **stock balances** for your store

## Workspace

Select your **store** at login (picker shows stores you are assigned to). Sidebar badge shows **store name**.

Default home: **Storekeeper Dashboard** (`/storekeeper/dashboard`).

## Sidebar

### Store Management

| Menu | Path | Purpose |
|------|------|---------|
| **Dashboard** | `/storekeeper/dashboard` | Store-centric stats and shortcuts |
| **Stores** | `/stores` | Your store detail (read) |
| **Stacks** | `/stacks` | Stacks in your store |
| **Transfer Requests** | `/transfer-requests` | Create/view transfer requests |

### Assignments

| Menu | Path | Purpose |
|------|------|---------|
| **My Assignments** | `/storekeeper/assignments` | Pending receipt work from warehouse manager |
| **Receive Receipt** | `/storekeeper/receipt-authorizations` | Process incoming RA deliveries |

### Documents

| Menu | Path | Purpose |
|------|------|---------|
| **GRN** | `/grns` | Create/view GRNs (confirm typically warehouse manager) |

### Reports

| Menu | Path | Purpose |
|------|------|---------|
| **Bin Card** | `/reports/bin-card` | Store commodity movements |
| **Stock Balances** | `/stock-balances` | Current quantities |

## Permissions summary

| Resource | Actions |
|----------|---------|
| warehouses, stores | read |
| stacks | read, create, update |
| grns | read, create *(no confirm)* |
| inspections | read, create |
| transfer_requests | read, **create** |
| receipt_orders | read |
| stock_balances, receipts, reports | read |

## Storekeeper Dashboard

Shows assignment counts, stack utilization, and quick links to **My Assignments** and **Receive Receipt**.

## My Assignments (`/storekeeper/assignments`)

Lists **receipt order assignments** for your active store.

### Assignment card fields

- Receipt order reference
- Commodity, quantity, unit
- Assigned by (warehouse manager name)
- Status badge: *pending*, *assigned*, *accepted*, *in_progress*, *completed*

### Accept & Prepare Stack

For pending assignments:

1. Review quantity and commodity.
2. Click **Accept & Prepare Stack**.
3. System **redirects** to Stack Layout:  
   `/stacks/layout?store_id=[your store]&auto_prepare=true`

### Stack Layout — preparation mode

When `auto_prepare=true`:

- Blue alert: **Prepare Stacking Space**
- Green badge: **Space Preparation Mode**
- Store is **pre-selected**
- Click empty area on board → create stack dialog
- Enter **length, width, height** (e.g. 6m × 6m × 2.5m)
- **Save** stack

Repeat until enough space exists for expected volume.

Return to **My Assignments** when preparation is complete; status progresses as warehouse processes GRN.

## Receive Receipt (`/storekeeper/receipt-authorizations`)

Lists RAs authorized for delivery to your store/warehouse.

1. Open RA from list → detail `/storekeeper/receipt-authorizations/:id`
2. Verify truck, quantities, commodity against physical delivery
3. Complete receive workflow on detail page (quantities, condition notes)
4. May trigger or link to **GRN** creation

**Driver confirmation** (per product rules): lookup by reference number — no SMS/signature in current version.

## GRN (storekeeper)

1. **GRN** → **New** or create from receipt/RA context
2. Enter received quantities, stacks, batch info
3. Save **Draft**
4. Warehouse manager **confirms** GRN (stock updates on confirm)

Storekeeper **cannot confirm** GRN in the default permission matrix.

## Transfer requests

When stock must move to another stack or store:

1. **Transfer Requests** → **New**
2. Select source stack, destination, commodity, quantity
3. Submit

Warehouse manager **updates/approves** on their menu.

## Stacks (outside preparation mode)

Navigate **Stacks** or **Stack Layout** manually:

- View existing stacks
- Update dimensions while stacks are editable
- See commodity assigned to each stack

## Reports

- **Bin Card** — filter to your store commodities
- **Stock Balances** — see on-hand qty for planning transfers

## What storekeepers do not do

- Assign warehouses or stores on receipt orders
- Confirm GRNs (unless policy extended)
- Create receipt orders (officers create orders; storekeepers do not)
- Manage users or hub-level RAs (hub manager path)

## Notifications

- New assignment from warehouse manager
- RA ready for receive
- Transfer request approved/rejected

## Daily workflow checklist

1. **Dashboard** / **My Assignments** — new pending rows.
2. **Accept** → **Stack Layout** → create stacks.
3. **Receive Receipt** when truck arrives.
4. Create **GRN draft**; notify warehouse manager to confirm.
5. Raise **transfer requests** if stacks are unbalanced.

## Common issues

| Issue | Resolution |
|-------|------------|
| Empty assignments | Wrong store selected in header workspace switch |
| Stack Layout wrong store | Re-switch store workspace; check `store_id` in URL |
| Cannot confirm GRN | Expected — ask warehouse manager |
| Assignment not listed | Filter status; assignment may target different store |

Next: [End-to-end workflows](12-end-to-end-workflows.md)
