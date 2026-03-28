# WMS Phase Test Protocol

## Purpose

This document defines the phase-by-phase validation protocol for transforming the current warehouse application into a production-ready, standard WMS. It is intended for QA, engineering, and release owners. The protocol is executable even when later-phase features are not yet implemented, because each phase includes the acceptance tests that must pass before that phase can be signed off.

## Target Environments

- Local development
- Shared staging
- Pre-production

## Prerequisites

- Database has been seeded using the current seed file.
- Backend is running and reachable.
- Frontend is running and reachable.
- The active API base URL is known and points to the target backend.
- The browser session is clean before role-based UI tests begin.
- Testers know which environment-specific URLs and credentials apply.

## Default Test Accounts

| Role | Email | Password | Usage |
| --- | --- | --- | --- |
| Admin | `admin@example.com` | `newpassword123` | Setup, assignments, cross-role validation |
| Superadmin | `superadmin@example.com` | `newpassword123` | Full-access verification |
| Hub Manager | `hub_manager@example.com` | `newpassword123` | Hub-scoped operations |
| Warehouse Manager | `warehouse_manager@example.com` | `newpassword123` | Warehouse-scoped operations |
| Storekeeper | `store_keeper@example.com` | `password123` | Store/stock operations |
| Hub Manager 2 | `hub_manager2@example.com` | `newpassword123` | Negative scope tests |
| Warehouse Manager 2 | `warehouse_manager2@example.com` | `newpassword123` | Negative scope tests |
| Storekeeper 2 | `store_keeper2@example.com` | `password123` | Negative scope tests |

If staging or pre-production credentials differ, keep the same role mapping and use environment-specific passwords.

## Global Pass/Fail Rule

- A phase passes only if all mandatory test cases pass and all pass/fail gate checks are satisfied.
- A phase fails if any stock-integrity defect, authorization defect, contract mismatch, or deployment-readiness blocker remains unresolved.

---

## Phase 0

### Objective

Stabilize the current system, align contracts and permissions, and establish baseline deployment and quality readiness.

### Entry Criteria

- Backend and frontend are bootable.
- Seed data is present.
- Current code includes the Phase 0 stabilization changes.

### Test Data / Accounts

- All default accounts
- Existing seeded facilities, commodities, and locations

### Exact Test Cases

#### 1. Test ID: P0-AUTH-001

- **Role / account:** `admin@example.com`
- **Preconditions:** Login page is reachable.
- **Steps:**
  1. Open the frontend login page.
  2. Sign in using the admin account.
  3. Observe redirect target.
- **Expected result:** Login succeeds, token is stored, and the user lands on the admin default route.
- **Fail indicators:** Login fails, role is incorrect, redirect is wrong, or token is not persisted.

#### 2. Test ID: P0-AUTH-002

- **Role / account:** `superadmin@example.com`
- **Preconditions:** Browser session is cleared.
- **Steps:**
  1. Sign in as superadmin.
  2. Navigate to admin pages and at least one warehouse page.
- **Expected result:** Login succeeds and access is granted across all protected areas expected for superadmin.
- **Fail indicators:** Access denied on allowed routes or incomplete session creation.

#### 3. Test ID: P0-AUTH-003

- **Role / account:** `hub_manager@example.com`
- **Preconditions:** Browser session is cleared.
- **Steps:**
  1. Sign in as hub manager.
  2. Observe landing route and visible sidebar items.
- **Expected result:** Only hub-manager-allowed menus and routes are visible.
- **Fail indicators:** Missing allowed routes or visible disallowed routes.

#### 4. Test ID: P0-AUTH-004

- **Role / account:** `warehouse_manager@example.com`
- **Preconditions:** Browser session is cleared.
- **Steps:**
  1. Sign in as warehouse manager.
  2. Open accessible warehouse-related routes.
- **Expected result:** Warehouse manager sees the allowed warehouse workflow routes only.
- **Fail indicators:** Authorization mismatch between UI and backend.

#### 5. Test ID: P0-AUTH-005

- **Role / account:** `store_keeper@example.com`
- **Preconditions:** Browser session is cleared.
- **Steps:**
  1. Sign in as storekeeper.
  2. Open stock-balance and report pages.
  3. Attempt to open an admin route.
- **Expected result:** Stock/report routes are accessible and admin routes are blocked.
- **Fail indicators:** Missing valid access or exposure of restricted routes.

#### 6. Test ID: P0-AUTH-006

- **Role / account:** Any valid user, then anonymous
- **Preconditions:** Active authenticated session exists.
- **Steps:**
  1. Remove or invalidate the auth token.
  2. Trigger a protected API request.
  3. Reload a protected route.
- **Expected result:** API returns unauthorized, session is cleared, and user is redirected to login.
- **Fail indicators:** Silent failures, stale access, or protected data still loading.

#### 7. Test ID: P0-ROUTE-001

- **Role / account:** All default roles
- **Preconditions:** Each role can log in.
- **Steps:**
  1. Log in with each role.
  2. Record visible menu items.
  3. Attempt direct navigation to disallowed routes.
- **Expected result:** Menu visibility, route guards, and backend authorization match for every role.
- **Fail indicators:** Any route visible but forbidden, or hidden but allowed.

#### 8. Test ID: P0-CONTRACT-001

- **Role / account:** `warehouse_manager@example.com`
- **Preconditions:** API tooling or browser devtools available.
- **Steps:**
  1. Create a GRN from the frontend.
  2. Inspect the outgoing payload.
  3. Compare payload keys to backend contract.
- **Expected result:** Payload uses the exact expected keys and request succeeds without manual intervention.
- **Fail indicators:** Wrong payload keys, backend parameter errors, or contract translation hacks.

#### 9. Test ID: P0-CONTRACT-002

- **Role / account:** `warehouse_manager@example.com`
- **Preconditions:** Same as above.
- **Steps:**
  1. Repeat the payload verification for GIN.
  2. Repeat for inspection.
  3. Repeat for waybill.
- **Expected result:** All core document payloads match backend contracts.
- **Fail indicators:** Any mutation depends on mismatched field names or manual request shaping.

#### 9a. Test ID: P0-CONTRACT-003

- **Role / account:** Engineer/QA shell access
- **Preconditions:** Repo contains the Phase 0 contract artifacts.
- **Steps:**
  1. Open `contracts/warehouse/v1/openapi.yaml`.
  2. Open `docs/phase0_contract_inventory.md`.
  3. Confirm the documented payload and enum rules match the running system.
- **Expected result:** Engineers have one canonical contract reference for auth and document workflows.
- **Fail indicators:** Docs and implementation diverge or the contract source is missing.

#### 10. Test ID: P0-CI-001

- **Role / account:** Engineer/QA shell access
- **Preconditions:** Dependencies are installed.
- **Steps:**
  1. Run `bundle exec rspec spec/requests`.
  2. Record result.
- **Expected result:** Request test suite passes.
- **Fail indicators:** Any failing request spec.

#### 11. Test ID: P0-CI-002

- **Role / account:** Engineer/QA shell access
- **Preconditions:** Frontend dependencies are installed.
- **Steps:**
  1. Run `npm run build`.
  2. Record result.
- **Expected result:** Frontend build completes successfully.
- **Fail indicators:** Type, bundling, or compile failures.

#### 12. Test ID: P0-CI-003

- **Role / account:** Engineer/QA shell access
- **Preconditions:** Frontend dependencies are installed.
- **Steps:**
  1. Run `npm run lint`.
  2. Record result.
- **Expected result:** Frontend lint completes successfully with zero blocking errors.
- **Fail indicators:** Any lint error.

#### 13. Test ID: P0-ENV-001

- **Role / account:** Engineer/DevOps
- **Preconditions:** Production-like env config is available.
- **Steps:**
  1. Review frontend API base URL configuration.
  2. Review backend CORS configuration.
  3. Validate startup in a non-localhost target environment.
- **Expected result:** No production behavior depends on localhost defaults, and `VITE_API_BASE_URL` plus backend `ALLOWED_ORIGINS` are explicitly configured for the target environment.
- **Fail indicators:** Localhost fallback is required for production runtime.

### Expected Results

- Auth, routing, and permissions are consistent.
- Document payload contracts are aligned.
- Backend tests pass.
- Frontend build and lint pass.
- Deployment configuration is environment-safe.

### Pass/Fail Criteria

| Gate | Pass Condition |
| --- | --- |
| Authentication | All seeded roles log in successfully |
| Authorization | Route/menu/API behavior matches role expectations |
| Contract alignment | GRN, GIN, inspection, and waybill requests match backend contract |
| Quality baseline | Backend request tests, frontend build, and frontend lint all pass |
| Runtime config | No localhost-only production assumptions remain |

### Exit Criteria

- Phase 0 is complete only when all pass gates above are satisfied and no manual payload/DB fixes are required for current supported flows.

---

## Phase 1

### Objective

Validate the MVP WMS as a usable pilot system for facility setup, inbound, inspection, outbound, and stock visibility.

### Entry Criteria

- Phase 0 has passed.
- Role assignments are available or can be created by admin.

### Test Data / Accounts

- `admin@example.com`
- `warehouse_manager@example.com`
- `store_keeper@example.com`
- Optional negative-scope users
- Seeded warehouses, stores, stacks, commodities

### Exact Test Cases

#### 1. Test ID: P1-SETUP-001

- **Role / account:** `admin@example.com`
- **Preconditions:** Admin can access setup pages.
- **Steps:**
  1. Create or verify a hub.
  2. Create or verify a warehouse under the hub.
  3. Create or verify a store under the warehouse.
  4. Create or verify a stack under the store.
- **Expected result:** Full facility hierarchy can be maintained successfully.
- **Fail indicators:** Broken create/edit flow, missing linkage, or invalid derived constraints.

#### 2. Test ID: P1-ASSIGN-001

- **Role / account:** `admin@example.com`
- **Preconditions:** Users and roles exist.
- **Steps:**
  1. Assign warehouse manager to a warehouse.
  2. Assign storekeeper to a store.
  3. Save assignments.
- **Expected result:** Assignments persist and affect scope correctly.
- **Fail indicators:** Assignment save failure or no effect on scoped access.

#### 3. Test ID: P1-GRN-001

- **Role / account:** `warehouse_manager@example.com`
- **Preconditions:** Warehouse assignment exists and a commodity is available for receiving.
- **Steps:**
  1. Create a GRN with at least one item.
  2. Confirm the GRN.
  3. Open stock balances.
- **Expected result:** GRN is created and confirmed, and stock increases in the targeted warehouse/store/stack.
- **Fail indicators:** Failed confirmation, incorrect stock delta, or ledger not recorded.

#### 4. Test ID: P1-INSP-001

- **Role / account:** `warehouse_manager@example.com`
- **Preconditions:** Confirmed GRN exists.
- **Steps:**
  1. Create an inspection against the received stock.
  2. Enter damaged/lost quantities.
  3. Confirm the inspection.
  4. Open stock balances and related document details.
- **Expected result:** Damaged/lost quantities reduce stock correctly and the document reflects confirmed status.
- **Fail indicators:** Inspection does not affect stock correctly or allows invalid totals.

#### 5. Test ID: P1-GIN-001

- **Role / account:** `warehouse_manager@example.com`
- **Preconditions:** Available stock exists after receipt/inspection.
- **Steps:**
  1. Create a GIN for available stock.
  2. Confirm the GIN.
  3. Open stock balances and bin card.
- **Expected result:** Stock decreases correctly and transaction history is visible.
- **Fail indicators:** Negative stock allowed incorrectly, missing ledger update, or wrong scoped visibility.

#### 6. Test ID: P1-STOCK-001

- **Role / account:** `store_keeper@example.com`
- **Preconditions:** Store assignment exists and stock movement has occurred.
- **Steps:**
  1. Open stock balances.
  2. Open bin card report.
  3. Verify visible records belong only to the assigned scope.
- **Expected result:** Stockkeeper sees only assigned stock data and can trace movements.
- **Fail indicators:** Missing records, overexposure to unassigned data, or incorrect totals.

#### 7. Test ID: P1-SCOPE-001

- **Role / account:** `warehouse_manager2@example.com` or `store_keeper2@example.com`
- **Preconditions:** Secondary user is assigned to a different scope or left unassigned.
- **Steps:**
  1. Log in as the secondary user.
  2. Attempt to access records created in the primary user’s scope.
- **Expected result:** Access is denied or the records are not visible.
- **Fail indicators:** Cross-scope leakage.

### Expected Results

- Full inbound -> inspection -> outbound loop works end-to-end.
- Scope enforcement is correct.
- Stock balances and bin card reflect actual changes.

### Pass/Fail Criteria

| Gate | Pass Condition |
| --- | --- |
| Facility hierarchy | Can be created and maintained |
| Role assignments | Persist and affect visible scope |
| GRN/GIN/inspection | Create and confirm correctly |
| Stock visibility | Balances and bin card reflect the executed loop |
| Scope isolation | Users cannot access data outside assigned scope |

### Exit Criteria

- Phase 1 is complete when the core warehouse loop is usable without manual database intervention and pilot users can complete supported tasks end-to-end.

---

## Phase 2

### Objective

Validate the expanded inventory-control capabilities required to manage discrepancies and planned inventory movement.

### Entry Criteria

- Phase 1 has passed.
- Inventory adjustment, transfer, cycle count, and reservation/allocation features are implemented.

### Test Data / Accounts

- Admin
- Warehouse manager
- Storekeeper
- Commodity stock available in at least two stacks or stores

### Exact Test Cases

#### 1. Test ID: P2-ADJ-001

- **Role / account:** `warehouse_manager@example.com`
- **Preconditions:** Existing stock balance is available.
- **Steps:**
  1. Create an inventory adjustment that increases stock.
  2. Confirm or post the adjustment.
  3. Recheck stock balance.
- **Expected result:** Stock increases by the adjustment amount with traceable audit history.
- **Fail indicators:** Missing stock movement, wrong quantity, or no audit trail.

#### 2. Test ID: P2-ADJ-002

- **Role / account:** `warehouse_manager@example.com`
- **Preconditions:** Existing stock balance is available.
- **Steps:**
  1. Create a negative adjustment.
  2. Attempt an excessive deduction and then a valid deduction.
- **Expected result:** Over-deduction is blocked; valid deduction succeeds.
- **Fail indicators:** Negative stock permitted or validation missing.

#### 3. Test ID: P2-TRF-001

- **Role / account:** `warehouse_manager@example.com`
- **Preconditions:** Two valid target locations exist for transfer.
- **Steps:**
  1. Transfer stock from one stack/store to another.
  2. Verify source and destination balances.
  3. Verify ledger traceability.
- **Expected result:** Source decreases, destination increases, and movement is fully traceable.
- **Fail indicators:** Partial movement, inconsistent totals, or broken traceability.

#### 4. Test ID: P2-COUNT-001

- **Role / account:** `store_keeper@example.com`
- **Preconditions:** Existing stock and count workflow available.
- **Steps:**
  1. Start a cycle count.
  2. Enter a discrepancy.
  3. Reconcile or submit for approval per implemented design.
- **Expected result:** Count discrepancy is recorded and resolved through supported workflow.
- **Fail indicators:** Count cannot close or requires direct DB correction.

#### 5. Test ID: P2-ALLOC-001

- **Role / account:** `warehouse_manager@example.com`
- **Preconditions:** Reservation/allocation feature is available.
- **Steps:**
  1. Reserve a portion of available stock.
  2. Attempt to issue more than remaining available stock.
  3. Release or consume the reservation.
- **Expected result:** Available stock reflects reservations correctly.
- **Fail indicators:** Reservations do not affect availability or allow double-consumption.

#### 6. Test ID: P2-CONC-001

- **Role / account:** Two operator accounts
- **Preconditions:** Same stock location is accessible for concurrent actions.
- **Steps:**
  1. Launch two near-simultaneous stock-affecting actions.
  2. Observe final balances and transaction outcomes.
- **Expected result:** Locking and validations preserve integrity; one or both operations resolve safely.
- **Fail indicators:** Duplicated deduction, corrupted balance, or inconsistent ledger state.

### Expected Results

- Inventory exceptions are handled in-app.
- Transfers and adjustments preserve stock integrity.
- Reservations affect available stock correctly.

### Pass/Fail Criteria

| Gate | Pass Condition |
| --- | --- |
| Adjustments | Positive and negative adjustments behave correctly |
| Transfers | Source and destination balances reconcile |
| Cycle counts | Discrepancies can be reconciled in system |
| Reservations | Available stock reflects reservation state accurately |
| Integrity under concurrency | No corrupted or negative stock state |

### Exit Criteria

- Phase 2 is complete when common inventory-control exceptions can be resolved without direct database correction.

---

## Phase 3

### Objective

Validate advanced warehouse operations and production-hardening capabilities for broader deployment.

### Entry Criteria

- Phase 2 has passed.
- Picking, packing, staging/loading, notifications, dashboards, and operational hardening are implemented.

### Test Data / Accounts

- Warehouse manager
- Storekeeper
- Admin or supervisor role as implemented
- Test integration endpoint or webhook listener

### Exact Test Cases

#### 1. Test ID: P3-PICK-001

- **Role / account:** Warehouse operator role
- **Preconditions:** Pickable demand or reservation exists.
- **Steps:**
  1. Generate or open a pick task.
  2. Complete picking.
  3. Move items into packing or staging state.
- **Expected result:** Pick workflow updates statuses and inventory/task state correctly.
- **Fail indicators:** Pick completion does not update downstream workflow state.

#### 2. Test ID: P3-PACK-001

- **Role / account:** Warehouse operator role
- **Preconditions:** Picked items exist.
- **Steps:**
  1. Execute packing workflow.
  2. Stage packed goods.
  3. Prepare them for loading.
- **Expected result:** Packing and staging statuses are recorded correctly.
- **Fail indicators:** Workflow breaks between pick, pack, and stage steps.

#### 3. Test ID: P3-NOTIFY-001

- **Role / account:** System/integration observer
- **Preconditions:** Notification or webhook destination is configured.
- **Steps:**
  1. Trigger an event that should notify downstream systems.
  2. Observe delivery, payload, and retry behavior if applicable.
- **Expected result:** Notification is delivered with correct payload and visible status.
- **Fail indicators:** Silent failure, malformed payload, or no retry/error visibility.

#### 4. Test ID: P3-REPORT-001

- **Role / account:** Supervisor or admin role
- **Preconditions:** Sufficient test activity exists.
- **Steps:**
  1. Open dashboards and reports.
  2. Verify KPI values against known executed workflows.
- **Expected result:** Dashboards and reports reflect the test data accurately.
- **Fail indicators:** Missing, stale, or inaccurate operational metrics.

#### 5. Test ID: P3-OPS-001

- **Role / account:** DevOps/engineering
- **Preconditions:** Logging, metrics, and queue processing are enabled.
- **Steps:**
  1. Trigger normal workflows and at least one intentional failure case.
  2. Observe logs, metrics, queue state, and alert surfaces.
- **Expected result:** Success and failure paths are observable and diagnosable.
- **Fail indicators:** Missing logs, missing metrics, or silent queue/integration failures.

#### 6. Test ID: P3-SEC-001

- **Role / account:** Multiple roles
- **Preconditions:** Expanded advanced features exist.
- **Steps:**
  1. Repeat unauthorized access tests on new advanced routes.
  2. Attempt forbidden actions with lower-privilege roles.
- **Expected result:** Authorization remains correct after advanced features are added.
- **Fail indicators:** Any privilege escalation or route exposure defect.

### Expected Results

- Advanced warehouse flows are usable.
- Webhooks and dashboards behave reliably.
- Operational telemetry exists for normal and failed execution paths.

### Pass/Fail Criteria

| Gate | Pass Condition |
| --- | --- |
| Pick/pack/stage/load | Workflow executes correctly |
| Notification delivery | Events are delivered or visibly retried/failed |
| Dashboards/reports | Values are accurate and usable |
| Observability | Logs, metrics, and queue state are visible |
| Security regression | No privilege drift in advanced routes |

### Exit Criteria

- Phase 3 is complete when advanced flows are production-operable and monitored with controlled failure handling.

---

## Phase 4

### Objective

Validate full standard-WMS maturity, including rule-driven execution, scan-based operations, supervisor controls, integration breadth, and resilience.

### Entry Criteria

- Phase 3 has passed.
- Directed putaway, replenishment, wave picking, scan flows, expiry rules, supervisor controls, and resilience tooling are implemented.

### Test Data / Accounts

- Supervisor/admin
- Warehouse manager
- Operator/storekeeper/mobile operator role
- Integration endpoints for ERP/TMS style flows
- Data with multiple lots, dates, and pick priorities

### Exact Test Cases

#### 1. Test ID: P4-PUT-001

- **Role / account:** Warehouse operator
- **Preconditions:** Inbound stock is ready for putaway and multiple storage options exist.
- **Steps:**
  1. Receive stock requiring putaway.
  2. View directed putaway recommendation.
  3. Execute recommended putaway.
- **Expected result:** System proposes a valid target and execution updates stock location correctly.
- **Fail indicators:** No rule-driven recommendation or incorrect final placement.

#### 2. Test ID: P4-REPL-001

- **Role / account:** Warehouse operator or supervisor
- **Preconditions:** Replenishment rule thresholds exist.
- **Steps:**
  1. Drive a pick/bin location below threshold.
  2. Observe replenishment trigger.
  3. Complete replenishment task.
- **Expected result:** Replenishment task is generated and completion moves stock correctly.
- **Fail indicators:** No trigger, wrong source, or wrong replenishment result.

#### 3. Test ID: P4-WAVE-001

- **Role / account:** Supervisor or planner
- **Preconditions:** Multiple outbound demands exist.
- **Steps:**
  1. Create or release a picking wave/batch.
  2. Execute picking from the generated wave.
  3. Validate grouping and completion logic.
- **Expected result:** Wave picking consolidates work correctly and updates downstream statuses.
- **Fail indicators:** Incorrect batching, missed lines, or broken execution state.

#### 4. Test ID: P4-SCAN-001

- **Role / account:** Mobile/operator role
- **Preconditions:** Scannable labels or test barcode/QR data exist.
- **Steps:**
  1. Scan a location, product, or task code.
  2. Execute the prompted workflow action.
  3. Validate resulting transaction.
- **Expected result:** Scan-driven flow is faster than manual entry and records the correct action.
- **Fail indicators:** Ambiguous scans, wrong entity resolution, or broken mobile workflow.

#### 5. Test ID: P4-FEFO-001

- **Role / account:** Warehouse operator
- **Preconditions:** Multiple lots or expiry dates exist.
- **Steps:**
  1. Create an outbound workflow that should apply FEFO/FIFO logic.
  2. Observe selected or recommended stock source.
  3. Complete the task.
- **Expected result:** Allocation and execution respect the configured FEFO/FIFO rule.
- **Fail indicators:** Wrong lot picked or expiry rules ignored.

#### 6. Test ID: P4-SUP-001

- **Role / account:** Operator then supervisor
- **Preconditions:** Exception queue and approval workflow exist.
- **Steps:**
  1. Trigger an exception requiring supervisor approval.
  2. Review the exception in the supervisor queue.
  3. Approve or reject the action.
- **Expected result:** Exception is routed, reviewed, and resolved with auditability.
- **Fail indicators:** No supervisor queue, no traceability, or direct bypass of approval.

#### 7. Test ID: P4-INT-001

- **Role / account:** Engineering/integration observer
- **Preconditions:** ERP/TMS integration endpoints are available.
- **Steps:**
  1. Trigger inbound or outbound events requiring integration.
  2. Validate payload shape, transmission, acknowledgment, and failure handling.
- **Expected result:** Interoperability path works end-to-end with traceable outcomes.
- **Fail indicators:** Missing acknowledgments, malformed payloads, or invisible failures.

#### 8. Test ID: P4-RES-001

- **Role / account:** DevOps/engineering
- **Preconditions:** Monitoring, backup, and incident/runbook processes exist.
- **Steps:**
  1. Validate backup and restore confidence path or drill.
  2. Validate monitoring/alert behavior for queue and app failure.
  3. Walk through the incident playbook for a simulated failure.
- **Expected result:** Resilience processes are documented, tested, and operationally credible.
- **Fail indicators:** No usable recovery path, no alerts, or undocumented incident response.

### Expected Results

- Rule-driven warehouse execution works correctly.
- Scan-based operations are viable.
- Supervisor controls, integrations, and resilience are proven.

### Pass/Fail Criteria

| Gate | Pass Condition |
| --- | --- |
| Directed putaway | Recommendation and execution work correctly |
| Replenishment | Threshold-driven tasks execute correctly |
| Wave picking | Batch execution is correct and traceable |
| Scan workflows | Barcode/QR/mobile flows work reliably |
| FEFO/FIFO and lot rules | Allocation follows the configured rule |
| Supervisor controls | Exceptions route and resolve correctly |
| Integration validation | External interoperability path is proven |
| Resilience validation | Backup, monitoring, and incident response are credible |

### Exit Criteria

- Phase 4 is complete when the product demonstrates standard-WMS operational completeness rather than document CRUD completeness.

---

## Phase 1 UI Verification Addendum

Use this smoke script to verify the Phase 1 MVP from the operator UI, not only from request specs.

### Roles

- `Warehouse Manager`
- `Storekeeper`

### Workflow Script

#### 1. GRN Draft and Confirm

- Create a GRN from a real source reference:
  - `Receipt` should now expose commodity identity when available from the receipt chain.
  - `Waybill` and source `GRN` should expose source-backed item choices.
- Confirm the GRN from the detail page.
- Verify:
  - GRN status changes to `Confirmed`
  - stock balance increases for the selected warehouse/store/stack
  - bin card shows an inbound transaction with:
    - reference type `GRN`
    - reference number
    - warehouse/store/stack labels
    - commodity and unit labels

#### 2. Inspection Draft and Confirm

- Create an inspection from a selected source `GRN`.
- Confirm the inspection with damaged/lost quantity.
- Verify:
  - inspection status changes to `Confirmed`
  - stock balance decreases by damaged + lost quantity
  - bin card shows an adjustment movement tied to the inspection reference
  - over-adjustment is blocked both in backend and UI flow

#### 3. GIN Draft and Confirm

- Create a GIN by selecting from available stock in the chosen warehouse/store/stack.
- Verify the form shows:
  - only available stock choices
  - visible available quantity before submit
  - client-side blocking when requested quantity exceeds available stock
- Confirm the GIN from the detail page.
- Verify:
  - GIN status changes to `Confirmed`
  - stock balance decreases correctly
  - bin card shows an outbound movement with the GIN reference

### Storekeeper Scope Check

- `Storekeeper` can create a draft GRN inside the assigned store scope.
- `Storekeeper` cannot confirm GRNs.
- `Storekeeper` should only see stock balances/bin card entries for the assigned store scope.

### Automated Evidence Already Green

- Focused request suite:
  - `spec/requests/cats_warehouse/phase1_inventory_workflows_spec.rb`
  - current result: `5 examples, 0 failures`

### Current Automated Status

| Area | Status | Evidence |
| --- | --- | --- |
| GRN confirm -> stock increase | Pass | Focused request suite |
| Inspection confirm -> stock reduction | Pass | Focused request suite |
| GIN confirm -> negative stock blocked | Pass | Focused request suite |
| Assignment-scoped stock visibility | Pass | Focused request suite |
| Storekeeper draft/create vs confirm restriction | Pass | Focused request suite |
| Guided GRN source selection | Implemented, manual verification pending | UI smoke required |
| Guided GIN available-stock selection | Implemented, manual verification pending | UI smoke required |
| UI stock balance/bin card refresh after confirm | Implemented, manual verification pending | UI smoke required |

### Manual Evidence To Capture

- Screenshot or short note for:
  - GRN confirm -> stock balance updated
  - inspection confirm -> stock balance and bin card updated
  - GIN confirm -> stock balance and bin card updated
- Record:
  - role
  - reference number
  - expected quantity
  - actual quantity shown in UI
  - pass/fail

### Phase 1 Signoff Checklist

Mark Phase 1 complete only when every item below is checked.

- [x] Focused backend workflow proof is green
- [x] Stock mutation logic is guarded against negative/inconsistent states
- [x] Bin card and stock balance expose readable operator-facing labels
- [x] GRN, inspection, and GIN forms use guided selectors for the main workflow paths
- [x] Storekeeper scope behavior has automated coverage
- [ ] Warehouse Manager UI smoke run completed and recorded
- [ ] Storekeeper UI smoke run completed and recorded
- [ ] Stock balance verified in UI after each confirm step
- [ ] Bin card verified in UI after each confirm step
- [ ] No pilot-blocking UX issue remains in the end-to-end loop

### Phase 1 Decision

- `Phase 1 code complete:` not yet
- `Phase 1 mostly implemented:` yes
- `Phase 1 signoff ready:` no

Phase 1 becomes signoff-ready only after the unchecked manual evidence items above are completed and passed.
