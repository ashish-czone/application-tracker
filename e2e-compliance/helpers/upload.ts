import { readStoredTokens } from '../fixtures/auth';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3012';
const API_BASE = `${API_URL}/api/v1`;

/**
 * Multipart upload helper. The shared `apiClient` always sends JSON;
 * the attachments controller's POST /attachments/upload expects
 * multipart/form-data. Kept tiny on purpose — only the attachments
 * fixture needs it.
 */
export async function postMultipart<T = unknown>(
  path: string,
  fields: Record<string, string>,
  file: { name: string; mimeType: string; content: Uint8Array | string },
): Promise<T> {
  const token = readStoredTokens().accessToken;
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);

  const blob = typeof file.content === 'string'
    ? new Blob([file.content], { type: file.mimeType })
    : new Blob([new Uint8Array(file.content)], { type: file.mimeType });
  form.append('file', blob, file.name);

  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`e2e multipart POST ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
