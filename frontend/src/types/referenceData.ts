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
