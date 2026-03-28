# Warehouse Backend API — Frontend Integration Guide

This guide is for frontend engineers integrating with the Warehouse Backend API. It explains what the system does, how to authenticate, what endpoints exist, and how to call them safely.

## Project Overview

This backend powers warehouse operations: hubs, warehouses, stores, stock movements, and warehouse documents like GRN, GIN, Inspections, and Waybills.

Frontend apps interact with it through REST APIs. The system is designed so that the frontend can:

- Read warehouse data (hubs, warehouses, stores, stacks, stock balances)
- Create and confirm warehouse documents (GRN, GIN, Inspection, Waybill)
- Manage users and locations (admin only)

## Backend Architecture (High Level)

- **Rails API**: Main backend app
- **Warehouse Engine**: A modular Rails engine mounted inside the API
- **CATS Core**: Shared core models (users, locations, commodities, etc.)

You only need to know the API paths and data models — the engine structure is internal.

## Getting Started for Frontend Developers

### Base API URL

Local development:

- `http://localhost:3000`

Warehouse engine routes are under:

- `/cats_warehouse/v1/...`

### Authentication

The backend supports **token-based auth** via a login endpoint.

- `POST /cats_warehouse/v1/auth/login`
- Returns a token (`token`) that you pass as:
  - `Authorization: Bearer <token>`

### Required Headers

- `Content-Type: application/json`
- `Authorization: Bearer <token>`

### Example Login Request

```bash
curl -X POST http://localhost:3000/cats_warehouse/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cats.com","password":"Password1!"}'
```

## Seeded Users (Dev)

These users exist after running `bundle exec rails db:reset`. All passwords are **`Password1!`**.

| Role | Email | Purpose |
|---|---|---|
| Admin | `admin@cats.com` | Full admin access (users, locations) |
| Hub Manager | `hub.manager@cats.com` | Manages hubs only |
| Warehouse Manager | `warehouse.manager@cats.com` | Manages warehouses, stores, stacks, GRN/GIN/inspections/waybills, stock balances |
| Storekeeper (Receiver) | `receiver@cats.com` | GRN + stock receive flows |
| Storekeeper (Issuer) | `issuer@cats.com` | GIN + stock issue flows |
| Inspector | `inspector@cats.com` | Inspections + GRN visibility |
| Approver | `approver@cats.com` | Warehouse manager permissions (approvals) |
| Dispatcher | `dispatcher@cats.com` | Waybills + GIN visibility |

## What Each Role Can Access

These are the current **menu permissions** and **API access rules**:

- **Admin**
  - Users, locations, and all core setup.
  - Not used for warehouse workflows.
- **Hub Manager**
  - Hubs only.
  - Cannot manage warehouses.
- **Warehouse Manager**
  - Warehouses, stores, stacks, GRN, GIN, inspections, waybills, stock balances.
- **Storekeeper**
  - Stores, stacks, GRN, GIN, stock balances.
- **Inspector**
  - Inspections, GRN.
- **Dispatcher**
  - Waybills, GIN.

## API Structure

### Versioning

Warehouse API routes are namespaced:

```
/cats_warehouse/v1/...
```

### Standard Response Format

Success:

```json
{
  "success": true,
  "data": { ... }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "message": "Human-readable error",
    "details": {}
  }
}
```

## Core Concepts (Frontend Perspective)

These are the key entities you’ll see in the API:

- **Hub**: A top-level logistics location.
- **Warehouse**: Physical warehouse under a hub.
- **Store**: Storage unit within a warehouse.
- **Stack**: A specific commodity stock pile inside a store.
- **Stock Balance**: Snapshot of current stock per stack/warehouse.
- **GRN (Goods Received Note)**: Document for incoming stock.
- **GIN (Goods Issue Note)**: Document for outgoing stock.
- **Inspection**: Quality/quantity checks, often tied to GRNs.
- **Waybill**: Dispatch/shipment document for transport.

## Common Workflows

### Fetch Warehouse Data

- `GET /cats_warehouse/v1/hubs`
- `GET /cats_warehouse/v1/warehouses`
- `GET /cats_warehouse/v1/stores`
- `GET /cats_warehouse/v1/stacks`
- `GET /cats_warehouse/v1/stock_balances`

### Create and Confirm GRN

1. `POST /cats_warehouse/v1/grns`
2. `POST /cats_warehouse/v1/grns/:id/confirm`

### Create and Confirm GIN

1. `POST /cats_warehouse/v1/gins`
2. `POST /cats_warehouse/v1/gins/:id/confirm`

### Create and Confirm Inspection

1. `POST /cats_warehouse/v1/inspections`
2. `POST /cats_warehouse/v1/inspections/:id/confirm`

### Create and Confirm Waybill

1. `POST /cats_warehouse/v1/waybills`
2. `POST /cats_warehouse/v1/waybills/:id/confirm`

## Example API Requests

### Using `fetch`

```js
const res = await fetch("http://localhost:3000/cats_warehouse/v1/hubs", {
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  }
});
const data = await res.json();
```

### Using `axios`

```js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  }
});

const hubs = await api.get("/cats_warehouse/v1/hubs");
```

### Using `curl`

```bash
curl http://localhost:3000/cats_warehouse/v1/stock_balances \
  -H "Authorization: Bearer <token>"
```

## Error Handling

Typical errors you may see:

- `401 Unauthorized`: Missing/invalid token
- `403 Forbidden`: Role does not have permission
- `422 Unprocessable Entity`: Validation errors

Frontend should:

- Show friendly validation messages for 422s
- Handle 401s by redirecting to login
- Handle 403s by hiding unauthorized UI routes

## Development & Testing

### Run Backend Locally

```bash
bundle exec rails db:reset
bundle exec rails s
```

### Local API URL

- `http://localhost:3000`

### Test Endpoints

You can use Postman or curl to hit the endpoints listed above.

## Best Practices for Frontend Integration

- Use a shared API client (`fetch` or `axios`) with the auth token.
- Handle pagination if an endpoint returns large lists.
- Always show loading states for API calls.
- Centralize error handling so validation and auth errors are consistent.

