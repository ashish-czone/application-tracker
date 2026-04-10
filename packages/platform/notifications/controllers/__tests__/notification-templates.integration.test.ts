import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { NotificationsModule } from '../../notifications.module';
import { NOTIFICATION_PERMISSIONS } from '../../permissions';

const READ = [NOTIFICATION_PERMISSIONS.TEMPLATES_READ];
const MANAGE = [...READ, NOTIFICATION_PERMISSIONS.TEMPLATES_MANAGE];

describe('NotificationTemplatesController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [NotificationChannelsModule, NotificationsModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;

  async function createTemplate(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: `Welcome Email ${seq}`,
      channel: 'email',
      subject: 'Welcome {{payload.firstName}}!',
      body: 'Hello {{payload.firstName}}, your account is ready.',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/notification-templates')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── CRUD ────────────────────────────────────────────────────

  describe('POST /api/v1/notification-templates', () => {
    it('should create an email template', async () => {
      const template = await createTemplate({
        name: 'Order Confirmation',
        channel: 'email',
        subject: 'Order confirmed',
        body: 'Your order has been confirmed.',
      });

      expect(template).toMatchObject({
        id: expect.any(String),
        name: 'Order Confirmation',
        channel: 'email',
        subject: 'Order confirmed',
      });
    });

    it('should create an in_app template', async () => {
      const template = await createTemplate({
        name: 'New Message',
        channel: 'in_app',
        body: 'You have a new message.',
      });

      expect(template).toMatchObject({
        name: 'New Message',
        channel: 'in_app',
      });
    });

    it('should create a whatsapp template', async () => {
      const template = await createTemplate({
        name: 'Appointment Reminder',
        channel: 'whatsapp',
        body: 'Reminder: your appointment is tomorrow.',
      });

      expect(template).toMatchObject({
        name: 'Appointment Reminder',
        channel: 'whatsapp',
      });
    });

    it('should reject missing name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notification-templates')
        .set(withAuth(MANAGE))
        .send({ channel: 'email', body: 'Hello' })
        .expect(400);
    });

    it('should reject missing body', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notification-templates')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', channel: 'email' })
        .expect(400);
    });

    it('should reject missing channel', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notification-templates')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', body: 'Hello' })
        .expect(400);
    });

    it('should reject invalid channel', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notification-templates')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', channel: 'sms', body: 'Hello' })
        .expect(400);
    });

    it('should reject unknown properties', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notification-templates')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', channel: 'email', body: 'Hello', hackField: 'injected' })
        .expect(400);
    });
  });

  describe('GET /api/v1/notification-templates', () => {
    it('should list templates with pagination', async () => {
      await createTemplate({ name: 'Template Alpha' });
      await createTemplate({ name: 'Template Beta' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/notification-templates')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({
        page: 1,
        total: 2,
      });
    });

    it('should filter by search', async () => {
      await createTemplate({ name: 'Welcome Email' });
      await createTemplate({ name: 'Order Confirmation' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/notification-templates?search=welcome')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Welcome Email');
    });

    it('should filter by channel', async () => {
      await createTemplate({ name: 'Email Template', channel: 'email' });
      await createTemplate({ name: 'In-App Template', channel: 'in_app' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/notification-templates?channel=in_app')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('In-App Template');
    });

    it('should paginate', async () => {
      await createTemplate({ name: 'Alpha' });
      await createTemplate({ name: 'Beta' });
      await createTemplate({ name: 'Gamma' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/notification-templates?page=1&limit=2&sort=name&order=asc')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Alpha');
      expect(res.body.meta.total).toBe(3);
    });

    it('should return empty when no templates exist', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/notification-templates')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });
  });

  describe('GET /api/v1/notification-templates/:id', () => {
    it('should return a template by ID', async () => {
      const template = await createTemplate({ name: 'Lookup Template' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/notification-templates/${template.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: template.id, name: 'Lookup Template' });
    });

    it('should return 404 for non-existent ID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/notification-templates/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/notification-templates/not-a-uuid')
        .set(withAuth(READ))
        .expect(400);
    });
  });

  describe('PATCH /api/v1/notification-templates/:id', () => {
    it('should update a template name', async () => {
      const template = await createTemplate();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/notification-templates/${template.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('should update template body', async () => {
      const template = await createTemplate();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/notification-templates/${template.id}`)
        .set(withAuth(MANAGE))
        .send({ body: 'Updated body content' })
        .expect(200);

      expect(res.body.body).toBe('Updated body content');
    });

    it('should update template subject', async () => {
      const template = await createTemplate();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/notification-templates/${template.id}`)
        .set(withAuth(MANAGE))
        .send({ subject: 'New Subject' })
        .expect(200);

      expect(res.body.subject).toBe('New Subject');
    });
  });

  describe('DELETE /api/v1/notification-templates/:id', () => {
    it('should delete a template', async () => {
      const template = await createTemplate();

      await request(ctx.httpServer)
        .delete(`/api/v1/notification-templates/${template.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/notification-templates/${template.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Permission enforcement ──────────────────────────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/notification-templates')
        .expect(401);
    });

    it('should return 403 with read-only on write endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/notification-templates')
        .set(withAuth(READ))
        .send({ name: 'Test', channel: 'email', body: 'Hello' })
        .expect(403);
    });

    it('should allow superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/notification-templates')
        .set(withAuth(['*']))
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
