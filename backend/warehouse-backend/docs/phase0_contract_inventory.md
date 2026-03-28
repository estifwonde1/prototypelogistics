# Phase 0 Contract Inventory

This document captures the warehouse contract baseline locked during Phase 0.

## Canonical Wire Rules

- Success envelope: `{ success: true, data: ... }`
- Error envelope: `{ success: false, error: { message, details? } }`
- Mutation requests: `{ payload: ... }`
- API field naming: `snake_case`

## Current Contract Baseline

| Area | Canonical Request | Canonical Response | Notes |
| --- | --- | --- | --- |
| Auth | `payload.email`, `payload.password` | `data.token`, `data.user_id`, `data.role` | Frontend must fail closed on unknown role |
| Admin users | `payload.*` | `data.user` | Nested response shape is intentional |
| Admin assignments | `payload.*` | `data.assignments` | Role-specific assignment ids remain scoped |
| Locations | Query params or `payload.*` | `data.locations` | List payload remains nested |
| Facilities | `payload.*` | `data` resource serializer | Warehouse upload remains multipart exception |
| GRN / GIN / Inspection | `payload.items` | `data.{resource}_items` | Legacy `*_items` request aliases temporarily normalized |
| Waybill | `payload.items`, `payload.transport` | `data.waybill_items`, `data.waybill_transport` | Legacy request aliases temporarily normalized |
| Receipts / Dispatches | read-only | `data` serializer | Sourced from `cats_core` |
| Stock / Reports | query params | `data` list serializer | Scope remains policy-driven |

## Locked Enums

- Document statuses: `Draft`, `Confirmed`
- Roles:
  - `Admin`
  - `Superadmin`
  - `Hub Manager`
  - `Warehouse Manager`
  - `Storekeeper`
  - `Inspector`
  - `Dispatcher`

## Known Phase 0 Safety Decisions

- Backend remains authoritative for authorization.
- Frontend no longer falls back to `admin` when the login role is unknown.
- Unsupported or unverified role workflows remain hidden in the UI until backend enforcement exists.
- Production-like environments must set `VITE_API_BASE_URL` and backend `ALLOWED_ORIGINS`.
