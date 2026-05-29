import axios from 'axios';import { API_BASE_URL } from '../utils/constants';
import { useAuthStore } from '../store/authStore';
import { notifications } from '@mantine/notifications';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 60000, // 60 seconds — dispatch index can be heavy on first load
});

// Request interceptor to attach auth token and fix Content-Type for file uploads
apiClient.interceptors.request.use(
  (config) => {
    const { token, userId } = useAuthStore.getState();
    const hasValidToken = Boolean(token && token !== 'undefined' && token !== 'null');
    if (hasValidToken) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Dev supplement: allows backend to recover when the Bearer token is expired/invalid.
    if (import.meta.env.DEV && userId) {
      config.headers['X-User-Id'] = String(userId);
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // No response — server unreachable, timed out, or browser blocked the request (CORS).
    if (!error.response) {
      if (error.code === 'ERR_CANCELED' || axios.isCancel(error)) {
        return Promise.reject(error);
      }

      if (error.config?.skipGlobalErrorHandler) {
        return Promise.reject(error);
      }

      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const isLikelyCors =
        !isTimeout &&
        error.message === 'Network Error' &&
        typeof error.request !== 'undefined';
      notifications.show({
        title: isTimeout ? 'Request Timed Out' : 'Network Error',
        message: isTimeout
          ? 'The server took too long to respond. Please try again.'
          : isLikelyCors
            ? 'The request was blocked by the browser (often a CORS configuration issue). Check the server is running and CORS headers allow this request.'
            : 'Unable to connect to the server. Please check your internet connection.',
        color: 'red',
        autoClose: 5000,
      });
      return Promise.reject(error);
    }

    const { status, data } = error.response;
    const requestUrl = String(error.config?.url || '');
    const isAuthLoginRequest = requestUrl.includes('/auth/login');

    switch (status) {
      case 401:
        if (isAuthLoginRequest) {
          return Promise.reject(error);
        }

        // Unauthorized - clear auth and redirect to login
        notifications.show({
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again.',
          color: 'orange',
        });
        useAuthStore.getState().clearAuth();
        // Note: can't call queryClient.clear() here (no React context), but
        // window.location.href causes a full page reload which resets the cache.
        window.location.href = '/login';
        break;

      case 403:
        // Forbidden
        notifications.show({
          title: 'Access Denied',
          message: 'You do not have permission to perform this action.',
          color: 'red',
        });
        break;

      case 404:
        // Not found - let individual components handle this
        break;

      case 422:
        // Validation error - let individual components handle this
        break;

      case 500:
      case 502:
      case 503:
        // Server error
        notifications.show({
          title: 'Server Error',
          message: data?.error?.message || 'An unexpected server error occurred. Please try again later.',
          color: 'red',
        });
        break;

      default:
        // Other errors
        if (status >= 400) {
          notifications.show({
            title: 'Error',
            message: data?.error?.message || 'An error occurred. Please try again.',
            color: 'red',
          });
        }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
