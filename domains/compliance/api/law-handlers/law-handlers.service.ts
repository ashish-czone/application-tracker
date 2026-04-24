import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService, and, eq, isNull, sql } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { complianceLawHandlers } from '../schema/law-handlers';
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
    @Inject('ENTITY_SERVICE_compliance_law_handlers') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
  ) {}

  // ---- CRUD delegates (vendors template) -----------------------------------

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  create(input: CreateLawHandlerDto, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: UpdateLawHandlerDto, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.update(id, input, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.softDelete(id, actorId, accessCtx);
  }

  clone(id: string, actorId: string) {
    return this.entityService.clone(id, actorId);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  getListLayout() {
    return this.entityService.getListLayout();
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
