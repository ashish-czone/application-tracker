import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService, and, eq, isNull, sql } from '@packages/database';
import { BaseCrudService, type BaseListQuery } from '@packages/crud-base';
import type { DataAccessContext } from '@packages/rbac';
import { LawsService } from '../laws';
import { complianceLawHandlers } from './law-handlers.schema';
import { LAW_HANDLERS_CRUD_TOKEN } from './law-handlers.crud-token';
import type { CreateLawHandlerDto, UpdateLawHandlerDto } from './law-handlers.dto';

export interface LawHandler {
  id: string;
  lawId: string;
  orgEntityId: string;
  clientId: string | null;
  isPrimary: boolean;
}

export interface CreateLawHandlerInput {
  lawId: string;
  orgEntityId: string;
  clientId?: string | null;
  isPrimary?: boolean;
}

/**
 * Merged service: CRUD delegates for the entity engine + the programmatic
 * query/insert helpers used by seeds and by the rules service (for default-
 * handler checks).
 *
 * CRUD methods go through the engine (events + audit fire). The
 * `createHandler` / `deleteHandler` programmatic methods skip those side
 * effects — they're for deterministic seeding and structural pivot edits.
 */
@Injectable()
export class LawHandlersService {
  constructor(
    @Inject(LAW_HANDLERS_CRUD_TOKEN)
    private readonly crud: BaseCrudService<typeof complianceLawHandlers>,
    private readonly database: DatabaseService,
    private readonly lawsService: LawsService,
  ) {}

  // ---- CRUD delegates -------------------------------------------------------

  /**
   * List handlers with `lawCode` + `lawName` embedded per row. Service
   * composition with LawsService.findDisplayByIds — same pattern as
   * ComplianceFilingsService.list, never a JOIN.
   */
  async list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    const result = await this.crud.list(query, accessCtx);
    const lawIds = new Set<string>();
    for (const row of result.data as Record<string, unknown>[]) {
      const id = row.lawId;
      if (typeof id === 'string' && id.length > 0) lawIds.add(id);
    }
    if (lawIds.size === 0) return result;

    const laws = await this.lawsService.findDisplayByIds([...lawIds]);
    const byId = new Map(laws.map((l) => [l.id, l]));

    return {
      ...result,
      data: (result.data as Record<string, unknown>[]).map((row) => {
        const lawId = typeof row.lawId === 'string' ? row.lawId : null;
        const law = lawId ? byId.get(lawId) : undefined;
        if (!law) return row;
        return {
          ...row,
          lawCode: law.code,
          lawName: law.name,
          lawJurisdiction: law.jurisdiction,
        };
      }),
    };
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.crud.findOneOrFail(id, accessCtx);
  }

  create(input: CreateLawHandlerDto, actorId: string) {
    return this.crud.create(input as never, actorId);
  }

  update(id: string, input: UpdateLawHandlerDto, actorId: string, accessCtx?: DataAccessContext) {
    return this.crud.update(id, input as never, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.crud.softDelete(id, actorId, accessCtx);
  }

  // ---- Programmatic / specialized ------------------------------------------

  async createHandler(input: CreateLawHandlerInput): Promise<LawHandler> {
    const [row] = await this.database.db
      .insert(complianceLawHandlers)
      .values({
        lawId: input.lawId,
        orgEntityId: input.orgEntityId,
        clientId: input.clientId ?? null,
        isPrimary: input.isPrimary ?? false,
      })
      .returning();
    return this.toHandler(row);
  }

  async deleteHandler(id: string): Promise<void> {
    await this.database.db.delete(complianceLawHandlers).where(eq(complianceLawHandlers.id, id));
  }

  async findByLaw(lawId: string): Promise<LawHandler[]> {
    const rows = await this.database.db
      .select()
      .from(complianceLawHandlers)
      .where(eq(complianceLawHandlers.lawId, lawId));
    return rows.map((r) => this.toHandler(r));
  }

  /**
   * A "default handler" is a global handler (client_id IS NULL) for the law.
   * At least one is required before a rule can be created — otherwise task
   * generation for clients with no per-client override would fail at assignee
   * resolution time.
   */
  async hasDefaultHandler(lawId: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceLawHandlers)
      .where(and(eq(complianceLawHandlers.lawId, lawId), isNull(complianceLawHandlers.clientId)));
    return (row?.count ?? 0) > 0;
  }

  private toHandler(row: typeof complianceLawHandlers.$inferSelect): LawHandler {
    return {
      id: row.id,
      lawId: row.lawId,
      orgEntityId: row.orgEntityId,
      clientId: row.clientId,
      isPrimary: row.isPrimary,
    };
  }
}
