# Receipt Authorization (RA) — End-to-end manual test guide

This document walks through the **Receipt Authorization** flow across **Officer**, **Hub Manager**, and **Storekeeper** (and related) roles, from creating a Receipt Order through inspection, driver confirmation, draft GRN, stack planning, finish stacking, and verification on the Receipt Order detail page.

Use it as a **QA checklist** and a **role-training script**. Paths match the current frontend router (`frontend/src/router.tsx`) and warehouse engine controllers.

---

## How the pieces fit together

| Concept | What it is |
|--------|-------------|
| **Receipt Order (RO)** | Officer creates and confirms it; hub assigns **warehouses** (and others may assign **stores** downstream); it may have **multiple Receipt Authorizations** (one per truck/delivery). |
| **Receipt Authorization (RA)** | Hub Manager authorizes a specific truck against a **hub→warehouse allocation** on the receipt order (quantity, driver, plate, waybill, transporter). **Individual stores are not selected here** — store assignment stays on the Receipt Order/workflow led by Warehouse Manager. Starts **Pending**; **`store_id` may be unset** until later in the workflow. |
| **Inspection** | Storekeeper records what arrived; when linked to an RA, RA goes **Pending → Active**. |
| **Driver confirmation** | After inspection, storekeeper confirms the driver delivered; system creates a **Draft GRN** from inspection lines. |
| **Stack layout / stacking** | Storekeeper places quantities onto **stacks** in the store; **Finish Stacking** confirms the Draft GRN, closes the RA, and may **complete the RO** when every RA is closed. |

Backend rules worth remembering:

- **`finish_stacking`** requires the receipt order to be **`in_progress`**. The UI now calls **`start_stacking`** automatically when you confirm **Finish Stacking** on the stack board (see `StackLayoutPage` + `POST /receipt_orders/:id/start_stacking`).
- **Total quantity on stacks** for the selected RA must match **inspection received totals** (or authorized quantity if no inspection items — RA path uses inspection sum when present). See `receipt_orders_controller#finish_stacking`.

---

## Prerequisites

1. **Test users** (or seed data) for at least:
   - **Officer** (receipt order create/confirm).
   - **Hub Manager** for the hub that owns the destination warehouse **and** permission to use hub RA pages (`hubs:read`).
   - **Storekeeper** assigned to the **destination store** (user assignment / role selection so `activeAssignment.store` is set).
   - Optional: **Warehouse Manager** if you test assignment from their UI.

2. **Facilities**: a hub → warehouse → **store** with a floor layout suitable for stacks (you can create stacks on **Stack Board**).

3. **Commodity**: Officer has defined a **commodity / batch** used on the receipt line.

4. **Browser**: stay logged in as one role at a time, or use separate browsers/profiles to avoid session confusion.

---

## Permission note (Officer vs Hub RA links)

- **Receipt Order → “Receipt Authorizations” tab** (`/officer/receipt-orders/:id` or `/receipt-orders/:id`) lists RAs and links each reference to **`/hub/receipt-authorizations/:id`**.
- Hub RA routes are wrapped with **`RequirePermission resource="hubs" action="read"`**.
- **Officers** typically **do not** have `hubs:read` in `ROLE_CAPABILITIES` (`frontend/src/contracts/warehouse.ts`). So from an **Officer** session, clicking an RA reference may show **Access Denied** even though the table is visible.
- **Workaround for QA**: open RA detail as **Hub Manager** (`/hub/receipt-authorizations/:id`) or use the **Storekeeper** RA page for store-level detail (`/storekeeper/receipt-authorizations/:id`). Use the RO tab as the officer for **progress counts and list**, not necessarily for deep-link drill-down.

---

## Phase A — Officer: commodity and Receipt Order

| Step | Action | Route | Expected |
|------|--------|-------|----------|
| A1 | Create a commodity batch if needed | `/officer/commodities/new` | Batch exists for later lines. |
| A2 | Create Receipt Order | `/officer/receipt-orders/new` | Status **Draft** (or equivalent initial). |
| A3 | Open RO detail | `/officer/receipt-orders/:id` or `/receipt-orders/:id` | Detail loads. **Receipt Authorizations** tab is hidden or empty for draft-only flow until RO is not draft — see your UI; once past draft, tab shows RAs. |
| A4 | Confirm order | Button on detail page | Status **Confirmed**; downstream roles get notifications per your env (`NotificationFanout` / jobs). |

**Checks:** workflow/assignment notifications appear if enabled; RO reference is known for hub steps.

---

## Phase B — Allocate receipt order lines to warehouses (and optionally stores)

Assignment UI lives on the **Receipt Order detail** page (`ReceiptOrderDetailPage`) — hub→warehouse allocations, and optionally **Warehouse Manager → store** assignments for their warehouse.

| Step | Action | Expected |
|------|--------|----------|
| B1 | Log in as **Hub Manager** (or WM if your process uses WM for allocation). | — |
| B2 | Open the same RO | `/receipt-orders/:id` |
| B3 | **Hub:** assign inbound quantity to **warehouses** under the hub (hub→warehouse assignment rows). The hub does **not** pick stores when creating Receipt Authorizations in Phase C — only allocations to warehouses matter for that screen. | Assignment rows created with **`warehouse_id`**; RO status may move toward **assigned** (`ReceiptOrderAssignmentService`). |
| B4 | (When testing storekeeper-facing steps) **Warehouse Manager** assigns **store(s)** inside their warehouse as your process requires, so downstream inspection/stacking still has a concrete store context. | Store-level assignment rows (`store_id` set) appear where configured; notifications to storekeepers follow existing rules when a store is on the assignment. |

**Checks:** At least one **warehouse allocation** exists before **Phase C**. For store-specific QA paths, confirm the **Storekeeper’s store** aligns with Phase B store assignment (when used).

---

## Phase C — Hub Manager: create Receipt Authorization

| Step | Action | Route | Expected |
|------|--------|-------|----------|
| C1 | Open RA list (optional) | `/hub/receipt-authorizations` | Lists RAs; counts if implemented. |
| C2 | Create RA | `/hub/receipt-authorizations/new` | Form: RO, routing mode, authorized quantity (in **Receipt Order line units** after conversion), transporter, driver name/ID, plate, waybill. **There is no “Destination Store” field** here — store assignment stays on the Receipt Order. |
| C3 | Planned path (default when RO has hub→warehouse assignment rows) | Leave **Use planned warehouse allocation** checked | Pick a **Warehouse Assignment** row; **`receipt_order_assignment_id`** sent; remaining quantity per allocation enforced server-side (unchanged). |
| C4 | Direct hub routing (bypass assignment row) | Uncheck planned allocation **or** RO has no warehouse assignment rows | Pick **Destination warehouse** under the RO’s hub; multi-line ROs require **Receipt order line**. **`warehouse_id`** sent, no assignment id. **Total authorized per line** cannot exceed that line’s quantity on the RO. |
| C5 | Routing impact / notifications | — | If the chosen warehouse is **not** on planned assignment rows for that line, affected planned facilities get **`receipt_authorization.plan_deviated`** (in-app); an optional checkbox can **notify planned contacts anyway** when still on-plan. **`receipt_authorization.routing_override`** is always recorded on the RO workflow. |
| C6 | Submit | — | RA **Pending**; reference like **RA-…**; **`store_id`** may be **null** (warehouse-level inbound). |

**Checks:**

- **Authorized quantity** should align with inspection (cannot exceed authorization on inspection create) and **must not exceed the Receipt Order line total** (all RAs on that line, normalized to the line’s unit).
- **Planned path:** assignment row matches intent; server enforces remaining allocation.
- **Tracing:** Receipt Order **Workflow** tab lists **Receipt authorization routing overrides** plus the full timeline (`receipt_authorization.routing_override` events).
- If the RO has **no hub**, you cannot use direct hub routing until the order has hub context; fix the Receipt Order if stuck.

---

## Phase D — Storekeeper: inspection (truck arrived)

| Step | Action | Route | Expected |
|------|--------|-------|----------|
| D1 | **Storekeeper** dashboard / RA list | `/storekeeper/receipt-authorizations` | Pending RA visible when it targets **your store** (`store_id`) **or**, for warehouse-only RAs, when your store sits in the **same warehouse** (`store_id` null on the RA, policy/API match by `warehouse_id`). |
| D2 | Create inspection | `/inspections/new` | Select **Receipt Authorization** from the dropdown of pending RAs you can access. Fill warehouse, date, inspector, **line items** with `quantity_received` (and damage/loss as needed). |
| D3 | Save | — | RA becomes **Active** (`InspectionCreator` links RA and transitions status). |

**Checks:** On `/storekeeper/receipt-authorizations/:id`, inspection section shows linked inspection when present.

**Quantity discipline:** Sum of `quantity_received` on inspection items becomes the **target total** for stacking (`finish_stacking` compares stacked total to this sum). Plan a simple case first (e.g. one line item = full authorized qty).

---

## Phase E — Storekeeper: driver confirmation → Draft GRN

| Step | Action | Route | Expected |
|------|--------|-------|----------|
| E1 | Open RA detail | `/storekeeper/receipt-authorizations/:id` | Status **Active**. |
| E2 | Click **Driver Confirmed Delivery** | — | `driver_confirmed_at` set; **`DriverConfirmService`** creates **Draft GRN** from inspection items (`driver_confirm_service.rb`). |
| E3 | Open GRN | Link to `/grns/:id` (from RA detail) | GRN **Draft**; lines mirror inspection quantities. |

**Checks:** RA detail shows GRN reference and **Draft** status.

---

## Phase F — Storekeeper: stack planning (quantities on the board)

**Goal:** Allocate the **received quantity** across one or more stacks for that store so the **sum of stack quantities** equals the **inspection received total** for this RA.

| Step | Action | Route | Expected |
|------|--------|-------|----------|
| F1 | Go to stack board | `/stacks/layout` (from sidebar, **Stack Board**, or **Go to Stacking** on `/storekeeper/receipt-authorizations`) | Select **store** matching the RA. |
| F2 | **Edit Layout** | Toggle on board | Create or adjust **stack** footprints (draw/edit stacks) and set commodity/batch/unit as required by the form. |
| F3 | Set **quantity** on each stack that will hold freight | Stack modal **Quantity** field | Only stacks with **quantity &gt; 0** are sent as placements. |
| F4 | (Optional URL) | `/stacks/layout?store_id=<storeId>&receipt_authorization_id=<raId>` | Pre-selects RA if you pass query params (board reads `receipt_authorization_id`). The list’s **Go to Stacking** button currently navigates to `/stacks/layout` **without** those params — you can still pick the RA in the dropdown (see Phase G). |

**Important:** **`finish_stacking`** sends `placements: [{ stack_id, quantity }]` built from **current stack records** (`storeStacks.filter(s => s.quantity > 0)`). Plan splits across stacks accordingly; **totals must match** the backend reconciliation.

---

## Phase G — Finish stacking (confirm GRN, close RA)

| Step | Action | Expected |
|------|--------|----------|
| G1 | On `/stacks/layout`, in the **Receipt Authorization** card (storekeeper only), choose the RA in the dropdown. | List only includes **Active** RAs with **driver confirmed** and **Draft GRN** (`activeRAsForStacking` filter). |
| G2 | Click **Finish Stacking** → confirm modal. | Client calls **`start_stacking`** then **`finish_stacking`** for that RO and RA. |
| G3 | Success | GRN **Confirmed**, RA **Closed**, inventory applied; if all non-cancelled RAs for the RO are closed, **`ReceiptOrderCompletionChecker`** sets RO **Completed** (`receipt_order.completed` notification). |

**Checks:** Return to **Receipt Order** detail → **Receipt Authorizations** tab: progress **“X of Y trucks completed”**, row shows closed RA and GRN reference.

---

## Phase H — Officer / viewer: verify RO tab

| Step | Action | Route | Expected |
|------|--------|-------|----------|
| H1 | Open RO | `/officer/receipt-orders/:id` or `/receipt-orders/:id` | **Receipt Authorizations** tab: table (reference, status, store, warehouse, qty, driver, plate, GRN), badge **“closed of total”**, progress bar. |
| H2 | Click RA link as Officer | `/hub/receipt-authorizations/:id` | May be **Access Denied** (see permission note). Use Hub Manager session to verify detail if needed. |

---

## API reference (troubleshooting only)

If the UI misbehaves, you can confirm the same rules with authenticated API calls (replace host and bearer token):

- `POST /receipt_orders/:id/start_stacking` — sets RO **in_progress** (allowed from confirmed / assigned / reserved / in progress).
- `POST /receipt_orders/:id/finish_stacking` — body `{ "placements": [...], "receipt_authorization_id": <id> }`.

Policies: **`start_stacking?`** / **`finish_stacking?`** allow **storekeeper** and **warehouse_manager** (and admin) (`receipt_order_policy.rb`).

---

## Common failures and what they mean

| Symptom | Likely cause |
|--------|----------------|
| **Finish Stacking** error: order must be **in_progress** | Should be resolved by automatic `start_stacking` before finish. If testing API-only, call `start_stacking` first. |
| Total stacked does not match total received | Sum of stack **quantities** ≠ sum of **inspection** `quantity_received` for that RA (or rounding &gt; 0.001). Adjust stack quantities or inspection. |
| No RA in dropdown on stack board | RA not **Active**, driver not confirmed, or GRN not **Draft** — complete Phases D–E first. Wrong **store** selected, or RA is still warehouse-only and not visible for your store’s filters. |
| Officer cannot open `/hub/receipt-authorizations/:id` | **Expected** without `hubs:read`. Use Hub Manager or read-only list on RO tab. |
| RO not **Completed** after one truck | Multiple RAs exist — **all** non-cancelled RAs must be **closed** before auto-completion. |

---

## Suggested minimal test dataset (one truck)

1. One RO line quantity **Q** (e.g. 100).
2. One RA with **authorized_quantity = Q**.
3. One inspection line with **quantity_received = Q**.
4. One or more stacks whose **quantity fields sum to Q**.

This isolates reconciliation logic and avoids partial multi-line math until you are comfortable.

---

## Document history

- Written against the warehouse engine **`finish_stacking` / `start_stacking`** actions and frontend **`StackLayoutPage`**, **`StorekeeperRADetailPage`**, **`ReceiptOrderDetailPage`**, **`InspectionCreatePage`**, and hub RA pages.
- **2026-05-05:** Hub RA create flow documents **warehouse assignment only** (no destination store on `/hub/receipt-authorizations/new`); Phase B distinguishes hub **warehouse** allocation vs WM **store** assignment; Phase D notes visibility for warehouse-scoped pending RAs.
