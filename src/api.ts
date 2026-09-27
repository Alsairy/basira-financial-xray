let csrfToken = '';
export const setCsrf = (value: string) => {
  csrfToken = value;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public messageAr: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      signal: options.signal || controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(!['GET', 'HEAD'].includes(method) ? { 'X-CSRF-Token': csrfToken } : {}),
        ...options.headers,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = payload.error || {};
      throw new ApiError(
        response.status,
        err.code || 'REQUEST_FAILED',
        err.message || 'Request failed',
        err.message_ar || err.message || 'تعذر إتمام الطلب',
        err.details,
      );
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export async function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
