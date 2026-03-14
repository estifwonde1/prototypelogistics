export interface Gin {
  id: number;
  reference_no: string;
  warehouse_id: number;
  issued_on: string;
  destination_type?: string;
  destination_id?: number;
  status: string;
  issued_by_id?: number;
  approved_by_id?: number;
  gin_items?: GinItem[];
}

export interface GinItem {
  id?: number;
  gin_id?: number;
  commodity_id: number;
  quantity: number;
  unit_id: number;
  store_id?: number;
  stack_id?: number;
}
