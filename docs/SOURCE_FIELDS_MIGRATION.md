# Source Type and Source Name Migration

## Summary
Moved `source_type` and `source_name` fields from the Receipt Order form to the Commodity form. These fields now belong to the commodity data itself, not the receipt order. When a commodity with a specific batch number is called, it will include the source information.

## Changes Made

### Frontend Changes

#### 1. Type Definitions (`frontend/src/types/referenceData.ts`)
- Added `source_type?: string | null` to `CommodityReference` interface
- Added `source_name?: string | null` to `CommodityReference` interface

#### 2. API Layer (`frontend/src/api/referenceData.ts`)
- Added `source_type?: string` to `CreateCommodityPayload` interface
- Added `source_name?: string` to `CreateCommodityPayload` interface

#### 3. Commodity Form Page (`frontend/src/pages/officer/CommodityFormPage.tsx`)
- Added state variables: `sourceType` and `sourceName`
- Added `sourceTypeOptions` with values: 'Supplier' and 'Gift (Donation)'
- Added validation to require both fields before submission
- Added two new form fields:
  - Source Type (Select dropdown)
  - Source Name (Text input)
- Updated the commodity creation mutation to include these fields
- Updated the existing commodities table to display source_type and source_name columns
- Reset these fields after successful commodity creation

#### 4. Receipt Order Form Page (`frontend/src/pages/officer/ReceiptOrderFormPage.tsx`)
- Removed `sourceType` and `sourceName` state variables
- Removed `sourceTypeOptions` constant
- Removed source type and source name input fields from the form
- Removed source type and source name from validation logic
- Removed source type and source name from the payload sent to the API
- Removed hydration logic for these fields when editing existing orders

### Backend Changes

#### 1. Database Migration (`backend/warehouse-backend/db/migrate/20260416204229_add_source_fields_to_cats_core_commodities.rb`)
- Created migration to add `source_type` column (string) to `cats_core_commodities` table
- Created migration to add `source_name` column (string) to `cats_core_commodities` table
- Migration has been successfully executed

#### 2. Reference Data Controller (`backend/warehouse-backend/engines/cats_warehouse/app/controllers/cats/warehouse/reference_data_controller.rb`)
- Updated `create_commodity` method to permit `source_type` and `source_name` parameters
- Added `source_type` and `source_name` to the commodity creation attributes
- Updated the response JSON to include `source_type` and `source_name` fields
- Updated the `commodities` method to include `source_type` and `source_name` in the list response

## Impact

### User Workflow Changes
1. **Creating Commodities**: Users must now provide source type and source name when creating a new commodity
2. **Creating Receipt Orders**: Users no longer need to provide source information at the receipt order level
3. **Data Retrieval**: When fetching commodity data by batch number, the source information is automatically included

### Data Model Changes
- Source information is now permanently associated with each commodity batch
- Receipt orders are simplified and focus on destination and delivery information
- Commodities from the same source can be easily identified and tracked

## Testing Recommendations

1. **Create New Commodity**:
   - Navigate to the commodity form page
   - Fill in all required fields including source type and source name
   - Verify the commodity is created successfully
   - Check that the source information appears in the commodities list

2. **Create Receipt Order**:
   - Navigate to the receipt order form
   - Verify that source type and source name fields are no longer present
   - Create a receipt order with commodities
   - Verify the order is created successfully without source information

3. **View Commodity Details**:
   - Fetch a commodity by batch number
   - Verify that source_type and source_name are included in the response

4. **Backward Compatibility**:
   - Check existing commodities (created before migration)
   - Verify they display correctly with null/empty source fields
   - Ensure the application handles missing source data gracefully

## Database Schema Update

The `cats_core_commodities` table now includes:
```ruby
t.string "source_type"
t.string "source_name"
```

These fields are nullable to maintain backward compatibility with existing data.
