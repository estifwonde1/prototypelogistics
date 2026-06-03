# 01 — Introduction & System Overview

## What this system is

**Prototypelogistics** is a warehouse and logistics management application. It helps organizations:

- Plan and execute **incoming** shipments (**receipt orders** through assignment, receipt authorization, and **GRN**)
- Assign work from officers down to hub managers, warehouse managers, and storekeepers
- Record inbound stock with formal documents (**GRN**, **Receipt Authorization**; **waybills** where used for transport context)
- Track **where** goods sit (hub → warehouse → store → stack) and **how much** is available (stock balances, bin cards)
- Maintain an audit trail of who did what and when

The system is **role-based**: each user sees only the menus and actions their job allows. The same person may hold multiple roles (for example Hub Manager at one hub and Federal Officer at national level) and switch between them without logging out.

## Organizational hierarchy

Goods and facilities are organized in layers:

```
Location (geographic area)
    └── Hub (group of warehouses in a region)
            └── Warehouse (operational building / site)
                    └── Store (shed, bay, tent, or logical zone inside the warehouse)
                            └── Stack (physical pile or lane where a commodity is stored)
```

**Officers** (Federal through Kebele) work at the planning level — they create orders and assign managers. They do not create GRNs or move stock themselves.

**Hub Managers** oversee a hub and the warehouses under it. They assign incoming receipt orders to specific warehouses and manage **Receipt Authorizations** (truck-level authorization to deliver).

**Warehouse Managers** run day-to-day warehouse operations: stores, stacks, goods receipt notes (GRN), transfer requests, and related inbound tasks.

**Storekeepers** work inside a **store**. They accept assignments, prepare stacking space, receive trucks against authorizations, and help create operational documents at store level.

**Admins** configure users, roles, commodities, and facilities.

## Main business flow (current release)

The **implemented** end-to-end path today is **inbound only**. Outbound dispatch (dispatch orders, GIN, and the officer-to-warehouse issue chain) is **not completed** in this version of the system.

### Inbound (receiving)

1. **Officer** creates and confirms a **Receipt Order** (what is coming, from whom, to which hub or warehouse).
2. **Officer** assigns a **Hub Manager** or **Warehouse Manager** (depending on destination type).
3. **Hub Manager** (if hub-scoped) assigns a **warehouse** under the hub.
4. **Warehouse Manager** assigns a **store** (and storekeeper).
5. **Storekeeper** accepts the assignment and **prepares stack space** on the stack layout board.
6. **Hub Manager / Warehouse Manager** creates **Receipt Authorization(s)** for trucks arriving at the gate.
7. Physical receipt: **GRN** is created and confirmed by the warehouse manager; stock balances update.

## What the system is not (current scope)

- **Outbound dispatch** — **Dispatch orders**, **GIN** (goods issue), officer outbound assignments, and the full dispatch workflow are **not implemented** in this release. Do not train users on those steps until a future version ships them.
- Hub distribution to FDPs and beneficiaries is **not** in this version.
- External ERP or SMS integrations are **not** required — the system is self-contained.
- **Routes registry** (standard paths between locations) is planned but not fully exposed in the UI yet.
- UI is **English first**; Amharic is planned later.

## Security and accountability

- Every action is tied to the **logged-in user** and their **active role** and **workspace** (hub, warehouse, or store).
- Documents move through statuses (typically *Draft* → *Confirmed*). Confirmed documents affect stock and are harder to change.
- **Notifications** alert users when they are assigned work or when a workflow step completes.
- **Workflow timeline** on order detail pages shows the history of assignments, authorizations, GRNs, and related events.

## Who should read which chapter

| Your job title | Start here |
|----------------|------------|
| IT / system setup | [Admin](04-admin.md) |
| Planning / coordination | [Officer roles](05-officer-roles.md) |
| Hub oversight | [Hub Manager](06-hub-manager.md) |
| Warehouse operations lead | [Warehouse Manager](07-warehouse-manager.md) |
| Store floor / stacking | [Storekeeper](08-storekeeper.md) |

Next: [Getting started](02-getting-started.md)
