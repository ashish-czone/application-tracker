import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import {
  CompaniesService,
  type FindOrCreateCompanyInput,
  type UpdateCompanyInput,
} from '@packages/directory';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import type { CreateClientDto, UpdateClientDto } from './clients.dto';
import { clients } from './schema/clients';

@Injectable()
export class ClientsService {
  constructor(
    @Inject('ENTITY_SERVICE_clients') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly companies: CompaniesService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateClientDto, actorId: string) {
    return this.database.db.transaction(async (tx) => {
      const company = await this.companies.findOrCreate(
        toFindOrCreateCompany(input),
        actorId,
        tx,
      );
      return this.entityService.create({ ...input, companyId: company.id }, actorId, tx);
    });
  }

  async update(
    id: string,
    input: UpdateClientDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    return this.database.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ companyId: clients.companyId })
        .from(clients)
        .where(eq(clients.id, id))
        .limit(1);
      if (!current) {
        throw new NotFoundException(`Client ${id} not found`);
      }

      const companyPatch = toCompanyPatch(input);
      if (current.companyId && Object.keys(companyPatch).length > 0) {
        try {
          await this.companies.update(current.companyId, companyPatch, actorId, tx);
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ConflictException(
              companyPatch.name
                ? `A company named "${companyPatch.name}" already exists in the directory. Use the Directory merge tool to combine identities.`
                : `Directory uniqueness conflict — use the Directory merge tool to resolve.`,
            );
          }
          throw error;
        }
      }

      return this.entityService.update(id, input, actorId, accessCtx, tx);
    });
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    // Soft-delete only the recruit_clients row. The directory company stays —
    // other recruit_clients (and future cross-domain rows) may still point at
    // it. Identity-level deletion is an explicit admin action via directory.
    return this.entityService.softDelete(id, actorId, accessCtx);
  }

  clone(id: string, actorId: string) {
    // Entity-engine's clone copies all columns including company_id, so the
    // cloned recruit_client points at the same directory company — desired:
    // same identity, new commercial relationship.
    return this.entityService.clone(id, actorId);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  getListLayout() {
    return this.entityService.getListLayout();
  }
}

function toFindOrCreateCompany(input: CreateClientDto): FindOrCreateCompanyInput {
  return {
    name: input.clientName,
    websiteDomain: normalizeWebsiteDomain(input.website),
    industry: input.industry ?? null,
  };
}

function toCompanyPatch(input: UpdateClientDto): UpdateCompanyInput {
  const patch: UpdateCompanyInput = {};
  if (input.clientName !== undefined) patch.name = input.clientName;
  if (input.website !== undefined) patch.websiteDomain = normalizeWebsiteDomain(input.website);
  if (input.industry !== undefined) patch.industry = input.industry ?? null;
  return patch;
}

function normalizeWebsiteDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = raw
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    ?.trim();
  return stripped || null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === '23505'
  );
}
