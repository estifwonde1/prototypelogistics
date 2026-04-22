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
  quantity?: number | null;
  unit_id?: number | null;
  unit_name?: string | null;
  unit_abbreviation?: string | null;
  package_unit_id?: number | null;
  package_unit_name?: string | null;
  package_size?: number | null;
  source_type?: string | null;
  source_name?: string | null;
  category_id?: number | null;
  category_name?: string | null;
}

export interface UnitReference {
  id: number;
  name: string;
  abbreviation?: string | null;
  unit_type?: string | null;
}

export interface TransporterReference {
  id: number;
  code?: string | null;
  name: string;
  address?: string | null;
  contact_phone?: string | null;
}

export interface InventoryLot {
  id: number;
  warehouse_id: number;
  warehouse_name?: string;
  commodity_id: number;
  lot_code: string;
  batch_no: string;
  expiry_date: string;
  received_on: string;
  status: string;
  display_name?: string;
}

export interface UomConversion {
  id: number;
  commodity_id?: number;
  from_unit_id: number;
  from_unit_name?: string;
  to_unit_id: number;
  to_unit_name?: string;
  multiplier: number;
  active: boolean;
  conversion_type?: string;
}

export interface CommodityCategory {
  id: number;
  name: string;
  code?: string;
}
