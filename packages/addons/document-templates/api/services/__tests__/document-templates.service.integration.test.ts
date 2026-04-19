import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { users } from '@packages/database/schema';
import { DocumentTemplatesModule } from '../../document-templates.module';
import { DocumentTemplatesService } from '../document-templates.service';
import { TemplateProviderRegistry } from '../template-provider-registry';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('DocumentTemplatesService (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let service: DocumentTemplatesService;
  let registry: TemplateProviderRegistry;
  let userId: string;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      imports: [DocumentTemplatesModule.register()],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    service = module.get(DocumentTemplatesService);
    registry = module.get(TemplateProviderRegistry);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  async function createUser(): Promise<string> {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email: `user-${id.slice(0, 8)}@test.com`,
      firstName: 'Test',
      lastName: 'User',
      userType: 'internal',
    });
    return id;
  }

  async function seedUser() {
    userId = await createUser();
  }

  // ---------- create ----------

  describe('create', () => {
    it('should create a template with all fields', async () => {
      await seedUser();

      const result = await service.create({
        name: 'Offer Letter',
        category: 'offers',
        subject: 'Your Offer from {{companyName}}',
        htmlBody: '<h1>Welcome {{candidateName}}</h1>',
        isDefault: false,
        metadata: { version: 1 },
        createdBy: userId,
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Offer Letter');
      expect(result.category).toBe('offers');
      expect(result.subject).toBe('Your Offer from {{companyName}}');
      expect(result.htmlBody).toBe('<h1>Welcome {{candidateName}}</h1>');
      expect(result.isDefault).toBe(false);
      expect(result.metadata).toEqual({ version: 1 });
      expect(result.createdBy).toBe(userId);
    });

    it('should create with isDefault=true', async () => {
      await seedUser();

      const result = await service.create({
        name: 'Default Offer',
        category: 'offers',
        htmlBody: '<p>Default</p>',
        isDefault: true,
        createdBy: userId,
      });

      expect(result.isDefault).toBe(true);
    });

    it('should unset existing default when creating new default in same category', async () => {
      await seedUser();

      const first = await service.create({
        name: 'First Default',
        category: 'offers',
        htmlBody: '<p>First</p>',
        isDefault: true,
        createdBy: userId,
      });

      const second = await service.create({
        name: 'Second Default',
        category: 'offers',
        htmlBody: '<p>Second</p>',
        isDefault: true,
        createdBy: userId,
      });

      const refreshedFirst = await service.findById(first.id);
      expect(refreshedFirst.isDefault).toBe(false);
      expect(second.isDefault).toBe(true);
    });

    it('should not affect defaults in other categories', async () => {
      await seedUser();

      const offerDefault = await service.create({
        name: 'Offer Default',
        category: 'offers',
        htmlBody: '<p>Offer</p>',
        isDefault: true,
        createdBy: userId,
      });

      await service.create({
        name: 'Invoice Default',
        category: 'invoices',
        htmlBody: '<p>Invoice</p>',
        isDefault: true,
        createdBy: userId,
      });

      const refreshed = await service.findById(offerDefault.id);
      expect(refreshed.isDefault).toBe(true);
    });
  });

  // ---------- findById ----------

  describe('findById', () => {
    it('should return template by ID', async () => {
      await seedUser();
      const created = await service.create({
        name: 'Test',
        category: 'test',
        htmlBody: '<p>test</p>',
        createdBy: userId,
      });

      const found = await service.findById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Test');
    });

    it('should throw NotFoundException for non-existent ID', async () => {
      await expect(service.findById(randomUUID()))
        .rejects.toThrow('not found');
    });
  });

  // ---------- findDefault ----------

  describe('findDefault', () => {
    it('should return default template for a category', async () => {
      await seedUser();

      await service.create({
        name: 'Non-default',
        category: 'offers',
        htmlBody: '<p>Not default</p>',
        createdBy: userId,
      });
      const defaultTemplate = await service.create({
        name: 'Default',
        category: 'offers',
        htmlBody: '<p>Default</p>',
        isDefault: true,
        createdBy: userId,
      });

      const found = await service.findDefault('offers');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(defaultTemplate.id);
    });

    it('should return null when no default exists', async () => {
      await seedUser();
      await service.create({
        name: 'Non-default',
        category: 'offers',
        htmlBody: '<p>test</p>',
        createdBy: userId,
      });

      const found = await service.findDefault('offers');
      expect(found).toBeNull();
    });
  });

  // ---------- list ----------

  describe('list', () => {
    it('should list all templates', async () => {
      await seedUser();
      await service.create({ name: 'T1', category: 'offers', htmlBody: '<p>1</p>', createdBy: userId });
      await service.create({ name: 'T2', category: 'invoices', htmlBody: '<p>2</p>', createdBy: userId });

      const all = await service.list();
      expect(all).toHaveLength(2);
    });

    it('should filter by category', async () => {
      await seedUser();
      await service.create({ name: 'Offer', category: 'offers', htmlBody: '<p>1</p>', createdBy: userId });
      await service.create({ name: 'Invoice', category: 'invoices', htmlBody: '<p>2</p>', createdBy: userId });

      const offers = await service.list('offers');
      expect(offers).toHaveLength(1);
      expect(offers[0].category).toBe('offers');
    });

    it('should return empty array when no templates exist', async () => {
      const all = await service.list();
      expect(all).toEqual([]);
    });
  });

  // ---------- update ----------

  describe('update', () => {
    it('should update template fields', async () => {
      await seedUser();
      const created = await service.create({
        name: 'Original',
        category: 'offers',
        htmlBody: '<p>original</p>',
        createdBy: userId,
      });

      const updated = await service.update(created.id, {
        name: 'Updated',
        htmlBody: '<p>updated</p>',
        subject: 'New subject',
      });

      expect(updated.name).toBe('Updated');
      expect(updated.htmlBody).toBe('<p>updated</p>');
      expect(updated.subject).toBe('New subject');
    });

    it('should set as default and unset previous default', async () => {
      await seedUser();
      const first = await service.create({
        name: 'First',
        category: 'offers',
        htmlBody: '<p>1</p>',
        isDefault: true,
        createdBy: userId,
      });
      const second = await service.create({
        name: 'Second',
        category: 'offers',
        htmlBody: '<p>2</p>',
        createdBy: userId,
      });

      await service.update(second.id, { isDefault: true });

      const refreshedFirst = await service.findById(first.id);
      const refreshedSecond = await service.findById(second.id);
      expect(refreshedFirst.isDefault).toBe(false);
      expect(refreshedSecond.isDefault).toBe(true);
    });

    it('should throw NotFoundException for non-existent ID', async () => {
      await expect(service.update(randomUUID(), { name: 'X' }))
        .rejects.toThrow('not found');
    });
  });

  // ---------- delete ----------

  describe('delete', () => {
    it('should delete template', async () => {
      await seedUser();
      const created = await service.create({
        name: 'Delete Me',
        category: 'offers',
        htmlBody: '<p>bye</p>',
        createdBy: userId,
      });

      await service.delete(created.id);

      await expect(service.findById(created.id))
        .rejects.toThrow('not found');
    });

    it('should throw NotFoundException for non-existent ID', async () => {
      await expect(service.delete(randomUUID()))
        .rejects.toThrow('not found');
    });
  });

  // ---------- render ----------

  describe('render', () => {
    it('should interpolate placeholders using provider values', async () => {
      await seedUser();

      registry.register({
        category: 'offers',
        getPlaceholders: () => [
          { key: 'candidateName', label: 'Candidate Name', sampleValue: 'John Doe' },
          { key: 'companyName', label: 'Company', sampleValue: 'Acme Inc' },
        ],
        resolve: async () => ({
          candidateName: 'Jane Smith',
          companyName: 'TechCorp',
        }),
      });

      const template = await service.create({
        name: 'Offer',
        category: 'offers',
        subject: 'Offer from {{companyName}}',
        htmlBody: '<p>Dear {{candidateName}}, welcome to {{companyName}}</p>',
        createdBy: userId,
      });

      const result = await service.render(template.id, 'context-123');
      expect(result.html).toBe('<p>Dear Jane Smith, welcome to TechCorp</p>');
      expect(result.subject).toBe('Offer from TechCorp');
    });

    it('should throw when no provider registered for category', async () => {
      await seedUser();
      const template = await service.create({
        name: 'Orphan',
        category: 'unknown_category',
        htmlBody: '<p>{{placeholder}}</p>',
        createdBy: userId,
      });

      await expect(service.render(template.id, 'ctx'))
        .rejects.toThrow('No placeholder provider registered');
    });
  });

  // ---------- renderPreview ----------

  describe('renderPreview', () => {
    it('should interpolate with sample values', async () => {
      await seedUser();

      registry.register({
        category: 'preview_cat',
        getPlaceholders: () => [
          { key: 'name', label: 'Name', sampleValue: 'Sample Name' },
        ],
        resolve: async () => ({}),
      });

      const template = await service.create({
        name: 'Preview Test',
        category: 'preview_cat',
        htmlBody: '<p>Hello {{name}}</p>',
        createdBy: userId,
      });

      const result = await service.renderPreview(template.id);
      expect(result.html).toBe('<p>Hello Sample Name</p>');
    });
  });
});
