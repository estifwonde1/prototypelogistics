import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { useAuthStore } from '../store/authStore';
import { notifications } from '@mantine/notifications';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor to attach auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
    // Network error (no response)
    if (!error.response) {
      notifications.show({
        title: 'Network Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        color: 'red',
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
