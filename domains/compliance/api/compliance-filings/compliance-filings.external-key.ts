/**
 * Natural key used for the `compliance_filings.external_key` idempotency
 * column. The generate action reuses this format across retries — keep
 * the shape stable.
 *
 * Callers of the HTTP API don't need to supply this directly — the
 * filings service derives it automatically at create-time when
 * ruleId/clientId/periodStart are present. Exposed for the automation
 * and seeds which pre-compute the key to dedupe before insert.
 *
 * Lives in its own file (rather than alongside the entity-engine
 * `defineEntity` config it shipped with originally) because every
 * external consumer — generator, seeds, lookup service — needs the
 * helper without dragging in the rest of the (now-retired)
 * `compliance-filings.config.ts`.
 */
export function buildFilingExternalKey(
  ruleId: string,
  clientId: string,
  periodStart: string,
): string {
  return `${ruleId}:${clientId}:${periodStart}`;
}
