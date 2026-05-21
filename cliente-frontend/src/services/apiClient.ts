import { sessionStorage } from './sessionStorage';
import { ApiError, normalizeApiMessage } from './apiError';

class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await sessionStorage.getAccessToken();
    } catch {
      return null;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const token = await this.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;

    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch {
      throw new ApiError(
        'Sin conexion. Revisa tu internet e intenta de nuevo.',
        0,
        'network'
      );
    }

    const responseText = await response.text();
    const data = responseText ? (JSON.parse(responseText) as unknown) : null;

    if (!response.ok) {
      if (response.status === 401) {
        throw new ApiError('Tu sesion expiro. Inicia sesion nuevamente.', 401, 'unauthorized');
      }

      if (response.status === 404) {
        throw new ApiError('Recurso no encontrado.', 404, 'not_found');
      }

      throw new ApiError(normalizeApiMessage(data), response.status);
    }

    return data as T;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: unknown, headers: HeadersInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

const apiClient = new ApiClient(
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'
);

export default apiClient;
