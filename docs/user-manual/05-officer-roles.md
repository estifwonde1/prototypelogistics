# 05 — Officer Roles

## Role purpose

**Officers** coordinate logistics **without** performing warehouse floor work. They:

- Create and confirm **Receipt Orders** (inbound)
- Assign **Hub Managers** or **Warehouse Managers** to execute receipt orders
- Monitor **facilities** capacity and status across their scope
- Track **workflow timelines** from receipt order creation through **GRN** completion
- Manage **commodity** definitions (Federal Officer; sub-federal officers per policy)

**Dispatch orders (outbound)** are **not implemented** in the current release. Officer menus or technical docs that reference dispatch should be ignored for day-to-day training until a future version ships outbound.

Officers **cannot** create GRNs, edit stacks, or accept storekeeper assignments.

## Officer role variants

There are **five** officer roles. They share **receipt order** permissions but differ in **geographic scope** and **dashboard data**.

| Role | Scope | Menu |
|------|-------|------|
| **Federal Officer** | System-wide | Dashboard, Facilities, Receipt Orders, Commodities |
| **Regional Officer** | Assigned region | Dashboard, Facilities, Receipt Orders, Commodities |
| **Zonal Officer** | Assigned zone | Same as regional |
| **Woreda Officer** | Assigned woreda | Same as regional |
| **Kebele Officer** | Assigned kebele | Same as regional |

**Federal Officer** sees national warehouse breakdown on the dashboard and has no geographic scope alert.

**Regional through Kebele** officers see data **filtered to their assigned location**. A blue alert shows: *“Your data is scoped to: [location name]”*.

## Sidebar — Federal Officer

| Item | Path | Actions |
|------|------|---------|
| **Dashboard** | `/officer/dashboard` | Summary stats, quick create buttons |
| **Facilities** | `/officer/facilities` | Hubs/warehouses overview, capacity indicators |
| **Receipt Orders** | `/officer/receipt-orders` | List, create, edit, confirm, assign |
| **Commodities** | `/officer/commodities` | View/create commodities |

## Sidebar — Regional / Zonal / Woreda / Kebele

**Overview:** Dashboard, Facilities  
**Orders:** Receipt Orders, Commodities

## Dashboard (`/officer/dashboard`)

- Receipt order counts by status (Draft, Confirmed, In Progress, Completed)
- Hub/warehouse totals (Federal and Regional officers may see warehouse breakdown)

### Quick actions

| Button | Navigates to |
|--------|--------------|
| **Create Receipt Order** | `/officer/receipt-orders/new` |
| **View Receipt Orders** | `/officer/receipt-orders` |
| **Facilities Overview** | `/officer/facilities` |

## Receipt Orders

### Create (`/officer/receipt-orders/new`)

| Field | Description |
|-------|-------------|
| Source type / name | Supplier, donor, transfer, etc. |
| Destination type | **Hub** or **Warehouse** |
| Destination | Select hub or warehouse |
| Expected delivery date | Date picker |
| Line items | Commodity, quantity, unit |

**Save as Draft** or confirm when ready.

### Detail page tabs

| Tab | Actions |
|-----|---------|
| **Details** | Edit (draft); **Confirm Order** |
| **Assignments** | **+ Assign Manager** → Hub Manager or Warehouse Manager |
| **Space Reservations** | (Where enabled) reserve store capacity |
| **Workflow Timeline** | Audit trail |
| **Receipt Authorizations** | View RAs from hub/warehouse managers |

## Facilities Overview

Capacity usage across hubs/warehouses; **full** / **almost full** indicators. Check before creating orders.

## Assignments — rules

| Destination on RO | Officer assigns |
|-------------------|-----------------|
| Hub | **Hub Manager** |
| Warehouse | **Warehouse Manager** |

| Role | Sees assignments | Can assign |
|------|------------------|------------|
| Officer (any level) | All in scope | Hub Mgr / WH Mgr |
| Hub Manager | Hub & warehouse level | Warehouse |
| Warehouse Manager | Warehouse & store level | Store |
| Storekeeper | Own store | Accept only |

## Downstream flow

1. Hub Manager assigns warehouse (hub-scoped RO).
2. Warehouse Manager assigns store.
3. Storekeeper accepts → stack layout.
4. Managers create **RA** and **GRN**.
5. Officer monitors **Workflow Timeline**.

Next: [Hub Manager](06-hub-manager.md) · [End-to-end workflows](12-end-to-end-workflows.md)
