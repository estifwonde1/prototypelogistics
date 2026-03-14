import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.userId);
  const role = useAuthStore((state) => state.role);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  return {
    token,
    userId,
    role,
    setAuth,
    clearAuth,
    isAuthenticated,
  };
}
