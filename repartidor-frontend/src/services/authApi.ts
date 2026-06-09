import { apiRequest } from './apiClient';
import { AuthResponse, LoginPayload, RegisterPayload, User } from '../types/auth';
import { sessionStorage } from './sessionStorage';

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: payload,
    });

    return response;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: payload,
    });

    return response;
  },

  async googleLogin(payload: { idToken: string; role: 'COURIER' }): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/google', {
      method: 'POST',
      body: payload,
    });
  },

  async validateSession(): Promise<User> {
    return apiRequest<User>('/auth/me');
  },

  async updateProfile(payload: {
    fullName?: string;
    username?: string;
    email?: string;
    phone?: string;
  }): Promise<User> {
    return apiRequest<User>('/auth/me', {
      method: 'PATCH',
      body: payload,
    });
  },

  async logout(): Promise<void> {
    await sessionStorage.clearSession();
  },
};
