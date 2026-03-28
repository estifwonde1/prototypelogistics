export interface AdminRole {
  id: number;
  name: string;
}

export interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  active: boolean;
  roles: string[];
}

export interface AdminUserAssignment {
  id: number;
  role_name: string;
  user: { id: number; name: string; email: string } | null;
  hub?: { id: number; name: string } | null;
  warehouse?: { id: number; name: string } | null;
  store?: { id: number; name: string } | null;
}

export interface LocationOption {
  id: number;
  name: string;
  code?: string;
  parent_id?: number | null;
}
