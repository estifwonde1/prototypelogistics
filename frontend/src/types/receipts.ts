export interface Receipt {
  id: number;
  reference_no?: string | null;
  receipt_authorization_id: number;
  commodity_status: string;
  commodity_grade?: string | null;
  quantity: number;
  unit_id: number;
  remark?: string | null;
  created_at: string;
  updated_at: string;
}
