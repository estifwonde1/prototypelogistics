# Unified officer dispatch — frontend implementation tracker



This document tracks **frontend** work for **officer allocation-based dispatch orders** and **Warehouse / Hub Manager** authorization flows. The canonical API and payloads are defined in [dispatcharchitecture.md](../dispatcharchitecture.md) (served under `/cats_warehouse/v1/`).



## Backend notes (read before integrating)



| Topic | Detail |

|--------|--------|

| Auth | `Authorization: Bearer <token>` on all requests. |

| Writes | JSON body uses a top-level **`payload`** object. |

| Success shape | `{ "success": true, "data": ... }` |

| Error shape | `{ "success": false, "error": { "message", "code?", "details?" } }` — stock errors use `code: "INSUFFICIENT_STOCK"`. |

| Officer lookups pagination | Response `meta` uses **`total_count`** (and `page`, `per_page`). |

| Feature flag | `ENABLE_OFFICER_DISPATCH_V2` — when `"false"`, several allocation routes return `404` + `FEATURE_DISABLED`. |

| Update order | Use **`PATCH`** `/dispatch_orders/:id` for draft updates. |

| Officer reference | **`dispatch_reference`** (e.g. `DR-01`) — officer-entered label; not the system `reference_no`. |

| System number | **`reference_no`** — assigned as `DO-{id}` when the allocation draft is created. |



## Implementation status checklist



### Officer — unified dispatch (replaces separate “Plan dispatch v2” nav)



- [x] Single entry: **New dispatch order** → [`OfficerDispatchOrderWizard.tsx`](../frontend/src/pages/officer/OfficerDispatchOrderWizard.tsx) at `/officer/dispatch-orders/new` and `/officer/dispatch-orders/:id/edit`.

- [x] Legacy single-warehouse orders edit at `/officer/dispatch-orders/:id/edit-legacy` via [`LegacyDispatchOrderFormPage.tsx`](../frontend/src/pages/officer/LegacyDispatchOrderFormPage.tsx).

- [x] `/officer/dispatch-orders/plan/*` redirects to unified routes.

- [x] Stepper UX: Food/Non-food → commodity → **Sources** (total jurisdiction availability → line quantity capped at total → split across warehouses) → destinations → add line; save full order.
- [x] **Multi-line local draft** (new order): build several commodity lines on one page; **dispatch reference** and **description** persist (and `sessionStorage` on reload); **Edit** / **Delete** on each line before **Create draft**; **Update line** when editing an existing line in the wizard.

- [x] [`dispatchLookups.ts`](../frontend/src/api/dispatchLookups.ts) — `getWarehousesForCommodityLookup`.

- [x] [`dispatchOrders.ts`](../frontend/src/api/dispatchOrders.ts) — `dispatch_reference` on create/update payloads.



### Storekeeper — outbound dispatches

- [x] **Outbound Dispatches** list + detail at `/storekeeper/dispatch-authorizations` ([`StorekeeperDispatchListPage.tsx`](../frontend/src/pages/storekeeper/StorekeeperDispatchListPage.tsx), [`StorekeeperDispatchDetailPage.tsx`](../frontend/src/pages/storekeeper/StorekeeperDispatchDetailPage.tsx)).
- [x] Execution, driver confirm, stack allocation, and GIN confirm API clients in [`dispatchOrderAuthorizations.ts`](../frontend/src/api/dispatchOrderAuthorizations.ts) and [`gins.ts`](../frontend/src/api/gins.ts).
- [x] Sidebar nav item separate from Driver Arrivals (receipts).

### Warehouse / Hub manager — authorizations (unchanged)



- [x] Authorization list/create/detail under `/warehouse/dispatch-authorizations` and `/hub/dispatch-authorizations` — WM inbox, guided form, detail with waybill summary.



### Polish / QA (ongoing)



- [ ] Field-level mapping for all `JURISDICTION_VIOLATION` `details` entries (optional UX).

- [ ] E2E or integration tests against running Rails.

- [ ] Notifications deep links (storekeeper) — follow-up.



---



## Ordered flow for developers (happy path)



1. **Officer** opens **New dispatch order**, enters **`dispatch_reference`** (e.g. `DR-01`) and optional description (kept while adding more commodities).

2. **Officer** adds commodity lines:
   - **Commodity** — pick from admin catalog (Food / Non-food).
   - **Sources** — `GET .../warehouses_for_commodity?commodity_definition_id=` returns per-warehouse rows plus `meta.total_available_quantity` and `meta.unit_abbreviation`. If `has_inventory_lots === false` or no positive stock in jurisdiction, show **Commodity unavailable** with back to commodity. Otherwise: unit → total available card → line quantity (max = total) → allocate source rows (sum must equal line qty; each row ≤ warehouse avail).
   - **Destinations** — optional **Destination type** filter (`All` / `Warehouses only` / `FDPs only`); federal officers may also filter by hub. Officers select each destination, **enter qty manually** (no auto-fill), with live **Distributed / Remaining** vs line qty; each row is a unique location; **Add line** enabled only when destination qtys sum to line qty. Progress is cached in `sessionStorage` (reload restores step and allocations; **Back** to Sources keeps destination rows). Per-row destination search (no shared dropdown state).

3. **Officer** repeats step 2 for each commodity (lines list grows; edit/delete lines before saving). When ready, **Create draft**: `POST /dispatch_orders` with `payload.dispatch_reference` and `payload.lines[]`. Response includes `reference_no` (`DO-{id}`) and nested lines.

4. **Officer** edits draft: `PATCH /dispatch_orders/:id` with `lines` (and `description`).

5. **Officer** confirms the order (confirm = approve for v2; no separate self-approve button).

6. **Warehouse manager** opens **Dispatch authorizations** → **Confirmed dispatch orders awaiting your authorization** (not the authorization status filter). Clicks **Authorize at warehouse** for each confirmed order where this warehouse is a source.



---



## API quick reference (officer slice)



| Method | Path | Query / body (payload keys) |

|--------|------|-----------------------------|

| GET | `/dispatch_orders/lookups/source_warehouses` | `q`, `page`, `per_page` |

| GET | `/dispatch_orders/lookups/warehouses_for_commodity` | **`commodity_id`**, `unit_id?` |

| GET | `/dispatch_orders/lookups/destinations` | `q`, `page`, `per_page`, `exchange_only?`, `destination_kind?` (`all` \| `warehouse` \| `fdp`), `hub_id?` (federal/admin). Returns warehouse destinations from `Warehouse` records (warehouses first, then FDPs). |
| GET | `/dispatch_orders/lookups/warehouses_for_commodity` | **`commodity_definition_id`**, `unit_id?` — response `meta`: `total_available_quantity`, `unit_abbreviation`, `has_inventory_lots`, `commodity_name` |
| POST | `/dispatch_orders` | **`dispatch_reference`**, `description?`, `lines[]` with **`commodity_definition_id`**, allocations + packaging |

| PATCH | `/dispatch_orders/:id` | `description?`, `lines[]` (draft only) |

| POST | `/dispatch_orders/:id/confirm` | no body |

| POST | `/dispatch_orders/:id/self_approve` | no body |



See [dispatcharchitecture.md](../dispatcharchitecture.md) for manager, waybill, GIN, and storekeeper endpoints.


