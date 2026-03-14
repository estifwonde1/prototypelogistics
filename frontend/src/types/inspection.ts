export interface Inspection {
  id: number;
  reference_no: string;
  warehouse_id: number;
  inspected_on: string;
  inspector_id?: number;
  source_type?: string;
  source_id?: number;
  status: string;
  inspection_items?: InspectionItem[];
}

export interface InspectionItem {
  id?: number;
  inspection_id?: number;
  commodity_id: number;
  quantity_received: number;
  quantity_damaged?: number;
  quantity_lost?: number;
  quality_status: string;
  packaging_condition: string;
  remarks?: string;
}
