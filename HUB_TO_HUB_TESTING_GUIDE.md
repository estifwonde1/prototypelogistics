# Hub-to-Hub Commodity Transfer — Full End-to-End Testing Guide

This guide walks through a **complete commodity transfer** from **Bole Hub** to **Yeka Hub** using the CATS Warehouse Management System — starting from the **Dispatch Planner** who creates the movement plan, through **Hub Officers** who authorize it, and into the operational execution at source and destination hubs. Every step tells you **which user to log in as**, **which page to go to**, and **exactly what to fill in**.

---

## Pre-Seeded Data You Already Have

After running `rails db:seed`, the database contains:

### Users & Roles

| Email | Password | Role | Assigned To |
|-------|----------|------|-------------|
| `admin@example.com` | `newpassword123` | Admin | Full access |
| `superadmin@example.com` | `newpassword123` | Superadmin | Full access |
| `hub_manager@example.com` | `newpassword123` | Hub Manager | **Bole Hub** |
| `hub_manager2@example.com` | `newpassword123` | Hub Manager | **Yeka Hub** |
| `warehouse_manager@example.com` | `newpassword123` | Warehouse Manager | **Bole Central Warehouse** |
| `warehouse_manager2@example.com` | `newpassword123` | Warehouse Manager | **Yeka Logistics Warehouse** |
| `store_keeper@example.com` | `password123` | Storekeeper | Bole Store 1 |
| `store_keeper2@example.com` | `password123` | Storekeeper | Yeka Store |

### Planner & Officer Users (created in Phase 0 below)

These users do NOT exist in seed data — you create them via Admin in Phase 0.

| Email | Password | Role | Assigned To |
|-------|----------|------|-------------|
| `planner@example.com` | `newpassword123` | Dispatch Planner | System-wide (no hub assignment needed) |
| `dispatch_officer@example.com` | `newpassword123` | Hub Dispatch Officer | **Bole Hub** |
| `dispatch_approver@example.com` | `newpassword123` | Hub Dispatch Approver | **Yeka Hub** |

### Infrastructure (already seeded)

| Hub | Warehouse | Stores | Stacks |
|-----|-----------|--------|--------|
| **Bole Hub** (`ADD-HUB-01`) | Bole Central Warehouse (`ADD-WH-01`) | `ADD-WH-01-ST1`, `ADD-WH-01-ST2` | 3 stacks per store (random commodities) |
| **Yeka Hub** (`ADD-HUB-02`) | Yeka Logistics Warehouse (`ADD-WH-02`) | `ADD-WH-02-ST1`, `ADD-WH-02-ST2` | 3 stacks per store |
| **Kirkos Hub** (`ADD-HUB-03`) | Kirkos Storage Warehouse (`ADD-WH-03`) | `ADD-WH-03-ST1`, `ADD-WH-03-ST2` | 3 stacks per store |

### Commodities (already seeded)

| Name | Batch No | Unit |
|------|----------|------|
| Rice | `ADD-RICE-001` | kg |
| Wheat Flour | `ADD-WHEAT-001` | kg |
| Cooking Oil | `ADD-OIL-001` | l |
| Beans | `ADD-BEAN-001` | kg |
| Soap Bars | `ADD-SOAP-001` | pcs |
| Blankets | `ADD-BLANKET-001` | pcs |
| Jerry Cans | `ADD-JERRYCAN-001` | pcs |
| Storage Bags | `ADD-BAG-001` | bag |

### Transporters (already seeded)

| Name | Code |
|------|------|
| Addis Transport PLC | `ADD-TR-01` |
| Sheger Logistics | `ADD-TR-02` |

---

## The Scenario

> **Transfer 500 kg of Rice from Bole Hub to Yeka Hub.**

| Phase | What Happens | Who Does It |
|-------|-------------|-------------|
| **0A** | Create planner & officer users and assign them | Admin |
| **0B** | Create Dispatch Plan and Plan Items | Dispatch Planner |
| **0C** | Authorize Source hub store | Hub Dispatch Officer (Bole) |
| **0D** | Authorize Destination hub store | Hub Dispatch Approver (Yeka) |
| **0E** | Verify plan item is Dispatchable | Dispatch Planner |
| **0F** | Create Dispatch from authorized plan item | Dispatch Planner |
| 1 | Receive Rice into Bole warehouse | Storekeeper creates GRN → Warehouse Manager confirms |
| 2 | Inspect the received goods | Storekeeper creates Inspection → Warehouse Manager confirms |
| 3 | Issue Rice out of Bole warehouse | Storekeeper creates GIN → Warehouse Manager confirms |
| 4 | Document the shipment (Waybill linked to Dispatch) | Hub Manager creates Waybill → Hub Manager confirms |
| 5 | Receive Rice into Yeka warehouse | Storekeeper 2 creates GRN → Warehouse Manager 2 confirms |
| 6 | Verify everything | Check Stock Balances and Bin Card at both hubs |

---

## PHASE 0: Planning and Authorization (New Planner Flow)

This phase is the **real-world prerequisite** — a Dispatch Planner creates the movement plan, hub officers authorize both ends, and only then can execution documents (GRN/GIN/Waybill) be created.

---

### STEP 0A — Admin Creates Planner & Officer Users

**Login as:** `admin@example.com` / `newpassword123`

**Create the Dispatch Planner user:**

1. Go to **Admin → Users**
2. Click **Create User**
3. Fill in:

| Field | Value |
|-------|-------|
| First Name | `Dawit` |
| Last Name | `Mekonnen` |
| Email | `planner@example.com` |
| Phone | `0911222001` |
| Password | `newpassword123` |
| Confirm Password | `newpassword123` |
| Role | **Dispatch Planner** |

4. Click **Create**

**Create the Hub Dispatch Officer user:**

1. Click **Create User** again
2. Fill in:

| Field | Value |
|-------|-------|
| First Name | `Selam` |
| Last Name | `Hailu` |
| Email | `dispatch_officer@example.com` |
| Phone | `0911222002` |
| Password | `newpassword123` |
| Confirm Password | `newpassword123` |
| Role | **Hub Dispatch Officer** |

3. Click **Create**

**Create the Hub Dispatch Approver user:**

1. Click **Create User** again
2. Fill in:

| Field | Value |
|-------|-------|
| First Name | `Biruk` |
| Last Name | `Tadesse` |
| Email | `dispatch_approver@example.com` |
| Phone | `0911222003` |
| Password | `newpassword123` |
| Confirm Password | `newpassword123` |
| Role | **Hub Dispatch Approver** |

3. Click **Create**

**Assign hub scope for Officer and Approver:**

1. Go to **Admin → User Assignments**
2. Create assignment for **dispatch_officer@example.com**:

| Field | Value |
|-------|-------|
| User | `dispatch_officer@example.com` |
| Role Name | **Hub Dispatch Officer** |
| Hub | **Bole Hub** |

3. Create assignment for **dispatch_approver@example.com**:

| Field | Value |
|-------|-------|
| User | `dispatch_approver@example.com` |
| Role Name | **Hub Dispatch Approver** |
| Hub | **Yeka Hub** |

> **Note:** The Dispatch Planner does NOT need a hub assignment — they have system-wide visibility of plans and plan items.

**Expected:** Three new users created, officer and approver assigned to their respective hubs.

---

### STEP 0B — Planner Creates the Dispatch Plan and Plan Item

**Login as:** `planner@example.com` / `newpassword123`

**Create the Dispatch Plan:**

Via API: `POST /cats_warehouse/v1/dispatch_plans`

```json
{
  "payload": {
    "reference_no": "DP-BOLE-YEKA-001",
    "description": "Rice transfer Bole to Yeka - 500kg",
    "prepared_by_id": "<planner_user_id>"
  }
}
```

**Expected:** Dispatch plan created with status **Draft**.

**Create the Dispatch Plan Item:**

Via API: `POST /cats_warehouse/v1/dispatch_plan_items`

```json
{
  "payload": {
    "reference_no": "DPI-BOLE-YEKA-001",
    "dispatch_plan_id": "<dispatch_plan_id from above>",
    "source_id": "<location_id of Bole Central Warehouse>",
    "destination_id": "<location_id of Yeka Logistics Warehouse>",
    "commodity_id": "<Rice commodity_id>",
    "quantity": 500,
    "unit_id": "<kg unit_id>"
  }
}
```

**Expected:** Plan item created with status **Unauthorized**.

> **Verify gating works:** Try creating a Dispatch from this plan item now — it should fail with "Dispatch plan item must be fully authorized before execution".

---

### STEP 0C — Hub Dispatch Officer Authorizes the Source

**Login as:** `dispatch_officer@example.com` / `newpassword123`

Via API: `POST /cats_warehouse/v1/hub_authorizations`

```json
{
  "payload": {
    "dispatch_plan_item_id": "<plan_item_id>",
    "store_id": "<Bole store id, e.g. ADD-WH-01-ST1>",
    "quantity": 500,
    "unit_id": "<kg unit_id>",
    "authorization_type": "Source",
    "authorized_by_id": "<officer_user_id>"
  }
}
```

**Expected:**
- Hub authorization created
- Plan item status auto-transitions to **Source Authorized**

**Verify:** `GET /cats_warehouse/v1/dispatch_plan_items/<plan_item_id>` should show `status: "Source Authorized"`.

---

### STEP 0D — Hub Dispatch Approver Authorizes the Destination

**Login as:** `dispatch_approver@example.com` / `newpassword123`

Via API: `POST /cats_warehouse/v1/hub_authorizations`

```json
{
  "payload": {
    "dispatch_plan_item_id": "<plan_item_id>",
    "store_id": "<Yeka store id, e.g. ADD-WH-02-ST1>",
    "quantity": 500,
    "unit_id": "<kg unit_id>",
    "authorization_type": "Destination",
    "authorized_by_id": "<approver_user_id>"
  }
}
```

**Expected:**
- Hub authorization created
- Plan item status auto-transitions to **Dispatchable**

**Verify:** `GET /cats_warehouse/v1/dispatch_plan_items/<plan_item_id>` should show `status: "Dispatchable"`.

---

### STEP 0E — Verify Plan Item Is Dispatchable

**Login as:** `planner@example.com` / `newpassword123`

1. Via API: `GET /cats_warehouse/v1/dispatch_plan_items/<plan_item_id>`
2. Confirm status is **Dispatchable**
3. Confirm both hub authorizations are listed (Source + Destination)

**Expected:** Status = `Dispatchable`, two hub_authorizations present.

---

### STEP 0F — Planner Creates the Dispatch

**Login as:** `planner@example.com` / `newpassword123`

Via API: `POST /cats_warehouse/v1/dispatches`

```json
{
  "payload": {
    "reference_no": "DSP-BOLE-YEKA-001",
    "dispatch_plan_item_id": "<plan_item_id>",
    "transporter_id": "<Addis Transport PLC id>",
    "plate_no": "AA-99999",
    "driver_name": "Abebe Tessema",
    "driver_phone": "0913000001",
    "quantity": 500,
    "unit_id": "<kg unit_id>",
    "prepared_by_id": "<planner_user_id>"
  }
}
```

**Expected:** Dispatch created with status **Draft**. This succeeds because the plan item is Dispatchable.

> **Key test:** If you had tried this before Steps 0C and 0D, the API would have returned **422 Unprocessable Entity** with message: "Dispatch plan item must be fully authorized before execution".

---

## Phase 0 Complete — Execution Begins

At this point the planning lifecycle is done:
- Plan exists and is approved
- Both source and destination hubs have authorized their stores
- A Dispatch document is created and ready

The remaining steps (1-6) are the **operational execution** at each hub. They are unchanged from before, except:
- In **Step 4** (Waybill), you should link the Waybill to the Dispatch created in Step 0F by entering its Dispatch ID.
- The flow is now **gated** — you cannot create a Dispatch or a Waybill linked to an unauthorized plan item.

---

## STEP 1: Receive Commodities at Bole Hub (GRN)

### 1A — Storekeeper Creates the GRN

**Login as:** `store_keeper@example.com` / `password123`

1. Click **GRN** in the sidebar
2. Click **Create GRN**
3. Fill in the header:

| Field | Value |
|-------|-------|
| Reference No | `GRN-BOLE-TEST-001` |
| Warehouse | **Bole Central Warehouse** (should auto-select if only one visible) |
| Received On | Today's date |
| Received By | Leave blank or enter your user ID |
| Source Type | Leave blank (or select "Receipt" if testing source linking) |

4. Add a line item — click **Add Item**:

| Field | Value |
|-------|-------|
| Commodity | Select **Rice** (or pick a stack that has Rice) |
| Quantity | `500` |
| Unit | **kg** (auto-fills if you selected from a stack) |
| Quality Status | `Good` |
| Store | `ADD-WH-01-ST1` (Bole Central Warehouse Store 1) |
| Stack | Pick any stack under that store |

5. Click **Create GRN**

**Expected:** GRN created with status **Draft**. You are redirected to the GRN detail page.

> **Note:** The Storekeeper **cannot** confirm the GRN — the Confirm button may appear in the UI but the API will return **403 Forbidden**. This is by design.

---

### 1B — Warehouse Manager Confirms the GRN

**Login as:** `warehouse_manager@example.com` / `newpassword123`

1. Click **GRN** in the sidebar
2. Find `GRN-BOLE-TEST-001` and click on it
3. Click **Confirm GRN**
4. Read the warning: "This will update stock balances. This action cannot be undone."
5. Click **Confirm**

**Expected:**
- Status changes from **Draft** → **Confirmed**
- Stock balance for Rice at Bole Central Warehouse **increases by 500 kg**

### 1C — Verify Stock Balance

1. Click **Stock Balances** in the sidebar
2. Look for **Rice** at **Bole Central Warehouse**

**Expected:** Quantity shows at least **500** (may be higher if seed data already had some Rice there).

---

## STEP 2: Inspect the Received Goods (Optional but Recommended)

### 2A — Storekeeper Creates the Inspection

**Login as:** `store_keeper@example.com` / `password123`

1. Click **Inspections** in the sidebar
2. Click **Create Inspection**
3. Fill in:

| Field | Value |
|-------|-------|
| Reference No | `INS-BOLE-TEST-001` |
| Warehouse | **Bole Central Warehouse** |
| Inspected On | Today's date |
| Inspector | Your user ID (or leave blank) |
| Source Type | **GRN** |
| Source Reference | Select `GRN-BOLE-TEST-001` |

4. When you select the source GRN, the items **auto-populate** from the GRN lines:
   - Commodity: Rice
   - Quantity Received: 500
   - Qty Damaged: `0` (edit if needed for testing — e.g. put `10`)
   - Qty Lost: `0` (edit if needed — e.g. put `5`)
   - Quality: Good
   - Packaging: Intact
   - Remarks: `"All bags in good condition"` (or describe damage)

5. Click **Create Inspection**

**Expected:** Inspection created with status **Draft**.

---

### 2B — Warehouse Manager Confirms the Inspection

**Login as:** `warehouse_manager@example.com` / `newpassword123`

1. Click **Inspections** in the sidebar
2. Find `INS-BOLE-TEST-001` and click on it
3. Click **Confirm Inspection**

**Expected:** Status changes to **Confirmed**. The inspection is now a permanent quality record.

---

## STEP 3: Issue Goods Out of Bole Hub (GIN)

### 3A — Storekeeper Creates the GIN

**Login as:** `store_keeper@example.com` / `password123`

1. Click **GIN** in the sidebar
2. Click **Create GIN**
3. Fill in the header:

| Field | Value |
|-------|-------|
| Reference No | `GIN-BOLE-TEST-001` |
| Warehouse | **Bole Central Warehouse** |
| Issued On | Today's date |
| Issued By | Leave blank or enter your user ID |
| Destination Type | Leave blank (or select "Dispatch" / "Waybill" for linking) |

4. Add a line item — click **Add Item**:

| Field | Value | Notes |
|-------|-------|-------|
| Store | `ADD-WH-01-ST1` | Same store where Rice was received |
| Stack | Same stack used in the GRN | |
| Commodity | **Rice** | Select from the dropdown — only commodities with stock appear |
| Available | Should show ≥ 500 | Read-only field |
| Quantity | `500` | Must be ≤ Available balance |
| Unit | **kg** | Auto-filled |

5. Click **Create GIN**

**Expected:** GIN created with status **Draft**.

> **Important:** If quantity exceeds the available stock balance, the form will block submission. Make sure your GRN was confirmed first.

---

### 3B — Warehouse Manager Confirms the GIN

**Login as:** `warehouse_manager@example.com` / `newpassword123`

1. Click **GIN** in the sidebar
2. Find `GIN-BOLE-TEST-001` and click on it
3. Click **Confirm GIN**
4. Read the warning: stock balances will decrease. This cannot be undone.
5. Click **Confirm**

**Expected:**
- Status: **Draft** → **Confirmed**
- On the **same store/stack** you used for the GIN line, **Rice decreases by 500 kg** (versus right after the GRN was confirmed).

### 3C — Verify Stock Balance Decreased

1. Go to **Stock Balances**
2. In the search box, type **Rice** so you only see Rice rows.
3. Remember: **Rice may appear on more than one stack** at Bole (seed data). Only the stack you chose in the GIN (Step 3) drops by **500 kg**; other Rice stacks stay unchanged.
4. Optional: set **Group by** to **Commodity** — you’ll see a **Total** for Rice; that total should be **500 kg less** than it was **immediately after you confirmed the Step 1 GRN** (not less than “before Step 1” — see Step 6).

**Expected:** Versus the moment **after** `GRN-BOLE-TEST-001` was confirmed, total **Rice (kg)** at Bole is **500 kg lower** once the GIN is confirmed. Versus **before Step 1**, total Rice at Bole is **back to the same level** (net +500 then −500).

---

## STEP 4: Document the Shipment (Waybill)

### 4A — Hub Manager Creates the Waybill

**Login as:** `hub_manager@example.com` / `newpassword123`

1. Click **Waybills** in the sidebar
2. Click **Create Waybill**
3. Fill in the header:

| Field | Value |
|-------|-------|
| Reference No | `WB-BOLE-YEKA-001` |
| Issued On | Today's date |
| Source Warehouse | **Bole Central Warehouse** (the system uses its `location_id` internally) |
| Destination Warehouse | **Yeka Logistics Warehouse** |
| Dispatch ID | Enter the Dispatch ID from **Step 0F** (`DSP-BOLE-YEKA-001`) — links the waybill to the authorized plan |

4. Fill in transport details:

| Field | Value |
|-------|-------|
| Transporter | **ADD-TR-01 — Addis Transport PLC** (dropdown lists seeded transporters) |
| Vehicle Plate No | `AA-12345` |
| Driver Name | `Tesfaye Kebede` |
| Driver Phone | `0915000001` |

5. Add a line item:

| Field | Value |
|-------|-------|
| Commodity ID | ID of **Rice** |
| Quantity | `500` |
| Unit ID | ID of **kg** |

6. Click **Create Waybill**

**Expected:** Waybill created with status **Draft**.

---

### 4B — Hub Manager Confirms the Waybill

Still logged in as `hub_manager@example.com`:

1. On the waybill detail page, click **Confirm Waybill**
2. Confirm the action

**Expected:** Status: **Draft** → **Confirmed**. This finalizes the shipment document.

> **Note:** Confirming a waybill does **NOT** move stock in the system. It only documents the transport. Stock was already removed by the GIN (Step 3) and will be added by the GRN at destination (Step 5).

---

## STEP 5: Receive Commodities at Yeka Hub (GRN)

### 5A — Storekeeper 2 Creates the GRN at Yeka

**Login as:** `store_keeper2@example.com` / `password123`

1. Click **GRN** in the sidebar
2. Click **Create GRN**
3. Fill in the header:

| Field | Value |
|-------|-------|
| Reference No | `GRN-YEKA-TEST-001` |
| Warehouse | **Yeka Logistics Warehouse** |
| Received On | Today's date |
| Source Type | **Waybill** (optional — links back to the shipment) |
| Source Reference | Select `WB-BOLE-YEKA-001` if available |

4. Add a line item:

| Field | Value |
|-------|-------|
| Commodity | **Rice** |
| Quantity | `500` |
| Unit | **kg** |
| Quality Status | `Good` |
| Store | `ADD-WH-02-ST1` (Yeka Logistics Warehouse Store 1) |
| Stack | Pick any stack under that store |

5. Click **Create GRN**

**Expected:** GRN created with status **Draft**.

---

### 5B — Warehouse Manager 2 Confirms the GRN at Yeka

**Login as:** `warehouse_manager2@example.com` / `newpassword123`

1. Click **GRN** in the sidebar
2. Find `GRN-YEKA-TEST-001` and click on it
3. Click **Confirm GRN**
4. Confirm the action

**Expected:**
- Status: **Draft** → **Confirmed**
- Stock balance for Rice at Yeka Logistics Warehouse **increases by 500 kg**

> **Authorization:** Only the **warehouse manager assigned to Yeka Logistics Warehouse** (and admins) can confirm this GRN. The Bole warehouse manager does not see **Confirm GRN** on this document.

---

## STEP 6: Final Verification

### Check Stock Balances

**Login as any user with stock balance access** (admin, hub manager, warehouse manager)

1. Go to **Stock Balances**
2. Use the search box **Rice** and (optional) **Filter by warehouse** so you are not distracted by Wheat, Oil, etc.
3. **Do not confuse the “Total Stock” summary card** with Rice only — it adds **all commodities** and even mixes **kg + l** as one number; use the **table rows** (or **Group by → Commodity**) for Rice.

**How to read Bole after the full flow**

| Question | What to check |
|----------|----------------|
| Did the GIN actually remove 500 kg? | **Yes** if total **Rice (kg)** at Bole dropped by **500** compared to **right after** you confirmed `GRN-BOLE-TEST-001` (Step 1). |
| Should total Rice be lower than *before* the test? | **No.** Versus **before Step 1**, total Rice at Bole should be **net unchanged**: +500 (GRN) and −500 (GIN) cancel out. |

**Why you might see two Rice lines at Bole:** Seeds put Rice on more than one stack. You only issue from **one** stack in Step 3 — only that line (or the **Group by → Commodity** total) should drop by 500 kg versus post-GRN.

| Warehouse | Rice (kg) — what “success” looks like |
|-----------|----------------------------------------|
| **Bole Central Warehouse** | Same **total Rice** as **before Step 1**; **500 kg less** than **right after** Step 1 GRN confirm. |
| **Yeka Logistics Warehouse** | **+500 kg** Rice versus **before Step 5** GRN (e.g. one row at **500** if that was the only receipt). |

### Check Bin Card Report

1. Go to **Bin Card** in the sidebar
2. Filter by warehouse and commodity (Rice)
3. You should see the transaction history: GRN in, GIN out at Bole; GRN in at Yeka

---

## Summary: Who Does What (Full End-to-End)

```
                    PLANNING & AUTHORIZATION (Phase 0)
                    ════════════════════════════════════

Dispatch Planner (system-wide)
  │
  ├─ Creates Dispatch Plan (DP-BOLE-YEKA-001)
  ├─ Creates Plan Item (source: Bole, dest: Yeka, 500kg Rice)
  │       status: Unauthorized
  │       ↓
Hub Dispatch Officer (Bole Hub)
  │
  ├─ Creates Source Hub Authorization
  │       status: Source Authorized
  │       ↓
Hub Dispatch Approver (Yeka Hub)
  │
  ├─ Creates Destination Hub Authorization
  │       status: Dispatchable  ✓
  │       ↓
Dispatch Planner
  │
  ├─ Creates Dispatch (DSP-BOLE-YEKA-001)
  │  (blocked until Dispatchable — this is the gating check)
  │
  ═══════════════════════════════════════════════════════════
                    OPERATIONAL EXECUTION (Phases 1-6)
  ═══════════════════════════════════════════════════════════

BOLE HUB (Sender)                          YEKA HUB (Receiver)
═══════════════════                         ═══════════════════

Storekeeper                                 Storekeeper 2
  │                                           │
  ├─ Creates GRN (receive Rice)               ├─ Creates GRN (receive Rice)
  │       ↓                                   │       ↓
Warehouse Manager                           Warehouse Manager 2
  │                                           │
  ├─ Confirms GRN                             ├─ Confirms GRN
  │  (stock +500 at Bole)                     │  (stock +500 at Yeka)
  │                                           │
Storekeeper                                   
  │                                           
  ├─ Creates Inspection (optional)            
  │       ↓                                   
Warehouse Manager                             
  │                                           
  ├─ Confirms Inspection                      
  │                                           
Storekeeper                                   
  │                                           
  ├─ Creates GIN (issue Rice out)             
  │       ↓                                   
Warehouse Manager                             
  │                                           
  ├─ Confirms GIN                             
  │  (stock −500 at Bole)                     
  │                                           
Hub Manager                                   
  │                                           
  ├─ Creates Waybill (linked to Dispatch)     
  │  (Bole location → Yeka location)          
  ├─ Confirms Waybill                         
  │  (shipment documented)                    
  │                                           
  └───── physical transport ─────────────────→
```

---

## Quick Reference: Role Permissions

### Planning & Authorization Permissions

| Action | Admin | Dispatch Planner | Hub Dispatch Officer | Hub Dispatch Approver | Hub Manager | Warehouse Manager | Storekeeper |
|--------|-------|-----------------|---------------------|----------------------|-------------|-------------------|-------------|
| Create Dispatch Plan | Yes | **Yes** | No | No | No | No | No |
| Update Dispatch Plan | Yes | **Yes** | No | No | No | No | No |
| Approve Dispatch Plan | Yes | **Yes** | No | **Yes** | No | No | No |
| Create Plan Item | Yes | **Yes** | No | No | No | No | No |
| View Plans & Items | Yes | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | No |
| Create Hub Authorization | Yes | No | **Yes** | **Yes** | **Yes** | No | No |
| View Hub Authorizations | Yes | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | No |
| Create Dispatch | Yes | **Yes** | **Yes** | No | **Yes** | **Yes** | No |

### Operational Permissions

| Action | Admin | Dispatch Planner | Hub Dispatch Officer | Hub Dispatch Approver | Hub Manager | Warehouse Manager | Storekeeper |
|--------|-------|-----------------|---------------------|----------------------|-------------|-------------------|-------------|
| Create GRN | Yes | No | No | No | No | **Yes** | **Yes** |
| Confirm GRN | Yes | No | No | No | No | **Yes** | No |
| Create GIN | Yes | No | No | No | No | **Yes** | **Yes** |
| Confirm GIN | Yes | No | No | No | No | **Yes** | No |
| Create Inspection | Yes | No | No | No | Yes | Yes | **Yes** |
| Confirm Inspection | Yes | No | No | No | **Yes** | **Yes** | No |
| Create Waybill | Yes | **Yes** | **Yes** | No | **Yes** | **Yes** | No |
| Confirm Waybill | Yes | No | **Yes** | **Yes** | **Yes** | **Yes** | No |
| View Stock Balances | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "No warehouses available" in GRN/GIN | Your user isn't assigned to any warehouse/hub | Go to Admin → User Assignments and assign the user |
| GIN says quantity exceeds balance | GRN wasn't confirmed yet | Go confirm the GRN first, then retry |
| Confirm button returns 403 | Your role can't confirm this document type | Switch to the correct role (see table above) |
| Stock balance didn't change after GRN confirm | Might be cached | Refresh the page; check the correct warehouse filter |
| Bole “Total Stock” unchanged / Rice looks wrong | **Total Stock** sums every commodity (and mixes kg + liters); Rice may sit on **multiple stacks** | Search **Rice**, use **Group by → Commodity**; compare Rice **total** to **after Step 1 GRN** (−500 after GIN), not to “before Step 1” (net zero) |
| Waybill source/destination same error | You picked the same warehouse for both | Pick different warehouses |
| No commodities in GIN dropdown | No stock balance exists for that warehouse | Create and confirm a GRN first |
| "Dispatch plan item must be fully authorized" | Tried to create Dispatch or Waybill before both hub authorizations exist | Complete Steps 0C and 0D first — both Source and Destination authorizations needed |
| Dispatch Planner can't see hubs/warehouses | Planner role doesn't need hub assignment | Planner sees all plans system-wide; this is correct behavior |
| Hub Dispatch Officer sees no plan items | Officer not assigned to any hub | Go to Admin → User Assignments, assign officer to the relevant hub |
| Plan item stuck at "Source Authorized" | Destination hub authorization missing | Login as the Hub Dispatch Approver at the destination hub and create the Destination authorization |
| 403 when creating hub authorization | User role doesn't have permission | Only Hub Dispatch Officer, Hub Dispatch Approver, Hub Manager, and Admin can create authorizations |

---

## Negative Testing Checklist (Expected Failures)

Run these tests to verify the system enforces the planner-gated workflow correctly:

| # | Test | How | Expected Result |
|---|------|-----|-----------------|
| N1 | Dispatch blocked before authorization | Create a plan item, then immediately try `POST /dispatches` referencing it | **422** — "Dispatch plan item must be fully authorized before execution" |
| N2 | Dispatch blocked with only Source auth | Create Source hub authorization, then try `POST /dispatches` | **422** — plan item is "Source Authorized" not "Dispatchable" |
| N3 | Storekeeper cannot create plan | Login as `store_keeper@example.com`, try `POST /dispatch_plans` | **403 Forbidden** |
| N4 | Planner cannot create hub authorization | Login as `planner@example.com`, try `POST /hub_authorizations` | **403 Forbidden** |
| N5 | Officer can only see assigned hub | Login as `dispatch_officer@example.com` (Bole), check `GET /dispatch_plan_items` — should only see items where source or destination is Bole | Only Bole-related items returned |
| N6 | Approver cannot create Dispatch | Login as `dispatch_approver@example.com`, try `POST /dispatches` | **403 Forbidden** |
| N7 | Waybill blocked if dispatch plan item not authorized | Create a waybill referencing a dispatch whose plan item is not Dispatchable | **422** — "Dispatch plan item must be fully authorized before execution" |

---

## Dispatch Plan Item Status Lifecycle

```
                   ┌─────────────────┐
                   │  Unauthorized   │  ← created
                   └────────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼                           ▼
   ┌─────────────────┐        ┌─────────────────────────┐
   │ Source Authorized│        │ Destination Authorized  │
   └────────┬────────┘        └────────────┬────────────┘
            │                              │
            └──────────┬───────────────────┘
                       ▼
              ┌─────────────────┐
              │  Dispatchable   │  ← both hubs approved
              └─────────────────┘
                       │
                       ▼
              Dispatch can now be created
```
