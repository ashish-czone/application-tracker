import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, inArray, sql } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { clientContacts, type ClientContact, type NewClientContact } from '../schema/client-contacts';
import { clients } from '../schema/clients';
import {
  DIRECTORY_CLIENT_CONTACT_CREATED,
  DIRECTORY_CLIENT_CONTACT_UPDATED,
  DIRECTORY_CLIENT_CONTACT_MERGED,
} from '../events/types';
import { followMerged, isUniqueViolation, type DbOrTx } from './types';

export interface FindOrCreateClientContactInput {
  fullName: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  linkedinUrl?: string | null;
  jobTitle?: string | null;
  clientId?: string | null;
  externalIds?: Record<string, unknown>;
}

export interface UpdateClientContactInput {
  fullName?: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  linkedinUrl?: string | null;
  jobTitle?: string | null;
  clientId?: string | null;
  doNotContact?: boolean;
  externalIds?: Record<string, unknown>;
}

@Injectable()
export class ClientContactsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
  ) {}

  async findOrCreate(
    input: FindOrCreateClientContactInput,
    userId: string,
    tx?: DbOrTx,
  ): Promise<ClientContact> {
    const db = tx ?? this.database.db;

    const existing = await this.lookupByDedupKeys(db, input);
    if (existing) {
      if (existing.deletedAt) {
        return this.revive(db, existing.id, userId);
      }
      return existing;
    }

    try {
      const insertValues: NewClientContact = {
        fullName: input.fullName,
        primaryEmail: input.primaryEmail ?? null,
        primaryPhone: input.primaryPhone ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        jobTitle: input.jobTitle ?? null,
        clientId: input.clientId ?? null,
        externalIds: input.externalIds ?? {},
        createdBy: userId,
        updatedAt: new Date(),
      };
      const [row] = await db.insert(clientContacts).values(insertValues).returning();

      this.events.emit(DIRECTORY_CLIENT_CONTACT_CREATED, {
        entityType: 'client_contacts',
        entityId: row.id,
        actorId: userId,
        payload: {
          clientContactId: row.id,
          fullName: row.fullName,
          primaryEmail: row.primaryEmail,
        },
      });

      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await this.lookupByDedupKeys(db, input);
        if (winner) return winner;
      }
      throw error;
    }
  }

  async findById(
    id: string,
    tx?: DbOrTx,
    opts: { followMerged?: boolean } = {},
  ): Promise<ClientContact | null> {
    const db = tx ?? this.database.db;
    const [row] = await db.select().from(clientContacts).where(eq(clientContacts.id, id)).limit(1);
    if (!row) return null;
    if (opts.followMerged === false) return row;
    return followMerged(row, async (nextId) => {
      const [next] = await db.select().from(clientContacts).where(eq(clientContacts.id, nextId)).limit(1);
      return next ?? null;
    });
  }

  async findMany(ids: string[], tx?: DbOrTx): Promise<Map<string, ClientContact>> {
    const db = tx ?? this.database.db;
    if (ids.length === 0) return new Map();
    const rows = await db.select().from(clientContacts).where(inArray(clientContacts.id, ids));
    return new Map(rows.map((row) => [row.id, row]));
  }

  async findByEmail(email: string, tx?: DbOrTx): Promise<ClientContact | null> {
    const db = tx ?? this.database.db;
    const [row] = await db
      .select()
      .from(clientContacts)
      .where(sql`lower(${clientContacts.primaryEmail}) = lower(${email}) AND ${clientContacts.deletedAt} IS NULL`)
      .limit(1);
    if (!row) return null;
    return followMerged(row, async (nextId) => {
      const [next] = await db.select().from(clientContacts).where(eq(clientContacts.id, nextId)).limit(1);
      return next ?? null;
    });
  }

  async update(
    id: string,
    patch: UpdateClientContactInput,
    userId: string,
    tx?: DbOrTx,
  ): Promise<ClientContact> {
    const db = tx ?? this.database.db;
    const before = await this.findById(id, db, { followMerged: false });
    if (!before) throw new NotFoundException(`client contact ${id} not found`);
    if (before.deletedAt) {
      throw new BadRequestException(`client contact ${id} is deleted/merged; cannot update`);
    }

    const [after] = await db
      .update(clientContacts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(clientContacts.id, id))
      .returning();

    this.events.emit(DIRECTORY_CLIENT_CONTACT_UPDATED, {
      entityType: 'client_contacts',
      entityId: id,
      actorId: userId,
      payload: { clientContactId: id, before, after },
    });

    return after;
  }

  async merge(loserId: string, winnerId: string, userId: string): Promise<ClientContact> {
    if (loserId === winnerId) {
      throw new BadRequestException('cannot merge a client contact into themselves');
    }

    return this.database.db.transaction(async (tx) => {
      const loser = await this.findById(loserId, tx, { followMerged: false });
      const winner = await this.findById(winnerId, tx, { followMerged: false });
      if (!loser) throw new NotFoundException(`client contact ${loserId} not found`);
      if (!winner) throw new NotFoundException(`client contact ${winnerId} not found`);
      if (loser.deletedAt) {
        throw new BadRequestException(`client contact ${loserId} is already merged or deleted`);
      }
      if (winner.deletedAt) {
        throw new BadRequestException(`client contact ${winnerId} is already merged or deleted`);
      }

      const now = new Date();
      await tx
        .update(clientContacts)
        .set({ mergedIntoId: winner.id, deletedAt: now, deletedBy: userId, updatedAt: now })
        .where(eq(clientContacts.id, loser.id));

      // Re-point clients.default_contact_id from loser → winner.
      await tx
        .update(clients)
        .set({ defaultContactId: winner.id })
        .where(eq(clients.defaultContactId, loser.id));

      this.events.emit(DIRECTORY_CLIENT_CONTACT_MERGED, {
        entityType: 'client_contacts',
        entityId: winner.id,
        actorId: userId,
        payload: { loserId: loser.id, winnerId: winner.id, mergedBy: userId },
      });

      return winner;
    });
  }

  // --- internals ---

  private async lookupByDedupKeys(
    db: DbOrTx,
    input: FindOrCreateClientContactInput,
  ): Promise<ClientContact | null> {
    if (input.primaryEmail) {
      const [row] = await db
        .select()
        .from(clientContacts)
        .where(sql`lower(${clientContacts.primaryEmail}) = lower(${input.primaryEmail})`)
        .limit(1);
      if (row) return row;
    }
    if (input.linkedinUrl) {
      const [row] = await db
        .select()
        .from(clientContacts)
        .where(eq(clientContacts.linkedinUrl, input.linkedinUrl))
        .limit(1);
      if (row) return row;
    }
    return null;
  }

  private async revive(db: DbOrTx, id: string, userId: string): Promise<ClientContact> {
    const [row] = await db
      .update(clientContacts)
      .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
      .where(eq(clientContacts.id, id))
      .returning();

    this.events.emit(DIRECTORY_CLIENT_CONTACT_UPDATED, {
      entityType: 'client_contacts',
      entityId: id,
      actorId: userId,
      payload: { clientContactId: id, before: { deletedAt: 'set' as unknown as Date }, after: { deletedAt: null } },
    });

    return row;
  }
}
