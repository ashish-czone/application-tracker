import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService, and, eq, isNull, inArray } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { complianceClientRegistrations } from '../schema/client-registrations';
import { complianceLaws } from '../schema/laws';
import { CLIENT_REGISTRATIONS_CREATED } from '../events/types';

export interface ClientRegistration {
  id: string;
  clientId: string;
  lawId: string;
  registeredAt: Date;
  deactivatedAt: Date | null;
}

@Injectable()
export class ClientRegistrationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
  ) {}

  async register(clientId: string, lawId: string): Promise<ClientRegistration> {
    const existing = await this.findActive(clientId, lawId);
    if (existing) {
      throw new ConflictException(`Client ${clientId} is already registered for law ${lawId}`);
    }
    const [row] = await this.database.db
      .insert(complianceClientRegistrations)
      .values({ clientId, lawId })
      .returning();
    return this.toRegistration(row);
  }

  /**
   * Register a client against multiple laws by code in a single transaction.
   * Idempotent — codes that already map to an active registration are
   * returned untouched (no throw), so the drawer can retry on network flakes
   * and the seeder can re-run safely. Unknown codes reject the entire batch
   * with BadRequestException; callers should validate codes client-side.
   *
   * Emits `client-registrations.Created` once per newly-inserted row after
   * the transaction commits. Already-active registrations do not re-emit.
   */
  async registerMany(
    clientId: string,
    lawCodes: string[],
    actorId: string | null = null,
  ): Promise<ClientRegistration[]> {
    if (lawCodes.length === 0) return [];

    const uniqueCodes = Array.from(new Set(lawCodes));
    const laws = await this.database.db
      .select({ id: complianceLaws.id, code: complianceLaws.code })
      .from(complianceLaws)
      .where(inArray(complianceLaws.code, uniqueCodes));

    const foundCodes = new Set(laws.map((l) => l.code));
    const unknown = uniqueCodes.filter((c) => !foundCodes.has(c));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown law code(s): ${unknown.join(', ')}`);
    }

    const outcomes = await this.database.db.transaction(async (tx) => {
      const results: Array<{
        row: typeof complianceClientRegistrations.$inferSelect;
        inserted: boolean;
      }> = [];
      for (const law of laws) {
        const [existing] = await tx
          .select()
          .from(complianceClientRegistrations)
          .where(
            and(
              eq(complianceClientRegistrations.clientId, clientId),
              eq(complianceClientRegistrations.lawId, law.id),
              isNull(complianceClientRegistrations.deactivatedAt),
            ),
          );
        if (existing) {
          results.push({ row: existing, inserted: false });
          continue;
        }
        const [inserted] = await tx
          .insert(complianceClientRegistrations)
          .values({ clientId, lawId: law.id })
          .returning();
        results.push({ row: inserted, inserted: true });
      }
      return results;
    });

    for (const { row, inserted } of outcomes) {
      if (!inserted) continue;
      this.events.emitDynamic(CLIENT_REGISTRATIONS_CREATED, {
        entityType: 'client-registrations',
        entityId: row.id,
        actorId,
        payload: { after: row as unknown as Record<string, unknown> },
      });
    }

    return outcomes.map(({ row }) => this.toRegistration(row));
  }

  async deregister(clientId: string, lawId: string): Promise<void> {
    const existing = await this.findActive(clientId, lawId);
    if (!existing) {
      throw new NotFoundException(`No active registration for client ${clientId} law ${lawId}`);
    }
    await this.database.db
      .update(complianceClientRegistrations)
      .set({ deactivatedAt: new Date() })
      .where(eq(complianceClientRegistrations.id, existing.id));
  }

  /** Active registrations only (deactivatedAt IS NULL). */
  async getRegisteredClients(lawId: string): Promise<ClientRegistration[]> {
    const rows = await this.database.db
      .select()
      .from(complianceClientRegistrations)
      .where(
        and(
          eq(complianceClientRegistrations.lawId, lawId),
          isNull(complianceClientRegistrations.deactivatedAt),
        ),
      );
    return rows.map((r) => this.toRegistration(r));
  }

  /** Active registrations only. */
  async getRegisteredLaws(clientId: string): Promise<ClientRegistration[]> {
    const rows = await this.database.db
      .select()
      .from(complianceClientRegistrations)
      .where(
        and(
          eq(complianceClientRegistrations.clientId, clientId),
          isNull(complianceClientRegistrations.deactivatedAt),
        ),
      );
    return rows.map((r) => this.toRegistration(r));
  }

  private async findActive(clientId: string, lawId: string): Promise<ClientRegistration | null> {
    const rows = await this.database.db
      .select()
      .from(complianceClientRegistrations)
      .where(
        and(
          eq(complianceClientRegistrations.clientId, clientId),
          eq(complianceClientRegistrations.lawId, lawId),
          isNull(complianceClientRegistrations.deactivatedAt),
        ),
      );
    return rows[0] ? this.toRegistration(rows[0]) : null;
  }

  private toRegistration(row: typeof complianceClientRegistrations.$inferSelect): ClientRegistration {
    return {
      id: row.id,
      clientId: row.clientId,
      lawId: row.lawId,
      registeredAt: row.registeredAt,
      deactivatedAt: row.deactivatedAt,
    };
  }
}
