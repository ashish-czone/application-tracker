import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { NotificationChannelsModule } from '../../notification-channels.module';

describe('UserNotificationsController (integration)', () => {
  let ctx: PackageTestApp;
  let testUserId: string;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [NotificationChannelsModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
    testUserId = randomUUID();
    // Seed a test user
    await ctx.db.execute(
      sql`INSERT INTO users (id, email, first_name, last_name, user_type, updated_at)
          VALUES (${testUserId}, ${`test-${Date.now()}@example.com`}, ${'Test'}, ${'User'}, ${'admin'}, NOW())`,
    );
  });

  // ── Helpers ──────────────────────────────────────────────────

  async function seedNotification(overrides: Record<string, unknown> = {}) {
    const id = randomUUID();
    const defaults = {
      id,
      userId: testUserId,
      title: 'Test Notification',
      body: 'This is a test notification body',
      isRead: false,
      eventName: 'test.event',
    };
    const data = { ...defaults, ...overrides };

    await ctx.db.execute(
      sql`INSERT INTO notifications (id, user_id, title, body, is_read, event_name)
          VALUES (${data.id as string}, ${data.userId as string}, ${data.title as string}, ${data.body as string}, ${data.isRead as boolean}, ${data.eventName as string})`,
    );
    return data;
  }

  // No @RequirePermission on this controller — uses @CurrentUser() only

  // ── List notifications ──────────────────────────────────────

  describe('GET /api/v1/notifications', () => {
    it('should return empty list when no notifications exist', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/notifications')
        .set(withAuth([], { userId: testUserId }))
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('should list notifications for the current user', async () => {
      await seedNotification({ title: 'Notification 1' });
      await seedNotification({ title: 'Notification 2' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/notifications')
        .set(withAuth([], { userId: testUserId }))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('should not return notifications for other users', async () => {
      const otherUserId = randomUUID();
      await ctx.db.execute(
        sql`INSERT INTO users (id, email, first_name, last_name, user_type, updated_at)
            VALUES (${otherUserId}, ${`other-${Date.now()}@example.com`}, ${'Other'}, ${'User'}, ${'admin'}, NOW())`,
      );
      await seedNotification({ userId: otherUserId, title: 'Other User Notification' });
      await seedNotification({ title: 'My Notification' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/notifications')
        .set(withAuth([], { userId: testUserId }))
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('My Notification');
    });

    it('should paginate', async () => {
      for (let i = 0; i < 5; i++) {
        await seedNotification({ title: `Notification ${i}` });
      }

      const res = await request(ctx.httpServer)
        .get('/api/v1/notifications?page=1&limit=2')
        .set(withAuth([], { userId: testUserId }))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(5);
    });
  });

  // ── Unread count ──────────────────────────────────────

  describe('GET /api/v1/notifications/unread-count', () => {
    it('should return zero when no unread notifications', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/notifications/unread-count')
        .set(withAuth([], { userId: testUserId }))
        .expect(200);

      expect(res.body.count).toBe(0);
    });

    it('should count unread notifications', async () => {
      await seedNotification({ isRead: false });
      await seedNotification({ isRead: false });
      await seedNotification({ isRead: true });

      const res = await request(ctx.httpServer)
        .get('/api/v1/notifications/unread-count')
        .set(withAuth([], { userId: testUserId }))
        .expect(200);

      expect(res.body.count).toBe(2);
    });
  });

  // ── Mark as read ──────────────────────────────────────

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const notif = await seedNotification({ isRead: false });

      await request(ctx.httpServer)
        .patch(`/api/v1/notifications/${notif.id}/read`)
        .set(withAuth([], { userId: testUserId }))
        .expect(200);

      // Verify unread count decreased
      const res = await request(ctx.httpServer)
        .get('/api/v1/notifications/unread-count')
        .set(withAuth([], { userId: testUserId }))
        .expect(200);

      expect(res.body.count).toBe(0);
    });
  });

  // ── Mark all as read ──────────────────────────────────────

  describe('PATCH /api/v1/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      await seedNotification({ isRead: false });
      await seedNotification({ isRead: false });
      await seedNotification({ isRead: false });

      await request(ctx.httpServer)
        .patch('/api/v1/notifications/read-all')
        .set(withAuth([], { userId: testUserId }))
        .expect(200);

      const res = await request(ctx.httpServer)
        .get('/api/v1/notifications/unread-count')
        .set(withAuth([], { userId: testUserId }))
        .expect(200);

      expect(res.body.count).toBe(0);
    });
  });

  // ── Auth ──────────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('should return 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/notifications')
        .expect(401);
    });
  });
});
