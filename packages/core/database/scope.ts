import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { hasSoftDeleteColumns, notDeleted } from '@packages/soft-delete';
import { getTenantId } from '@packages/logger';

/**
 * Single scoping primitive for raw Drizzle queries. Composes every active
 * row-level scope dimension a query MUST respect — soft-delete and tenancy
 * today, actor-scope when row-level RBAC plumbing lands — by introspecting
 * the table at runtime:
 *
 * - If the table spreads `softDeleteColumns()`, `deleted_at IS NULL` is added.
 * - If the table has a `tenantId` column AND a tenant context is active
 *   (`getTenantId()` from `@packages/logger`), `tenant_id = $current` is added.
 * - Caller-supplied conditions are ANDed in.
 *
 * Apps that don't use tenancy get the tenant leg as a runtime no-op because
 * `getTenantId()` returns falsy. Apps that don't soft-delete a given table
 * get the soft-delete leg as a runtime no-op via the column check. The same
 * call site stays correct in either case — that's the safety guarantee.
 *
 * Use this on every `select`/`update`/`delete` chain that touches application
 * data, including INSIDE transactions. Mandatory per `.claude/rules/data-scoping.md`.
 *
 * For the rare case that needs to read or mutate tombstoned rows (the
 * compliance dormancy "sweep late filings" guard, restore-from-trash flows,
 * forensic queries), use `withScopeIncludingDeleted` — the explicit name is
 * intentional so the bypass reads as a code smell in review.
 *
 * @example
 *   db.select().from(filings).where(withScope(filings, eq(filings.id, id)))
 *
 *   db.update(filings).set({ status: 'cancelled' })
 *     .where(withScope(filings, inArray(filings.id, ids)))
 *
 * @example INSERT path — use withTenantInsert from @packages/tenancy/helpers
 *   for tenancy column injection. INSERTs cannot be soft-deleted, so the
 *   `withScope` predicate doesn't apply on insert.
 */
export function withScope(
  table: PgTable,
  ...conditions: (SQL | undefined)[]
): SQL | undefined {
  return composeScope(table, conditions, { includeDeleted: false });
}

/**
 * Escape hatch for the rare paths that genuinely need to read tombstoned rows
 * (restore flows, dormancy late-filing sweeps, audit queries). Tenancy scope
 * still applies. The verbose name is the audit-trail surface — code review
 * stops on every occurrence and asks "why?".
 */
export function withScopeIncludingDeleted(
  table: PgTable,
  ...conditions: (SQL | undefined)[]
): SQL | undefined {
  return composeScope(table, conditions, { includeDeleted: true });
}

/**
 * Returns a `tenant_id = $current` SQL fragment for raw `sql\`...\`` template
 * literals where the Drizzle WHERE-builder can't reach. When tenancy is not
 * active, returns `TRUE` so the fragment is a no-op inside an AND chain.
 *
 * Most call sites don't need this — they use `withScope` on a real Drizzle
 * chain. Reach for `tenantSqlCondition` only when the surrounding query is
 * already a `db.execute(sql\`...\`)` raw aggregation (e.g. `COUNT(DISTINCT)`,
 * `FILTER (WHERE ...)`).
 */
export function tenantSqlCondition(): SQL {
  const tenantId = getTenantId();
  if (!tenantId) return sql`TRUE`;
  return sql`tenant_id = ${tenantId}`;
}

function composeScope(
  table: PgTable,
  conditions: (SQL | undefined)[],
  options: { includeDeleted: boolean },
): SQL | undefined {
  const parts: SQL[] = [];

  const tenantId = getTenantId();
  if (tenantId && hasTenantColumn(table)) {
    parts.push(eq(table.tenantId, tenantId));
  }

  if (!options.includeDeleted && hasSoftDeleteColumns(table)) {
    parts.push(notDeleted(table));
  }

  for (const c of conditions) {
    if (c) parts.push(c);
  }

  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return and(...parts);
}

function hasTenantColumn(table: PgTable): table is PgTable & { tenantId: SQL } {
  return 'tenantId' in (table as unknown as Record<string, unknown>);
}
