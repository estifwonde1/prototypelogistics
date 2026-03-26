export interface Receipt {
  id: number;
  reference_no?: string | null;
  receipt_authorization_id: number;
  commodity_id?: number | null;
  commodity_name?: string | null;
  commodity_status: string;
  commodity_grade?: string | null;
  quantity: number;
  unit_id: number;
  unit_name?: string | null;
  unit_abbreviation?: string | null;
  remark?: string | null;
  created_at: string;
  updated_at: string;
}
