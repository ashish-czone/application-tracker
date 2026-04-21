import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '@packages/auth';
import { DatabaseService, users, eq, isNull } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';

/**
 * Thin users reader service. CRUD + search + list + events + audit for users
 * are owned by the generic entity-engine route stack (`forEntity(usersConfig)`).
 *
 * Surface kept here covers the slots the engine does not:
 *
 * - `getEmail(id)` / `getPhone(id)` — readers registered with the notifications
 *   `ContactResolverRegistry` for email/whatsapp dispatch.
 * - `resetPassword(id, newPassword)` — backs the admin-only
 *   `POST /users/:id/reset-password` endpoint (not part of generic CRUD).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authService: AuthService,
  ) {}

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
}
