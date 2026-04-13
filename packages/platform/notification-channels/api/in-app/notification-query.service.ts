import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, and, desc, count } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import { notifications } from '../schema/notifications';

export interface ListNotificationsQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  eventName: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
}

@Injectable()
export class NotificationQueryService {
  constructor(private readonly database: DatabaseService) {}

  async listForUser(
    userId: string,
    query: ListNotificationsQuery = {},
  ): Promise<{ data: NotificationRecord[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(notifications.userId, userId)];
    if (query.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, query.isRead));
    }

    const where = withTenant(notifications, and(...conditions));

    const [data, [{ total }]] = await Promise.all([
      this.database.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(notifications)
        .where(where),
    ]);

    return { data, total: Number(total) };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await this.database.db
      .select({ count: count() })
      .from(notifications)
      .where(withTenant(notifications, eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return Number(result.count);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.database.db
      .update(notifications)
      .set({ isRead: true })
      .where(withTenant(notifications, eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.database.db
      .update(notifications)
      .set({ isRead: true })
      .where(withTenant(notifications, eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }
}
