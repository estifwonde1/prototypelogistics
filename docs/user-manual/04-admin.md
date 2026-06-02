# 04 — Admin

## Role purpose

**Admin** accounts set up the system so operational staff can work. Admins do **not** perform day-to-day warehouse operations as their primary job — they manage **users**, **assignments**, **commodities**, and **facility records**.

## Default landing page

After login, Admin opens **Users** (`/admin/users`).

## Sidebar menus

### Facilities

| Menu item | Path | What you can do |
|-----------|------|-----------------|
| **Hubs** | `/hubs` | List hubs; open detail; create/edit hubs |
| **Warehouses** | `/warehouses` | List warehouses; create/edit; link to hub |

### User Management

| Menu item | Path | What you can do |
|-----------|------|-----------------|
| **Users** | `/admin/users` | Create users, set email/password, assign roles |
| **User Assignments** | `/admin/assignments` | Assign users to hubs, warehouses, or geographic locations for officer roles |

### Setup

| Menu item | Path | What you can do |
|-----------|------|-----------------|
| **Commodities** | `/admin/setup/commodities` | Maintain commodity catalog (name, codes, default units) |

Additional setup routes:

- `/admin/setup/locations`
- `/admin/setup/hubs`
- `/admin/setup/warehouses`

## Assignable roles

When creating or editing a user, only these roles can be selected:

- Admin
- Federal Officer, Regional Officer, Zonal Officer, Woreda Officer, Kebele Officer
- Hub Manager
- Warehouse Manager
- Storekeeper

Legacy or unused role names (for example Dispatch Planner, Hub Dispatch Officer, generic Officer) are **not** available and have been removed from the system.

## Key tasks

### Create a new user

1. Go to **Users** → **Create User**.
2. Enter name, email, phone, password.
3. Select one or more **roles** from the allowed list above.
4. Save.

**Note:** Officer roles cannot be combined with Hub Manager, Warehouse Manager, or Storekeeper on the same account.

### Assign user to a facility

Operational roles only see data for facilities they are assigned to.

1. Go to **User Assignments**.
2. Select **role**, then **user**.
3. Assign hubs (Hub Manager), warehouses (Warehouse Manager / Storekeeper), or geographic locations (Regional → Kebele officers).
4. **Federal Officer** does not require a location assignment — access is system-wide.

### Maintain commodities

1. Go to **Setup → Commodities**.
2. Add commodity name, code, and default unit.

### Maintain hubs and warehouses

1. **Hubs** — create hub, link to location, set status and capacity.
2. **Warehouses** — create under a hub; assign warehouse managers and storekeepers via **User Assignments**.

## Permissions summary

| Area | Admin access |
|------|--------------|
| Users & assignments | Full |
| Commodities setup | Full |
| Hubs & warehouses | Create, read, update |
| Receipt/dispatch orders, GRN/GIN | Not primary admin workflow |

## Troubleshooting

| Problem | Check |
|---------|--------|
| User sees empty warehouse list | **User Assignments** for that user + role |
| User cannot switch role | User lacks second role on account |
| Commodity missing on order form | **Commodities** setup |
| Unexpected role in old data | Re-save user with allowed roles only |

Next: [Officer roles](05-officer-roles.md)
