export interface Gin {
  id: number;
  reference_no: string;
  warehouse_id: number;
  issued_on: string;
  destination_type?: string;
  destination_id?: number;
  destination_name?: string;
  status: string;
  issued_by_id?: number;
  issued_by_name?: string;
  approved_by_id?: number;
  approved_by_name?: string;
  gin_items?: GinItem[];
  // Phase 3: Order linkage
  dispatch_order_id?: number;
  dispatch_order_authorization_id?: number;
  dispatch_order?: {
    id: number;
    destination_type: string;
    destination_name: string;
    status: string;
  };
  generated_from_waybill_id?: number;
  transporter_id?: number;
  transporter_name?: string;
  truck_plate_number?: string;
  driver_name?: string;
  driver_id_number?: string;
  driver_phone?: string;
  driver_confirmed_at?: string;
  driver_confirmed_by_id?: number;
  driver_confirmed_by_name?: string;
}

export interface GinItem {
  id?: number;
  gin_id?: number;
  commodity_id: number;
  commodity_name?: string;
  commodity_code?: string;
  quantity: number;
  unit_id: number;
  unit_name?: string;
  unit_abbreviation?: string;
  store_id?: number;
  store_name?: string;
  store_code?: string;
  stack_id?: number;
  stack_name?: string;
  stack_code?: string;
  // Phase 2: Lot/UOM fields
  batch_no?: string;
  expiry_date?: string;
  entered_unit_id?: number;
  entered_unit_name?: string;
  entered_quantity?: number;
  base_unit_id?: number;
  base_unit_name?: string;
  base_quantity?: number;
  inventory_lot_id?: number;
}
