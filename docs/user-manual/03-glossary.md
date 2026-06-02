# 03 — Glossary & Core Concepts

## Facilities

| Term | Meaning |
|------|---------|
| **Location** | Geographic/administrative place (region, city, etc.) used to scope officers and register facilities. |
| **Hub** | A grouping of warehouses in an area. Officers may send receipt orders **to a hub**; hub managers assign which warehouse receives goods. |
| **Warehouse** | Operational storage site under a hub. Has capacity, stores, stock balances, and operational documents. |
| **Store** | Subdivision inside a warehouse (shed, tent, bay). Has dimensions, usable space, and stacks. |
| **Stack** | A defined pile or lane inside a store where a specific commodity is stored. Created on the **Stack Layout** board. |

## Orders (planning documents)

| Term | Meaning |
|------|---------|
| **Receipt Order (RO)** | Plan for **incoming** goods: source, destination (hub or warehouse), line items, expected dates. |
| **Dispatch Order (DO)** | Plan for **outgoing** goods: source warehouse, destination, line items. |
| **Assignment** | Link from an order to a responsible person/facility. Created on the order’s **Assignments** tab. |
| **Space reservation** | (Where enabled) Reserve storage capacity on a receipt order before goods arrive. |
| **Stock reservation** | (Where enabled) Reserve commodity quantity on a dispatch order before issue. |

## Operational documents

| Term | Abbreviation | Meaning |
|------|--------------|---------|
| **Goods Receipt Note** | **GRN** | Records goods **received** into the warehouse. Updates stock when **confirmed**. |
| **Goods Issue Note** | **GIN** | Records goods **issued** from the warehouse. Reduces stock when **confirmed**. |
| **Receipt Authorization** | **RA** | Authorizes a **truck/load** to deliver against a receipt order. Hub/warehouse managers create RAs; storekeepers **receive** against them. |
| **Waybill** | — | Transport document for movement of goods. |
| **Transfer Request** | — | Move stock between stores/stacks; storekeeper creates, warehouse manager approves. |

## Stock & reporting

| Term | Meaning |
|------|---------|
| **Stock balance** | Current quantity of a commodity in a warehouse/store/stack context. |
| **Bin card** | Ledger-style report of movements in/out for a commodity location. |
| **Batch / lot** | Identifier for a production or receipt batch (on GRN lines where captured). |
| **UOM** | Unit of measure (kg, bags, quintals, etc.). |

## Status values

| Context | Common statuses |
|---------|-----------------|
| Orders | *Draft*, *Confirmed*, *In Progress*, *Completed* |
| Assignments | *Pending*, *Assigned*, *Accepted*, *In Progress*, *Completed* |
| Documents (GRN/GIN) | *Draft*, *Confirmed* |

## Roles (short definitions)

See [README — All roles](README.md#all-roles-in-the-system).

| Role | One-line purpose |
|------|------------------|
| **Admin** | Users, assignments, commodities, hubs/warehouses setup |
| **Federal Officer** | National receipt/dispatch orders and monitoring |
| **Regional Officer** | Region-scoped orders and monitoring |
| **Zonal Officer** | Zone-scoped orders and monitoring |
| **Woreda Officer** | Woreda-scoped orders and monitoring |
| **Kebele Officer** | Kebele-scoped orders and monitoring |
| **Hub Manager** | Hub dashboard, warehouse assignment, receipt authorizations |
| **Warehouse Manager** | Stores, stacks, GRN/GIN, transfers, waybills |
| **Storekeeper** | Assignments, stack layout, receive RA, GRN drafts |

## Permission actions

- **read** — view lists and details
- **create** — new records
- **update** — edit drafts or metadata
- **delete** — remove drafts (where allowed)
- **confirm** — finalize document and trigger stock effects

Next: your role chapter, or [Shared modules](11-shared-modules.md).
