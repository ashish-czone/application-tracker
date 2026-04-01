import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, and, ilike, asc, desc, count } from '@packages/database';
import type { PaginatedResponse } from '@packages/common';
import { notificationTemplates } from '../schema/notification-templates';
import type { NotificationTemplate, NotificationChannel } from '../types';

@Injectable()
export class NotificationTemplatesService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    channel?: NotificationChannel;
    sort?: 'name' | 'createdAt';
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<NotificationTemplate>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.channel) conditions.push(eq(notificationTemplates.channel, query.channel));
    if (query.search) conditions.push(ilike(notificationTemplates.name, `%${query.search}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const sortColumn = { name: notificationTemplates.name, createdAt: notificationTemplates.createdAt }[query.sort ?? 'createdAt'];
    const orderFn = query.order === 'asc' ? asc : desc;

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(notificationTemplates)
      .where(whereClause);

    const data = await this.database.db
      .select()
      .from(notificationTemplates)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    return {
      data: data as NotificationTemplate[],
      meta: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) },
    };
  }

  async findByIdOrFail(id: string): Promise<NotificationTemplate> {
    const [template] = await this.database.db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .limit(1);

    if (!template) throw new NotFoundException('Notification template not found');
    return template as NotificationTemplate;
  }

  async create(data: { name: string; channel: NotificationChannel; subject?: string; body: string }): Promise<NotificationTemplate> {
    const [template] = await this.database.db
      .insert(notificationTemplates)
      .values(data)
      .returning();
    return template as NotificationTemplate;
  }

  async update(id: string, data: { name?: string; subject?: string; body?: string }): Promise<NotificationTemplate> {
    await this.findByIdOrFail(id);

    const [updated] = await this.database.db
      .update(notificationTemplates)
      .set(data)
      .where(eq(notificationTemplates.id, id))
      .returning();

    return updated as NotificationTemplate;
  }

  async delete(id: string): Promise<void> {
    await this.findByIdOrFail(id);

    await this.database.db
      .delete(notificationTemplates)
      .where(eq(notificationTemplates.id, id));
  }
}
