import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { AuthService, AUTH_INVITATION_SENT } from '@packages/auth';
import { RbacService } from '@packages/rbac';
import { DomainEventEmitter } from '@packages/events';
import { DatabaseService, users, eq, isNull } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';

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
 * Users service. CRUD delegates to the engine's ENTITY_SERVICE_users, plus
 * hand-written slots the engine does not cover:
 *
 * - `getEmail(id)` / `getPhone(id)` — readers registered with the notifications
 *   `ContactResolverRegistry` for email/whatsapp dispatch.
 * - `resetPassword(id, newPassword)` — backs the admin-only
 *   `POST /users/:id/reset-password` endpoint.
 * - `inviteUser(data)` — backs `POST /users/invite`; creates a user without a
 *   credentials row, mints an invitation token via auth, assigns roles, and
 *   emits AUTH_INVITATION_SENT so a notifications handler can deliver the email.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject('ENTITY_SERVICE_users') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly authService: AuthService,
    private readonly rbacService: RbacService,
    private readonly domainEventEmitter: DomainEventEmitter,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  create(input: Record<string, unknown>, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: Record<string, unknown>, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.update(id, input, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.softDelete(id, actorId, accessCtx);
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
