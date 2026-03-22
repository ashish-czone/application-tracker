import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService, eq, and, or, isNull, ilike, asc, desc, count } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { MediaService, type MediaFile, type MediaFieldConfig, type UploadedFile } from '@packages/media';
import { TaxonomyService } from '@packages/taxonomy';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import {
  FieldValueService,
  FieldDefinitionService,
  buildSnapshot,
  diffSnapshot,
  validatePayload,
  splitPayload,
} from '@packages/eav-attributes';
import type { PaginatedResponse } from '@packages/common';
import { candidates } from '../schema/candidates';
import {
  CANDIDATES_CANDIDATE_CREATED,
  CANDIDATES_CANDIDATE_UPDATED,
  CANDIDATES_CANDIDATE_DELETED,
} from '../events/types';

function resumeFieldConfig(candidateId: string): MediaFieldConfig {
  return {
    entityType: ENTITY_TYPE,
    entityId: candidateId,
    fieldName: 'resume',
    maxFiles: 1,
    accept: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxFileSize: 10 * 1024 * 1024, // 10MB
  };
}

const ENTITY_TYPE = 'candidate';
const EAV_ENTITY_TYPE = 'candidates';

/** System columns excluded from field-level operations (snapshot, toResponse field spread) */
const SYSTEM_COLUMNS = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'resumeFile', 'createdBy']);

export interface ListCandidatesQuery {
  page?: number;
  limit?: number;
  search?: string;
  source?: string;
  country?: string;
  qualification?: string;
  sort?: 'firstName' | 'email' | 'createdAt' | 'country';
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

@Injectable()
export class CandidatesService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly domainEventEmitter: DomainEventEmitter,
    private readonly mediaService: MediaService,
    private readonly taxonomyService: TaxonomyService,
    private readonly fieldValueService: FieldValueService,
    private readonly fieldDefinitionService: FieldDefinitionService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(CandidatesService.name);
  }

  async list(query: ListCandidatesQuery): Promise<PaginatedResponse<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (!query.includeDeleted) {
      conditions.push(isNull(candidates.deletedAt));
    }

    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(candidates.firstName, pattern),
          ilike(candidates.lastName, pattern),
          ilike(candidates.email, pattern),
        ),
      );
    }

    if (query.source) {
      conditions.push(eq(candidates.source, query.source));
    }

    if (query.country) {
      conditions.push(eq(candidates.country, query.country));
    }

    if (query.qualification) {
      conditions.push(eq(candidates.highestQualification, query.qualification));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumn = {
      firstName: candidates.firstName,
      email: candidates.email,
      createdAt: candidates.createdAt,
      country: candidates.country,
    }[query.sort ?? 'createdAt'];

    const orderFn = query.order === 'asc' ? asc : desc;

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(candidates)
      .where(whereClause);

    const rows = await this.database.db
      .select()
      .from(candidates)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    // Batch-hydrate EAV values for all candidates on this page
    const entityIds = rows.map(r => r.id);
    const eavMap = entityIds.length > 0
      ? await this.fieldValueService.getBatchValues(EAV_ENTITY_TYPE, entityIds)
      : new Map<string, Record<string, unknown>>();

    const data = await Promise.all(rows.map((row) => this.toResponse(row, eavMap.get(row.id))));

    return {
      data,
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async findOneOrFail(id: string): Promise<Record<string, unknown>> {
    const [candidate] = await this.database.db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
      .limit(1);

    if (!candidate) throw new NotFoundException('Candidate not found');

    return this.toResponse(candidate);
  }

  async create(payload: Record<string, unknown>, actorId: string): Promise<Record<string, unknown>> {
    // 1. Load field definitions with picklist options for validation
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(EAV_ENTITY_TYPE);

    // 2. Validate
    const result = validatePayload(defs, payload, { partial: false });
    if (!result.valid) {
      throw new BadRequestException({ message: 'Validation failed', errors: result.errors });
    }

    // 3. Split into standard DB columns vs custom EAV fields
    const { standardFields, customFields } = splitPayload(defs, payload);

    // 4. Email normalization
    if (standardFields.email) {
      standardFields.email = (standardFields.email as string).toLowerCase();
    }

    // 5. Check email uniqueness
    if (standardFields.email) {
      const [existing] = await this.database.db
        .select({ id: candidates.id })
        .from(candidates)
        .where(and(eq(candidates.email, standardFields.email as string), isNull(candidates.deletedAt)))
        .limit(1);

      if (existing) throw new ConflictException('A candidate with this email already exists');
    }

    // 6. Check uniqueness for unique custom EAV fields
    for (const def of defs.filter(d => d.isUnique && !d.columnName)) {
      if (customFields[def.fieldKey] != null) {
        const isUnique = await this.fieldValueService.checkUniqueness(
          EAV_ENTITY_TYPE, def.fieldKey, customFields[def.fieldKey],
        );
        if (!isUnique) throw new ConflictException(`Value for '${def.label}' must be unique`);
      }
    }

    // 7. Insert standard fields + set EAV values in transaction
    const candidate = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(candidates)
        .values({ ...standardFields, createdBy: actorId } as any)
        .returning();

      if (Object.keys(customFields).length > 0) {
        await this.fieldValueService.setValues(EAV_ENTITY_TYPE, row.id, customFields, tx);
      }

      return row;
    });

    this.logger.log('Candidate created', { candidateId: candidate.id, actorId });

    const response = await this.toResponse(candidate);
    const snapshot = await this.buildEntitySnapshot(candidate);

    this.domainEventEmitter.emit(CANDIDATES_CANDIDATE_CREATED, {
      entityType: EAV_ENTITY_TYPE,
      entityId: candidate.id,
      actorId,
      payload: {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        source: candidate.source,
        after: snapshot,
      },
    });

    return response;
  }

  async update(id: string, payload: Record<string, unknown>, actorId: string): Promise<Record<string, unknown>> {
    // Validate the candidate exists
    await this.findOneOrFail(id);

    // 1. Load field definitions
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(EAV_ENTITY_TYPE);

    // 2. Validate (partial mode — missing required fields OK)
    const result = validatePayload(defs, payload, { partial: true });
    if (!result.valid) {
      throw new BadRequestException({ message: 'Validation failed', errors: result.errors });
    }

    // 3. Split
    const { standardFields, customFields } = splitPayload(defs, payload);

    // Filter out undefined values from standard fields
    const updateValues: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(standardFields)) {
      if (value !== undefined) {
        updateValues[key] = key === 'email' && typeof value === 'string' ? value.toLowerCase() : value;
      }
    }

    const hasStandardChanges = Object.keys(updateValues).length > 0;
    const hasCustomChanges = Object.keys(customFields).length > 0;

    if (!hasStandardChanges && !hasCustomChanges) {
      return this.findOneOrFail(id);
    }

    // 4. If email changed, check uniqueness
    if (updateValues.email) {
      const [conflict] = await this.database.db
        .select({ id: candidates.id })
        .from(candidates)
        .where(and(
          eq(candidates.email, updateValues.email as string),
          isNull(candidates.deletedAt),
        ))
        .limit(1);

      if (conflict && conflict.id !== id) {
        throw new ConflictException('A candidate with this email already exists');
      }
    }

    // 5. Check uniqueness for unique custom EAV fields
    for (const def of defs.filter(d => d.isUnique && !d.columnName)) {
      if (customFields[def.fieldKey] != null) {
        const isUnique = await this.fieldValueService.checkUniqueness(
          EAV_ENTITY_TYPE, def.fieldKey, customFields[def.fieldKey], id,
        );
        if (!isUnique) throw new ConflictException(`Value for '${def.label}' must be unique`);
      }
    }

    let eventPayload: { changes: string[]; before: Record<string, unknown>; after: Record<string, unknown> } | null = null;

    const updated = await this.database.db.transaction(async (tx) => {
      // Read EAV values before mutation (inside tx for consistency)
      const eavBefore = await this.fieldValueService.getValues(EAV_ENTITY_TYPE, id, tx);

      // Re-read the raw row inside the transaction to get a consistent snapshot
      const [existingRow] = await tx
        .select()
        .from(candidates)
        .where(eq(candidates.id, id))
        .limit(1);

      const before = buildSnapshot(this.rowToSnapshot(existingRow), eavBefore);

      // Update standard columns (if any)
      let row = existingRow;
      if (hasStandardChanges) {
        const [updatedRow] = await tx
          .update(candidates)
          .set(updateValues)
          .where(eq(candidates.id, id))
          .returning();
        row = updatedRow;
      }

      // Update EAV values (if any)
      let eavAfter = eavBefore;
      if (hasCustomChanges) {
        const eavResult = await this.fieldValueService.setValues(EAV_ENTITY_TYPE, id, customFields, tx);
        eavAfter = eavResult.after;
      }

      const after = buildSnapshot(this.rowToSnapshot(row), eavAfter);
      const changes = diffSnapshot(before, after);

      if (changes.length > 0) {
        eventPayload = { changes, before, after };
      }

      return row;
    });

    this.logger.log('Candidate updated', {
      candidateId: id,
      actorId,
      changes: [...Object.keys(updateValues), ...Object.keys(customFields)],
    });

    // Emit AFTER transaction commits
    if (eventPayload) {
      this.domainEventEmitter.emit(CANDIDATES_CANDIDATE_UPDATED, {
        entityType: EAV_ENTITY_TYPE,
        entityId: id,
        actorId,
        payload: eventPayload,
      });
    }

    return this.toResponse(updated);
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    const candidate = await this.findOneOrFail(id);

    await this.database.db
      .update(candidates)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(eq(candidates.id, id));

    this.logger.log('Candidate deleted', { candidateId: id, actorId });

    this.domainEventEmitter.emit(CANDIDATES_CANDIDATE_DELETED, {
      entityType: EAV_ENTITY_TYPE,
      entityId: id,
      actorId,
      payload: {
        firstName: candidate.firstName as string,
        lastName: candidate.lastName as string,
        email: candidate.email as string,
        before: candidate as Record<string, unknown>,
      },
    });
  }

  async restore(id: string): Promise<Record<string, unknown>> {
    const [candidate] = await this.database.db
      .select()
      .from(candidates)
      .where(eq(candidates.id, id))
      .limit(1);

    if (!candidate) throw new NotFoundException('Candidate not found');

    const [restored] = await this.database.db
      .update(candidates)
      .set({ deletedAt: null, deletedBy: null })
      .where(eq(candidates.id, id))
      .returning();

    this.logger.log('Candidate restored', { candidateId: id });

    return this.toResponse(restored);
  }

  async uploadResume(id: string, file: UploadedFile, actorId: string): Promise<Record<string, unknown>> {
    const candidate = await this.findOneOrFail(id);
    const existingResume = candidate.resumeFile as MediaFile | null;

    const mediaFile = await this.mediaService.uploadSingle(file, resumeFieldConfig(id), existingResume);

    const [updated] = await this.database.db
      .update(candidates)
      .set({ resumeFile: mediaFile })
      .where(eq(candidates.id, id))
      .returning();

    this.logger.log('Resume uploaded', { candidateId: id, actorId, key: mediaFile.key });

    return this.toResponse(updated);
  }

  async attachSkill(id: string, tagId: string): Promise<void> {
    await this.findOneOrFail(id);
    await this.taxonomyService.attachTag(ENTITY_TYPE, id, tagId);
  }

  async detachSkill(id: string, tagId: string): Promise<void> {
    await this.findOneOrFail(id);
    await this.taxonomyService.detachTag(ENTITY_TYPE, id, tagId);
  }

  /**
   * Extract field-level data from a raw DB row (excludes system columns).
   * Used for building before/after snapshots for events.
   */
  private rowToSnapshot(row: typeof candidates.$inferSelect): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!SYSTEM_COLUMNS.has(key)) {
        snapshot[key] = value;
      }
    }
    return snapshot;
  }

  /**
   * Build a full entity snapshot (standard + EAV) for event payloads.
   */
  private async buildEntitySnapshot(row: typeof candidates.$inferSelect): Promise<Record<string, unknown>> {
    const eavValues = await this.fieldValueService.getValues(EAV_ENTITY_TYPE, row.id);
    return buildSnapshot(this.rowToSnapshot(row), eavValues);
  }

  /**
   * Build the API response by merging standard DB columns with EAV values.
   * Standard fields take precedence over EAV on key collision.
   * Optionally accepts pre-fetched EAV values for batch hydration (list view).
   */
  private async toResponse(
    row: typeof candidates.$inferSelect,
    preloadedEavValues?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const eavValues = preloadedEavValues ?? await this.fieldValueService.getValues(EAV_ENTITY_TYPE, row.id);
    const skills = await this.taxonomyService.getTagsForEntity(ENTITY_TYPE, row.id);

    const standardFields = this.rowToSnapshot(row);

    return {
      ...eavValues,
      ...standardFields,
      id: row.id,
      resumeFile: row.resumeFile as MediaFile | null,
      skills: skills.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }
}
