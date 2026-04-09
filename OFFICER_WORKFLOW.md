# Officer Role - End-to-End Workflows

## Role Overview
The Officer role is a **coordinator** who orchestrates warehouse operations by creating and managing receipt and dispatch orders. Officers have visibility across all facilities but cannot perform warehouse operations directly.

---

## Workflow 1: Receiving Goods (Receipt Order → GRN)

### Step 1: Officer Creates Receipt Order
1. Officer logs in and navigates to Dashboard
2. Clicks "Create Receipt Order" button
3. Fills in order details:
   - Source Type: Supplier/Donor/Transfer
   - Source Name: Name of supplier/donor
   - Destination Warehouse: Select from dropdown
   - Expected Delivery Date: Date picker
   - Notes: Optional notes
4. Adds line items:
   - Commodity: Select from dropdown
   - Quantity: Enter amount
   - Unit: Select unit (kg, bags, boxes, etc.)
   - Unit Price: Optional price
   - Notes: Optional item notes
5. Clicks "Save as Draft"

**Result:** Receipt Order created with status "Draft"

### Step 2: Officer Reviews and Confirms Order
1. Officer navigates to Receipt Orders list
2. Clicks on the draft order to view details
3. Reviews all information
4. Clicks "Confirm Order" button
5. Confirms in dialog

**Result:** Receipt Order status changes to "Confirmed"

### Step 3: Officer Assigns to Warehouse Manager (Phase 3)
1. Officer opens confirmed receipt order
2. Navigates to "Assignments" tab
3. Clicks "+ Assign Warehouse" button
4. Selects warehouse manager from dropdown
5. Adds assignment notes
6. Clicks "Create Assignment"

**Result:** Warehouse manager receives assignment notification

### Step 4: Officer Reserves Space (Phase 3)
1. Officer stays on receipt order detail page
2. Navigates to "Space Reservations" tab
3. Clicks "+ Reserve Space" button
4. Selects store from dropdown
5. Enters quantity to reserve
6. Adds reservation notes
7. Clicks "Reserve Space"

**Result:** Space reserved in warehouse for incoming goods

### Step 5: Warehouse Manager Creates GRN
1. Warehouse manager logs in
2. Goods arrive at warehouse
3. Manager creates GRN:
   - Links to Receipt Order (shows RO-123)
   - Adds received quantities
   - Adds batch numbers and expiry dates (Phase 2)
   - Selects store and stack locations
   - Enters UOM conversions if needed (Phase 2)
4. Manager confirms GRN

**Result:** Stock updated, GRN shows "Generated from Receipt Order RO-123"

### Step 6: Officer Tracks Workflow
1. Officer opens receipt order detail page
2. Navigates to "Workflow Timeline" tab
3. Views complete history:
   - Order created by Officer
   - Order confirmed by Officer
   - Assignment created
   - Space reserved
   - GRN created by Manager
   - GRN confirmed by Manager
   - Stock updated

**Result:** Complete audit trail visible

---

## Workflow 2: Dispatching Goods (Dispatch Order → GIN)

### Step 1: Officer Creates Dispatch Order
1. Officer logs in and navigates to Dashboard
2. Clicks "Create Dispatch Order" button
3. Fills in order details:
   - Source Warehouse: Select from dropdown
   - Destination Type: Beneficiary/Warehouse/Other
   - Destination Name: Name of destination
   - Expected Pickup Date: Date picker
   - Notes: Optional notes
4. Adds line items:
   - Commodity: Select from dropdown
   - Quantity: Enter amount
   - Unit: Select unit
   - Notes: Optional item notes
5. Clicks "Save as Draft"

**Result:** Dispatch Order created with status "Draft"

### Step 2: Officer Reviews and Confirms Order
1. Officer navigates to Dispatch Orders list
2. Clicks on the draft order to view details
3. Reviews all information
4. Clicks "Confirm Order" button
5. Confirms in dialog

**Result:** Dispatch Order status changes to "Confirmed"

### Step 3: Officer Assigns to Warehouse Manager (Phase 3)
1. Officer opens confirmed dispatch order
2. Navigates to "Assignments" tab
3. Clicks "+ Assign Warehouse" button
4. Selects warehouse manager from dropdown
5. Adds assignment notes
6. Clicks "Create Assignment"

**Result:** Warehouse manager receives assignment notification

### Step 4: Officer Reserves Stock (Phase 3)
1. Officer stays on dispatch order detail page
2. Navigates to "Stock Reservations" tab
3. Clicks "+ Reserve Stock" button
4. Selects commodity from dropdown
5. Enters quantity to reserve
6. Adds reservation notes
7. Clicks "Reserve Stock"

**Result:** Stock reserved for dispatch

### Step 5: Warehouse Manager Creates GIN
1. Warehouse manager logs in
2. Prepares goods for dispatch
3. Manager creates GIN:
   - Links to Dispatch Order (shows DO-456)
   - Selects lots/batches to issue (Phase 2)
   - Confirms quantities
   - Selects store and stack locations
   - Reviews UOM conversions (Phase 2)
4. Manager confirms GIN

**Result:** Stock deducted, GIN shows "Generated from Dispatch Order DO-456"

### Step 6: Officer Tracks Workflow
1. Officer opens dispatch order detail page
2. Navigates to "Workflow Timeline" tab
3. Views complete history:
   - Order created by Officer
   - Order confirmed by Officer
   - Assignment created
   - Stock reserved
   - GIN created by Manager
   - GIN confirmed by Manager
   - Stock deducted

**Result:** Complete audit trail visible

---

## Officer Dashboard Features

### Statistics Displayed
- **Hubs Overview:** Total number of hubs
- **Inbound Summary:** Draft and Confirmed receipt orders
- **Outbound Summary:** Draft and Confirmed dispatch orders

### Quick Actions
- Create Receipt Order button
- Create Dispatch Order button

### Navigation
- Dashboard
- Receipt Orders (list, create, view, edit)
- Dispatch Orders (list, create, view, edit)

---

## Integration with Other Roles

### With Warehouse Managers
- Officer creates and confirms orders
- Officer assigns orders to managers
- Officer reserves space/stock
- Manager accepts assignments
- Manager creates GRN/GIN
- Manager confirms GRN/GIN
- Both can view workflow timeline

### With Storekeepers
- Officer creates orders
- Storekeeper can view orders
- Storekeeper helps with GRN/GIN creation
- Storekeeper manages lot tracking

### With Hub Managers
- Officer creates orders across all hubs
- Hub manager can view orders in their hub
- Hub manager can assign to warehouse managers

### With Admins
- Admin has full visibility
- Admin can override any operation
- Admin can view all officer activities

---

## Key Features

### Traceability (Phase 2)
- Batch numbers tracked on all documents
- Expiry dates with visual indicators
- UOM conversions recorded
- Complete lot history

### Workflow Management (Phase 3)
- Assignment workflow with accept/reject
- Space and stock reservations
- Complete audit trail
- Order linkage in GRN/GIN

### Permissions
- View all facilities and documents
- Create and manage orders
- Cannot perform warehouse operations
- Cannot modify facility structures

---

## Best Practices

### For Officers
1. Always confirm orders before assigning
2. Reserve space/stock early to avoid conflicts
3. Monitor workflow timeline for delays
4. Add clear notes for warehouse managers
5. Review GRN/GIN after creation to verify

### For System Administrators
1. Ensure officers are properly trained
2. Monitor order creation patterns
3. Review workflow timelines for bottlenecks
4. Set up notifications for assignments
5. Regular audits of order confirmations

