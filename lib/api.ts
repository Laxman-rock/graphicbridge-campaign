import axios, { AxiosError } from 'axios';
import { LoginCredentials, LoginResponse, User, UserListParams, UserListResponse } from '@/types/auth';
import { getAuthToken, clearAuthSession } from './auth';

const RAW_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://gb-billing-server-on-408163079626.asia-south2.run.app';

// Ensure no trailing slash
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor: attach token if present & handle FormData boundary
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // When uploading FormData, delete preset application/json Content-Type
    // so Axios and the browser automatically set 'multipart/form-data; boundary=...'
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
      delete (config.headers as Record<string, unknown>)['content-type'];
      if (typeof (config.headers as Record<string, unknown>).delete === 'function') {
        ((config.headers as unknown) as { delete: (k: string) => void }).delete('Content-Type');
        ((config.headers as unknown) as { delete: (k: string) => void }).delete('content-type');
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Avoid infinite redirect loop if already on login page
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        clearAuthSession();
        window.location.href = '/login?expired=1';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Authenticate user with staging API.
 * The verified backend endpoint is /api/users/login (with fallback to /users/login).
 */
export async function loginUser(credentials: LoginCredentials): Promise<LoginResponse> {
  const payload = {
    user_id: credentials.user_id.trim(),
    password: credentials.password,
  };

  try {
    // Verified endpoint on staging is /api/users/login
    const response = await apiClient.post<LoginResponse>('/api/users/login', payload);
    return response.data;
  } catch (err: unknown) {
    const axiosErr = err as AxiosError<LoginResponse>;

    // If 404 on /api/users/login, attempt fallback to /users/login as per prompt specification
    if (axiosErr.response?.status === 404) {
      try {
        const fallbackRes = await apiClient.post<LoginResponse>('/users/login', payload);
        return fallbackRes.data;
      } catch (fallbackErr: unknown) {
        const fbAxiosErr = fallbackErr as AxiosError<LoginResponse>;
        const fbData = fbAxiosErr.response?.data;
        const msg =
          fbData?.error ||
          fbData?.message ||
          fbAxiosErr.message ||
          'Failed to authenticate with backend server.';
        return {
          success: false,
          error: msg,
        };
      }
    }

    // Process structured error response
    const errorData = axiosErr.response?.data;
    let errorMessage = 'An unexpected error occurred during login. Please try again.';

    if (errorData?.error) {
      errorMessage = errorData.error;
    } else if (errorData?.message) {
      errorMessage = errorData.message;
    } else if (axiosErr.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out. Please check your network and try again.';
    } else if (!axiosErr.response) {
      errorMessage = 'Unable to connect to the staging API server. Please check your internet connection.';
    } else if (axiosErr.response.status === 400) {
      errorMessage = errorData?.error || 'Invalid credentials or missing required fields.';
    } else if (axiosErr.response.status === 404) {
      errorMessage = errorData?.error || 'User not found.';
    } else if (axiosErr.response.status >= 500) {
      errorMessage = 'Server error encountered. Please try again later.';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Fetch users / employees list with support for employee_category filtering.
 * Supported endpoints: GET /api/users (fallback: GET /users)
 * Query parameters: status, employee_category (single or comma-separated e.g. "IT,Production"), search, page, limit.
 */
export async function listUsers(params?: UserListParams): Promise<UserListResponse> {
  try {
    const queryParams: Record<string, any> = {};
    if (params) {
      if (params.status) queryParams.status = params.status;
      // Canonical employee_category parameter with fallback to aliases
      if (params.employee_category) {
        queryParams.employee_category = params.employee_category;
      } else if (params.employeeCategory) {
        queryParams.employee_category = params.employeeCategory;
      } else if (params.category) {
        queryParams.employee_category = params.category;
      }
      if (params.search) queryParams.search = params.search;
      if (params.page) queryParams.page = params.page;
      if (params.limit) queryParams.limit = params.limit;
    }

    let res;
    try {
      res = await apiClient.get<any>('/api/users', { params: queryParams });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        res = await apiClient.get<any>('/users', { params: queryParams });
      } else {
        throw err;
      }
    }

    const raw = res.data;
    let usersList: User[] = [];
    if (Array.isArray(raw)) {
      usersList = raw;
    } else if (raw && Array.isArray(raw.data)) {
      usersList = raw.data;
    } else if (raw && Array.isArray(raw.users)) {
      usersList = raw.users;
    } else if (raw && raw.data && Array.isArray(raw.data.users)) {
      usersList = raw.data.users;
    }

    // Safely map and preserve employee_category from backend fields
    usersList = usersList.map((u: any) => ({
      ...u,
      employee_category: u.employee_category ?? u.employeeCategory ?? u.category ?? null,
    }));

    return {
      success: raw?.success ?? true,
      data: usersList,
      pagination: raw?.pagination || raw?.meta,
    };
  } catch (err: unknown) {
    const axiosErr = err as AxiosError<any>;
    const errorData = axiosErr.response?.data;
    const msg =
      (typeof errorData === 'string' && errorData) ||
      errorData?.error ||
      errorData?.message ||
      axiosErr.message ||
      'Failed to load users list.';
    return {
      success: false,
      error: msg,
      data: [],
    };
  }
}


