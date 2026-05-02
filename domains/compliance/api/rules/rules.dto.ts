import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  FREQUENCIES,
  LAW_GROUP_KEYS,
  type ComplianceFrequency,
  type LawGroupKey,
} from '@domains/compliance-contract';
import { complianceRules } from './rules.schema';

export const ComplianceRuleRowSchema = createSelectSchema(complianceRules);

/**
 * `status` is intentionally omitted: workflow state is system-managed.
 * Creates always start at `RULES_WORKFLOW.initialState` (set by
 * `ComplianceRulesService.create`); state changes go only through
 * `POST /compliance-rules/:id/transition`. See
 * `.claude/rules/workflow-entity-creates.md`.
 */
export const CreateComplianceRuleSchema = createInsertSchema(complianceRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
});

/**
 * PATCH body shape. `status` is omitted (creates and updates never carry it);
 * transitions go through the workflow engine via `/transition`.
 */
export const UpdateComplianceRuleSchema = CreateComplianceRuleSchema.partial();

export const DeprecateComplianceRuleSchema = z.object({
  alsoCancelInFlight: z.boolean().optional(),
  comment: z.string().max(2000).optional(),
});

/**
 * Body shape for POST /compliance-rules/:id/transition. Generic transition
 * endpoint delegating to the engine's `EntityService.transition` so the
 * platform's workflow guards, condition evaluation, and history rows
 * apply uniformly.
 */
export const TransitionComplianceRuleSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

const RULE_STATUSES = ['draft', 'active', 'deprecated'] as const;
const RULE_JURISDICTIONS = ['central', 'state', 'municipal'] as const;
export type RuleStatusKey = (typeof RULE_STATUSES)[number];
export type RuleJurisdictionKey = (typeof RULE_JURISDICTIONS)[number];

const RULES_LIST_DEFAULT_LIMIT = 25;
const RULES_LIST_MAX_LIMIT = 100;

const optionalString = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return undefined;
    const trimmed = s.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const optionalEnum = <T extends string>(allowed: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      const trimmed = s.trim();
      return (allowed as readonly string[]).includes(trimmed) ? (trimmed as T) : undefined;
    });

const optionalEnumCsv = <T extends string>(allowed: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      const set = new Set<string>(allowed);
      const parts = s.split(',').map((p) => p.trim()).filter((p) => set.has(p)) as T[];
      return parts.length > 0 ? parts : undefined;
    });

const optionalStringCsv = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return undefined;
    const parts = s
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return parts.length > 0 ? parts : undefined;
  });

const clampedLimit = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return RULES_LIST_DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return RULES_LIST_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), RULES_LIST_MAX_LIMIT);
});

const clampedPage = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
});

export interface RulesListQuery {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: RuleStatusKey;
  frequencies?: ComplianceFrequency[];
  jurisdictions?: RuleJurisdictionKey[];
  lawGroups?: LawGroupKey[];
  lawIds?: string[];
  q?: string;
}

/**
 * URL query schema for `GET /compliance-rules`. Replaces the old
 * `translateRulesQuery` helper — the schema and its inferred type
 * are the single source of truth for the list endpoint contract.
 *
 * Behaviour preserved from the prior parser:
 *  - `page`/`limit` clamp silently to defaults / max rather than throwing
 *  - invalid enum members in CSV params are dropped silently (e.g.
 *    `frequency=monthly,bogus` → `['monthly']`)
 *  - `sort=field:dir` is accepted as combined form; `sort=field` + `order=dir`
 *    is the split form
 *  - empty strings are coerced to `undefined`
 *
 * The schema's `transform` step renames the URL-friendly singular params
 * (`frequency`, `jurisdiction`, `lawGroup`, `lawId`) to the plural
 * collection names the service consumes.
 */
export const RulesListQuerySchema = z
  .object({
    page: clampedPage,
    limit: clampedLimit,
    sort: optionalString,
    order: optionalEnum(['asc', 'desc'] as const),
    status: optionalEnum(RULE_STATUSES),
    frequency: optionalEnumCsv(FREQUENCIES),
    jurisdiction: optionalEnumCsv(RULE_JURISDICTIONS),
    lawGroup: optionalEnumCsv(LAW_GROUP_KEYS),
    lawId: optionalStringCsv,
    q: optionalString,
  })
  .passthrough()
  .transform((raw): RulesListQuery => {
    let sort = raw.sort;
    let order = raw.order;
    if (typeof raw.sort === 'string' && raw.sort.includes(':')) {
      const [field, dir] = raw.sort.split(':');
      sort = field;
      order = dir === 'desc' ? 'desc' : 'asc';
    }
    return {
      page: raw.page,
      limit: raw.limit,
      sort,
      order,
      status: raw.status,
      frequencies: raw.frequency,
      jurisdictions: raw.jurisdiction,
      lawGroups: raw.lawGroup,
      lawIds: raw.lawId,
      q: raw.q,
    };
  });

export type CreateComplianceRuleDto = z.infer<typeof CreateComplianceRuleSchema>;
export type UpdateComplianceRuleDto = z.infer<typeof UpdateComplianceRuleSchema>;
export type DeprecateComplianceRuleDto = z.infer<typeof DeprecateComplianceRuleSchema>;
export type ComplianceRuleRow = z.infer<typeof ComplianceRuleRowSchema>;
