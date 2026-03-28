# WMS MVP and Standardization Roadmap

## 1. Executive Summary

The current system is a modular warehouse platform composed of a Rails 7 API backend with a mounted `cats_warehouse` engine and a React 19 + TypeScript frontend SPA. It already supports a meaningful subset of warehouse operations, especially facility setup, role assignment, stock-facing document workflows, and role-aware UI navigation. However, it is not yet a fully functional, production-ready warehouse management system.

The target end state is a production-ready, standard WMS that provides stable inventory control, operator-friendly workflows, strong security and deployment posture, reliable observability, and the operational depth expected in a mature warehouse product.

For this codebase, the **MVP** is the minimum deployable WMS that supports:

- secure login and role-scoped access
- facility setup across hub, warehouse, store, and stack
- GRN, GIN, and inspection workflows with stock mutation
- stock visibility through balances and bin card
- assignment-driven data scoping
- stable backend/frontend deployment and baseline quality gates

## 2. Current State Assessment

### Backend

#### Implemented domains and workflows

- Authentication through `POST /cats_warehouse/v1/auth/login`
- Admin management for users, roles, and assignments
- Master data and facility hierarchy:
  - regions, zones, woredas
  - hubs
  - warehouses
  - stores
  - stacks
  - geos
- Warehouse support records:
  - capacities
  - accesses
  - contacts
  - infra
- Operational document workflows:
  - GRN
  - GIN
  - inspection
  - waybill
- Stock visibility:
  - stock balances
  - stack transactions / bin card reporting
- Read access into receipts and dispatches sourced from `cats_core`

#### Current strengths

- Domain boundaries are clearer than a flat Rails app because warehouse logic is isolated in a mountable engine.
- The backend already uses service objects for core stock-affecting confirmations.
- Pundit is present and policy scopes are now part of the access approach.
- Inventory integrity has been strengthened with non-negative checks, row locking, and unique stock-balance keys.
- Seed data includes realistic users, roles, facilities, commodities, and locations for local/staging testing.

#### Current limitations

- The backend still depends heavily on `cats_core`, which is useful but creates coupling around users, locations, commodities, receipts, dispatches, and transporters.
- Standard WMS workflows such as adjustments, transfers, reservations, picking, replenishment, and cycle counting are not implemented end-to-end.
- Notifications are only an integration starting point, not a complete production alerting/event model.
- Some workflows are document-centric rather than task-centric, which limits warehouse execution depth.

#### Current backend state classification

| Area | Status | Notes |
| --- | --- | --- |
| Facility setup | Implemented and usable | Hubs, warehouses, stores, stacks, geos, support records exist |
| User/role assignment | Implemented and usable | Admin endpoints and seeded users exist |
| GRN/GIN/inspection/waybill lifecycle | Partially implemented | Core create/confirm exists, but not all standard WMS behaviors are covered |
| Inventory correctness | Partially implemented | Ledger and integrity checks exist, but no full adjustment/transfer/count model |
| Notifications/integrations | Partially implemented | Delivery path exists, but not yet a full production integration strategy |

### Frontend

#### Implemented pages and modules

- Authentication page and persisted auth state
- Dashboard
- Facility setup and maintenance pages:
  - hubs
  - warehouses
  - stores
  - stacks
  - stack layout
- Admin pages:
  - users
  - assignments
  - setup/location flows
- Operational pages:
  - GRN list, create, detail
  - GIN list, create, detail
  - inspection list, create, detail
  - waybill list, create, detail
  - receipts
  - dispatches
  - stock balances
  - bin card report

#### Current user journeys

- Login persists token and role using Zustand.
- React Router and sidebar menus gate access by normalized role slug.
- Most pages use TanStack Query for data loading and Axios wrappers for API access.
- Core forms support CRUD-style editing, but several workflows are still admin/data-entry oriented instead of operator-first.

#### Role-driven navigation and permission behavior

- Admin and superadmin are treated as fully privileged in the UI.
- Hub manager, warehouse manager, storekeeper, inspector, and dispatcher are controlled through a frontend permission matrix.
- Route visibility, menu visibility, and action availability are all role-conditioned.

#### Current UX and contract limitations

- Several forms rely on raw IDs or loosely typed inputs instead of strongly guided selectors.
- Some frontend payload shapes do not match backend strong params for core document workflows.
- Status/value normalization is inconsistent.
- Some derived domain values are still collected as user input.
- Client-side permissions can drift from backend authorization unless centrally enforced.

#### Current frontend state classification

| Area | Status | Notes |
| --- | --- | --- |
| Auth and route guarding | Implemented and usable | Token persistence and protected routing exist |
| Facility pages | Implemented and usable | CRUD and details are present |
| Document pages | Partially implemented | Present in UI, but some payloads and role assumptions are inconsistent |
| Operator UX | Partially implemented | Usable for controlled flows, not yet optimized for execution efficiency |
| Testing/quality posture | Partially implemented | Build works, but lint/test discipline is not yet mature |

### Fully working vs partial vs inconsistent

#### Implemented and usable

- Hub, warehouse, store, stack setup
- Admin user and assignment management
- Authentication and protected route shell
- Stock balance and bin card visibility
- Backend document confirmation skeletons

#### Partially implemented

- GRN, GIN, inspection, and waybill end-to-end operations
- Notifications and event delivery
- Role alignment across frontend and backend
- Deployment hardening and observability

#### Present but inconsistent

- Frontend payload shapes vs backend contracts
- Frontend role permissions vs backend policy scopes
- Status casing and enum usage
- Some derived capacity and dimensional fields

## 3. Functional Coverage

| WMS Capability Area | Classification | Current State |
| --- | --- | --- |
| Facility and location setup | Implemented and usable | Full hierarchy and support records exist |
| User/role assignment | Implemented and usable | Admin management and scoped assignments are in place |
| Inbound receiving | Partially implemented | GRN exists, confirm impacts stock, but receiving UX and inbound control depth are limited |
| Inspections and exception handling | Partially implemented | Inspection create/confirm exists, but workflow and role coverage need refinement |
| Outbound issue/shipping | Partially implemented | GIN and waybill exist, but broader outbound execution is incomplete |
| Stock visibility and movement history | Implemented and usable | Stock balances and bin card are available |
| Internal transfers | Missing | No full transfer workflow yet |
| Adjustments and cycle counts | Missing | Inventory adjustment model exists historically, but no complete live feature flow |
| Reservation/allocation | Missing | Not supported end-to-end in current warehouse engine |
| Picking/packing/staging/loading | Missing | No warehouse task execution model |
| Lot/batch/expiry handling | Partially implemented | Commodity records carry batch/expiry-related data, but not enforced as warehouse rules across flows |
| Reporting and dashboards | Partially implemented | Dashboard and bin card exist, but KPI/report breadth is limited |
| Integrations/notifications | Partially implemented | Delivery mechanism exists, but not mature for enterprise integrations |
| Auditability and traceability | Partially implemented | Ledger and document history exist, but not a full audit and exception review system |

## 4. Architecture and Technical Assessment

### Backend architecture

- Style: modular monolith
- Host app responsibilities:
  - application config
  - database config
  - engine mounting
  - environment/runtime setup
- `cats_warehouse` engine responsibilities:
  - warehouse domain models
  - controllers
  - policies
  - serializers
  - workflow services
  - jobs
- `cats_core` responsibilities:
  - users
  - roles
  - locations
  - commodities
  - receipts
  - dispatches
  - transporters

### Backend API style and data flow

- JSON API with a `payload` request envelope and `{ success, data }` response envelope
- Main flow:
  - request
  - auth
  - policy scope
  - controller strong params
  - service/model transaction
  - serializer
  - JSON response
- Stock mutations are centered on ledger-style operations through backend services.

### Database and data flow

- PostgreSQL is the primary system of record.
- Warehouse-specific tables hold facility, document, balance, and ledger records.
- `cats_core` tables remain authoritative for cross-domain references.
- Current data flow is synchronous for core workflows, with background-job integration beginning to exist for notifications.

### `cats_core` dependency boundaries

Keep `cats_core` authoritative for:

- locations
- users
- roles
- commodities
- transporters
- upstream receipt/dispatch source records

Keep warehouse engine authoritative for:

- hub/warehouse/store/stack physical model
- warehouse document workflow
- inventory balance and stack transaction ledger
- assignment-driven warehouse access and operational validation

### Frontend architecture

- Vite + React 19 + TypeScript SPA
- Mantine component library
- React Router 7 for routing
- TanStack Query for server state
- Zustand for auth state persistence
- Axios for API access and interceptor-based auth/error handling

### Frontend routing, state, network, and permission design

- Route tree is centralized and lazy-loaded.
- Auth state stores token, user id, and normalized role.
- API client attaches bearer token and handles global error notifications.
- Permissions are computed client-side and used by:
  - route guards
  - sidebar/menu visibility
  - action gating

### Frontend integration model

- Thin API modules wrap backend endpoints.
- Query and mutation hooks are page-local in many cases.
- Some transformations are handled in API wrappers, but not all contracts are typed strictly enough to prevent drift.

### Operational and deployment architecture

Present artifacts:

- Backend:
  - `Dockerfile`
  - `docker-compose.yml`
  - `kamal` binaries
  - `.env` and `.env.example`
- Frontend:
  - `Dockerfile`
  - `nginx.conf`
  - `.env` and `.env.example`
  - `vite.config.ts`

Current readiness gaps:

- CORS is still localhost-oriented.
- Frontend production fallback API URL still points to localhost if not configured.
- Observability, monitoring, alerting, and background job operations are not yet mature enough for broad production rollout.
- Environment-driven deployment discipline exists only partially and must be hardened.

## 5. Gap Analysis With Priority

### High Priority

| Gap | Why It Matters | Impacted Subsystem | Consequence If Not Addressed |
| --- | --- | --- | --- |
| Frontend/backend document contract mismatches | Core document workflows can fail or behave inconsistently | Both | Users cannot reliably create GRN, GIN, inspection, or waybill records |
| Role and policy drift | UI may expose unsupported actions or hide valid ones | Both | Authorization defects, broken workflows, and support burden |
| Missing standard inventory controls | A warehouse cannot operate safely without adjustments, transfers, and counts | Backend and frontend | Stock discrepancies accumulate and require manual intervention |
| Deployment/security hardening gaps | Localhost assumptions and incomplete runtime controls are unsafe for production | Ops and both apps | Failed deployments, insecure exposure, and brittle environments |
| Missing standard-WMS workflows | The product remains a document tracker rather than a true WMS | Both | Operational teams cannot run real warehouse execution from the system |

### Medium Priority

| Gap | Why It Matters | Impacted Subsystem | Consequence If Not Addressed |
| --- | --- | --- | --- |
| Weakly typed API integration | Contract drift remains easy to reintroduce | Frontend | Regressions appear after backend changes |
| Operator UX inefficiency | Warehouse workflows need fast and guided execution | Frontend | Slower adoption and more input mistakes |
| Limited reporting and KPI depth | Supervisors need operational visibility | Both | Reduced control and poorer decision-making |
| Coupling to `cats_core` | Shared dependencies complicate domain evolution | Backend | Slower change velocity and riskier refactors |

### Low Priority

| Gap | Why It Matters | Impacted Subsystem | Consequence If Not Addressed |
| --- | --- | --- | --- |
| Bundle/performance tuning | Important at scale but not the first blocker | Frontend | Gradual UX degradation rather than immediate failure |
| Visual and workflow polish | Valuable for adoption but secondary to correctness | Frontend | Lower operator efficiency and perceived quality |
| Advanced reporting/export breadth | Needed for maturity, not Day 1 | Both | Teams rely on external spreadsheets longer than ideal |

## 6. Phased Delivery Plan

### Phase Summary

| Phase | Objective | Deployable Outcome |
| --- | --- | --- |
| Phase 0 | Stabilize and lock contracts | Internally testable staging-ready build |
| Phase 1 | Deliver MVP WMS | Pilot-ready WMS for limited operational use |
| Phase 2 | Expand core inventory control | Inventory-safe system without DB-level correction for common exceptions |
| Phase 3 | Add advanced operations and hardening | Broad production rollout readiness |
| Phase 4 | Reach full standard WMS maturity | Complete standard-WMS operational coverage |

### Phase 0: Stabilization and Contract Lock

**Objective**

Make the current system consistent, testable, and safe to build on.

**User value**

Teams can use the current workflows without fighting payload mismatches, role inconsistencies, or broken deployment assumptions.

**Major features**

- lock backend request and response contracts
- align frontend payloads for GRN, GIN, inspection, and waybill
- normalize status and enum handling
- align frontend role capability matrix with backend policy scopes
- eliminate runtime configuration pitfalls:
  - localhost-only CORS assumptions
  - localhost production API fallbacks
- make baseline quality gates pass:
  - backend tests
  - frontend build
  - frontend lint

**Dependencies**

- no functional dependencies; this is the foundation phase

**Readiness and deployability criteria**

- core current workflows execute in staging
- contract mismatches are removed
- role visibility and API authorization align
- frontend build and lint pass
- backend request suite passes
- production env configuration no longer depends on localhost defaults

**Why this ordering avoids rework**

Contract and role stabilization prevents every later phase from being built on moving or contradictory behavior.

### Phase 1: MVP WMS

**Objective**

Deliver the smallest production-credible warehouse system for real inbound, inspection, outbound, and stock visibility workflows.

**User value**

Warehouse teams can operate real stock movement and see accurate inventory without relying on manual reconciliation for every transaction.

**Major features**

- facility hierarchy finalized:
  - hub
  - warehouse
  - store
  - stack
- assignment-based roles working end-to-end
- GRN create/confirm with stock increase
- GIN create/confirm with stock decrease
- inspection create/confirm with stock impact for damaged/lost quantities
- stock balances and bin card
- guided operator flows and better selectors instead of raw IDs

**Dependencies**

- Phase 0 complete

**Readiness and deployability criteria**

- inbound, inspection, and outbound loop works end-to-end
- role-scoped data access behaves correctly
- inventory movements are traceable
- pilot users can complete warehouse basics without manual DB fixes

**Why this ordering avoids rework**

It converts the existing scaffold into a usable product before adding deeper inventory and warehouse execution complexity.

**Current implementation status**

- Core code status: mostly implemented
- Automated workflow proof: green
  - focused request suite covers:
    - GRN confirm and stock increase
    - inspection adjustment and stock reduction
    - GIN negative-stock protection
    - assignment-scoped stock visibility
    - storekeeper draft/create vs confirm restriction
- Guided operator UX: mostly implemented
  - GRN, inspection, and GIN flows now use guided selectors for the main workflow path
  - receipt-backed GRN source selection now exposes commodity identity
  - confirm screens invalidate stock balance and bin card queries after successful confirmation
- Remaining signoff work:
  - run and record the manual UI smoke loop
  - capture stock balance and bin card evidence in the UI
  - confirm no pilot-blocking UX issue remains in real operator use

**Phase 1 signoff rule**

Treat Phase 1 as complete only when both are true:

- automated workflow proof is green
- manual UI smoke evidence is completed and passed

### Phase 2: Core Inventory Control Expansion

**Objective**

Move from basic document-led inventory to operational inventory control.

**User value**

Teams can manage discrepancies, transfers, and planned stock allocation without leaving the system.

**Major features**

- inventory adjustments
- internal transfers across stack/store/warehouse boundaries as supported
- cycle counts and reconciliation
- reservation/allocation foundation
- stronger stock exception handling and operational traceability

**Dependencies**

- Phase 1 stable inventory ledger and scoped access model

**Readiness and deployability criteria**

- no common discrepancy workflow requires direct database intervention
- transfer and adjustment flows preserve stock integrity
- count/reconciliation workflows can close inventory gaps in-app

**Why this ordering avoids rework**

Inventory controls depend on a stable ledger and validated baseline operations from the MVP phase.

### Phase 3: Advanced Operations and Production Hardening

**Objective**

Add the operational and platform capabilities required for broader production rollout.

**User value**

Supervisors and operators gain more complete warehouse execution support, while engineering gains the runtime safeguards needed for scale.

**Major features**

- picking, packing, staging, and loading foundations
- richer reporting and dashboards
- event/webhook integration maturity
- observability:
  - structured logs
  - metrics
  - queue health visibility
- security hardening
- deployment and recovery readiness

**Dependencies**

- Phase 2 inventory control primitives

**Readiness and deployability criteria**

- advanced warehouse flows are operationally usable
- failures in async/integration paths are observable and recoverable
- deployment, monitoring, and rollback practices are in place

**Why this ordering avoids rework**

Execution-task workflows and production hardening should sit on top of stable inventory control rather than compete with foundational fixes.

### Phase 4: Full Standard WMS Maturity

**Objective**

Complete the transition from a production-capable warehouse application into a full standard WMS.

**User value**

Operators, supervisors, and adjacent enterprise systems can rely on the platform for end-to-end warehouse execution and control.

**Major features**

- directed putaway
- replenishment rules
- wave and batch picking
- packing and shipment staging
- barcode, QR, and mobile scan workflows
- FEFO and FIFO enforcement where applicable
- lot, batch, and expiry-first operational controls
- reservation and allocation strategy completion
- supervisor exception queues and approvals
- advanced KPI dashboards and export/reporting
- ERP/TMS integration-grade interoperability
- operational resilience maturity:
  - backups
  - disaster recovery
  - monitoring
  - incident playbooks
  - queue health
  - SLOs

**Dependencies**

- Phase 3 advanced operations and runtime maturity

**Readiness and deployability criteria**

- the system supports standard WMS execution patterns rather than only document CRUD
- scan-driven and rule-driven operations function reliably
- resilience and incident-response processes are proven
- external-system interoperability is validated

**Why this ordering avoids rework**

These capabilities depend on the earlier phases establishing correct stock behavior, operator workflows, and production-grade platform controls.

## 7. Recommendations and Best Practices

### Backend recommendations

- Keep business mutations behind well-defined domain services.
- Treat inventory ledger operations as the single source of truth for stock mutation.
- Centralize enums, transitions, and response contracts.
- Add API contract tests around every mutation endpoint.
- Isolate `cats_core` integration through clear adapters or boundary services where coupling is growing.

### Frontend recommendations

- Centralize capabilities so route guards, sidebar, and page actions read from one permission map.
- Introduce strict DTO typing for every API request and response.
- Replace raw-ID entry workflows with validated selectors and guided forms.
- Treat derived fields as computed/read-only where the backend is authoritative.
- Add component/integration tests for the critical operator flows.

### Deployment and operational recommendations

- Replace localhost assumptions with env-driven configuration only.
- Add structured logging, metrics, and alerting before broad rollout.
- Standardize container and release workflows across frontend and backend.
- Define queue retry policies, dead-letter behavior, and webhook/integration observability.
- Maintain seed-backed staging environments for regression testing.

### Inventory correctness and auditability best practices

- Enforce stock mutation only through ledger operations.
- Use row locking and idempotent confirmation rules for stock-affecting actions.
- Preserve document-to-ledger traceability.
- Add cycle count and reconciliation workflows before scaling operations.
- Model lots, expiry, and allocation rules explicitly when Phase 4 maturity begins.

### Centralization guidance

Centralize these shared concerns across frontend and backend:

- roles and capabilities
- document status enums
- payload contracts
- serializer/DTO shapes
- validation messages and field semantics

## 8. Effort, Risks, and Assumptions

### Effort estimate

| Phase | Effort |
| --- | --- |
| Phase 0 | Medium |
| Phase 1 | Large |
| Phase 2 | Large |
| Phase 3 | Medium to Large |
| Phase 4 | Large |

### Major risks and tradeoffs

- `cats_core` coupling can slow or complicate changes in warehouse-domain ownership.
- Inventory-control errors have the highest business impact and must take precedence over feature breadth.
- UI/backend drift will continue unless contracts and permissions are centralized.
- Expanding to standard-WMS maturity without operator-centric UX will reduce adoption even if features exist.
- Integration depth increases operational complexity and must be matched with observability.

### Assumptions

- The modular monolith remains the target architecture for the medium term.
- PostgreSQL remains the source of truth.
- Initial deployment targets internal warehouse teams rather than external users.
- Seeded users from `db/seeds.rb` are acceptable default local and staging test identities.
- Phase 4 is the stage that represents complete standard-WMS maturity, not the MVP.
