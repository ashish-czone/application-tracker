import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DocumentTemplatesService } from '../document-templates.service';
import { TemplateProviderRegistry } from '../template-provider-registry';

function createMockDb(rows: any[] = []) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return { db: chainable };
}

describe('DocumentTemplatesService', () => {
  let service: DocumentTemplatesService;
  let registry: TemplateProviderRegistry;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    registry = new TemplateProviderRegistry();
    mockDb = createMockDb();
    service = new DocumentTemplatesService(mockDb as any, registry);
  });

  describe('findById', () => {
    it('returns template when found', async () => {
      const template = { id: '1', name: 'Test', category: 'offer-letter' };
      mockDb.db.where.mockResolvedValueOnce([template]);

      const result = await service.findById('1');
      expect(result).toEqual(template);
    });

    it('throws NotFoundException when not found', async () => {
      mockDb.db.where.mockResolvedValueOnce([]);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('renderPreview', () => {
    it('renders template with sample values from provider', async () => {
      const template = { id: '1', name: 'Test', category: 'offer-letter', htmlBody: 'Hello {{name}}!', subject: null };
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'offer-letter',
        getPlaceholders: () => [
          { key: 'name', label: 'Name', sampleValue: 'Jane' },
        ],
        resolve: async () => ({ name: 'Jane' }),
      });

      const result = await service.renderPreview('1');
      expect(result.html).toBe('Hello Jane!');
    });

    it('uses label fallback when sampleValue is missing', async () => {
      const template = { id: '1', name: 'Test', category: 'offer-letter', htmlBody: 'Hello {{name}}!', subject: null };
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'offer-letter',
        getPlaceholders: () => [
          { key: 'name', label: 'Full Name' },
        ],
        resolve: async () => ({ name: '' }),
      });

      const result = await service.renderPreview('1');
      expect(result.html).toBe('Hello [Full Name]!');
    });

    it('preserves unmatched placeholders', async () => {
      const template = { id: '1', name: 'Test', category: 'unknown-category', htmlBody: 'Hello {{name}}!', subject: null };
      mockDb.db.where.mockResolvedValueOnce([template]);

      const result = await service.renderPreview('1');
      expect(result.html).toBe('Hello {{name}}!');
    });
  });

  describe('render', () => {
    it('renders template with resolved values', async () => {
      const template = { id: '1', name: 'Test', category: 'offer-letter', htmlBody: 'Dear {{name}}, your role is {{role}}.', subject: 'Offer: {{role}}' };
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'offer-letter',
        getPlaceholders: () => [],
        resolve: async () => ({ name: 'Alice', role: 'Engineer' }),
      });

      const result = await service.render('1', 'context-1');
      expect(result.html).toBe('Dear Alice, your role is Engineer.');
      expect(result.subject).toBe('Offer: Engineer');
    });

    it('throws when no provider is registered for category', async () => {
      const template = { id: '1', name: 'Test', category: 'unknown', htmlBody: 'Hello', subject: null };
      mockDb.db.where.mockResolvedValueOnce([template]);

      await expect(service.render('1', 'ctx')).rejects.toThrow(NotFoundException);
    });
  });

  describe('renderToPdf', () => {
    it('throws when no PDF renderer is configured', async () => {
      const template = { id: '1', name: 'Test', category: 'offer-letter', htmlBody: 'Hello {{name}}', subject: null };
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'offer-letter',
        getPlaceholders: () => [],
        resolve: async () => ({ name: 'Alice' }),
      });

      await expect(service.renderToPdf('1', 'ctx')).rejects.toThrow('PDF rendering not configured');
    });
  });
});
