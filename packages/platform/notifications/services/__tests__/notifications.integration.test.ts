import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { Global, Module } from '@nestjs/common';
import { createIntegrationTestModule, cleanDatabase } from '@packages/testing';
import { EventsModule } from '@packages/events';
import { RbacModule } from '@packages/rbac';
import { QueueService } from '@packages/queue';
import { ActionRegistry } from '@packages/automations/services/action-registry';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { NotificationsModule } from '../../notifications.module';
import { NotificationTemplatesService } from '../notification-templates.service';
import { PreferenceService } from '../preference.service';
import { ContactResolverRegistry } from '../contact-resolver-registry';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

@Global()
@Module({
  providers: [
    { provide: QueueService, useValue: { registerProcessor: () => {}, getQueue: () => null } },
    ActionRegistry,
  ],
  exports: [QueueService, ActionRegistry],
})
class MockDepsModule {}

describe('Notifications (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let templates: NotificationTemplatesService;
  let preferences: PreferenceService;
  let contactRegistry: ContactResolverRegistry;

  beforeAll(async () => {
    const ctx = await createIntegrationTestModule({
      imports: [EventsModule, RbacModule, MockDepsModule, NotificationChannelsModule, NotificationsModule],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    templates = module.get(NotificationTemplatesService);
    preferences = module.get(PreferenceService);
    contactRegistry = module.get(ContactResolverRegistry);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('NotificationTemplatesService', () => {
    it('should create and retrieve a template', async () => {
      const template = await templates.create({
        name: 'Welcome Email',
        channel: 'email',
        subject: 'Welcome {{name}}',
        body: 'Hello {{name}}, welcome to the platform!',
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('Welcome Email');

      const found = await templates.findByIdOrFail(template.id);
      expect(found.body).toBe('Hello {{name}}, welcome to the platform!');
    });

    it('should list templates with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await templates.create({
          name: `Template ${i}`,
          channel: 'email',
          body: `Body ${i}`,
        });
      }

      const page = await templates.list({ page: 1, limit: 3 });
      expect(page.data).toHaveLength(3);
      expect(page.meta.total).toBe(5);
    });

    it('should filter templates by channel', async () => {
      await templates.create({ name: 'Email', channel: 'email', body: 'email body' });
      await templates.create({ name: 'In-App', channel: 'in_app', body: 'in-app body' });

      const emailOnly = await templates.list({ channel: 'email' });
      expect(emailOnly.data.every((t) => t.channel === 'email')).toBe(true);
    });

    it('should update a template', async () => {
      const template = await templates.create({
        name: 'Original',
        channel: 'email',
        body: 'original body',
      });

      const updated = await templates.update(template.id, { name: 'Updated', body: 'new body' });
      expect(updated.name).toBe('Updated');
      expect(updated.body).toBe('new body');
    });

    it('should delete a template', async () => {
      const template = await templates.create({
        name: 'To Delete',
        channel: 'email',
        body: 'delete me',
      });
      await templates.delete(template.id);
      await expect(templates.findByIdOrFail(template.id)).rejects.toThrow();
    });
  });

  describe('PreferenceService', () => {
    it('should return true (enabled) when no preference is set', async () => {
      const enabled = await preferences.isEnabled(randomUUID(), 'email');
      expect(enabled).toBe(true);
    });
  });

  describe('ContactResolverRegistry', () => {
    it('should register and resolve contacts', async () => {
      contactRegistry.register('test_channel', async (userId) => `${userId}@test.com`);

      const contact = await contactRegistry.resolve('test_channel', 'user-123');
      expect(contact).toBe('user-123@test.com');
    });

    it('should return null for unregistered channels', async () => {
      const contact = await contactRegistry.resolve('unregistered', 'user-123');
      expect(contact).toBeNull();
    });
  });
});
