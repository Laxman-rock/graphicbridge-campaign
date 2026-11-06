export interface User {
  id?: string;
  _id?: string;
  user_id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  designation?: string;
  phone?: string;
  contact_number?: string;
  image?: string;
  avatar?: string;
  employee_category?: string | null;
  employeeCategory?: string | null;
  category?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface UserListParams {
  status?: string;
  employee_category?: string;
  employeeCategory?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UserListResponse {
  success: boolean;
  data?: User[];
  users?: User[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
  message?: string;
}

export interface LoginCredentials {
  user_id: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  data?: {
    token?: string;
    user?: User;
    user_id?: string;
    [key: string]: unknown;
  };
  user?: User;
  error?: string;
  message?: string;
}

export interface AuthSession {
  token: string;
  user: User;
  expiresAt?: number;
}

