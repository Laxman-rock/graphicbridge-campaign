export interface User {
  id?: string;
  user_id: string;
  name?: string;
  email?: string;
  role?: string;
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

