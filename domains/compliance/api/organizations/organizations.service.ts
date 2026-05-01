import { BadRequestException, Injectable } from '@nestjs/common';
import { count } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService } from '@packages/logger';
import { BaseCrudService } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { organizations } from './organizations.schema';
import type { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';

/**
 * Organizations is a singleton: exactly one row may exist and the row cannot
 * be deleted. Both invariants live here as method overrides.
 *
 * First consumer of `BaseCrudService` (sprint 4 of the camp-B migration).
 * The base provides standard list/findOne/create/update/softDelete via
 * `withScope`-applied Drizzle calls; this subclass adds the singleton
 * invariant on `create` and hard-blocks `softDelete`.
 *
 * Note: this service no longer injects the entity-engine's `EntityService`
 * for CRUD. The entity-engine module is still imported in
 * `organizations.module.ts` because it still owns ambient registrations
 * (CRUD permission manifests via auto-derivation, audit hookup, lookup
 * resolver). Sprint 5 will lift those out too.
 */
@Injectable()
export class OrganizationsService extends BaseCrudService(organizations, {
  slug: 'organizations',
  events: {
    created: 'organizations.Created',
    updated: 'organizations.Updated',
    deleted: 'organizations.Deleted',
  },
}) {
  constructor(database: DatabaseService, events: DomainEventEmitter, appLogger: AppLoggerService) {
    super(database, events, appLogger);
  }

  /**
   * Singleton invariant: reject create when any row already exists. The
   * caller-facing message points them at update so the API remains
   * discoverable from the error.
   */
  async create(input: CreateOrganizationDto, actorId: string) {
    const [{ count: rowCount }] = await this.database.db
      .select({ count: count() })
      .from(organizations);
    if (rowCount > 0) {
      throw new BadRequestException(
        'Organization is a singleton — only one row may exist. Update the existing one instead.',
      );
    }
    return super.create(input, actorId);
  }

  /**
   * Override `update` to type the input as `UpdateOrganizationDto` (the
   * narrow Zod-validated shape) instead of the base's generic
   * `Partial<Insert>`. Behaviour is unchanged — delegates to the base.
   */
  async update(
    id: string,
    input: UpdateOrganizationDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    return super.update(id, input, actorId, accessCtx);
  }

  /**
   * Hard-block delete — organizations is a singleton; the row represents
   * the deployment's identity and cannot be removed. Throw regardless of
   * id or access context so the failure is unambiguous.
   */
  async softDelete(_id: string, _actorId: string, _accessCtx?: DataAccessContext): Promise<never> {
    throw new BadRequestException('The organization record cannot be deleted.');
  }
}
