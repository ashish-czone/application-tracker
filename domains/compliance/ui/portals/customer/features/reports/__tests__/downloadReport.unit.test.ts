/**
 * @vitest-environment happy-dom
 *
 * The download path manipulates `document` + `URL.createObjectURL` —
 * needs a DOM. Other UI tests don't, so the shared vitest config keeps
 * the default `node` environment and individual files opt in.
 * Compliance UI already depends on happy-dom (used by other component
 * tests); we reuse it here to avoid adding jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadReport, parseDispositionFilename } from '../downloadReport';

/**
 * Stub `tokenStore.getAccessToken` so the helper can attach the token
 * header without a real auth context. The unit test focuses on the
 * fetch -> blob -> synthetic-anchor pipeline, not the auth layer.
 */
vi.mock('@packages/auth-ui', () => ({
  tokenStore: {
    getAccessToken: () => 'test-token',
  },
}));

describe('parseDispositionFilename', () => {
  it('extracts filename from RFC 6266 quoted form (CSV)', () => {
    expect(
      parseDispositionFilename(
        'attachment; filename="overdue-report-2026-05-03.csv"',
      ),
    ).toBe('overdue-report-2026-05-03.csv');
  });

  it('extracts filename from RFC 6266 quoted form (PDF)', () => {
    expect(
      parseDispositionFilename(
        'attachment; filename="compliance-report-2026-05-03.pdf"',
      ),
    ).toBe('compliance-report-2026-05-03.pdf');
  });

  it('returns null when the header is empty', () => {
    expect(parseDispositionFilename('')).toBe(null);
  });

  it('returns null when the header has no filename param', () => {
    expect(parseDispositionFilename('attachment')).toBe(null);
  });

  it('does not match the older unquoted form', () => {
    // We control the server and emit the quoted form unconditionally.
    expect(
      parseDispositionFilename('attachment; filename=foo.csv'),
    ).toBe(null);
  });
});

describe('downloadReport', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let createdLinks: Array<{ href: string; download: string; clicked: boolean }>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url') as never;
    URL.revokeObjectURL = vi.fn() as never;

    createdLinks = [];
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === 'a') {
        const tracker = { href: '', download: '', clicked: false };
        createdLinks.push(tracker);
        Object.defineProperty(el, 'href', {
          set: (v: string) => {
            tracker.href = v;
          },
          get: () => tracker.href,
          configurable: true,
        });
        Object.defineProperty(el, 'download', {
          set: (v: string) => {
            tracker.download = v;
          },
          get: () => tracker.download,
          configurable: true,
        });
        el.click = () => {
          tracker.clicked = true;
        };
      }
      return el;
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('downloads a CSV report and uses the server-provided filename', async () => {
    globalThis.fetch = vi.fn(async () => {
      const headers = {
        get: (k: string) =>
          k.toLowerCase() === 'content-disposition'
            ? 'attachment; filename="overdue-report-2026-05-03.csv"'
            : null,
      };
      return {
        ok: true,
        headers,
        blob: async () => new Blob(['col1,col2\r\na,b\r\n'], { type: 'text/csv' }),
      };
    }) as never;

    await downloadReport(
      '/compliance-filings/reports/overdue.csv',
      'fallback.csv',
    );

    expect(createdLinks).toHaveLength(1);
    expect(createdLinks[0].href).toBe('blob:mock-url');
    expect(createdLinks[0].download).toBe('overdue-report-2026-05-03.csv');
    expect(createdLinks[0].clicked).toBe(true);
  });

  it('downloads a PDF report and uses the server-provided filename', async () => {
    globalThis.fetch = vi.fn(async () => {
      const headers = {
        get: (k: string) =>
          k.toLowerCase() === 'content-disposition'
            ? 'attachment; filename="compliance-report-2026-05-03.pdf"'
            : null,
      };
      return {
        ok: true,
        headers,
        blob: async () =>
          new Blob(['%PDF-1.4\nbinary'], { type: 'application/pdf' }),
      };
    }) as never;

    await downloadReport(
      '/compliance-filings/reports/compliance.pdf',
      'fallback.pdf',
    );

    expect(createdLinks).toHaveLength(1);
    expect(createdLinks[0].download).toBe('compliance-report-2026-05-03.pdf');
    expect(createdLinks[0].clicked).toBe(true);
  });

  it('falls back to the caller-supplied filename when no Content-Disposition is set', async () => {
    globalThis.fetch = vi.fn(async () => {
      const headers = { get: () => null };
      return {
        ok: true,
        headers,
        blob: async () => new Blob([''], { type: 'application/pdf' }),
      };
    }) as never;

    await downloadReport(
      '/compliance-filings/reports/compliance.pdf',
      'fallback-name.pdf',
    );

    expect(createdLinks[0].download).toBe('fallback-name.pdf');
  });

  it('throws when the server returns a non-OK response', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      headers: { get: () => null },
      text: async () => 'forbidden',
    })) as never;

    await expect(
      downloadReport('/compliance-filings/reports/overdue.csv', 'fallback.csv'),
    ).rejects.toThrow(/403/);
  });
});
