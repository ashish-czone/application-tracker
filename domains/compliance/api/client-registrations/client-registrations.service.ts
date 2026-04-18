import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseService, and, eq, isNull } from '@packages/database';
import { complianceClientRegistrations } from '../schema/client-registrations';

export interface ClientRegistration {
  id: string;
  clientId: string;
  lawId: string;
  registeredAt: Date;
  deactivatedAt: Date | null;
}

@Injectable()
export class ClientRegistrationService {
  constructor(private readonly database: DatabaseService) {}

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
