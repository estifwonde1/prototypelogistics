# Location Context Filtering Fixes

This document summarizes the fixes implemented to ensure that when hub or warehouse managers are assigned to multiple locations, they can select a specific location context and see only data for that selected location.

## Problem Statement

Previously, when managers were assigned to multiple locations, the system would show ALL data from ALL their assigned locations, rather than filtering to show only data for their currently selected active location context.

## Solution Overview

The system already had an `activeAssignment` concept in the auth store where users can select which location they're currently working with. The fix involved ensuring all API calls respect this active assignment context by passing the appropriate warehouse_id, hub_id, or store_id parameters.

## Files Fixed

### 1. **Stack Layout Page**
**File**: `frontend/src/pages/stacks/StackLayoutPage.tsx`
**Changes**:
- Added active assignment context filtering
- Stores query now filters by `warehouse_id` for warehouse managers
- Stacks query filters by `warehouse_id` for warehouse managers or `store_id` for storekeepers

### 2. **Stack Form Page**
**File**: `frontend/src/pages/stacks/StackFormPage.tsx`
**Changes**:
- Added active assignment context filtering
- Stores query now filters by `warehouse_id` for warehouse managers

### 3. **Bin Card Report Page**
**File**: `frontend/src/pages/reports/BinCardReportPage.tsx`
**Changes**:
- Added active assignment context filtering
- Both stores and stacks queries now respect user's active assignment

### 4. **Transfer Requests Page**
**File**: `frontend/src/pages/stock/TransferRequestsPage.tsx`
**Changes**:
- Added active assignment context filtering
- Stacks query filters by warehouse or store based on user role

### 5. **GIN Create Page**
**File**: `frontend/src/pages/gins/GinCreatePage.tsx`
**Changes**:
- Added active assignment context filtering
- Stacks query respects user's active assignment

### 6. **GRN Create Page**
**File**: `frontend/src/pages/grns/GrnCreatePage.tsx`
**Changes**:
- Added active assignment context filtering
- Stacks query respects user's active assignment

### 7. **Dashboard Page**
**File**: `frontend/src/pages/dashboard/DashboardPage.tsx`
**Changes**:
- Added active assignment context filtering
- Both stores and stacks queries now filter by user's active assignment

### 8. **Transfer Request Modal**
**File**: `frontend/src/components/stacks/TransferRequestModal.tsx`
**Changes**:
- Modified to use active assignment when loading stores
- Ensures only stores from the active warehouse are shown

### 9. **Stack Transfer Modal**
**File**: `frontend/src/components/stacks/StackTransferModal.tsx`
**Changes**:
- Modified to use active assignment when loading stacks
- Ensures only stacks from the active warehouse are shown

### 10. **Warehouse Detail Page**
**File**: `frontend/src/pages/warehouses/WarehouseDetailPage.tsx`
**Changes**:
- Added active assignment context for initial data loading
- Still shows all stores for the specific warehouse being viewed (correct behavior)

## Implementation Pattern

The consistent pattern applied across all pages:

```typescript
// Get active assignment context for filtering
const activeAssignment = useAuthStore((state) => state.activeAssignment);
const roleSlug = normalizeRoleSlug(useAuthStore((state) => state.role));
const userWarehouseId = activeAssignment?.warehouse?.id;
const userStoreId = activeAssignment?.store?.id;
const isWarehouseManager = roleSlug === 'warehouse_manager';
const isStorekeeper = roleSlug === 'storekeeper';

// Apply filtering in queries
const { data: stores = [] } = useQuery({
  queryKey: ['stores', { warehouse_id: isWarehouseManager ? userWarehouseId : undefined }],
  queryFn: () => {
    if (isWarehouseManager && userWarehouseId) {
      return getStores({ warehouse_id: userWarehouseId });
    }
    return getStores();
  },
});

const { data: stacks } = useQuery({
  queryKey: ['stacks', { 
    warehouse_id: isWarehouseManager ? userWarehouseId : undefined,
    store_id: isStorekeeper ? userStoreId : undefined 
  }],
  queryFn: () => {
    if (isWarehouseManager && userWarehouseId) {
      return getStacks({ warehouse_id: userWarehouseId });
    } else if (isStorekeeper && userStoreId) {
      return getStacks({ store_id: userStoreId });
    }
    return getStacks();
  },
});
```

## Role-Based Filtering Logic

### Warehouse Managers
- When a warehouse manager selects an active assignment (warehouse), all API calls include `warehouse_id` parameter
- This ensures they only see stores, stacks, and other data from their currently selected warehouse
- If they switch to a different warehouse assignment, the data automatically updates

### Storekeepers
- When a storekeeper has an active assignment (store), API calls include `store_id` parameter
- This ensures they only see stacks and data from their currently assigned store

### Hub Managers
- Hub managers see data from all warehouses under their assigned hub
- The existing hub-level filtering in the backend handles this correctly

### Federal Officers/Admins
- These roles continue to see all data (no filtering applied)
- This maintains their system-wide access

## Backend Support

The backend controllers were already updated in the previous security fixes to:
1. Validate warehouse_id parameters against user access
2. Properly filter data based on the provided parameters
3. Ensure authorization checks are in place

## Benefits

1. **Proper Context Isolation**: Managers only see data for their currently selected location
2. **Improved Performance**: Reduced data loading by filtering at the API level
3. **Better User Experience**: Clear context switching with immediate data updates
4. **Security**: Maintains proper access control while enabling context switching

## Testing Recommendations

1. **Multi-Assignment Testing**: Test with users assigned to multiple warehouses/stores
2. **Context Switching**: Verify data updates when switching between assignments
3. **Role-Based Access**: Ensure each role sees appropriate data scope
4. **Performance**: Verify reduced data loading with filtering

## Future Enhancements

1. **Context Indicator**: Add visual indicators showing current active context
2. **Quick Switching**: Implement quick context switching UI component
3. **Context Memory**: Remember last selected context per user
4. **Breadcrumb Navigation**: Show current location context in navigation

## Notes

- All changes are backward compatible
- Federal officers and admins maintain full system access
- The filtering is applied at the query level, not just UI filtering
- Query keys include context parameters for proper cache invalidation