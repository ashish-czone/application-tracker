import { tokenStore } from '@packages/auth-ui';

/**
 * Resolves the API base URL the same way `apps/compliance-web/src/lib/api.ts`
 * does — `VITE_API_URL` if set, else `/api/v1`. Reading the same env var
 * here keeps dev / staging / prod consistent without an explicit prop.
 */
function apiBaseUrl(): string {
  return (
    (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env
      ?.VITE_API_URL ?? '/api/v1'
  );
}

/**
 * Download a CSV report from the API as a file.
 *
 * Why a custom helper instead of `apiFn.get(...)`:
 *
 *  - The shared `ApiFn` always parses the response as JSON; CSV would
 *    be mangled on the way back.
 *  - `window.location = '/api/.../foo.csv'` would skip the `Authorization:
 *    Bearer` header (the auth tokens live in localStorage, not cookies),
 *    so the request 401s before it reaches the controller.
 *
 * The helper attaches the current access token, fetches as a blob, and
 * triggers a download via a synthetic `<a download>`. Filename is taken
 * from the server's `Content-Disposition` header so the date stamp the
 * controller produced (today's calendar date) wins.
 *
 * Lives in the customer reports feature folder because nothing else in
 * compliance needs CSV downloads today. If a second consumer ever needs
 * it, lift verbatim into a shared customer-portal helper — there is no
 * state.
 */
export async function downloadReportCsv(
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const accessToken = tokenStore.getAccessToken();
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${apiBaseUrl()}${path}`, { headers });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`CSV download failed (${res.status}): ${errorBody}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const filename = parseDispositionFilename(
    res.headers.get('content-disposition') ?? '',
  ) ?? fallbackFilename;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Extract `filename="…"` from a Content-Disposition header. Only the
 * RFC 6266 quoted form the controller emits is matched; the older
 * unquoted form is ignored (we control the server, no need to be lax).
 */
export function parseDispositionFilename(header: string): string | null {
  const match = /filename="([^"]+)"/.exec(header);
  return match ? match[1] : null;
}
