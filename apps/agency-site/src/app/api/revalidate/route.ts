import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * On-demand revalidation webhook. The admin/pages-api POSTs here after a
 * page is saved so the public site picks up the change immediately instead
 * of waiting for the ISR window.
 *
 *   POST /api/revalidate
 *   { slug: "home" }
 *   Header: x-revalidate-secret: <REVALIDATE_SECRET>
 *
 * Shared secret guard is optional in dev (unset env = skip check); set
 * REVALIDATE_SECRET in production.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (secret && req.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: { slug?: string };
  try {
    body = (await req.json()) as { slug?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  if (!body.slug || typeof body.slug !== 'string') {
    return NextResponse.json({ ok: false, error: 'slug is required' }, { status: 400 });
  }

  revalidateTag(`page:${body.slug}`);
  return NextResponse.json({ ok: true, revalidated: body.slug });
}
