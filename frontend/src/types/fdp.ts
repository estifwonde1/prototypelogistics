export interface Fdp {
  id: number;
  name: string;
  location_id?: number | null;
  location_name?: string | null;
  location_type?: string | null;
  number_of_families?: number | null;
  number_of_beneficiaries?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface FdpPayload {
  name: string;
  location_id?: number | null;
  location_name?: string | null;
  number_of_families?: number | null;
  number_of_beneficiaries?: number | null;
}
