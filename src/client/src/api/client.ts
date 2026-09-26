// Typed API client for Jobsapply React Client

const STORAGE_KEY_TOKEN = 'myjobapply_token';

export async function api<T = any>(endpoint: string, options: RequestInit = {}): Promise<{ success: boolean; data: T; error?: string }> {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({ success: false, error: 'Failed to parse JSON response' }));

  if (!response.ok || json.success === false) {
    const errorMsg = json.error || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return json;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
