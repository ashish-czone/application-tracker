import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { clients } from './clients.schema';

export const ClientRowSchema = createSelectSchema(clients);

/**
 * The shared `clients` table now exposes the full base column set (including
 * `createdBy`, `deletedAt`, `externalIds`, `mergedIntoId`, `defaultContactId`,
 * `complianceBecameClientAt`, `complianceArchivedAt`) plus compliance prefix
 * columns. Most of those base columns are owned by directory's services or
 * by the platform — compliance's create payload only carries the fields the
 * compliance UI / API has historically supported. The narrow projection
 * below mirrors the old `compliance.clients` shape mapped onto the new
 * field names per the C-2 mapping table.
 *
 * `complianceStatus` is intentionally NOT picked. Workflow state is
 * system-managed: creates always start at `CLIENTS_WORKFLOW.initialState`
 * (set by `ClientsService.create`); state changes go only through
 * `POST /clients/:id/transition`. See `.claude/rules/workflow-entity-creates.md`.
 */
export const CreateClientSchema = createInsertSchema(clients).pick({
  name: true,
  legalName: true,
  email: true,
  phone: true,
  websiteDomain: true,
  taxId: true,
  industry: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  addressCountryId: true,
  complianceAccountManagerId: true,
  complianceOnboardedAt: true,
  complianceNotes: true,
});

export const UpdateClientSchema = CreateClientSchema.partial();

/**
 * Body shape for POST /clients/:id/transition. The controller-side `fieldKey`
 * stays as `'status'` (UI-facing); the service translates this to the
 * underlying `complianceStatus` column when reading the entity. Keeps the
 * endpoint generic so additional workflow fields can be added later.
 */
export const TransitionClientSchema = z.object({
  fieldKey: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

// ---- Composite create + cross-entity DTOs ---------------------------------
// (Replace the prior class-validator classes under dto/. Same wire shape; the
// controller now calls Schema.parse(body) explicitly instead of relying on
// the global ValidationPipe — matches the convention used everywhere else
// in this module and the rules/ reference.)

const ClientPayloadSchema = z.object({
  name: z.string().min(1).max(255),
  legalName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(32).optional(),
  websiteDomain: z.string().max(512).optional(),
  taxId: z.string().max(64).optional(),
  industry: z.string().uuid().optional(),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(128).optional(),
  state: z.string().max(128).optional(),
  postalCode: z.string().max(32).optional(),
  addressCountryId: z.string().uuid().optional(),
  complianceAccountManagerId: z.string().uuid().optional(),
  // complianceStatus intentionally absent — workflow state is system-managed
  // (always starts at `CLIENTS_WORKFLOW.initialState`).
  complianceOnboardedAt: z.string().datetime({ offset: true }).optional(),
  complianceNotes: z.string().optional(),
});

const ContactPayloadSchema = z.object({
  fullName: z.string().min(1).max(255),
  primaryEmail: z.string().email().optional(),
  primaryPhone: z.string().max(32).optional(),
  complianceDesignation: z.string().max(128).optional(),
  complianceIsPrimary: z.boolean().optional(),
  complianceNotes: z.string().optional(),
});

export const CreateClientWithContactsSchema = z.object({
  client: ClientPayloadSchema,
  contacts: z.array(ContactPayloadSchema).min(1),
});

export const RegisterLawsSchema = z.object({
  lawCodes: z.array(z.string().min(1).max(64)).min(1),
});

export const DeactivateRegistrationSchema = z.object({
  /** `YYYY-MM-DD` or any ISO-8601 datetime. Past-or-today (enforced server-side). */
  deactivatedAt: z.string().datetime({ offset: true }).or(z.string().date()),
  alsoCancelEarlier: z.boolean().optional(),
  comment: z.string().max(2000).optional(),
});

// ---- List query schema ----------------------------------------------------
// (Replaces clients-query.ts's translateClientsQuery helper. Same URL contract:
// page/limit clamp silently, invalid CSV enums drop silently, sort=field:dir
// shorthand accepted, empty strings → undefined.)

export type ClientStatusKey = 'active' | 'onboarding' | 'dormant';
export type ClientRiskLevel = 'healthy' | 'at-risk' | 'critical';

const CLIENT_STATUSES = ['active', 'onboarding', 'dormant'] as const;
const CLIENT_RISKS = ['healthy', 'at-risk', 'critical'] as const;

const CLIENTS_LIST_DEFAULT_LIMIT = 25;
const CLIENTS_LIST_MAX_LIMIT = 100;

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
  if (raw == null || raw === '') return CLIENTS_LIST_DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return CLIENTS_LIST_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), CLIENTS_LIST_MAX_LIMIT);
});

const clampedPage = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
});

export interface ClientsListQuery {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: ClientStatusKey;
  handlerIds?: string[];
  risks?: ClientRiskLevel[];
  q?: string;
}

export const ClientsListQuerySchema = z
  .object({
    page: clampedPage,
    limit: clampedLimit,
    sort: optionalString,
    order: optionalEnum(['asc', 'desc'] as const),
    status: optionalEnum(CLIENT_STATUSES),
    risk: optionalEnumCsv(CLIENT_RISKS),
    handlerId: optionalStringCsv,
    q: optionalString,
  })
  .passthrough()
  .transform((raw): ClientsListQuery => {
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
      handlerIds: raw.handlerId,
      risks: raw.risk,
      q: raw.q,
    };
  });

// ---- Options query schema -------------------------------------------------
// Backs `GET /clients/options` (typeahead). `search` ILIKEs name/legalName;
// `ids` (CSV) bypasses search and hydrates labels for already-selected chips
// when the page is reopened. `limit` clamps low — typeaheads don't need
// hundreds of rows.

const OPTIONS_DEFAULT_LIMIT = 25;
const OPTIONS_MAX_LIMIT = 50;

const optionsClampedLimit = z.unknown().transform((raw) => {
  if (raw == null || raw === '') return OPTIONS_DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return OPTIONS_DEFAULT_LIMIT;
  return Math.min(Math.floor(n), OPTIONS_MAX_LIMIT);
});

export interface ClientsOptionsQuery {
  search?: string;
  ids?: string[];
  limit: number;
}

export const ClientsOptionsQuerySchema = z
  .object({
    search: optionalString,
    ids: optionalStringCsv,
    limit: optionsClampedLimit,
  })
  .passthrough()
  .transform((raw): ClientsOptionsQuery => ({
    search: raw.search,
    ids: raw.ids,
    limit: raw.limit,
  }));

export type CreateClientDto = z.infer<typeof CreateClientSchema>;
export type UpdateClientDto = z.infer<typeof UpdateClientSchema>;
export type TransitionClientDto = z.infer<typeof TransitionClientSchema>;
export type CreateClientWithContactsDto = z.infer<typeof CreateClientWithContactsSchema>;
export type RegisterLawsDto = z.infer<typeof RegisterLawsSchema>;
export type DeactivateRegistrationDto = z.infer<typeof DeactivateRegistrationSchema>;
export type ClientRow = z.infer<typeof ClientRowSchema>;
