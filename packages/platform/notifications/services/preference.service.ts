import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, and } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import { notificationPreferences } from '../schema/notification-preferences';
import type { NotificationChannel } from '../types';

@Injectable()
export class PreferenceService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Check if a user has a specific channel enabled.
   * Returns true if no preference exists (default: enabled).
   */
  async isEnabled(userId: string, channel: NotificationChannel): Promise<boolean> {
    const [pref] = await this.database.db
      .select({ isEnabled: notificationPreferences.isEnabled })
      .from(notificationPreferences)
      .where(withTenant(notificationPreferences,
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.channel, channel),
      ))
      .limit(1);

    // No preference = default enabled
    return pref?.isEnabled ?? true;
  }
}
