import { sql } from '@packages/database';
import type { SQL } from 'drizzle-orm';
import { tenantCondition } from '@packages/tenancy/helpers';

/**
 * SQL subquery expression that computes the average overall rating
 * from evaluations for a given entity type.
 *
 * Usage in EntityConfig.computedColumns:
 * ```ts
 * computedColumns: [
 *   { name: 'averageRating', expression: evaluationAvgExpr('applications', applications.id) },
 * ]
 * ```
 */
export function evaluationAvgExpr(entityType: string, idColumn: any): SQL {
  return sql`(
    SELECT ROUND(AVG(overall_rating)::numeric, 1)
    FROM evaluations
    WHERE entity_type = ${entityType}
      AND entity_id = ${idColumn}
      AND ${tenantCondition()}
  )`;
}

/**
 * SQL subquery expression that computes the count of evaluations
 * for a given entity type.
 */
export function evaluationCountExpr(entityType: string, idColumn: any): SQL {
  return sql`(
    SELECT COUNT(*)::integer
    FROM evaluations
    WHERE entity_type = ${entityType}
      AND entity_id = ${idColumn}
      AND ${tenantCondition()}
  )`;
}
