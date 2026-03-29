export interface ReferenceOption {
  value: string;
  label: string;
}

export interface FacilityOptions {
  loading_dock_type: ReferenceOption[];
  access_road_type: ReferenceOption[];
  floor_type: ReferenceOption[];
  roof_type: ReferenceOption[];
}

export interface CommodityReference {
  id: number;
  name: string;
  code?: string | null;
  batch_no?: string | null;
  unit_id?: number | null;
  unit_name?: string | null;
  unit_abbreviation?: string | null;
}

export interface UnitReference {
  id: number;
  name: string;
  abbreviation?: string | null;
  unit_type?: string | null;
}
