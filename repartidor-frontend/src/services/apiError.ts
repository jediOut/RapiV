export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: 'network' | 'unauthorized' | 'not_found' | 'api' = 'api'
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function normalizeApiMessage(data: unknown): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;

    if (Array.isArray(message)) {
      return message.join('\n');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return 'No se pudo completar la solicitud.';
}
