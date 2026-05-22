import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import { AuthResponse, LoginPayload, RegisterPayload, User } from '../types/auth';
import { sessionStorage } from './sessionStorage';

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(API_ENDPOINTS.LOGIN, payload);
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(API_ENDPOINTS.REGISTER, payload);
  },

  async validateSession(): Promise<User> {
    return apiClient.get<User>('/auth/me');
  },

  async updateProfile(payload: {
    fullName?: string;
    username?: string;
    email?: string;
    phone?: string;
    address?: string;
  }): Promise<User> {
    return apiClient.patch<User>('/auth/me', payload);
  },

  async logout(): Promise<void> {
    await sessionStorage.clearSession();
  },
};
