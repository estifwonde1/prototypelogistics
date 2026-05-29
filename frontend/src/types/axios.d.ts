import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** When true, network/timeout failures skip the global error toast. */
    skipGlobalErrorHandler?: boolean;
  }
}
