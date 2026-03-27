export interface Dispatch {
  id: number;
  reference_no?: string | null;
  dispatch_plan_item_id: number;
  transporter_id: number;
  plate_no: string;
  driver_name: string;
  driver_phone: string;
  quantity: number;
  unit_id: number;
  unit_name?: string | null;
  unit_abbreviation?: string | null;
  commodity_name?: string | null;
  commodity_code?: string | null;
  commodity_status: string;
  remark?: string | null;
  prepared_by_id: number;
  dispatch_status: string;
  created_at: string;
  updated_at: string;
}
