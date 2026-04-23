import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeRoleSlug } from '../contracts/warehouse';

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
  activeAssignment: OfficerAssignment | null;
  setAuth: (token: string, userId: number, role: string | null) => void;
  setAssignments: (assignments: OfficerAssignment[]) => void;
  setActiveAssignment: (assignment: OfficerAssignment | null) => void;
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
      activeAssignment: null,
      setAuth: (token, userId, role) => set({ token, userId, role }),
      setAssignments: (assignments) => set({ assignments }),
      setActiveAssignment: (activeAssignment) => set({ activeAssignment, role: activeAssignment?.role_name ? normalizeRoleSlug(activeAssignment.role_name) : null }),
      clearAuth: () => set({ token: null, userId: null, role: null, assignments: [], activeAssignment: null }),
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'auth-storage',
    }
  )
);
