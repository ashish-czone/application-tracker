/**
 * CSV serialisation helpers shared by the report-export endpoints.
 *
 * Inlined here (not in `@packages/common`) because:
 *  - the formatting rules are trivial (RFC 4180 quoting),
 *  - no other consumer needs them today, and
 *  - the data-formatting rule (`.claude/rules/data-formatting.md`)
 *    forbids adding cross-cutting utilities to platform packages
 *    without a clear cross-domain demand.
 *
 * If a second domain ever needs CSV serialisation, lift this verbatim
 * into `@packages/common` and replace the imports — there is no state.
 */

/**
 * RFC 4180 field escape: quote any value containing `"`, `,`, `\r`, or `\n`,
 * and double-quote any embedded `"`. Null and undefined render as the empty
 * string. Non-string scalars are stringified via `String(v)`.
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  if (str.length === 0) return '';
  if (
    str.includes('"') ||
    str.includes(',') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Joins a single row of values into a CSV line, applying `csvEscape` to each.
 * Lines use `\r\n` per RFC 4180 — Excel and most spreadsheet tools prefer it
 * over bare `\n`.
 */
export function csvRow(values: ReadonlyArray<unknown>): string {
  return values.map(csvEscape).join(',');
}

/**
 * Serialises a header row + a list of data rows into a single CSV string
 * terminated with a trailing newline. Suitable for response.send(...) on
 * a controller that has set the Content-Type / Content-Disposition headers.
 */
export function toCsv(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  const lines = [csvRow(headers)];
  for (const row of rows) lines.push(csvRow(row));
  return lines.join('\r\n') + '\r\n';
}

/**
 * Builds a `Content-Disposition: attachment; filename="…"` header value for
 * a report tab, scoped by today's calendar date so repeated exports get
 * distinct filenames in the user's downloads folder.
 *
 * Example: `attachment; filename="overdue-report-2026-05-03.csv"`
 */
export function csvDisposition(tab: string, today: string): string {
  return `attachment; filename="${tab}-report-${today}.csv"`;
}
