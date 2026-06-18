import { EXPO_PUBLIC_API_URL } from '../config/api';
import { ApiError, normalizeApiMessage } from './apiError';
import { sessionStorage } from './sessionStorage';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(
  path: string,
  { method = 'GET', token, body, headers = {} }: ApiRequestOptions = {}
): Promise<T> {
  const authToken = token ?? (await sessionStorage.getAccessToken());

  let response: Response;

  try {
    response = await fetch(`${EXPO_PUBLIC_API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'Sin conexión. Revisa tu internet e intenta de nuevo.',
      0,
      'network'
    );
  }

  const responseText = await response.text();
  const data = responseText ? (JSON.parse(responseText) as unknown) : null;

  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiError('Tu sesión expiró. Inicia sesión nuevamente.', 401, 'unauthorized');
    }

    if (response.status === 404) {
      throw new ApiError('Recurso no encontrado.', 404, 'not_found');
    }

    throw new ApiError(normalizeApiMessage(data), response.status);
  }

  return data as T;
}

export const apiClient = {
  get: async <T>(url: string) => {
    return apiRequest<T>(url);
  },
  post: async <T>(url: string, data: unknown) => {
    return apiRequest<T>(url, { method: 'POST', body: data });
  },
};
