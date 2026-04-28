import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, inArray, sql } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { people, type Person, type NewPerson } from '../schema/people';
import { companies } from '../schema/companies';
import {
  DIRECTORY_PERSON_CREATED,
  DIRECTORY_PERSON_UPDATED,
  DIRECTORY_PERSON_MERGED,
} from '../events/types';
import { followMerged, isUniqueViolation, type DbOrTx } from './types';

export interface FindOrCreatePersonInput {
  fullName: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  linkedinUrl?: string | null;
  jobTitle?: string | null;
  companyId?: string | null;
  externalIds?: Record<string, unknown>;
}

export interface UpdatePersonInput {
  fullName?: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  linkedinUrl?: string | null;
  jobTitle?: string | null;
  companyId?: string | null;
  doNotContact?: boolean;
  externalIds?: Record<string, unknown>;
}

@Injectable()
export class PeopleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
  ) {}

  async findOrCreate(
    input: FindOrCreatePersonInput,
    userId: string,
    tx?: DbOrTx,
  ): Promise<Person> {
    const db = tx ?? this.database.db;

    const existing = await this.lookupByDedupKeys(db, input);
    if (existing) {
      if (existing.deletedAt) {
        return this.revive(db, existing.id, userId);
      }
      return existing;
    }

    try {
      const insertValues: NewPerson = {
        fullName: input.fullName,
        primaryEmail: input.primaryEmail ?? null,
        primaryPhone: input.primaryPhone ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        jobTitle: input.jobTitle ?? null,
        companyId: input.companyId ?? null,
        externalIds: input.externalIds ?? {},
        createdBy: userId,
        updatedAt: new Date(),
      };
      const [row] = await db.insert(people).values(insertValues).returning();

      this.events.emit(DIRECTORY_PERSON_CREATED, {
        entityType: 'people',
        entityId: row.id,
        actorId: userId,
        payload: {
          personId: row.id,
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
  ): Promise<Person | null> {
    const db = tx ?? this.database.db;
    const [row] = await db.select().from(people).where(eq(people.id, id)).limit(1);
    if (!row) return null;
    if (opts.followMerged === false) return row;
    return followMerged(row, async (nextId) => {
      const [next] = await db.select().from(people).where(eq(people.id, nextId)).limit(1);
      return next ?? null;
    });
  }

  async findMany(ids: string[], tx?: DbOrTx): Promise<Map<string, Person>> {
    const db = tx ?? this.database.db;
    if (ids.length === 0) return new Map();
    const rows = await db.select().from(people).where(inArray(people.id, ids));
    return new Map(rows.map((row) => [row.id, row]));
  }

  async findByEmail(email: string, tx?: DbOrTx): Promise<Person | null> {
    const db = tx ?? this.database.db;
    const [row] = await db
      .select()
      .from(people)
      .where(sql`lower(${people.primaryEmail}) = lower(${email}) AND ${people.deletedAt} IS NULL`)
      .limit(1);
    if (!row) return null;
    return followMerged(row, async (nextId) => {
      const [next] = await db.select().from(people).where(eq(people.id, nextId)).limit(1);
      return next ?? null;
    });
  }

  async update(
    id: string,
    patch: UpdatePersonInput,
    userId: string,
    tx?: DbOrTx,
  ): Promise<Person> {
    const db = tx ?? this.database.db;
    const before = await this.findById(id, db, { followMerged: false });
    if (!before) throw new NotFoundException(`person ${id} not found`);
    if (before.deletedAt) {
      throw new BadRequestException(`person ${id} is deleted/merged; cannot update`);
    }

    const [after] = await db
      .update(people)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(people.id, id))
      .returning();

    this.events.emit(DIRECTORY_PERSON_UPDATED, {
      entityType: 'people',
      entityId: id,
      actorId: userId,
      payload: { personId: id, before, after },
    });

    return after;
  }

  async merge(loserId: string, winnerId: string, userId: string): Promise<Person> {
    if (loserId === winnerId) {
      throw new BadRequestException('cannot merge a person into themselves');
    }

    return this.database.db.transaction(async (tx) => {
      const loser = await this.findById(loserId, tx, { followMerged: false });
      const winner = await this.findById(winnerId, tx, { followMerged: false });
      if (!loser) throw new NotFoundException(`person ${loserId} not found`);
      if (!winner) throw new NotFoundException(`person ${winnerId} not found`);
      if (loser.deletedAt) {
        throw new BadRequestException(`person ${loserId} is already merged or deleted`);
      }
      if (winner.deletedAt) {
        throw new BadRequestException(`person ${winnerId} is already merged or deleted`);
      }

      const now = new Date();
      await tx
        .update(people)
        .set({ mergedIntoId: winner.id, deletedAt: now, deletedBy: userId, updatedAt: now })
        .where(eq(people.id, loser.id));

      // Re-point companies.default_contact_id from loser → winner.
      await tx
        .update(companies)
        .set({ defaultContactId: winner.id })
        .where(eq(companies.defaultContactId, loser.id));

      this.events.emit(DIRECTORY_PERSON_MERGED, {
        entityType: 'people',
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
    input: FindOrCreatePersonInput,
  ): Promise<Person | null> {
    if (input.primaryEmail) {
      const [row] = await db
        .select()
        .from(people)
        .where(sql`lower(${people.primaryEmail}) = lower(${input.primaryEmail})`)
        .limit(1);
      if (row) return row;
    }
    if (input.linkedinUrl) {
      const [row] = await db
        .select()
        .from(people)
        .where(eq(people.linkedinUrl, input.linkedinUrl))
        .limit(1);
      if (row) return row;
    }
    return null;
  }

  private async revive(db: DbOrTx, id: string, userId: string): Promise<Person> {
    const [row] = await db
      .update(people)
      .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
      .where(eq(people.id, id))
      .returning();

    this.events.emit(DIRECTORY_PERSON_UPDATED, {
      entityType: 'people',
      entityId: id,
      actorId: userId,
      payload: { personId: id, before: { deletedAt: 'set' as unknown as Date }, after: { deletedAt: null } },
    });

    return row;
  }
}
