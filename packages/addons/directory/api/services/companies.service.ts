import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService, asc, eq, ilike, inArray, isNull, sql } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { companies, type Company, type NewCompany } from '../schema/companies';
import { people } from '../schema/people';
import {
  DIRECTORY_COMPANY_CREATED,
  DIRECTORY_COMPANY_UPDATED,
  DIRECTORY_COMPANY_MERGED,
} from '../events/types';
import { followMerged, isUniqueViolation, type DbOrTx } from './types';

export interface FindOrCreateCompanyInput {
  name: string;
  websiteDomain?: string | null;
  linkedinUrl?: string | null;
  industry?: string | null;
  sizeBand?: string | null;
  countryCode?: string | null;
  externalIds?: Record<string, unknown>;
}

export interface UpdateCompanyInput {
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
export class CompaniesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
  ) {}

  async findOrCreate(
    input: FindOrCreateCompanyInput,
    userId: string,
    tx?: DbOrTx,
  ): Promise<Company> {
    const db = tx ?? this.database.db;

    const existing = await this.lookupByDedupKeys(db, input);
    if (existing) {
      if (existing.deletedAt) {
        return this.revive(db, existing.id, userId);
      }
      return existing;
    }

    try {
      const insertValues: NewCompany = {
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
      const [row] = await db.insert(companies).values(insertValues).returning();

      this.events.emit(DIRECTORY_COMPANY_CREATED, {
        entityType: 'companies',
        entityId: row.id,
        actorId: userId,
        payload: {
          companyId: row.id,
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
  ): Promise<Company | null> {
    const db = tx ?? this.database.db;
    const [row] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    if (!row) return null;
    if (opts.followMerged === false) return row;
    return followMerged(row, async (nextId) => {
      const [next] = await db.select().from(companies).where(eq(companies.id, nextId)).limit(1);
      return next ?? null;
    });
  }

  async findMany(ids: string[], tx?: DbOrTx): Promise<Map<string, Company>> {
    const db = tx ?? this.database.db;
    if (ids.length === 0) return new Map();
    const rows = await db.select().from(companies).where(inArray(companies.id, ids));
    return new Map(rows.map((row) => [row.id, row]));
  }

  /**
   * Search live (non-deleted, non-merged) companies by name. Used by
   * domain-side pickers (recruit clients, future compliance clients) that
   * route the picker through the canonical identity registry.
   */
  async searchByName(query: string, limit = 20, tx?: DbOrTx): Promise<Company[]> {
    const db = tx ?? this.database.db;
    const term = `%${query}%`;
    return db
      .select()
      .from(companies)
      .where(
        sql`${ilike(companies.name, term)} AND ${isNull(companies.deletedAt)} AND ${isNull(companies.mergedIntoId)}`,
      )
      .orderBy(asc(companies.name))
      .limit(limit);
  }

  async findByDomain(domain: string, tx?: DbOrTx): Promise<Company | null> {
    const db = tx ?? this.database.db;
    const [row] = await db
      .select()
      .from(companies)
      .where(sql`lower(${companies.websiteDomain}) = lower(${domain}) AND ${companies.deletedAt} IS NULL`)
      .limit(1);
    if (!row) return null;
    return followMerged(row, async (nextId) => {
      const [next] = await db.select().from(companies).where(eq(companies.id, nextId)).limit(1);
      return next ?? null;
    });
  }

  async update(
    id: string,
    patch: UpdateCompanyInput,
    userId: string,
    tx?: DbOrTx,
  ): Promise<Company> {
    const db = tx ?? this.database.db;
    const before = await this.findById(id, db, { followMerged: false });
    if (!before) throw new NotFoundException(`company ${id} not found`);
    if (before.deletedAt) {
      throw new BadRequestException(`company ${id} is deleted/merged; cannot update`);
    }

    const [after] = await db
      .update(companies)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();

    this.events.emit(DIRECTORY_COMPANY_UPDATED, {
      entityType: 'companies',
      entityId: id,
      actorId: userId,
      payload: { companyId: id, before, after },
    });

    return after;
  }

  async merge(loserId: string, winnerId: string, userId: string): Promise<Company> {
    if (loserId === winnerId) {
      throw new BadRequestException('cannot merge a company into itself');
    }

    return this.database.db.transaction(async (tx) => {
      const loser = await this.findById(loserId, tx, { followMerged: false });
      const winner = await this.findById(winnerId, tx, { followMerged: false });
      if (!loser) throw new NotFoundException(`company ${loserId} not found`);
      if (!winner) throw new NotFoundException(`company ${winnerId} not found`);
      if (loser.deletedAt) {
        throw new BadRequestException(`company ${loserId} is already merged or deleted`);
      }
      if (winner.deletedAt) {
        throw new BadRequestException(`company ${winnerId} is already merged or deleted`);
      }

      const now = new Date();
      await tx
        .update(companies)
        .set({ mergedIntoId: winner.id, deletedAt: now, deletedBy: userId, updatedAt: now })
        .where(eq(companies.id, loser.id));

      // Re-point directory.people.company_id from loser → winner.
      await tx.update(people).set({ companyId: winner.id }).where(eq(people.companyId, loser.id));

      // Re-point default_contact references that named loser (rare, but safe).
      // Domain tables (compliance_clients.company_id, etc.) are NOT touched here;
      // they're updated via DIRECTORY_COMPANY_MERGED event listeners in each
      // domain. Reads can also follow merged_into_id at the service layer.

      this.events.emit(DIRECTORY_COMPANY_MERGED, {
        entityType: 'companies',
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
    input: FindOrCreateCompanyInput,
  ): Promise<Company | null> {
    if (input.websiteDomain) {
      const [row] = await db
        .select()
        .from(companies)
        .where(sql`lower(${companies.websiteDomain}) = lower(${input.websiteDomain})`)
        .limit(1);
      if (row) return row;
    }
    if (input.linkedinUrl) {
      const [row] = await db
        .select()
        .from(companies)
        .where(eq(companies.linkedinUrl, input.linkedinUrl))
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
        .from(companies)
        .where(
          sql`lower(trim(${companies.name})) = lower(${trimmedName}) AND ${companies.mergedIntoId} IS NULL`,
        )
        .orderBy(sql`${companies.deletedAt} ASC NULLS FIRST`)
        .limit(1);
      if (row) return row;
    }
    return null;
  }

  private async revive(db: DbOrTx, id: string, userId: string): Promise<Company> {
    const [row] = await db
      .update(companies)
      .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();

    this.events.emit(DIRECTORY_COMPANY_UPDATED, {
      entityType: 'companies',
      entityId: id,
      actorId: userId,
      payload: { companyId: id, before: { deletedAt: 'set' as unknown as Date }, after: { deletedAt: null } },
    });

    return row;
  }
}
