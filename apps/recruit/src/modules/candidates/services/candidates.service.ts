import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, and, or, isNull, ilike, asc, desc, count } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { MediaService, type MediaFile, type MediaFieldConfig, type UploadedFile } from '@packages/media';
import { TaxonomyService } from '@packages/taxonomy';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { FieldValueService, buildSnapshot, diffSnapshot } from '@packages/eav-attributes';
import type { PaginatedResponse } from '@packages/common';
import { candidates } from '../schema/candidates';
import {
  CANDIDATES_CANDIDATE_CREATED,
  CANDIDATES_CANDIDATE_UPDATED,
  CANDIDATES_CANDIDATE_DELETED,
  type CandidateSnapshot,
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

export interface CandidateResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  expectedSalary: number | null;
  currency: string | null;
  highestQualification: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  isWillingToRelocate: boolean | null;
  availableFrom: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  resumeFile: MediaFile | null;
  skills: { id: string; name: string; slug: string }[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

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

export interface CreateCandidateInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source?: string;
  currentCompany?: string;
  currentTitle?: string;
  expectedSalary?: number;
  currency?: string;
  highestQualification?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  isWillingToRelocate?: boolean;
  availableFrom?: string;
  linkedinUrl?: string;
  notes?: string;
}

export interface UpdateCandidateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  source?: string;
  currentCompany?: string | null;
  currentTitle?: string | null;
  expectedSalary?: number | null;
  currency?: string;
  highestQualification?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
  isWillingToRelocate?: boolean;
  availableFrom?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
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
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(CandidatesService.name);
  }

  async list(query: ListCandidatesQuery): Promise<PaginatedResponse<CandidateResponse>> {
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

    const data = await Promise.all(rows.map((row) => this.toResponse(row)));

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

  async findOneOrFail(id: string): Promise<CandidateResponse> {
    const [candidate] = await this.database.db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
      .limit(1);

    if (!candidate) throw new NotFoundException('Candidate not found');

    return this.toResponse(candidate);
  }

  async create(data: CreateCandidateInput, actorId: string): Promise<CandidateResponse> {
    // Check email uniqueness
    const [existing] = await this.database.db
      .select({ id: candidates.id })
      .from(candidates)
      .where(and(eq(candidates.email, data.email.toLowerCase()), isNull(candidates.deletedAt)))
      .limit(1);

    if (existing) throw new ConflictException('A candidate with this email already exists');

    const [candidate] = await this.database.db
      .insert(candidates)
      .values({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        source: data.source,
        currentCompany: data.currentCompany,
        currentTitle: data.currentTitle,
        expectedSalary: data.expectedSalary,
        currency: data.currency,
        highestQualification: data.highestQualification,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        nationality: data.nationality,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        zipCode: data.zipCode,
        isWillingToRelocate: data.isWillingToRelocate,
        availableFrom: data.availableFrom,
        linkedinUrl: data.linkedinUrl,
        notes: data.notes,
        createdBy: actorId,
      })
      .returning();

    this.logger.log('Candidate created', { candidateId: candidate.id, actorId });

    this.domainEventEmitter.emit(CANDIDATES_CANDIDATE_CREATED, {
      entityType: 'candidates',
      entityId: candidate.id,
      actorId,
      payload: {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        source: candidate.source,
        after: this.toSnapshot(candidate),
      },
    });

    return this.toResponse(candidate);
  }

  async update(id: string, data: UpdateCandidateInput, actorId: string): Promise<CandidateResponse> {
    // Validate the candidate exists before entering the transaction
    const existingResponse = await this.findOneOrFail(id);

    const updateValues: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateValues[key] = key === 'email' && typeof value === 'string' ? value.toLowerCase() : value;
      }
    }

    if (Object.keys(updateValues).length === 0) {
      return existingResponse;
    }

    // If email changed, check uniqueness
    if (updateValues.email && updateValues.email !== existingResponse.email) {
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

    let eventPayload: { changes: string[]; before: Record<string, unknown>; after: Record<string, unknown> } | null = null;

    const updated = await this.database.db.transaction(async (tx) => {
      // Read EAV values before mutation (inside tx for consistency)
      const eavBefore = await this.fieldValueService.getValues('candidates', id, tx);

      // Re-read the raw row inside the transaction to get a consistent snapshot
      const [existingRow] = await tx
        .select()
        .from(candidates)
        .where(eq(candidates.id, id))
        .limit(1);

      const before = buildSnapshot(this.toSnapshot(existingRow), eavBefore);

      // Update standard columns
      const [row] = await tx
        .update(candidates)
        .set(updateValues)
        .where(eq(candidates.id, id))
        .returning();

      // Update EAV (returns before/after of EAV values)
      const eavResult = await this.fieldValueService.setValues('candidates', id, {}, tx);

      const after = buildSnapshot(this.toSnapshot(row), eavResult.after);
      const changes = diffSnapshot(before, after);

      if (changes.length > 0) {
        eventPayload = { changes, before, after };
      }

      return row;
    });

    this.logger.log('Candidate updated', { candidateId: id, actorId, changes: Object.keys(updateValues) });

    // Emit AFTER transaction commits
    if (eventPayload) {
      this.domainEventEmitter.emit(CANDIDATES_CANDIDATE_UPDATED, {
        entityType: 'candidates',
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
      entityType: 'candidates',
      entityId: id,
      actorId,
      payload: {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        before: this.toSnapshot(candidate),
      },
    });
  }

  async restore(id: string): Promise<CandidateResponse> {
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

  async uploadResume(id: string, file: UploadedFile, actorId: string): Promise<CandidateResponse> {
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

  private toSnapshot(entity: CandidateResponse | typeof candidates.$inferSelect): CandidateSnapshot {
    return {
      firstName: entity.firstName,
      lastName: entity.lastName,
      email: entity.email,
      phone: entity.phone,
      source: entity.source,
      currentCompany: entity.currentCompany,
      currentTitle: entity.currentTitle,
      expectedSalary: entity.expectedSalary,
      currency: entity.currency,
      gender: entity.gender,
      nationality: entity.nationality,
      dateOfBirth: entity.dateOfBirth,
      address: entity.address,
      city: entity.city,
      state: entity.state,
      country: entity.country,
      zipCode: entity.zipCode,
      linkedinUrl: entity.linkedinUrl,
      highestQualification: entity.highestQualification,
      availableFrom: entity.availableFrom,
      isWillingToRelocate: entity.isWillingToRelocate,
      notes: entity.notes,
    };
  }

  private async toResponse(row: typeof candidates.$inferSelect): Promise<CandidateResponse> {
    const skills = await this.taxonomyService.getTagsForEntity(ENTITY_TYPE, row.id);

    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      source: row.source,
      currentCompany: row.currentCompany,
      currentTitle: row.currentTitle,
      expectedSalary: row.expectedSalary,
      currency: row.currency,
      highestQualification: row.highestQualification,
      dateOfBirth: row.dateOfBirth,
      gender: row.gender,
      nationality: row.nationality,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      zipCode: row.zipCode,
      isWillingToRelocate: row.isWillingToRelocate,
      availableFrom: row.availableFrom,
      linkedinUrl: row.linkedinUrl,
      notes: row.notes,
      resumeFile: row.resumeFile as MediaFile | null,
      skills: skills.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }
}
