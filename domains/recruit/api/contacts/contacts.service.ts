import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import {
  ClientContactsService,
  type FindOrCreateClientContactInput,
  type UpdateClientContactInput,
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
    private readonly clientContacts: ClientContactsService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateContactDto, actorId: string) {
    return this.database.db.transaction(async (tx) => {
      const clientContact = await this.clientContacts.findOrCreate(
        toFindOrCreateClientContact(input, input.clientId ?? null),
        actorId,
        tx,
      );
      return this.entityService.create({ ...input, clientContactId: clientContact.id }, actorId, tx);
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
        .select({ clientContactId: contacts.clientContactId, clientId: contacts.clientId })
        .from(contacts)
        .where(eq(contacts.id, id))
        .limit(1);
      if (!current) {
        throw new NotFoundException(`Contact ${id} not found`);
      }

      const clientContactPatch = toClientContactPatch(input, current.clientId);
      if (current.clientContactId && Object.keys(clientContactPatch).length > 0) {
        try {
          await this.clientContacts.update(current.clientContactId, clientContactPatch, actorId, tx);
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ConflictException(
              clientContactPatch.primaryEmail
                ? `A contact with email "${clientContactPatch.primaryEmail}" already exists in the directory. Use the Directory merge tool to combine identities.`
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
    // Soft-delete only the recruit_contacts row. The directory client contact
    // stays — it may still be referenced by other domains. Identity-level
    // deletion is an explicit admin action via directory.
    return this.entityService.softDelete(id, actorId, accessCtx);
  }

  clone(id: string, actorId: string) {
    // Cloned contact points at the same directory client contact — same
    // identity, different recruit-side commercial relationship.
    return this.entityService.clone(id, actorId);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  getListLayout() {
    return this.entityService.getListLayout();
  }
}

function toFindOrCreateClientContact(
  input: CreateContactDto,
  clientId: string | null,
): FindOrCreateClientContactInput {
  return {
    fullName: composeFullName(input.firstName, input.lastName),
    primaryEmail: normalizeEmail(input.email),
    primaryPhone: input.mobile ?? input.workPhone ?? null,
    linkedinUrl: input.linkedinUrl ?? null,
    jobTitle: input.jobTitle ?? null,
    clientId,
  };
}

function toClientContactPatch(
  input: UpdateContactDto,
  currentClientId: string | null,
): UpdateClientContactInput {
  const patch: UpdateClientContactInput = {};
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

  // If clientId changed, update the client contact's clientId to track the
  // new client. Last-writer-wins semantics: if multiple recruit_contacts
  // share an identity via dedup, the most recent clientId change determines
  // the contact's client.
  if (input.clientId !== undefined && input.clientId !== currentClientId) {
    patch.clientId = input.clientId ?? null;
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
