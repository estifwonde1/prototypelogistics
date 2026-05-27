# Dispatch Architecture — Frontend Integration Guide

> **Scope:** Backend-only Rails engine at `engines/cats_warehouse`. All base URLs are prefixed `/cats_warehouse/v1/`. All requests require `Authorization: Bearer <token>`. All write payloads are wrapped in a `payload` key. All responses are `{ success: true, data: ... }` or `{ success: false, error: { message, code?, details? } }`.

---

## Feature Flag

The entire dispatch v2 flow is gated by the env var `ENABLE_OFFICER_DISPATCH_V2`. It defaults to **enabled** (only disabled when explicitly set to `"false"`). If disabled, all v2 endpoints return `404` with `{ code: "FEATURE_DISABLED" }`.

---

## Status Enums (exact strings used in DB and API)

### DispatchOrder
| Value | Meaning |
|---|---|
| `draft` | Officer editing |
| `confirmed` | Officer confirmed / self-approved |
| `partially_authorized` | At least one warehouse authorization exists |
| `fully_authorized` | All source quantities authorized |
| `in_progress` | Storekeeper execution started |
| `partially_dispatched` | Shortage recorded on at least one store |
| `completed` | All authorizations terminal |
| `cancelled` | Cancelled |

### DispatchOrderAuthorization
`draft` → `confirmed` → `in_progress` → `completed` | `cancelled`

### DispatchOrderAuthorizationExecution
`draft` → `confirmed`

### Waybill / GIN
`draft` → `confirmed`

### PackagingTransaction
`posted` | `voided`

---

## Role → Permitted Actions

| Role | Permitted |
|---|---|
| Officer | Create/edit/confirm/self-approve dispatch orders |
| Warehouse Manager | Create/confirm authorizations, record transport, void packaging transactions |
| Hub Manager | Same as Warehouse Manager |
| Storekeeper | Record executions, driver confirm, stack allocations, GIN confirm |
| Admin | Everything |


---

## Step 1 — Officer: Load Page Data

Before rendering the creation form, fetch all reference data in parallel.

### GET /dispatch_orders/lookups/source_warehouses
Returns warehouses within the officer's jurisdiction.

Query params: `q` (search string), `page`, `per_page`

```json
{ "success": true, "data": { "items": [{ "id": 1, "name": "Addis Hub WH", "code": "AHW01", "label": "Addis Hub WH (AHW01)" }], "meta": { "total": 12 } } }
```

### GET /dispatch_orders/lookups/destinations
Returns `Warehouse` and `FDP` locations within officer jurisdiction.

Query params: `q`, `exchange_only=true` (returns only warehouses, for exchange orders)

```json
{ "success": true, "data": { "items": [{ "id": 20, "name": "Dire Dawa FDP", "code": "DD-FDP-01", "label": "Dire Dawa FDP (DD-FDP-01)", "location_type": "FDP" }] } }
```

### GET /reference_data/commodities
### GET /reference_data/units
### GET /reference_data/commodity_grades
### GET /reference_data/uom_conversions

All return flat arrays. No auth scoping — available to all authenticated users.

---

## Step 2–5 — Officer: Create Draft Dispatch Order

### POST /dispatch_orders

**Identifies as v2** when `plan_reference` is present in the payload.

```json
{
  "payload": {
    "plan_reference": "RP-2026-03-WHEAT-001",
    "description": "Optional free text",
    "dispatch_plan_id": null,
    "lines": [
      {
        "commodity_id": 1,
        "quantity": 500,
        "unit_id": 2,
        "packaging_unit_id": 3,
        "packaging_size": 50,
        "source_allocations": [
          { "warehouse_id": 10, "quantity": 300, "unit_id": 2 },
          { "warehouse_id": 11, "quantity": 200, "unit_id": 2 }
        ],
        "destination_allocations": [
          { "destination_location_id": 20, "quantity": 500, "unit_id": 2 }
        ]
      }
    ]
  }
}
```

**Backend computes server-side (do not send):** `base_quantity`, `package_count`, `officer_level`, `officer_location_id`, `jurisdiction_metadata`, `reference_no`.

**Response:** Full `DispatchOrderSerializer` payload (see §Serializer Reference).

**Errors:**
- `422` — `plan_reference` blank, quantity ≤ 0, no UOM conversion path
- `403` — `{ code: "JURISDICTION_VIOLATION", message: "...", details: [{ field, code }] }` — warehouse or destination outside officer scope


---

## Step 6 — Officer: Save / Update Draft

### PATCH /dispatch_orders/:id

Only allowed while `status == "draft"`. Replaces lines and allocations entirely.

```json
{
  "payload": {
    "description": "Updated notes",
    "lines": [ /* same structure as POST */ ]
  }
}
```

Returns updated `DispatchOrderSerializer`.

---

## Step 7 — Officer: Confirm / Self-Approve

Two endpoints — both do the same thing but `self_approve` enforces `created_by == current_user`.

### POST /dispatch_orders/:id/confirm
### POST /dispatch_orders/:id/self_approve

No body required.

**Backend actions:**
1. Validates all allocations are balanced (source sum == destination sum == line base_quantity)
2. Re-validates jurisdiction
3. Generates `reference_no` if blank
4. Sets `status = "confirmed"`, `confirmed_at`, `confirmed_by_id`, `approved_by_id`
5. Notifies warehouse managers for all source warehouses

**Response:** Updated `DispatchOrderSerializer`.

**Errors:**
- `422` — allocation mismatch, missing `plan_reference`, incomplete lines
- `403` — not the creator (self_approve), jurisdiction violation

**UI hint:** The `DispatchOrderSerializer` includes `can_confirm` and `can_self_approve` boolean flags — use these to show/hide action buttons without a separate policy call.

---

## Step 8 — Manager: List Pending Authorizations

### GET /dispatch_order_authorizations

Query params:
- `dispatch_order_id` — filter by order
- `warehouse_id` — filter by warehouse
- `status` — filter by status (`draft`, `confirmed`, `in_progress`, `completed`)
- `storekeeper_scope=true` — storekeeper sees only authorizations for their assigned stores

Returns array of `DispatchOrderAuthorizationSerializer`.

---

## Step 9 — Manager: Create Authorization

### POST /dispatch_order_authorizations

```json
{
  "payload": {
    "dispatch_order_id": 5,
    "warehouse_id": 10,
    "authorized_quantity": 300,
    "authorized_quantity_input_unit_id": 2,
    "transporter_id": 7,
    "driver_name": "Abebe Kebede",
    "driver_id_number": "ET-DL-12345",
    "truck_plate_number": "AA-3-12345",
    "store_splits": [
      { "store_id": 3, "commodity_id": 1, "authorized_quantity": 200, "base_quantity": 200 },
      { "store_id": 4, "commodity_id": 1, "authorized_quantity": 100, "base_quantity": 100 }
    ]
  }
}
```

**Backend actions:**
- Validates order is `confirmed` / `partially_authorized` / `fully_authorized`
- Validates authorized quantity does not exceed source-allocated quantity per commodity per warehouse
- Pre-fills transport fields from `TransportRecord` if one exists for this order+warehouse
- Creates authorization in `draft` status

**Response:** `DispatchOrderAuthorizationSerializer` (includes `dispatch_order_authorization_stores` and `dispatch_order_authorization_executions`).

**Errors:**
- `422` — over-authorization, order not ready, commodity_id missing in store_splits


---

## Step 9b — Manager: Optional Transport Record (Task 6)

Record transport details before creating a full authorization. Data is auto-copied into the authorization on creation.

### POST /dispatch_orders/:id/transport_record
### PATCH /dispatch_orders/:id/transport_record

```json
{
  "payload": {
    "warehouse_id": 10,
    "driver_name": "Abebe Kebede",
    "license_number": "ET-DL-12345",
    "vehicle_plate": "AA-3-12345",
    "phone": "+251911000000"
  }
}
```

One record per `(dispatch_order, warehouse)` — upsert behavior. Returns `{ transport_record_id }`.

---

## Step 10 — Manager: Confirm Authorization

### POST /dispatch_order_authorizations/:id/confirm

No body required.

**Backend actions:**
1. Validates `driver_name`, `driver_id_number`, `truck_plate_number` all present
2. Validates store splits sum == `authorized_quantity`
3. Sets `status = "confirmed"`
4. **Auto-generates a Waybill** — returns immediately with waybill embedded in authorization
5. Notifies storekeepers assigned to the authorization stores

**Response:** Updated `DispatchOrderAuthorizationSerializer`.

**To get the generated waybill:** `GET /waybills?dispatch_order_authorization_id=<id>` or read `waybill` from the printable endpoint.

---

## Step 10b — Lookup Stores and Stacks for Authorization Form

### GET /dispatch_order_authorizations/lookups/stores?warehouse_id=10&q=store+name

Returns stores belonging to the warehouse.

```json
{ "success": true, "data": { "items": [{ "id": 3, "name": "Store A", "code": "SA", "label": "Store A (SA)" }] } }
```

### GET /dispatch_order_authorizations/lookups/stacks?store_id=3&commodity_id=1

Returns stacks with available balance.

```json
{ "success": true, "data": { "items": [{ "id": 12, "name": "Stack 1", "code": "S1", "label": "Stack 1 (S1)", "available_quantity": 250.0 }] } }
```

---

## Step 11 — Storekeeper: List Assigned Authorizations

### GET /dispatch_order_authorizations?storekeeper_scope=true&status=confirmed

Returns authorizations where the storekeeper's assigned stores appear in `dispatch_order_authorization_stores`.

---

## Step 12 — Storekeeper: Record Execution

### POST /dispatch_order_authorizations/:id/executions

```json
{
  "payload": {
    "dispatch_order_authorization_store_id": 3,
    "quantity": 180,
    "commodity_grade": "Grade A",
    "inventory_lot_id": null,
    "shortage_reason": "Damaged bags removed"
  }
}
```

**Rules enforced by backend:**
- `quantity` ≤ store row `remaining_quantity`
- `shortage_reason` **required** when `quantity < remaining_quantity`
- Authorization must be `confirmed` or `in_progress`

**Response:** `DispatchOrderAuthorizationExecutionSerializer`:
```json
{
  "id": 1, "quantity": 180, "base_quantity": 180, "authorized_quantity": 200,
  "shortage_quantity": 20, "shortage_reason": "Damaged bags removed",
  "commodity_grade": "Grade A", "inventory_lot_id": null,
  "status": "draft", "storekeeper_id": 5, "commodity_id": 1,
  "dispatch_order_authorization_id": 7, "dispatch_order_authorization_store_id": 3
}
```

### GET /dispatch_order_authorizations/:id/executions?status=draft

List all executions for an authorization. Filter by `status`.

### POST /dispatch_order_authorizations/:id/executions/:execution_id/confirm

Transitions execution `draft → confirmed`. No body required.


---

## Step 13 — Storekeeper: Driver Confirmation → GIN Draft

### POST /dispatch_order_authorizations/:id/driver_confirm

No body required.

**Preconditions:** At least one execution exists with `quantity > 0`.

**Backend actions:**
1. Sets `driver_confirmed_at` on authorization
2. Generates a **draft GIN** from the waybill
3. Links GIN to authorization via `dispatch_order_authorization_id`

**Response:**
```json
{ "success": true, "data": { "gin_id": 42, "dispatch_order_authorization_id": 7 } }
```

Frontend should then `GET /gins/42` to display the draft GIN.

---

## Step 14 — Storekeeper: Assign Stacks

### POST /gins/:id/stack_allocations

```json
{
  "payload": {
    "allocations": [
      { "stack_id": 12, "quantity": 100, "commodity_id": 1, "commodity_grade": "Grade A" },
      { "stack_id": 13, "quantity": 80,  "commodity_id": 1, "commodity_grade": "Grade A" }
    ]
  }
}
```

**Backend validates:**
- Sum of allocation quantities matches GIN item quantity (tolerance 0.001)
- Stacks belong to the GIN warehouse

**Response:** Array of `DispatchStackAllocationSerializer`:
```json
[
  { "id": 1, "gin_id": 42, "stack_id": 12, "quantity": 100, "base_quantity": 100, "commodity_grade": "Grade A" },
  { "id": 2, "gin_id": 42, "stack_id": 13, "quantity": 80,  "base_quantity": 80,  "commodity_grade": "Grade A" }
]
```

Use `GET /dispatch_order_authorizations/lookups/stacks?store_id=X&commodity_id=Y` to populate the stack picker with available balances.

---

## Step 15 — Storekeeper: Finish Dispatch (Confirm GIN)

### POST /gins/:id/confirm

Optional header: `Idempotency-Key: <uuid>` — safe to retry; duplicate confirms are ignored.

Optional body: `{ "approved_by_id": <user_id> }` — defaults to current user.

**Backend actions (all in one transaction):**
1. Calls `InventoryLedger.apply_issue!` per GIN item → deducts stock from stacks
2. Updates `StockReservation` → `Consumed`
3. Creates `StackTransaction` records (bin card entries)
4. Updates `StockBalance`
5. Marks authorization executions `confirmed`
6. Marks authorization `completed` when all store rows are fully dispatched
7. Calls `DispatchOrderStatusAggregator` → updates order status to `completed` when all authorizations done
8. Emits `gin.confirmed` notification

**Response:** Updated `GinSerializer` with `status: "Confirmed"`.

**Errors:**
- `422` — GIN not in confirmable state, stack quantities insufficient
- Idempotent replay returns the already-confirmed GIN silently

---

## Exchange Orders (Task 4)

An order is automatically treated as an exchange when **all** destination allocations have `destination_location_type == "Warehouse"` (no FDPs). The `exchange_order` boolean in `DispatchOrderSerializer` reflects this.

### Receiving at destination warehouse

### POST /dispatch_orders/:id/receive

```json
{
  "payload": {
    "warehouse_id": 11,
    "commodity_id": 1,
    "quantity": 300,
    "unit_id": 2,
    "packaging_unit_id": 3,
    "packaging_size": 50
  }
}
```

Creates a `PackagingTransaction(receive)` at the destination. Returns `{ packaging_transaction_id }`.

---

## Packaging Transactions (Task 7)

### GET /packaging_transactions
Query params: `warehouse_id`, `transaction_type` (`receive`|`dispatch`), `reference_order_id`, `reference_order_type`

### GET /packaging_transactions/:id

### POST /packaging_transactions
Manual creation (for standalone packaging records not tied to execution flow).

### POST /packaging_transactions/:id/void
Marks transaction `voided`. Only `posted` transactions can be voided. Manager/admin only.


---

## Printable Documents

### POST /printables/waybill
Body: `{ "waybill_id": 15 }` or `{ "id": 15 }`

Returns a flat DTO for document rendering:
```json
{
  "reference_no": "WB-AHW01-20260527-7",
  "issued_on": "2026-05-27",
  "plan_reference": "RP-2026-03-WHEAT-001",
  "authorization_reference": "DOA-A1B2C3D4",
  "transporter_name": "Fast Logistics",
  "driver_name": "Abebe Kebede",
  "vehicle_plate_no": "AA-3-12345",
  "source_location_name": "Addis Hub WH",
  "destination_location_name": "Dire Dawa FDP",
  "items": [{ "commodity_name": "Wheat", "quantity": 300, "unit_name": "MT", "base_quantity": 300 }]
}
```

### POST /printables/gin
Body: `{ "gin_id": 42 }` or `{ "id": 42 }`

Returns flat GIN DTO including `plan_reference`, `authorization_reference`, `driver_name`, `truck_plate_number`, items with `store_id`, `stack_id`, `commodity_grade`.

---

## Workflow / Audit Trail

### GET /dispatch_orders/:id/workflow

Returns full event history for an order:
```json
{
  "id": 5,
  "reference_no": "DO-A1B2C3D4",
  "plan_reference": "RP-2026-03-WHEAT-001",
  "status": "confirmed",
  "officer_level": "regional",
  "workflow_events": [
    { "id": 1, "event_type": "dispatch_order.created", "from_status": null, "to_status": "draft", "actor_name": "Tigist Alemu", "occurred_at": "2026-05-27T08:00:00Z", "payload": {} },
    { "id": 2, "event_type": "dispatch_order.self_approved", "from_status": "draft", "to_status": "confirmed", "actor_name": "Tigist Alemu", "occurred_at": "2026-05-27T09:00:00Z", "payload": {} }
  ]
}
```

---

## Serializer Reference

### DispatchOrderSerializer
```
id, reference_no, plan_reference, name, status, status_label,
dispatched_date, hub_id, hub_name, warehouse_id, warehouse_name, warehouse_code,
created_by_id, created_by_name, confirmed_by_id, confirmed_by_name, confirmed_at,
approved_by_id, approved_at, description, created_at, updated_at,
location_id, location_name, hierarchical_level, officer_level, officer_location_id,
exchange_order (bool), dispatch_plan_id, dispatch_plan_item_id,
can_confirm (bool), can_self_approve (bool),
dispatch_order_lines: [ DispatchOrderLineSerializer ],
dispatch_order_authorizations: [ DispatchOrderAuthorizationSerializer ]
```

### DispatchOrderLineSerializer
```
id, commodity_id, commodity_name, quantity, unit_id, unit_name,
base_quantity, base_unit_id, base_unit_name,
packaging_unit_id, packaging_size, package_count, remarks,
source_allocations: [ DispatchLineSourceAllocationSerializer ],
destination_allocations: [ DispatchLineDestinationAllocationSerializer ]
```

### DispatchLineSourceAllocationSerializer
```
id, warehouse_id, quantity, unit_id, base_quantity, base_unit_id,
warehouse_ownership_type (hub|independent), unit_name, base_unit_name,
warehouse: { id, name, code, label }
```

### DispatchLineDestinationAllocationSerializer
```
id, destination_location_id, destination_location_type (Warehouse|FDP),
quantity, unit_id, base_quantity, base_unit_id,
unit_name, base_unit_name, destination_label,
destination_location: { id, name, code, label, location_type }
```

### DispatchOrderAuthorizationSerializer
```
id, dispatch_order_id, warehouse_id, reference_no, status, status_label,
authorized_quantity, authorized_base_quantity, remaining_quantity,
driver_name, driver_id_number, truck_plate_number, transporter_id, transporter_name,
created_by_id, confirmed_at, driver_confirmed_at,
warehouse: { id, name, code, label },
dispatch_order_authorization_stores: [ DispatchOrderAuthorizationStoreSerializer ],
dispatch_order_authorization_executions: [ DispatchOrderAuthorizationExecutionSerializer ]
```

### DispatchOrderAuthorizationStoreSerializer
```
id, store_id, commodity_id, authorized_quantity, base_quantity,
dispatched_quantity, remaining_quantity, store_name, commodity_name
```

### DispatchOrderAuthorizationExecutionSerializer
```
id, quantity, base_quantity, authorized_quantity, shortage_quantity, shortage_reason,
commodity_grade, inventory_lot_id, status (draft|confirmed),
storekeeper_id, commodity_id,
dispatch_order_authorization_id, dispatch_order_authorization_store_id
```

### GinSerializer
```
id, reference_no, warehouse_id, issued_on, destination_type, destination_id,
status, workflow_status, dispatch_order_id, dispatch_order_authorization_id,
generated_from_waybill_id, issued_by_id, approved_by_id, created_at, updated_at,
gin_items: [ GinItemSerializer ]
```

### WaybillSerializer
```
id, reference_no, dispatch_id, dispatch_order_id, dispatch_order_authorization_id,
prepared_by_id, auto_generated_gin_id,
source_location_id, destination_location_id, source_location_name, destination_location_name,
issued_on, status, workflow_status, created_at, updated_at,
waybill_transport: { transporter_id, vehicle_plate_no, driver_name, driver_phone },
waybill_items: [ WaybillItemSerializer ]
```

### PackagingTransactionSerializer
```
id, transaction_type (receive|dispatch), warehouse_id, commodity_id,
quantity, base_quantity, unit_id, packaging_unit_id, packaging_size, package_count,
occurred_at, reference_order_type, reference_order_id,
dispatch_order_authorization_execution_id, created_by_id, status (posted|voided)
```

### DispatchStackAllocationSerializer
```
id, dispatch_order_authorization_execution_id, gin_id,
stack_id, quantity, base_quantity, commodity_grade
```


---

## Complete API Endpoint Map

| Method | Path | Actor | Description |
|---|---|---|---|
| GET | `/dispatch_orders/lookups/source_warehouses` | Officer | Jurisdiction-filtered warehouse list |
| GET | `/dispatch_orders/lookups/destinations` | Officer | Jurisdiction-filtered warehouse+FDP list |
| GET | `/dispatch_orders` | All | List orders (filterable by `status`, `warehouse_id`, `created_by=me`, `officer_level`) |
| GET | `/dispatch_orders/:id` | All | Single order with lines, allocations, authorizations |
| POST | `/dispatch_orders` | Officer | Create draft order |
| PATCH | `/dispatch_orders/:id` | Officer | Update draft order |
| POST | `/dispatch_orders/:id/confirm` | Officer | Confirm order |
| POST | `/dispatch_orders/:id/self_approve` | Officer (creator only) | Self-approve order |
| GET | `/dispatch_orders/:id/workflow` | All | Audit trail |
| POST | `/dispatch_orders/:id/transport_record` | Manager | Create/update transport record |
| PATCH | `/dispatch_orders/:id/transport_record` | Manager | Update transport record |
| POST | `/dispatch_orders/:id/receive` | Manager | Exchange receive at destination |
| GET | `/dispatch_order_authorizations/lookups/stores` | Manager | Stores for a warehouse |
| GET | `/dispatch_order_authorizations/lookups/stacks` | Manager/SK | Stacks with balances for a store+commodity |
| GET | `/dispatch_order_authorizations` | Manager/SK | List authorizations |
| GET | `/dispatch_order_authorizations/:id` | Manager/SK | Single authorization with stores + executions |
| POST | `/dispatch_order_authorizations` | Manager | Create authorization |
| POST | `/dispatch_order_authorizations/:id/confirm` | Manager | Confirm authorization → auto-generates waybill |
| POST | `/dispatch_order_authorizations/:id/driver_confirm` | SK/Manager | Driver confirm → generates draft GIN |
| GET | `/dispatch_order_authorizations/:id/executions` | Manager/SK | List executions |
| POST | `/dispatch_order_authorizations/:id/executions` | Storekeeper | Record execution |
| POST | `/dispatch_order_authorizations/:id/executions/:execution_id/confirm` | Storekeeper | Confirm execution |
| GET | `/gins` | All | List GINs (filterable by `warehouse_id`, `dispatch_order_id`, `dispatch_order_authorization_id`) |
| GET | `/gins/:id` | All | Single GIN with items |
| POST | `/gins/:id/stack_allocations` | Storekeeper | Assign stacks to GIN items |
| POST | `/gins/:id/confirm` | Storekeeper | Finish dispatch — deducts inventory |
| GET | `/waybills` | All | List waybills |
| GET | `/waybills/:id` | All | Single waybill |
| POST | `/printables/waybill` | All | Printable waybill DTO |
| POST | `/printables/gin` | All | Printable GIN DTO |
| GET | `/packaging_transactions` | Manager/SK | List packaging transactions |
| GET | `/packaging_transactions/:id` | Manager/SK | Single packaging transaction |
| POST | `/packaging_transactions` | Manager/SK | Create packaging transaction |
| POST | `/packaging_transactions/:id/void` | Manager | Void a posted transaction |

---

## Error Handling Contract

All errors follow:
```json
{ "success": false, "error": { "message": "Human-readable string" } }
```

Jurisdiction violations add:
```json
{ "success": false, "error": { "code": "JURISDICTION_VIOLATION", "message": "...", "details": [{ "field": "source_allocations.warehouse_id", "code": "forbidden" }] } }
```

Validation errors from `ActiveRecord` add:
```json
{ "success": false, "error": { "message": "Quantity can't be blank", "details": { "quantity": ["can't be blank"] } } }
```

| HTTP Status | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `400` | Missing required parameter |
| `401` | Not authenticated |
| `403` | Not authorized / jurisdiction violation |
| `404` | Record not found / feature disabled |
| `422` | Business rule violation |

---

## Key Frontend Rules

1. **Never compute** `base_quantity`, `package_count`, `officer_level`, `jurisdiction_metadata`, `reference_no` — all server-side.
2. **Submit IDs only** in write payloads — display names come from serializer responses.
3. **`can_confirm` / `can_self_approve`** booleans in `DispatchOrderSerializer` drive button visibility — no client-side role check needed.
4. **Shortage reason field** must appear and be required when `quantity < store_row.remaining_quantity` — validate client-side before submit to give immediate feedback, but backend enforces it too.
5. **Idempotency-Key header** on `POST /gins/:id/confirm` — generate a UUID per confirm attempt and store it; safe to retry on network failure.
6. **Exchange order detection** — read `exchange_order: true` from `DispatchOrderSerializer`; do not infer from destination types client-side.
7. **Waybill is auto-generated** on authorization confirm — no separate waybill creation step needed. Read `auto_generated_gin_id` from `WaybillSerializer` after driver confirm.
8. **Polling / refresh** — after `POST /gins/:id/confirm`, re-fetch the dispatch order to get the updated `status` (may be `completed`).
