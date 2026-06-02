# 12 — End-to-End Workflows

Cross-role process maps. Use with your role chapter for button-level detail.

---

## Workflow A — Hub-scoped inbound (full chain)

**Scenario:** Officer sends goods to a **Hub**; hub assigns warehouse; warehouse assigns store; storekeeper stacks; trucks deliver via RA; GRN updates stock.

```
Officer → Hub Manager → Warehouse Manager → Storekeeper → RA → GRN
```

### Step-by-step

| # | Role | Action | System result |
|---|------|--------|---------------|
| 1 | Officer | Create receipt order → destination **Hub** → **Confirm** | RO confirmed |
| 2 | Officer | Assignments → **+ Assign Manager** → Hub Manager | Hub manager notified |
| 3 | Hub Manager | Assignments → **+ Assign Warehouse** | WH manager notified |
| 4 | Warehouse Manager | Assignments → **+ Assign Store** | Storekeeper notified |
| 5 | Storekeeper | **My Assignments** → **Accept & Prepare Stack** | Stack layout opens |
| 6 | Storekeeper | Create stack(s) on layout board | Space prepared |
| 7 | Hub Manager | **Receipt Authorizations** → create RA | RA active |
| 8 | Storekeeper | **Receive Receipt** → complete RA | Delivery recorded |
| 9 | Storekeeper / WH Mgr | **GRN** draft | Draft GRN |
| 10 | Warehouse Manager | **Confirm GRN** | Stock increased |
| 11 | Officer | **Workflow Timeline** | Full audit trail |

---

## Workflow B — Warehouse-scoped inbound (skip hub)

```
Officer → Warehouse Manager → Storekeeper → RA (optional) → GRN
```

| # | Role | Action |
|---|------|--------|
| 1 | Officer | RO destination = **Warehouse** |
| 2 | Officer | Assign **Warehouse Manager** |
| 3 | WH Manager | Assign **store** |
| 4 | Storekeeper | Accept → stack layout |
| 5 | WH Manager | Create **RA** (if enabled) |
| 6 | WH Manager | **Confirm GRN** |

---

## Workflow C — Outbound dispatch

```
Officer → Warehouse Manager → GIN → Waybill
```

| # | Role | Action | System result |
|---|------|--------|---------------|
| 1 | Officer | Create & **confirm** dispatch order | DO confirmed |
| 2 | Officer | Assign **warehouse manager** | WH manager notified |
| 3 | WH Manager | Create **GIN** → select stacks | Draft GIN |
| 4 | WH Manager | **Confirm GIN** | Stock decreased |
| 5 | WH Manager | **Waybill** (if required) | Transport doc |
| 6 | Officer | **Workflow Timeline** | Audit trail |

---

## Workflow D — Inter-store transfer

```
Storekeeper → Warehouse Manager
```

| # | Role | Action |
|---|------|--------|
| 1 | Storekeeper | **Transfer Requests** → New |
| 2 | WH Manager | Approve/update |
| 3 | System | Stock balances updated |

---

## Assignment visibility matrix

| Role | Sees assignments | Creates assignments |
|------|------------------|---------------------|
| Officer | All in scope | Hub Mgr / WH Mgr |
| Hub Manager | Hub & WH (no store) | Warehouse |
| Warehouse Manager | WH & store | Store |
| Storekeeper | Own store | Accept only |

---

## Document status progression

**Orders:** Draft → Confirmed → In Progress → Completed  
**GRN / GIN:** Draft → Confirmed (stock moves on confirm)  
**Receipt Authorization:** Created → received → reconciled to GRN

---

## Quick reference — who creates what

| Document | Primary creator | Primary confirmer |
|----------|-----------------|-------------------|
| Receipt Order | Officer | Officer |
| Dispatch Order | Officer | Officer |
| Assignment | Officer / Hub Mgr / WH Mgr | — |
| Receipt Authorization | Hub Mgr / WH Mgr | — |
| GRN | Storekeeper / WH Mgr | WH Manager |
| GIN | WH Manager | WH Manager |
| Waybill | Hub Mgr / WH Mgr | Same |
| Transfer Request | Storekeeper | WH Manager |

---

## Training exercise order

1. Admin — users and assignments  
2. Federal Officer — hub-scoped receipt order  
3. Hub Manager — warehouse + RA  
4. WH Manager — store assignment + GRN confirm  
5. Storekeeper — accept, stacks, receive  
6. Officer — workflow timeline  
7. Dispatch order → GIN  

Return to [User Manual index](README.md)
