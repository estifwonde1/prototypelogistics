# 11 — Shared Modules Reference

This chapter describes screens **shared across roles**. Menus differ, but page behavior is consistent. Actions shown depend on your permissions.

---

## Hubs (`/hubs`, `/hubs/:id`)

**Who:** Admin, Hub Manager (read), Officers (facilities overview).

| Action | Typical roles |
|--------|---------------|
| List hubs | Admin, Hub Manager, Officer |
| View detail | All with read |
| Create/edit | Admin, Hub Manager (warehouses under hub) |

**Detail page:** name, location, status, capacity, linked warehouses, contacts/infra tabs where present.

---

## Warehouses (`/warehouses`, `/warehouses/:id`)

**Who:** Admin, Hub Manager, Warehouse Manager, officers (read via facilities).

| Action | Roles |
|--------|-------|
| Create warehouse | Admin, Hub Manager |
| Update capacity/settings | Admin, Hub Manager, WH Manager (own) |
| View stores | All with read |

Watch **capacity** fields — officer **Facilities Overview** uses them for full/almost-full badges.

---

## Stores (`/stores`, `/stores/:id`)

**Who:** WH Manager (create/update), Hub Manager/Storekeeper (read).

**Fields:** name, warehouse link, dimensions, usable/available space, temporary flag.

**Store detail:** stacks summary, stock balances link, assignment hints.

---

## Stacks (`/stacks`, `/stacks/layout`)

**List** (`/stacks`): table of stacks with store, commodity, dimensions.

**Layout board** (`/stacks/layout`):

| Mode | Trigger | UI |
|------|---------|-----|
| Normal | Manual navigation | Select store, edit stacks |
| Preparation | Storekeeper **Accept & Prepare Stack** | `auto_prepare=true`, alerts/badges |

**Actions:** click grid → create stack; drag/resize per UI; save dimensions.

---

## Receipt Orders (officer paths)

Paths: `/officer/receipt-orders`, `/receipt-orders/:id` (aliases).

**Tabs:** Details, Assignments, Space Reservations, Workflow Timeline, Receipt Authorizations (embedded).

**Buttons:** Edit, Confirm, + Assign Manager/Warehouse/Store (role-dependent).

---

## Dispatch Orders *(not in current release)*

Outbound **dispatch orders** are **not implemented** for end users in this version. Paths such as `/officer/dispatch-orders` may exist in code but are **out of scope** for training and operations until a future release.

---

## GRN — Goods Receipt Notes (`/grns`)

| Step | Action | Roles |
|------|--------|-------|
| List | Filter draft/confirmed | WH Manager, Storekeeper |
| New | Link RO, lines, store/stack | WH Manager, Storekeeper |
| Edit | Draft only | Creator roles |
| Confirm | Stock + | WH Manager |

**Detail (`/grns/:id`):** header reference, lines, status badge, Confirm button when permitted.

---

## GIN — Goods Issue Notes (`/gins`) *(not in current release)*

**GIN** and the outbound issue workflow are **not completed** in this version. Do not document or train on GIN until dispatch is shipped.

---

## Receipt Authorizations

| Path prefix | Role |
|-------------|------|
| `/hub/receipt-authorizations` | Hub Manager |
| `/warehouse/receipt-authorizations` | WH Manager (if enabled) |
| `/storekeeper/receipt-authorizations` | Storekeeper receive |

**Forms:** truck identity, lines vs order assignment, planned store allocation checkbox (hub/wh forms).

**Statuses:** track pending/active/completed per truck load.

---

## Waybills (`/waybills`)

Transport document: create draft, add route/vehicle/commodity lines, confirm.

**Hub Manager** and **WH Manager**: create + confirm per permissions.

---

## Transfer Requests (`/transfer-requests`)

| Role | Action |
|------|--------|
| Storekeeper | Create request |
| WH Manager | Read, update (approve/reject/complete) |

---

## Stock Balances (`/stock-balances`)

Read-only table: commodity, warehouse/store/stack, quantity, unit.

Filter by facility scope of active workspace.

---

## Bin Card Report (`/reports/bin-card`)

Ledger of receipts/issues for filtered commodity and location.

Use for reconciliation and audits.

---

## Receipts aggregate list

| List | Path | Content |
|------|------|---------|
| Receipts | `/receipts` | Inbound receipt documents summary |

Mostly read-only monitoring for hub manager and officers. An outbound **Dispatches** list is **not part of the completed system** in this release.

---

## Profile (`/profile`)

All roles: view/update profile fields allowed by API.

---

## Common button glossary

| Button | Effect |
|--------|--------|
| **Save / Save as Draft** | Persist without confirm side-effects |
| **Confirm** | Finalize document; may update stock |
| **Create Assignment** | Add row on order Assignments tab |
| **Accept & Prepare Stack** | Storekeeper → stack layout |
| **+ New** (list pages) | Open create form |
| **Edit** | Change draft records |
| **Delete** | Remove draft where permitted |

---

## Error messages users see

| Message type | Meaning |
|--------------|---------|
| 403 / Not authorized | Role lacks permission — switch role or ask admin |
| Validation errors on form | Required fields, quantity exceeds order, capacity exceeded |
| Capacity guard | Warehouse/store/stack cannot accept volume |

Next: [End-to-end workflows](12-end-to-end-workflows.md)
