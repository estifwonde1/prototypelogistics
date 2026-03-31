# Planner E2E Backend and Frontend Execution Plan

## Purpose

This document explains how planner-first logistics flow is implemented in the current backend and how the frontend should execute the rollout to deliver complete end-to-end flow.

## Legacy Reference Extract (What Was Missing)

From legacy `cats_warehouse-main (1)`:

- Planner/officer roles existed (`dispatch_planner`, `hub_and_dispatch_officer`, `hub_and_dispatch_approver`, etc.).
- Dispatch planning was modeled via dispatch plans and dispatch plan items.
- Hub authorization was modeled with source/destination authorization types.
- Plan item lifecycle included authorization progression before dispatch execution.

In current backend before this migration:

- Execution documents existed (`GRN`, `GIN`, `Inspection`, `Waybill`, dispatch read endpoints).
- Planner-centric APIs and explicit authorization lifecycle were not exposed in this engine.

## Current Backend Architecture (Implemented)

### Roles and Access

Added planner/officer role support in warehouse module constants and access checks:

- `Dispatch Planner`
- `Hub Dispatch Officer`
- `Hub Dispatch Approver`

These are now recognized by policy and access context logic alongside existing operational roles.

### New Planning Domain Models

Added warehouse-facing models over core tables:

- `Cats::Warehouse::DispatchPlan` (`cats_core_dispatch_plans`)
- `Cats::Warehouse::DispatchPlanItem` (`cats_core_dispatch_plan_items`)
- `Cats::Warehouse::HubAuthorization` (`cats_core_hub_authorizations`)

Planner status model for plan items:

- `Unauthorized`
- `Source Authorized`
- `Destination Authorized`
- `Dispatchable`

### New APIs

Planner APIs:

- `GET /cats_warehouse/v1/dispatch_plans`
- `GET /cats_warehouse/v1/dispatch_plans/:id`
- `POST /cats_warehouse/v1/dispatch_plans`
- `PATCH /cats_warehouse/v1/dispatch_plans/:id`
- `POST /cats_warehouse/v1/dispatch_plans/:id/approve`
- `GET /cats_warehouse/v1/dispatch_plan_items`
- `GET /cats_warehouse/v1/dispatch_plan_items/:id`
- `POST /cats_warehouse/v1/dispatch_plan_items`
- `PATCH /cats_warehouse/v1/dispatch_plan_items/:id`

Authorization APIs:

- `GET /cats_warehouse/v1/hub_authorizations`
- `GET /cats_warehouse/v1/hub_authorizations/:id`
- `POST /cats_warehouse/v1/hub_authorizations`

Dispatch creation API added:

- `POST /cats_warehouse/v1/dispatches`

### Status Transition Hook

When a hub authorization is created:

- Source auth sets plan item to `Source Authorized`.
- Destination auth sets plan item to `Destination Authorized`.
- If both exist, plan item becomes `Dispatchable`.

### Execution Gating (Planner -> Operations)

Dispatch and waybill creation are now blocked unless the referenced dispatch plan item is fully authorized (`Dispatchable`).

This guarantees:

- No execution starts from unauthorized planning data.
- Planner + hub authorization stages are completed first.

## Backend Rollout Steps

1. Seed/add new roles in environments (`Dispatch Planner`, `Hub Dispatch Officer`, `Hub Dispatch Approver`).
2. Assign hub-based responsibilities using user assignments for officer/approver roles.
3. Integrate frontend planner module with new planning and authorization APIs.
4. Enforce operational creation through dispatch plan items only.
5. Run E2E tests for planner -> authorization -> dispatch -> waybill -> GRN/GIN/inspection.

## Frontend Execution Plan

## M1 - Planner Foundation

- Add planner nav/menu module.
- Build dispatch plan list/detail/create/edit screens.
- Build dispatch plan item list/create/edit screens.
- Show plan and item statuses clearly.

## M2 - Hub Authorization

- Build hub authorization queue with filters:
  - by `dispatch_plan_item_id`
  - by hub/store
  - by authorization stage
- Add source/destination authorization actions.
- Display per-item authorization progress badge (`Unauthorized`/`Source`/`Destination`/`Dispatchable`).

## M3 - Execution Gating Integration

- Dispatch create screen consumes only dispatchable plan items.
- Waybill create flow validates dispatch is tied to dispatchable item.
- Show actionable validation errors when not dispatchable.

## M4 - Operations Continuation

Keep existing warehouse execution flow as-is after gating passes:

- `GRN -> Inspection -> GIN -> Waybill -> destination GRN`
- stock balances and bin card reporting continue through current ledger pipeline.

## M5 - UAT and Rollout

- Pilot with one planner + one hub officer + one hub approver.
- Validate complete cycle times and authorization bottlenecks.
- Roll out to all hubs after sign-off.

## API Contract Notes for Frontend

- Always send payloads under `payload`.
- For dispatch creation, include `dispatch_plan_item_id`.
- For authorization creation, include:
  - `dispatch_plan_item_id`
  - `authorization_type` (`Source` or `Destination`)
  - `store_id`, `quantity`, `unit_id`, `authorized_by_id`
- Treat non-dispatchable errors as user-facing workflow blockers, not generic failures.

## QA Checklist

- Planner can create plan and items.
- Officer can create source authorization.
- Approver can create destination authorization.
- Plan item auto-transitions to `Dispatchable` when both exist.
- Dispatch creation fails before dispatchable state.
- Dispatch creation succeeds after dispatchable state.
- Waybill creation fails when dispatch references non-dispatchable item.
- Existing GRN/GIN/Inspection confirmation behavior remains intact.

## Known Verification Constraint

Local request spec for planner flow was added, but test execution currently reports pending migrations in test DB environment. Run test DB migrations first, then execute:

`bundle exec rspec spec/requests/cats_warehouse/planner_flow_spec.rb`

