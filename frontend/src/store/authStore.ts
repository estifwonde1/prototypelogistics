import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OfficerAssignment {
  id: number;
  role_name: string;
  hub?: { id: number; name: string } | null;
  warehouse?: { id: number; name: string } | null;
  store?: { id: number; name: string } | null;
  location?: { id: number; name: string; location_type: string } | null;
}

interface AuthState {
  token: string | null;
  userId: number | null;
  role: string | null;
  assignments: OfficerAssignment[];
  setAuth: (token: string, userId: number, role: string) => void;
  setAssignments: (assignments: OfficerAssignment[]) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      userId: null,
      role: null,
      assignments: [],
      setAuth: (token, userId, role) => set({ token, userId, role }),
      setAssignments: (assignments) => set({ assignments }),
      clearAuth: () => set({ token: null, userId: null, role: null, assignments: [] }),
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'auth-storage',
    }
  )
);
