import { Injectable } from '@nestjs/common';
import { DatabaseService, and, eq, isNull, sql } from '@packages/database';
import { complianceLawHandlers } from '../schema/law-handlers';

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

@Injectable()
export class LawHandlerService {
  constructor(private readonly database: DatabaseService) {}

  async create(input: CreateLawHandlerInput): Promise<LawHandler> {
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

  async delete(id: string): Promise<void> {
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
