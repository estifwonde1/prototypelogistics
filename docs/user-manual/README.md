# Prototypelogistics — System User Manual

This manual is written for **all people who use the warehouse management system** — administrators, officers, hub and warehouse managers, and storekeepers. It explains what the system does, how roles differ, what each screen and button is for, and how work flows from order creation to stock on the shelf and back out again.

## How to use this manual

1. Start with [Introduction & system overview](01-introduction.md) if you are new to the system.
2. Read [Getting started](02-getting-started.md) for login, role selection, and navigation.
3. Skim [Glossary](03-glossary.md) when you see an unfamiliar term (GRN, RA, stack, etc.).
4. Open **your role chapter** for day-to-day tasks.
5. Use [End-to-end workflows](12-end-to-end-workflows.md) when you need the full chain across several roles.

## Table of contents

| # | Document | Who should read it |
|---|----------|-------------------|
| 01 | [Introduction & system overview](01-introduction.md) | Everyone |
| 02 | [Getting started — login, roles, workspace](02-getting-started.md) | Everyone |
| 03 | [Glossary & core concepts](03-glossary.md) | Everyone |
| 04 | [Admin](04-admin.md) | System administrators |
| 05 | [Officer roles](05-officer-roles.md) | Federal, Regional, Zonal, Woreda, and Kebele Officers |
| 06 | [Hub Manager](06-hub-manager.md) | Hub Managers |
| 07 | [Warehouse Manager](07-warehouse-manager.md) | Warehouse Managers |
| 08 | [Storekeeper](08-storekeeper.md) | Storekeepers |
| 09 | [Shared modules reference](11-shared-modules.md) | GRN, GIN, stacks, reports — all operational roles |
| 10 | [End-to-end workflows](12-end-to-end-workflows.md) | Cross-role process maps |

## All roles in the system

The system supports **nine user roles**. Your account may have one or several; you choose which role (and facility) to work in after login.

| Display name | Primary purpose |
|--------------|-----------------|
| **Admin** | User and facility setup; commodities; assignments |
| **Federal Officer** | National-level receipt/dispatch orders and facility monitoring |
| **Regional Officer** | Region-scoped orders and facility monitoring |
| **Zonal Officer** | Zone-scoped orders and facility monitoring |
| **Woreda Officer** | Woreda-scoped orders and facility monitoring |
| **Kebele Officer** | Kebele-scoped orders and facility monitoring |
| **Hub Manager** | Hub-level warehouse assignment and receipt authorizations |
| **Warehouse Manager** | Warehouse operations: stores, stacks, GRN/GIN, transfers |
| **Storekeeper** | Store-level stacking, assignments, physical receipt |

These are the only roles that appear when an administrator creates or edits a user.

## Document conventions

- **Bold menu paths** like **Receipt Orders → + New Receipt Order** match sidebar and button labels in the app.
- *Draft* and *Confirmed* refer to document statuses used throughout the system.
- Screenshots are not included in this version; labels match the current English UI.

## Related technical docs (for implementers)

- [WORKFLOW.md](../WORKFLOW.md) — developer setup and assignment flows
- [OFFICER_WORKFLOW.md](../OFFICER_WORKFLOW.md) — officer receipt/dispatch detail
- [LOGIN_CREDENTIALS.md](../LOGIN_CREDENTIALS.md) — test account passwords (non-production)

---

*Last updated: June 2026*
