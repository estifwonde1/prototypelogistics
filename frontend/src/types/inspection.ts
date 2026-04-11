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
  commodity_name?: string;
  commodity_code?: string;
  /** Unique source-detail reference; doubles as batch identity on intake. */
  line_reference_no?: string;
  /** Resolved lot batch when present (API). */
  batch_no?: string;
  unit_id?: number;
  quantity_received: number;
  quantity_damaged?: number;
  quantity_lost?: number;
  quality_status: string;
  packaging_condition: string;
  remarks?: string;
}
