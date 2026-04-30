import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService, asc, eq, ilike, inArray, isNull, sql } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { clients, type Client, type NewClient } from '../schema/clients';
import { clientContacts } from '../schema/client-contacts';
import {
  DIRECTORY_CLIENT_CREATED,
  DIRECTORY_CLIENT_UPDATED,
  DIRECTORY_CLIENT_MERGED,
} from '../events/types';
import { followMerged, isUniqueViolation, type DbOrTx } from './types';

export interface FindOrCreateClientInput {
  name: string;
  websiteDomain?: string | null;
  linkedinUrl?: string | null;
  industry?: string | null;
  sizeBand?: string | null;
  countryCode?: string | null;
  externalIds?: Record<string, unknown>;
}

export interface UpdateClientInput {
  name?: string;
  websiteDomain?: string | null;
  linkedinUrl?: string | null;
  industry?: string | null;
  sizeBand?: string | null;
  countryCode?: string | null;
  defaultContactId?: string | null;
  externalIds?: Record<string, unknown>;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
  ) {}

  async findOrCreate(
    input: FindOrCreateClientInput,
    userId: string,
    tx?: DbOrTx,
  ): Promise<Client> {
    const db = tx ?? this.database.db;

    const existing = await this.lookupByDedupKeys(db, input);
    if (existing) {
      if (existing.deletedAt) {
        return this.revive(db, existing.id, userId);
      }
      return existing;
    }

    try {
      const insertValues: NewClient = {
        name: input.name,
        websiteDomain: input.websiteDomain ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        industry: input.industry ?? null,
        sizeBand: input.sizeBand ?? null,
        countryCode: input.countryCode ?? null,
        externalIds: input.externalIds ?? {},
        createdBy: userId,
        updatedAt: new Date(),
      };
      const [row] = await db.insert(clients).values(insertValues).returning();

      this.events.emit(DIRECTORY_CLIENT_CREATED, {
        entityType: 'clients',
        entityId: row.id,
        actorId: userId,
        payload: {
          clientId: row.id,
          name: row.name,
          websiteDomain: row.websiteDomain,
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
  ): Promise<Client | null> {
    const db = tx ?? this.database.db;
    const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!row) return null;
    if (opts.followMerged === false) return row;
    return followMerged(row, async (nextId) => {
      const [next] = await db.select().from(clients).where(eq(clients.id, nextId)).limit(1);
      return next ?? null;
    });
  }

  async findMany(ids: string[], tx?: DbOrTx): Promise<Map<string, Client>> {
    const db = tx ?? this.database.db;
    if (ids.length === 0) return new Map();
    const rows = await db.select().from(clients).where(inArray(clients.id, ids));
    return new Map(rows.map((row) => [row.id, row]));
  }

  /**
   * Search live (non-deleted, non-merged) clients by name. Used by
   * domain-side pickers (recruit clients, future compliance clients) that
   * route the picker through the canonical identity registry.
   */
  async searchByName(query: string, limit = 20, tx?: DbOrTx): Promise<Client[]> {
    const db = tx ?? this.database.db;
    const term = `%${query}%`;
    return db
      .select()
      .from(clients)
      .where(
        sql`${ilike(clients.name, term)} AND ${isNull(clients.deletedAt)} AND ${isNull(clients.mergedIntoId)}`,
      )
      .orderBy(asc(clients.name))
      .limit(limit);
  }

  async findByDomain(domain: string, tx?: DbOrTx): Promise<Client | null> {
    const db = tx ?? this.database.db;
    const [row] = await db
      .select()
      .from(clients)
      .where(sql`lower(${clients.websiteDomain}) = lower(${domain}) AND ${clients.deletedAt} IS NULL`)
      .limit(1);
    if (!row) return null;
    return followMerged(row, async (nextId) => {
      const [next] = await db.select().from(clients).where(eq(clients.id, nextId)).limit(1);
      return next ?? null;
    });
  }

  async update(
    id: string,
    patch: UpdateClientInput,
    userId: string,
    tx?: DbOrTx,
  ): Promise<Client> {
    const db = tx ?? this.database.db;
    const before = await this.findById(id, db, { followMerged: false });
    if (!before) throw new NotFoundException(`client ${id} not found`);
    if (before.deletedAt) {
      throw new BadRequestException(`client ${id} is deleted/merged; cannot update`);
    }

    const [after] = await db
      .update(clients)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();

    this.events.emit(DIRECTORY_CLIENT_UPDATED, {
      entityType: 'clients',
      entityId: id,
      actorId: userId,
      payload: { clientId: id, before, after },
    });

    return after;
  }

  async merge(loserId: string, winnerId: string, userId: string): Promise<Client> {
    if (loserId === winnerId) {
      throw new BadRequestException('cannot merge a client into itself');
    }

    return this.database.db.transaction(async (tx) => {
      const loser = await this.findById(loserId, tx, { followMerged: false });
      const winner = await this.findById(winnerId, tx, { followMerged: false });
      if (!loser) throw new NotFoundException(`client ${loserId} not found`);
      if (!winner) throw new NotFoundException(`client ${winnerId} not found`);
      if (loser.deletedAt) {
        throw new BadRequestException(`client ${loserId} is already merged or deleted`);
      }
      if (winner.deletedAt) {
        throw new BadRequestException(`client ${winnerId} is already merged or deleted`);
      }

      const now = new Date();
      await tx
        .update(clients)
        .set({ mergedIntoId: winner.id, deletedAt: now, deletedBy: userId, updatedAt: now })
        .where(eq(clients.id, loser.id));

      // Re-point client_contacts.client_id from loser → winner.
      await tx
        .update(clientContacts)
        .set({ clientId: winner.id })
        .where(eq(clientContacts.clientId, loser.id));

      // Re-point default_contact references that named loser (rare, but safe).
      // Domain-extension columns (e.g. compliance_client_id, recruit_*) are NOT
      // touched here; they're updated via DIRECTORY_CLIENT_MERGED event listeners
      // in each domain. Reads can also follow merged_into_id at the service layer.

      this.events.emit(DIRECTORY_CLIENT_MERGED, {
        entityType: 'clients',
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
    input: FindOrCreateClientInput,
  ): Promise<Client | null> {
    if (input.websiteDomain) {
      const [row] = await db
        .select()
        .from(clients)
        .where(sql`lower(${clients.websiteDomain}) = lower(${input.websiteDomain})`)
        .limit(1);
      if (row) return row;
    }
    if (input.linkedinUrl) {
      const [row] = await db
        .select()
        .from(clients)
        .where(eq(clients.linkedinUrl, input.linkedinUrl))
        .limit(1);
      if (row) return row;
    }
    // Name fallback. Excludes merged rows so a loser doesn't shadow the winner;
    // orders deleted last so a live "Acme Corp" beats a soft-deleted one of
    // the same name (caller revives the deleted match if that's all we find).
    // Guarded at the DB level by companies_name_lower_uniq partial index.
    const trimmedName = input.name.trim();
    if (trimmedName) {
      const [row] = await db
        .select()
        .from(clients)
        .where(
          sql`lower(trim(${clients.name})) = lower(${trimmedName}) AND ${clients.mergedIntoId} IS NULL`,
        )
        .orderBy(sql`${clients.deletedAt} ASC NULLS FIRST`)
        .limit(1);
      if (row) return row;
    }
    return null;
  }

  private async revive(db: DbOrTx, id: string, userId: string): Promise<Client> {
    const [row] = await db
      .update(clients)
      .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();

    this.events.emit(DIRECTORY_CLIENT_UPDATED, {
      entityType: 'clients',
      entityId: id,
      actorId: userId,
      payload: { clientId: id, before: { deletedAt: 'set' as unknown as Date }, after: { deletedAt: null } },
    });

    return row;
  }
}
