import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { NotificationTemplatesService, NotificationRulesService } from '@packages/notifications';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { createTestIdentity, type TestIdentity } from '../../../../../../../test/utils/identity';
import { NOTIFICATION_RULES_PERMISSIONS } from '../../permissions';

describe('NotificationRulesController + TemplatesController (integration)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let db: DrizzleDB;
  let httpServer: any;
  let adminIdentity: TestIdentity;
  let templatesService: NotificationTemplatesService;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    module = testApp.module;
    db = testApp.db;
    httpServer = testApp.httpServer;
    templatesService = module.get(NotificationTemplatesService);

    adminIdentity = await createTestIdentity(module, db, {
      userType: 'admin',
      permissions: [
        NOTIFICATION_RULES_PERMISSIONS.RULES_READ,
        NOTIFICATION_RULES_PERMISSIONS.RULES_MANAGE,
        NOTIFICATION_RULES_PERMISSIONS.TEMPLATES_READ,
        NOTIFICATION_RULES_PERMISSIONS.TEMPLATES_MANAGE,
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase(db);
    await app.close();
  });

  // --- Templates ---

  describe('POST /api/v1/notification-templates', () => {
    it('should create a template and return 201', async () => {
      const res = await request(httpServer)
        .post('/api/v1/notification-templates')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ name: 'Welcome Email', channel: 'email', subject: 'Welcome!', body: 'Hello {{payload.firstName}}' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Welcome Email',
        channel: 'email',
      });
    });

    it('should return 400 for missing fields', async () => {
      const res = await request(httpServer)
        .post('/api/v1/notification-templates')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid channel', async () => {
      const res = await request(httpServer)
        .post('/api/v1/notification-templates')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ name: 'Test', channel: 'sms', body: 'test' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/notification-templates', () => {
    it('should return paginated templates', async () => {
      const res = await request(httpServer)
        .get('/api/v1/notification-templates')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });

    it('should filter by channel', async () => {
      const res = await request(httpServer)
        .get('/api/v1/notification-templates?channel=email')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      for (const t of res.body.data) {
        expect(t.channel).toBe('email');
      }
    });
  });

  describe('PATCH /api/v1/notification-templates/:id', () => {
    it('should update a template', async () => {
      const template = await templatesService.create({ name: 'Patch Me', channel: 'in_app', body: 'old' });

      const res = await request(httpServer)
        .patch(`/api/v1/notification-templates/${template.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ body: 'updated' });

      expect(res.status).toBe(200);
      expect(res.body.body).toBe('updated');
    });
  });

  describe('DELETE /api/v1/notification-templates/:id', () => {
    it('should delete a template not used by rules', async () => {
      const template = await templatesService.create({ name: 'Delete Me', channel: 'in_app', body: 'bye' });

      const res = await request(httpServer)
        .delete(`/api/v1/notification-templates/${template.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent template', async () => {
      const res = await request(httpServer)
        .delete('/api/v1/notification-templates/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  // --- Rules ---

  describe('POST /api/v1/notification-rules', () => {
    it('should create a rule with channels and return 201', async () => {
      const template = await templatesService.create({ name: 'Rule Template', channel: 'email', body: 'test' });

      const res = await request(httpServer)
        .post('/api/v1/notification-rules')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          name: 'Welcome Rule',
          triggerType: 'event',
          eventName: 'users.UserCreated',
          recipientStrategy: 'actor',
          channels: [{ channel: 'email', templateId: template.id }],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Welcome Rule',
        eventName: 'users.UserCreated',
        recipientStrategy: 'actor',
      });
      expect(res.body.channels).toHaveLength(1);
      expect(res.body.channels[0].channel).toBe('email');
    });

    it('should create a schedule_once rule with multiple date amounts', async () => {
      const template = await templatesService.create({ name: 'Reminder Template', channel: 'email', body: '{{#entities}}{{name}}{{/entities}}' });

      const res = await request(httpServer)
        .post('/api/v1/notification-rules')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          name: 'Multi-day reminder',
          triggerType: 'schedule_once',
          scheduleEntityType: 'tasks',
          scheduleDateField: 'dueDate',
          scheduleDateOperator: 'before',
          scheduleDateAmounts: [7, 3, 1],
          scheduleDateUnit: 'days',
          recipientStrategy: 'entity_owner',
          recipientConfig: { field: 'ownerId' },
          channels: [{ channel: 'email', templateId: template.id }],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Multi-day reminder',
        triggerType: 'schedule_once',
        scheduleDateAmounts: [7, 3, 1],
        scheduleDateUnit: 'days',
      });
    });

    it('should return 400 for non-integer scheduleDateAmounts', async () => {
      const template = await templatesService.create({ name: 'Bad Amounts Template', channel: 'email', body: 'test' });

      const res = await request(httpServer)
        .post('/api/v1/notification-rules')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          name: 'Bad amounts rule',
          triggerType: 'schedule_once',
          scheduleEntityType: 'tasks',
          scheduleDateField: 'dueDate',
          scheduleDateOperator: 'before',
          scheduleDateAmounts: ['abc', 'def'],
          scheduleDateUnit: 'days',
          recipientStrategy: 'actor',
          channels: [{ channel: 'email', templateId: template.id }],
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing fields', async () => {
      const res = await request(httpServer)
        .post('/api/v1/notification-rules')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/notification-rules', () => {
    it('should return paginated rules', async () => {
      const res = await request(httpServer)
        .get('/api/v1/notification-rules')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });

    it('should filter by eventName', async () => {
      const res = await request(httpServer)
        .get('/api/v1/notification-rules?eventName=users.UserCreated')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      for (const r of res.body.data) {
        expect(r.eventName).toBe('users.UserCreated');
      }
    });
  });

  describe('GET /api/v1/notification-rules/:id', () => {
    it('should return rule with channels', async () => {
      const template = await templatesService.create({ name: 'Get Rule Template', channel: 'in_app', body: 'test' });
      const rulesService = module.get(NotificationRulesService);
      const rule = await rulesService.create({
        name: 'Get Me',
        eventName: 'test.event',
        recipientStrategy: 'actor',
        channels: [{ channel: 'in_app', templateId: template.id }],
      });

      const res = await request(httpServer)
        .get(`/api/v1/notification-rules/${rule.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.channels).toHaveLength(1);
    });

    it('should return 404 for non-existent rule', async () => {
      const res = await request(httpServer)
        .get('/api/v1/notification-rules/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/notification-rules/:id', () => {
    it('should update rule fields', async () => {
      const template = await templatesService.create({ name: 'Patch Rule Tmpl', channel: 'email', body: 'x' });
      const rulesService = module.get(NotificationRulesService);
      const rule = await rulesService.create({
        name: 'Patch Me',
        eventName: 'test.event',
        recipientStrategy: 'actor',
        channels: [{ channel: 'email', templateId: template.id }],
      });

      const res = await request(httpServer)
        .patch(`/api/v1/notification-rules/${rule.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ name: 'Patched', isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Patched');
      expect(res.body.isActive).toBe(false);
    });
  });

  describe('PUT /api/v1/notification-rules/:id/channels', () => {
    it('should replace rule channels', async () => {
      const tmpl1 = await templatesService.create({ name: 'Ch1', channel: 'email', body: 'x' });
      const tmpl2 = await templatesService.create({ name: 'Ch2', channel: 'in_app', body: 'y' });
      const rulesService = module.get(NotificationRulesService);
      const rule = await rulesService.create({
        name: 'Set Channels',
        eventName: 'test.event',
        recipientStrategy: 'actor',
        channels: [{ channel: 'email', templateId: tmpl1.id }],
      });

      const res = await request(httpServer)
        .put(`/api/v1/notification-rules/${rule.id}/channels`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          channels: [
            { channel: 'email', templateId: tmpl1.id },
            { channel: 'in_app', templateId: tmpl2.id },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.channels).toHaveLength(2);
    });
  });

  describe('DELETE /api/v1/notification-rules/:id', () => {
    it('should delete a rule', async () => {
      const template = await templatesService.create({ name: 'Del Rule Tmpl', channel: 'email', body: 'x' });
      const rulesService = module.get(NotificationRulesService);
      const rule = await rulesService.create({
        name: 'Delete Me Rule',
        eventName: 'test.event',
        recipientStrategy: 'actor',
        channels: [{ channel: 'email', templateId: template.id }],
      });

      const res = await request(httpServer)
        .delete(`/api/v1/notification-rules/${rule.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(204);
    });
  });
});
