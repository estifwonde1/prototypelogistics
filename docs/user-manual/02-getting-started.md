# 02 — Getting Started: Login, Roles & Navigation

## Accessing the system

1. Open the application URL provided by your organization (development default: `http://localhost:5173`).
2. You land on the **Login** page.
3. Enter your **email** and **password**.
4. Click **Sign in**.

If credentials fail, contact your administrator — passwords are set when your user account is created in **Admin → Users**.

## After login: role and workspace selection

Many users have **more than one role** or **more than one facility assignment** (for example two warehouses). The system handles this in two steps.

### Step A — Choose a role

If your account has multiple roles, you may see **Select Role** (`/select-role`). Each card shows:

- Role name (e.g. Warehouse Manager, Hub Manager, Federal Officer)
- How many facility assignments you have for that role

Click the role you want to work in. The system remembers your choice for the session.

### Step B — Choose a workspace (facility)

Some roles require picking **where** you are working:

| Role | Workspace picker |
|------|------------------|
| Hub Manager | Select **hub** |
| Warehouse Manager | Select **warehouse** |
| Storekeeper | Select **store** (within a warehouse) |
| Regional / Zonal / Woreda / Kebele Officer | Geographic **location** scope (from assignment) |
| Federal Officer | System-wide — no facility picker |
| Admin | No facility badge — system-wide setup |

If you have only **one** assignment for a role, the system may select it automatically.

## Header bar (top of every page)

| Control | Purpose |
|---------|---------|
| **Burger menu** (mobile) | Opens/closes sidebar navigation |
| **Sidebar toggle** (desktop) | Collapses or expands the left menu |
| **Notifications bell** | Shows unread count; click to see recent notifications and jump to related records |
| **Account menu** (avatar / name) | Profile, **Switch role**, **Switch workspace**, Logout |

### Switch role (without logging out)

1. Open the **account menu** in the header.
2. Click **Switch role**.
3. Pick another role from the list.
4. If that role needs a facility, the **workspace picker** opens.
5. You are taken to that role’s **default dashboard**.

### Switch workspace (same role, different facility)

1. Open the account menu.
2. Click **Switch workspace**.
3. Select hub, warehouse, or store from the modal.
4. Lists, dashboards, and assignments filter to the new facility.

### Notifications

- The bell shows a **red badge** with unread count.
- Click a notification to mark it read and navigate to the linked record.
- Notifications are scoped to your **active warehouse** where applicable.

## Sidebar navigation

The **left sidebar** lists menus for your **current role only**.

At the top of the sidebar (non-admin roles), a **scope badge** shows your active facility:

- Green badge — system-wide (Federal Officer)
- Blue badge — hub, warehouse, store, or geographic location name

Below menus, every role has **Account → Profile** and **Account → Logout**.

## Default home page by role

| Role | Default route |
|------|---------------|
| Admin | `/admin/users` |
| Federal / Regional / Zonal / Woreda / Kebele Officer | `/officer/dashboard` |
| Hub Manager | `/hub/dashboard` |
| Warehouse Manager | `/warehouse/dashboard` |
| Storekeeper | `/storekeeper/dashboard` |

## Profile page

**Account → Profile** (`/profile`) lets you view your name, email, phone, and role information.

## Tips for new users

1. **Confirm your scope badge** before creating orders or documents.
2. **Draft first, confirm second** — receipt orders and GRNs should be reviewed in *Draft* before *Confirm*.
3. Use **notifications** when waiting for an assignment.
4. If a button is missing, your **role may not have permission** — see your role chapter or ask an admin.

Next: [Glossary](03-glossary.md)
