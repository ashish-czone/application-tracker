import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import {
  PeopleService,
  type FindOrCreatePersonInput,
  type UpdatePersonInput,
} from '@packages/directory';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import type { CreateContactDto, UpdateContactDto } from './contacts.dto';
import { contacts } from './schema/contacts';

@Injectable()
export class ContactsService {
  constructor(
    @Inject('ENTITY_SERVICE_contacts') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly people: PeopleService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateContactDto, actorId: string) {
    return this.database.db.transaction(async (tx) => {
      const person = await this.people.findOrCreate(
        toFindOrCreatePerson(input, input.companyId ?? null),
        actorId,
        tx,
      );
      return this.entityService.create({ ...input, personId: person.id }, actorId, tx);
    });
  }

  async update(
    id: string,
    input: UpdateContactDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    return this.database.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ personId: contacts.personId, companyId: contacts.companyId })
        .from(contacts)
        .where(eq(contacts.id, id))
        .limit(1);
      if (!current) {
        throw new NotFoundException(`Contact ${id} not found`);
      }

      const personPatch = toPersonPatch(input, current.companyId);
      if (current.personId && Object.keys(personPatch).length > 0) {
        try {
          await this.people.update(current.personId, personPatch, actorId, tx);
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ConflictException(
              personPatch.primaryEmail
                ? `A person with email "${personPatch.primaryEmail}" already exists in the directory. Use the Directory merge tool to combine identities.`
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
    // Soft-delete only the recruit_contacts row. The directory person stays —
    // they may still be referenced by other domains. Identity-level deletion
    // is an explicit admin action via directory.
    return this.entityService.softDelete(id, actorId, accessCtx);
  }

  clone(id: string, actorId: string) {
    // Cloned contact points at the same directory person — same identity,
    // different recruit-side commercial relationship.
    return this.entityService.clone(id, actorId);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  getListLayout() {
    return this.entityService.getListLayout();
  }
}

function toFindOrCreatePerson(
  input: CreateContactDto,
  companyId: string | null,
): FindOrCreatePersonInput {
  return {
    fullName: composeFullName(input.firstName, input.lastName),
    primaryEmail: normalizeEmail(input.email),
    primaryPhone: input.mobile ?? input.workPhone ?? null,
    linkedinUrl: input.linkedinUrl ?? null,
    jobTitle: input.jobTitle ?? null,
    companyId,
  };
}

function toPersonPatch(
  input: UpdateContactDto,
  currentCompanyId: string | null,
): UpdatePersonInput {
  const patch: UpdatePersonInput = {};
  if (input.firstName !== undefined || input.lastName !== undefined) {
    patch.fullName = composeFullName(input.firstName, input.lastName);
  }
  if (input.email !== undefined) {
    patch.primaryEmail = normalizeEmail(input.email);
  }
  if (input.mobile !== undefined || input.workPhone !== undefined) {
    patch.primaryPhone = input.mobile ?? input.workPhone ?? null;
  }
  if (input.linkedinUrl !== undefined) patch.linkedinUrl = input.linkedinUrl ?? null;
  if (input.jobTitle !== undefined) patch.jobTitle = input.jobTitle ?? null;

  // If companyId changed, update the person's companyId to track the new
  // company. Last-writer-wins semantics: if multiple recruit_contacts share a
  // person via dedup, the most recent companyId change determines the
  // person's company.
  if (input.companyId !== undefined && input.companyId !== currentCompanyId) {
    patch.companyId = input.companyId ?? null;
  }
  return patch;
}

function composeFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === '23505'
  );
}
