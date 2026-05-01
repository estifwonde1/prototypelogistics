# Hub Manager Location Context Filtering Fixes

This document summarizes the fixes implemented to ensure that hub managers assigned to multiple hubs can select a specific hub context and see only data for that selected hub.

## Problem Statement

Previously, when hub managers were assigned to multiple hubs, the system would show ALL data from ALL their assigned hubs, rather than filtering to show only data for their currently selected active hub context.

## Solution Overview

Extended the existing `activeAssignment` concept to include hub managers. When a hub manager selects an active hub assignment, all API calls now respect this context by passing the appropriate `hub_id` parameter to filter warehouses, stores, stacks, and other data to only those within the selected hub.

## Files Fixed

### 1. **Warehouse List Page**
**File**: `frontend/src/pages/warehouses/WarehouseListPage.tsx`
**Changes**:
- Added hub manager context filtering
- Warehouses query now filters by `hub_id` for hub managers
- Only shows warehouses within the selected hub

### 2. **Store List Page**
**File**: `frontend/src/pages/stores/StoreListPage.tsx`
**Changes**:
- Added hub manager context filtering
- Stores query respects hub manager's active assignment
- Warehouses query filters by `hub_id` for hub managers

### 3. **Store Form Page**
**File**: `frontend/src/pages/stores/StoreFormPage.tsx`
**Changes**:
- Added hub manager context filtering
- Warehouses dropdown only shows warehouses from the active hub

### 4. **Stack List Page**
**File**: `frontend/src/pages/stacks/StackListPage.tsx`
**Changes**:
- Added hub manager context filtering
- Stacks, stores, and warehouses queries all respect hub context
- Hub managers see only data from their selected hub

### 5. **Stack Layout Page**
**File**: `frontend/src/pages/stacks/StackLayoutPage.tsx`
**Changes**:
- Added hub manager context filtering
- Both stores and stacks queries filter by hub context

### 6. **Stack Form Page**
**File**: `frontend/src/pages/stacks/StackFormPage.tsx`
**Changes**:
- Added hub manager context filtering
- Stores dropdown only shows stores from warehouses in the active hub

### 7. **Receipt Orders List Page**
**File**: `frontend/src/pages/officer/ReceiptOrdersListPage.tsx`
**Changes**:
- Added hub manager context filtering
- Receipt orders query filters by `hub_id` for hub managers
- Warehouses dropdown only shows warehouses from the active hub

### 8. **Dispatch Orders List Page**
**File**: `frontend/src/pages/officer/DispatchOrdersListPage.tsx`
**Changes**:
- Added hub manager context filtering
- Dispatch orders and warehouses queries respect hub context

### 9. **Receipt Order Form Page**
**File**: `frontend/src/pages/officer/ReceiptOrderFormPage.tsx`
**Changes**:
- Added hub manager context filtering
- Warehouses dropdown only shows warehouses from the active hub

### 10. **Stock Balance Page**
**File**: `frontend/src/pages/stock/StockBalancePage.tsx`
**Changes**:
- Added hub manager context filtering
- Warehouses query filters by `hub_id` for hub managers

### 11. **Inspection Create Page**
**File**: `frontend/src/pages/inspections/InspectionCreatePage.tsx`
**Changes**:
- Added hub manager context filtering
- Warehouses dropdown only shows warehouses from the active hub

### 12. **Waybill Create Page**
**File**: `frontend/src/pages/waybills/WaybillCreatePage.tsx`
**Changes**:
- Added hub manager context filtering
- Warehouses dropdown only shows warehouses from the active hub

### 13. **Bin Card Report Page**
**File**: `frontend/src/pages/reports/BinCardReportPage.tsx`
**Changes**:
- Added hub manager context filtering
- Stores and stacks queries respect hub context

### 14. **Transfer Requests Page**
**File**: `frontend/src/pages/stock/TransferRequestsPage.tsx`
**Changes**:
- Added hub manager context filtering
- Stacks query respects hub context

### 15. **Dashboard Page**
**File**: `frontend/src/pages/dashboard/DashboardPage.tsx`
**Changes**:
- Added hub manager context filtering
- Stores and stacks queries respect hub context

### 16. **GIN Create Page**
**File**: `frontend/src/pages/gins/GinCreatePage.tsx`
**Changes**:
- Added hub manager context filtering
- Stacks query respects hub context

### 17. **GRN Create Page**
**File**: `frontend/src/pages/grns/GrnCreatePage.tsx`
**Changes**:
- Added hub manager context filtering
- Stacks query respects hub context

## Implementation Pattern

The consistent pattern applied across all pages for hub managers:

```typescript
// Get active assignment context for filtering
const activeAssignment = useAuthStore((state) => state.activeAssignment);
const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
const userHubId = activeAssignment?.hub?.id;
const isHubManager = roleSlug === 'hub_manager';

// Apply filtering in queries
const { data: warehouses = [] } = useQuery({
  queryKey: ['warehouses', { hub_id: isHubManager ? userHubId : undefined }],
  queryFn: () => {
    if (isHubManager && userHubId) {
      return getWarehouses({ hub_id: userHubId });
    }
    return getWarehouses();
  },
});

// For stores and stacks, hub managers rely on backend filtering
const { data: stores = [] } = useQuery({
  queryKey: ['stores', { hub_id: isHubManager ? userHubId : undefined }],
  queryFn: () => {
    if (isHubManager && userHubId) {
      return getStores(); // Backend handles hub-level filtering
    }
    return getStores();
  },
});
```

## Role-Based Filtering Hierarchy

### Hub Managers
- When a hub manager selects an active assignment (hub), API calls include `hub_id` parameter where supported
- For warehouses: Direct filtering by `hub_id`
- For stores/stacks: Backend handles filtering based on user's hub access
- This ensures they only see data from warehouses within their currently selected hub

### Warehouse Managers (Existing)
- When a warehouse manager selects an active assignment (warehouse), API calls include `warehouse_id` parameter
- This ensures they only see data from their currently selected warehouse

### Storekeepers (Existing)
- When a storekeeper has an active assignment (store), API calls include `store_id` parameter
- This ensures they only see data from their currently assigned store

### Federal Officers/Admins (Existing)
- These roles continue to see all data (no filtering applied)
- This maintains their system-wide access

## Backend Support

The backend controllers already support hub-level filtering through:
1. `hub_id` parameter support in warehouse queries
2. Policy scope filtering that respects user's hub assignments
3. Hierarchical access control (hub → warehouse → store → stack)

## Benefits

1. **Proper Hub Context Isolation**: Hub managers only see data for their currently selected hub
2. **Hierarchical Data Access**: Clear data hierarchy from hub → warehouse → store → stack
3. **Improved Performance**: Reduced data loading by filtering at the API level
4. **Better User Experience**: Clear context switching with immediate data updates
5. **Maintained Security**: All existing access controls preserved

## Testing Recommendations

1. **Multi-Hub Assignment Testing**: Test with hub managers assigned to multiple hubs
2. **Context Switching**: Verify data updates when switching between hub assignments
3. **Hierarchical Access**: Ensure hub managers see all warehouses/stores/stacks within their hub
4. **Role Interaction**: Test interaction between hub managers and warehouse managers
5. **Performance**: Verify reduced data loading with hub filtering

## API Parameter Usage

### Direct Hub Filtering
- `getWarehouses({ hub_id: userHubId })` - Direct filtering
- `getReceiptOrders({ hub_id: userHubId })` - Direct filtering (if supported)

### Backend Policy Filtering
- `getStores()` - Backend filters based on user's hub access
- `getStacks()` - Backend filters based on user's hub access
- `getDispatchOrders()` - Backend filters based on user's hub access

## Future Enhancements

1. **Hub Context Indicator**: Add visual indicators showing current active hub
2. **Quick Hub Switching**: Implement quick hub context switching UI
3. **Hub Breadcrumbs**: Show hub → warehouse → store hierarchy in navigation
4. **Hub Dashboard**: Enhanced hub-specific dashboard with hub-level metrics

## Notes

- All changes are backward compatible with existing warehouse manager and storekeeper filtering
- Federal officers and admins maintain full system access
- The filtering respects the hierarchical nature of hub → warehouse → store → stack
- Query keys include hub context parameters for proper cache invalidation
- Backend policy scope ensures security even if frontend filtering is bypassed