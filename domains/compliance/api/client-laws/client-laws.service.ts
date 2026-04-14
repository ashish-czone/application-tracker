import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService, and, eq, isNull } from '@packages/database';
import { complianceClientLaws } from '../schema/client-laws';

export interface ClientLawRegistration {
  id: string;
  clientId: string;
  lawId: string;
  registeredAt: Date;
  deactivatedAt: Date | null;
}

@Injectable()
export class ClientLawService {
  constructor(private readonly database: DatabaseService) {}

  async register(clientId: string, lawId: string): Promise<ClientLawRegistration> {
    const existing = await this.findActive(clientId, lawId);
    if (existing) {
      throw new ConflictException(`Client ${clientId} is already registered for law ${lawId}`);
    }
    const [row] = await this.database.db
      .insert(complianceClientLaws)
      .values({ clientId, lawId })
      .returning();
    return this.toRegistration(row);
  }

  async deregister(clientId: string, lawId: string): Promise<void> {
    const existing = await this.findActive(clientId, lawId);
    if (!existing) {
      throw new NotFoundException(`No active registration for client ${clientId} law ${lawId}`);
    }
    await this.database.db
      .update(complianceClientLaws)
      .set({ deactivatedAt: new Date() })
      .where(eq(complianceClientLaws.id, existing.id));
  }

  /** Active registrations only (deactivatedAt IS NULL). */
  async getRegisteredClients(lawId: string): Promise<ClientLawRegistration[]> {
    const rows = await this.database.db
      .select()
      .from(complianceClientLaws)
      .where(
        and(
          eq(complianceClientLaws.lawId, lawId),
          isNull(complianceClientLaws.deactivatedAt),
        ),
      );
    return rows.map((r) => this.toRegistration(r));
  }

  /** Active registrations only. */
  async getRegisteredLaws(clientId: string): Promise<ClientLawRegistration[]> {
    const rows = await this.database.db
      .select()
      .from(complianceClientLaws)
      .where(
        and(
          eq(complianceClientLaws.clientId, clientId),
          isNull(complianceClientLaws.deactivatedAt),
        ),
      );
    return rows.map((r) => this.toRegistration(r));
  }

  private async findActive(clientId: string, lawId: string): Promise<ClientLawRegistration | null> {
    const rows = await this.database.db
      .select()
      .from(complianceClientLaws)
      .where(
        and(
          eq(complianceClientLaws.clientId, clientId),
          eq(complianceClientLaws.lawId, lawId),
          isNull(complianceClientLaws.deactivatedAt),
        ),
      );
    return rows[0] ? this.toRegistration(rows[0]) : null;
  }

  private toRegistration(row: typeof complianceClientLaws.$inferSelect): ClientLawRegistration {
    return {
      id: row.id,
      clientId: row.clientId,
      lawId: row.lawId,
      registeredAt: row.registeredAt,
      deactivatedAt: row.deactivatedAt,
    };
  }
}
