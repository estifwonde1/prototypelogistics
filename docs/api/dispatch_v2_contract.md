# Dispatch v2 API contract

Backend-owned workflow for officer multi-source/multi-destination dispatch, warehouse authorization, storekeeper execution, and GIN confirmation.

## Feature flag

Set `ENABLE_OFFICER_DISPATCH_V2=true` (default: enabled unless explicitly `false`).

## Write pattern

- Submit **IDs only** for entities (`warehouse_id`, `destination_location_id`, `commodity_id`, `unit_id`, etc.).
- Submit **text** for `plan_reference`, `description`, `driver_name`, `shortage_reason`, `remarks`.
- Do **not** send derived fields (`base_quantity`, `package_count`, `officer_level`, status).

## Officer: create draft

`POST /cats_warehouse/v1/dispatch_orders`

```json
{
  "payload": {
    "plan_reference": "RP-2026-03-WHEAT-001",
    "description": "Regional wheat movement",
    "lines": [{
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
    }]
  }
}
```

## Officer: self-approve

`POST /cats_warehouse/v1/dispatch_orders/:id/self_approve` (creator only)

## Manager: authorization

`POST /cats_warehouse/v1/dispatch_order_authorizations`

```json
{
  "payload": {
    "dispatch_order_id": 1,
    "warehouse_id": 10,
    "authorized_quantity": 300,
    "transporter_id": 5,
    "driver_name": "Abebe",
    "driver_id_number": "ID-123",
    "truck_plate_number": "AA-12345",
    "store_splits": [
      { "store_id": 3, "commodity_id": 1, "authorized_quantity": 300 }
    ]
  }
}
```

`POST /cats_warehouse/v1/dispatch_order_authorizations/:id/confirm` — auto-generates waybill.

## Storekeeper: execution & GIN

1. `POST /cats_warehouse/v1/dispatch_order_authorizations/:id/executions`
2. `POST /cats_warehouse/v1/dispatch_order_authorizations/:id/driver_confirm`
3. `POST /cats_warehouse/v1/gins/:id/stack_allocations`
4. `POST /cats_warehouse/v1/gins/:id/confirm` with optional header `Idempotency-Key`

## Lookups

| Endpoint | Purpose |
|----------|---------|
| `GET /dispatch_orders/lookups/source_warehouses?q=&page=` | Officer source warehouses |
| `GET /dispatch_orders/lookups/destinations?q=&exchange_only=` | Warehouse + FDP destinations |
| `GET /dispatch_order_authorizations/lookups/stores?warehouse_id=` | Manager store splits |
| `GET /dispatch_order_authorizations/lookups/stacks?store_id=&commodity_id=` | Storekeeper stacks |

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `JURISDICTION_VIOLATION` | 403 | Warehouse/destination outside officer scope |
| `FEATURE_DISABLED` | 404 | v2 endpoints disabled |
| `INVALID_TRANSITION` | 422 | Document lifecycle violation |
