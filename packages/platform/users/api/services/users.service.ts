import { Inject, Injectable, Optional, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AuthService, AUTH_INVITATION_SENT } from '@packages/auth';
import { RbacService } from '@packages/rbac';
import { DomainEventEmitter } from '@packages/events';
import { DatabaseService, users, eq, isNull } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { deriveUserStatus, type UserPosition, type UsersPositionsReader } from '../users.config';
import { USERS_POSITIONS_READER } from '../users-positions-reader.token';

interface UserWriteInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  userType?: string;
  credentials?: { password?: string };
  roles?: string[];
}

const STANDARD_FIELDS = ['email', 'firstName', 'lastName', 'phone', 'userType'] as const;

export interface InviteUserData {
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  phone?: string;
  roleIds?: string[];
}

export interface InvitedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  invitedAt: Date;
}

/**
 * Users service. Owns the full write path for the users entity — create,
 * update, and softDelete compose the users row with credentials and role
 * assignments inside a single tx, without going through the entity-engine's
 * generated CRUD. Reads (list, findOne) still wrap the engine for
 * pagination/filtering plus app-side enrichment.
 *
 * - `create(input, actorId)` — inserts the users row, creates the password
 *   credential when one is supplied, and assigns roles, all inside one tx.
 *   Emits `users.Created` after commit.
 * - `update(id, input, actorId)` — patches standard fields, optionally rotates
 *   the password, and diff-applies role assignments inside one tx.
 * - `softDelete(id, actorId)` — runs the subclass `cleanupOnSoftDelete` hook,
 *   then stamps `deletedAt` + `deletedBy`. Credentials and `user_roles` are
 *   left in place so a restore is a clean reverse.
 * - `getEmail(id)` / `getPhone(id)` — readers registered with the notifications
 *   `ContactResolverRegistry` for email/whatsapp dispatch.
 * - `resetPassword(id, newPassword)` — backs the admin-only
 *   `POST /users/:id/reset-password` endpoint.
 * - `inviteUser(data)` — backs `POST /users/invite`; creates a user without a
 *   credentials row, mints an invitation token via auth, assigns roles, and
 *   emits AUTH_INVITATION_SENT so a notifications handler can deliver the email.
 *
 * `list` and `findOne` wrap the engine read calls so every user response is
 * enriched with `roles` (from rbac), `positions` (from an app-supplied
 * positions reader), and the read-side `status` derived from the timestamps
 * on the row. Apps that don't wire up a positions reader still get
 * `positions: []` on every row.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject('ENTITY_SERVICE_users') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly authService: AuthService,
    private readonly rbacService: RbacService,
    private readonly domainEventEmitter: DomainEventEmitter,
    @Optional()
    @Inject(USERS_POSITIONS_READER)
    private readonly positionsReader?: UsersPositionsReader,
  ) {}

  async list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    const result = await this.entityService.list(query, accessCtx);
    result.data = await this.enrichUsers(result.data as Record<string, unknown>[]);
    return result;
  }

  async findOne(id: string, accessCtx?: DataAccessContext) {
    const row = await this.entityService.findOneOrFail(id, accessCtx);
    const [enriched] = await this.enrichUsers([row]);
    return enriched;
  }

  /**
   * Batch-enriches user rows with `roles`, `positions`, and derived `status`.
   * Runs one roles query and one positions query regardless of row count, so
   * list pages stay O(1) in network round-trips. Apps with no positions
   * reader wired get `positions: []` on every row.
   */
  private async enrichUsers(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    if (rows.length === 0) return rows;
    const ids = rows.map((r) => r.id as string);
    const emptyPositions: Record<string, UserPosition[]> = {};
    const [rolesByUser, positionsByUser] = await Promise.all([
      this.rbacService.getRolesByUserIds(ids),
      this.positionsReader ? this.positionsReader.getPositionsByUserIds(ids) : Promise.resolve(emptyPositions),
    ]);
    return rows.map((r) => ({
      ...r,
      roles: rolesByUser[r.id as string] ?? [],
      positions: positionsByUser[r.id as string] ?? [],
      status: deriveUserStatus(r),
    }));
  }

  /**
   * Insert a user, the password credential, and the role assignments inside
   * a single transaction. Either the whole composition lands or none of it
   * does — atomic with the user row, so a caller never observes a user that
   * exists without their credentials or roles. Emits `users.Created` after
   * the tx commits.
   */
  async create(input: Record<string, unknown>, actorId: string): Promise<Record<string, unknown>> {
    const parsed = this.parseWriteInput(input);
    this.requireFields(parsed, ['email', 'firstName', 'lastName', 'userType']);
    const email = parsed.email!.toLowerCase();

    await this.requireEmailAvailable(email);

    const user = await this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values(withTenantInsert(users, {
          email,
          firstName: parsed.firstName!,
          lastName: parsed.lastName!,
          userType: parsed.userType!,
          phone: parsed.phone ?? null,
        }))
        .returning();

      const password = parsed.credentials?.password;
      if (password !== undefined && password !== '') {
        await this.authService.createPasswordCredential(created.id, email, password, tx);
      }

      const roleIds = parsed.roles ?? [];
      if (roleIds.length > 0) {
        await this.rbacService.assignRolesInTx(tx, created.id, roleIds, parsed.userType!);
      }

      return created;
    });

    this.domainEventEmitter.emitDynamic('users.Created', {
      entityType: 'users',
      entityId: user.id,
      actorId,
      payload: { after: user as Record<string, unknown> },
    });

    return user as Record<string, unknown>;
  }

  /**
   * Patch a user's standard fields, optionally rotate the password, and
   * diff-apply the role set inside one transaction. Standard fields and
   * relationships are silently skipped when the corresponding key is not
   * present on the DTO — matching the prior engine semantics so partial
   * updates remain a tolerable shape.
   */
  async update(
    id: string,
    input: Record<string, unknown>,
    actorId: string,
    accessCtx?: DataAccessContext,
  ): Promise<Record<string, unknown>> {
    const before = await this.entityService.findOneOrFail(id, accessCtx);
    const parsed = this.parseWriteInput(input);

    const standardPatch: Record<string, unknown> = {};
    if (parsed.email !== undefined) standardPatch.email = parsed.email.toLowerCase();
    if (parsed.firstName !== undefined) standardPatch.firstName = parsed.firstName;
    if (parsed.lastName !== undefined) standardPatch.lastName = parsed.lastName;
    if (parsed.userType !== undefined) standardPatch.userType = parsed.userType;
    if ('phone' in input) standardPatch.phone = parsed.phone ?? null;

    if (typeof standardPatch.email === 'string' && standardPatch.email !== before.email) {
      await this.requireEmailAvailable(standardPatch.email, id);
    }

    const expectedUserType = (standardPatch.userType ?? before.userType) as string;

    const updated = await this.database.db.transaction(async (tx) => {
      let row: Record<string, unknown> = before;
      if (Object.keys(standardPatch).length > 0) {
        const [patched] = await tx
          .update(users)
          .set(standardPatch as any)
          .where(withTenant(users, eq(users.id, id)))
          .returning();
        row = patched as unknown as Record<string, unknown>;
      }

      const password = parsed.credentials?.password;
      if (password !== undefined && password !== '') {
        await this.authService.changePasswordDirect(id, password, tx);
      }

      if (parsed.roles !== undefined) {
        const desired = new Set(parsed.roles);
        const current = await this.rbacService.readRoleIdsInTx(tx, id);
        const toAdd = [...desired].filter((rid) => !current.has(rid));
        const toRemove = [...current].filter((rid) => !desired.has(rid));
        await this.rbacService.assignRolesInTx(tx, id, toAdd, expectedUserType);
        await this.rbacService.unassignRolesInTx(tx, id, toRemove);
      }

      return row;
    });

    this.domainEventEmitter.emitDynamic('users.Updated', {
      entityType: 'users',
      entityId: id,
      actorId,
      payload: { before, after: updated },
    });

    return updated;
  }

  /**
   * Soft-delete the user: run the subclass cleanup hook, then stamp deletedAt
   * + deletedBy on the row. Credentials and `user_roles` are intentionally
   * left in place so a restore brings them back; cascade-on-hard-delete is
   * handled at the FK level.
   */
  async softDelete(id: string, actorId: string, accessCtx?: DataAccessContext): Promise<void> {
    const before = await this.entityService.findOneOrFail(id, accessCtx);
    await this.cleanupOnSoftDelete(id);

    await this.database.db
      .update(users)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(withTenant(users, eq(users.id, id), isNull(users.deletedAt)));

    this.domainEventEmitter.emitDynamic('users.Deleted', {
      entityType: 'users',
      entityId: id,
      actorId,
      payload: { before },
    });
  }

  private parseWriteInput(input: Record<string, unknown>): UserWriteInput {
    const out: UserWriteInput = {};
    for (const key of STANDARD_FIELDS) {
      if (!(key in input)) continue;
      const value = input[key];
      if (key === 'phone') {
        if (value === null || value === undefined) { out.phone = null; continue; }
        if (typeof value !== 'string') throw new BadRequestException(`'phone' must be a string`);
        out.phone = value;
        continue;
      }
      if (typeof value !== 'string') {
        throw new BadRequestException(`'${key}' must be a string`);
      }
      out[key] = value;
    }
    if ('credentials' in input) {
      const v = input.credentials;
      if (v !== null && typeof v === 'object') {
        const password = (v as Record<string, unknown>).password;
        if (password !== undefined && typeof password !== 'string') {
          throw new BadRequestException(`'credentials.password' must be a string`);
        }
        out.credentials = { password: password as string | undefined };
      }
    }
    if ('roles' in input) {
      const v = input.roles;
      if (!Array.isArray(v)) {
        throw new BadRequestException(`'roles' must be an array of role IDs`);
      }
      const ids: string[] = [];
      for (const rid of v) {
        if (typeof rid !== 'string' || rid.length === 0) {
          throw new BadRequestException(`'roles' must be an array of non-empty strings`);
        }
        ids.push(rid);
      }
      out.roles = Array.from(new Set(ids));
    }
    return out;
  }

  private requireFields(parsed: UserWriteInput, fields: Array<keyof UserWriteInput>): void {
    for (const f of fields) {
      const v = parsed[f];
      if (v === undefined || v === null || v === '') {
        throw new BadRequestException(`'${String(f)}' is required`);
      }
    }
  }

  private async requireEmailAvailable(email: string, excludeId?: string): Promise<void> {
    const [existing] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(withTenant(users, eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('A user with this email already exists');
    }
  }

  /**
   * Called synchronously before the user row's `deletedAt` is stamped. Apps
   * subclass this service and override this method to null cross-module FK
   * references (tasks.assigneeId, org_unit_members rows, domain-specific
   * assignees) via the owning module's service API. Default is a no-op.
   *
   * Throwing aborts the deactivation — the user row is not soft-deleted.
   * Run everything here inside a DB transaction if atomicity with the user
   * row update matters; otherwise cleanup runs first and the row stamp is
   * a separate statement.
   */
  protected async cleanupOnSoftDelete(_userId: string): Promise<void> {
    // no-op in base; overridden per-app.
  }

  clone(id: string, actorId: string) {
    return this.entityService.clone(id, actorId);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  getListLayout() {
    return this.entityService.getListLayout();
  }

  async getEmail(id: string): Promise<string | null> {
    const [user] = await this.database.db
      .select({ email: users.email })
      .from(users)
      .where(withTenant(users, eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return user?.email ?? null;
  }

  async getPhone(id: string): Promise<string | null> {
    const [user] = await this.database.db
      .select({ phone: users.phone })
      .from(users)
      .where(withTenant(users, eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return user?.phone ?? null;
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const [user] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(withTenant(users, eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    await this.authService.changePasswordDirect(id, newPassword);
  }

  async inviteUser(data: InviteUserData): Promise<InvitedUser> {
    const email = data.email.toLowerCase();

    // Reject if an active (non-deleted) user already exists with this email.
    // The users_email_unique partial index on deletedAt IS NULL enforces this
    // at the DB level — check first so we return a clean 409 instead of a DB
    // constraint error.
    const [existing] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(withTenant(users, eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    // Create user + mint invitation token atomically. Role assignment + event
    // emission happen outside the tx because rbac assignments are idempotent
    // and the event is a fire-and-forget signal to the notifications handler.
    const { user, token, expiresAt } = await this.database.db.transaction(async (tx) => {
      const now = new Date();
      const [created] = await tx
        .insert(users)
        .values(withTenantInsert(users, {
          email,
          phone: data.phone ?? null,
          firstName: data.firstName,
          lastName: data.lastName,
          userType: data.userType,
          invitedAt: now,
        }))
        .returning();

      const { token, expiresAt } = await this.authService.createInvitationToken(created.id, tx);
      return { user: created, token, expiresAt };
    });

    // Role assignments — idempotent, so out-of-tx is fine.
    for (const roleId of data.roleIds ?? []) {
      await this.rbacService.assignRoleToUser(user.id, roleId);
    }

    // Emit the invitation event. The token travels on the payload so the
    // notifications handler can build the accept-invitation link.
    this.domainEventEmitter.emit(AUTH_INVITATION_SENT, {
      entityType: 'users',
      entityId: user.id,
      actorId: null,
      payload: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        token,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      invitedAt: user.invitedAt!,
    };
  }

  async resendInvitation(userId: string): Promise<{ expiresAt: Date }> {
    // Resend — must still be in the invited-but-not-yet-accepted state.
    const [user] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        userType: users.userType,
        invitedAt: users.invitedAt,
        acceptedAt: users.acceptedAt,
      })
      .from(users)
      .where(withTenant(users, eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');
    if (!user.invitedAt) {
      throw new ConflictException('User was not invited — has no pending invitation to resend');
    }
    if (user.acceptedAt) {
      throw new ConflictException('Invitation already accepted — user can log in');
    }

    // Refresh invitedAt so the listing reflects the resend timestamp.
    await this.database.db
      .update(users)
      .set({ invitedAt: new Date() })
      .where(withTenant(users, eq(users.id, user.id)));

    // createInvitationToken revokes outstanding invitation tokens and mints a fresh one.
    const { token, expiresAt } = await this.authService.createInvitationToken(user.id);

    this.domainEventEmitter.emit(AUTH_INVITATION_SENT, {
      entityType: 'users',
      entityId: user.id,
      actorId: null,
      payload: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        token,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return { expiresAt };
  }
}
