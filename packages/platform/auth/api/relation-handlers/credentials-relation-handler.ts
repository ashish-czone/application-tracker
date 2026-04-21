import { Injectable, BadRequestException } from '@nestjs/common';
import type { DrizzleDB } from '@packages/database';
import type { RelationHandler, RelationHandlerContext } from '@packages/entity-engine-contract';
import { CredentialsService } from '../services/credentials.service';

interface CredentialsPayload {
  password?: string;
}

/**
 * Owns the write side of the `credentials` relationship declared on the users
 * entity. Derives the login identifier from `ctx.parent.email` so the caller
 * DTO only needs to ship `{ credentials: { password } }` — email lives on the
 * parent row and is not duplicated.
 *
 * Invoked by `@packages/entity-engine` inside the parent's create/update tx.
 */
@Injectable()
export class CredentialsRelationHandler implements RelationHandler {
  constructor(private readonly credentialsService: CredentialsService) {}

  async onCreate(
    tx: unknown,
    parentId: string,
    payload: unknown,
    _actorId: string,
    ctx: RelationHandlerContext,
  ): Promise<void> {
    const { password } = this.parsePayload(payload);
    if (!password) {
      throw new BadRequestException('credentials.password is required');
    }
    const identifier = this.resolveIdentifier(ctx);
    await this.credentialsService.createPasswordCredential(parentId, identifier, password, tx as DrizzleDB);
  }

  async onUpdate(
    tx: unknown,
    parentId: string,
    payload: unknown,
    _actorId: string,
    _ctx: RelationHandlerContext,
  ): Promise<void> {
    const { password } = this.parsePayload(payload);
    // Updates that don't touch password (e.g. rotating another credential
    // field in the future) are silent no-ops rather than errors.
    if (!password) return;
    await this.credentialsService.updateSecretHash(parentId, 'password', password, tx as DrizzleDB);
  }

  /**
   * No-op on delete: credential rows are removed by the users table's FK
   * cascade on hard delete, and deliberately left in place on soft delete so
   * a restore is a clean reverse. The engine still fires this hook for
   * symmetry with other handlers that may need to clean up.
   */
  async onDelete(
    _tx: unknown,
    _parentId: string,
    _actorId: string,
    _opts: { kind: 'soft' | 'hard' },
    _ctx: RelationHandlerContext,
  ): Promise<void> {
    // intentionally empty
  }

  private parsePayload(payload: unknown): CredentialsPayload {
    if (!payload || typeof payload !== 'object') return {};
    const { password } = payload as Record<string, unknown>;
    return { password: typeof password === 'string' ? password : undefined };
  }

  private resolveIdentifier(ctx: RelationHandlerContext): string {
    const email = ctx.parent?.email;
    if (typeof email !== 'string' || email.length === 0) {
      throw new BadRequestException(
        'credentials handler requires parent.email — the owning entity must expose an `email` column',
      );
    }
    return email.toLowerCase();
  }
}
