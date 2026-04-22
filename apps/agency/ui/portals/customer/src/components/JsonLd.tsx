/**
 * Emits a JSON-LD `<script type="application/ld+json">` from a plain
 * JS object. Kept as a server component — no client bundle cost.
 *
 * Use sparingly: one Organization per page is fine, one WebPage /
 * Article per page is fine. Avoid duplicating the same @type on the
 * same URL — search engines dedupe but authors get confused reading
 * view-source.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Single JSON.stringify; Next.js will inline this in the HTML.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
