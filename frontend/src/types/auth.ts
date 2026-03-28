export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user_id: number;
  role?: string;
}

export interface User {
  id: number;
  email: string;
  role: string;
  name?: string;
}
