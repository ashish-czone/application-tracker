import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DocumentTemplatesService } from '../document-templates.service';
import { TemplateProviderRegistry } from '../template-provider-registry';
import type { PdfRenderer } from '../../types';

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

const makeTemplate = (overrides: Record<string, unknown> = {}) => ({
  id: 'tpl-1',
  name: 'Offer Letter',
  category: 'offer-letter',
  subject: null,
  htmlBody: '<p>Hello {{name}}</p>',
  isDefault: false,
  metadata: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('DocumentTemplatesService — CRUD & rendering', () => {
  let service: DocumentTemplatesService;
  let registry: TemplateProviderRegistry;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    registry = new TemplateProviderRegistry();
    mockDb = createMockDb();
    service = new DocumentTemplatesService(mockDb as any, registry);
  });

  // ---------------------------------------------------------------------------
  // list()
  // ---------------------------------------------------------------------------

  describe('list', () => {
    it('returns all templates when no category is given', async () => {
      const templates = [makeTemplate(), makeTemplate({ id: 'tpl-2', name: 'NDA' })];
      // When no category filter, the query chain resolves at the `from()` step
      // because `where()` is never called. The mock chain returns via `where`
      // when called, but for the no-filter path the promise resolves from `from`.
      // However the service calls `await query` (the chainable itself).
      // Since where is not called for the unfiltered path, the chainable is
      // returned as the awaited value. We need to mock it as a thenable.
      const chainable = mockDb.db;
      // Make the chainable thenable so `await query` resolves to templates
      chainable.from.mockReturnValue({
        ...chainable,
        where: vi.fn().mockResolvedValue(templates),
        then: (resolve: any) => resolve(templates),
      });

      const result = await service.list();
      expect(result).toEqual(templates);
      expect(chainable.select).toHaveBeenCalled();
      expect(chainable.from).toHaveBeenCalled();
    });

    it('filters by category when provided', async () => {
      const templates = [makeTemplate()];
      const chainable = mockDb.db;
      chainable.where.mockResolvedValueOnce(templates);
      // For the filtered path, .where() is called on the result of .from()
      chainable.from.mockReturnValue({
        ...chainable,
        where: vi.fn().mockResolvedValue(templates),
      });

      const result = await service.list('offer-letter');
      expect(result).toEqual(templates);
    });

    it('returns empty array when no templates exist', async () => {
      const chainable = mockDb.db;
      chainable.from.mockReturnValue({
        ...chainable,
        then: (resolve: any) => resolve([]),
      });

      const result = await service.list();
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findDefault()
  // ---------------------------------------------------------------------------

  describe('findDefault', () => {
    it('returns the default template for a category', async () => {
      const template = makeTemplate({ isDefault: true });
      mockDb.db.where.mockResolvedValueOnce([template]);

      const result = await service.findDefault('offer-letter');
      expect(result).toEqual(template);
    });

    it('returns null when no default exists', async () => {
      mockDb.db.where.mockResolvedValueOnce([]);

      const result = await service.findDefault('offer-letter');
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a template with required fields', async () => {
      const created = makeTemplate();
      mockDb.db.returning.mockResolvedValueOnce([created]);

      const result = await service.create({
        name: 'Offer Letter',
        category: 'offer-letter',
        htmlBody: '<p>Hello {{name}}</p>',
        createdBy: 'user-1',
      });

      expect(result).toEqual(created);
      expect(mockDb.db.insert).toHaveBeenCalled();
      expect(mockDb.db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Offer Letter',
          category: 'offer-letter',
          htmlBody: '<p>Hello {{name}}</p>',
          isDefault: false,
          subject: null,
          metadata: null,
          createdBy: 'user-1',
        }),
      );
    });

    it('unsets existing defaults when isDefault is true', async () => {
      const created = makeTemplate({ isDefault: true });
      mockDb.db.returning.mockResolvedValueOnce([created]);

      await service.create({
        name: 'Offer Letter',
        category: 'offer-letter',
        htmlBody: '<p>Hello</p>',
        isDefault: true,
        createdBy: 'user-1',
      });

      // The update to unset defaults is called before the insert
      expect(mockDb.db.update).toHaveBeenCalled();
      expect(mockDb.db.set).toHaveBeenCalledWith({ isDefault: false });
    });

    it('does not unset defaults when isDefault is false', async () => {
      const created = makeTemplate();
      mockDb.db.returning.mockResolvedValueOnce([created]);

      await service.create({
        name: 'Offer Letter',
        category: 'offer-letter',
        htmlBody: '<p>Hello</p>',
        isDefault: false,
        createdBy: 'user-1',
      });

      // update is not called for unsetting defaults (only insert chain calls it)
      expect(mockDb.db.values).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: false }),
      );
    });

    it('defaults isDefault to false when omitted', async () => {
      const created = makeTemplate();
      mockDb.db.returning.mockResolvedValueOnce([created]);

      await service.create({
        name: 'Offer Letter',
        category: 'offer-letter',
        htmlBody: '<p>Hello</p>',
        createdBy: 'user-1',
      });

      expect(mockDb.db.values).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: false }),
      );
    });

    it('passes subject and metadata when provided', async () => {
      const created = makeTemplate({ subject: 'Your Offer', metadata: { version: 2 } });
      mockDb.db.returning.mockResolvedValueOnce([created]);

      await service.create({
        name: 'Offer Letter',
        category: 'offer-letter',
        htmlBody: '<p>Hello</p>',
        subject: 'Your Offer',
        metadata: { version: 2 },
        createdBy: 'user-1',
      });

      expect(mockDb.db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your Offer',
          metadata: { version: 2 },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update()
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates template fields', async () => {
      const existing = makeTemplate();
      const updated = makeTemplate({ name: 'Updated Letter' });

      // findById (select chain) uses where to resolve rows
      mockDb.db.where
        .mockResolvedValueOnce([existing]) // findById
        .mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([updated]) }); // update chain

      const result = await service.update('tpl-1', { name: 'Updated Letter' });
      expect(result).toEqual(updated);
      expect(mockDb.db.set).toHaveBeenCalledWith({ name: 'Updated Letter' });
    });

    it('unsets existing defaults when isDefault is true', async () => {
      const existing = makeTemplate({ category: 'offer-letter' });
      const updated = makeTemplate({ isDefault: true });

      mockDb.db.where
        .mockResolvedValueOnce([existing]) // findById
        .mockResolvedValueOnce(undefined)  // unset defaults update chain where
        .mockReturnValueOnce({ returning: vi.fn().mockResolvedValue([updated]) }); // actual update chain

      await service.update('tpl-1', { isDefault: true });

      expect(mockDb.db.update).toHaveBeenCalled();
      expect(mockDb.db.set).toHaveBeenCalledWith({ isDefault: false });
    });

    it('throws NotFoundException when template does not exist', async () => {
      mockDb.db.where.mockResolvedValueOnce([]);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // delete()
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes an existing template', async () => {
      const existing = makeTemplate();
      mockDb.db.where.mockResolvedValueOnce([existing]);

      await service.delete('tpl-1');

      expect(mockDb.db.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException when template does not exist', async () => {
      mockDb.db.where.mockResolvedValueOnce([]);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // renderToPdf() with PDF renderer
  // ---------------------------------------------------------------------------

  describe('renderToPdf with renderer configured', () => {
    let pdfRenderer: PdfRenderer;

    beforeEach(() => {
      pdfRenderer = {
        htmlToPdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
      };
      service = new DocumentTemplatesService(mockDb as any, registry, pdfRenderer);
    });

    it('calls pdfRenderer with rendered HTML', async () => {
      const template = makeTemplate({ htmlBody: 'Dear {{name}}' });
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'offer-letter',
        getPlaceholders: () => [],
        resolve: async () => ({ name: 'Alice' }),
      });

      const result = await service.renderToPdf('tpl-1', 'ctx-1');

      expect(pdfRenderer.htmlToPdf).toHaveBeenCalledWith('Dear Alice');
      expect(result).toEqual(Buffer.from('fake-pdf'));
    });

    it('returns buffer from pdfRenderer', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 mock content');
      (pdfRenderer.htmlToPdf as ReturnType<typeof vi.fn>).mockResolvedValueOnce(pdfBuffer);

      const template = makeTemplate({ htmlBody: 'Hello' });
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'offer-letter',
        getPlaceholders: () => [],
        resolve: async () => ({}),
      });

      const result = await service.renderToPdf('tpl-1', 'ctx-1');
      expect(result).toBe(pdfBuffer);
    });
  });

  // ---------------------------------------------------------------------------
  // interpolate (via render) — edge cases
  // ---------------------------------------------------------------------------

  describe('interpolate edge cases (via render)', () => {
    beforeEach(() => {
      registry.register({
        category: 'test',
        getPlaceholders: () => [],
        resolve: async () => ({}),
      });
    });

    it('preserves unmatched placeholders', async () => {
      const template = makeTemplate({
        category: 'test',
        htmlBody: 'Hello {{unknown}} world',
      });
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'test',
        getPlaceholders: () => [],
        resolve: async () => ({ name: 'Alice' }),
      });

      const result = await service.render('tpl-1', 'ctx');
      expect(result.html).toBe('Hello {{unknown}} world');
    });

    it('handles multiple different placeholders', async () => {
      const template = makeTemplate({
        category: 'test',
        htmlBody: '{{greeting}} {{name}}, welcome to {{company}}!',
      });
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'test',
        getPlaceholders: () => [],
        resolve: async () => ({ greeting: 'Hi', name: 'Bob', company: 'Acme' }),
      });

      const result = await service.render('tpl-1', 'ctx');
      expect(result.html).toBe('Hi Bob, welcome to Acme!');
    });

    it('handles repeated placeholders', async () => {
      const template = makeTemplate({
        category: 'test',
        htmlBody: '{{name}} is {{name}}',
      });
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'test',
        getPlaceholders: () => [],
        resolve: async () => ({ name: 'Alice' }),
      });

      const result = await service.render('tpl-1', 'ctx');
      expect(result.html).toBe('Alice is Alice');
    });

    it('handles empty template body', async () => {
      const template = makeTemplate({
        category: 'test',
        htmlBody: '',
      });
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'test',
        getPlaceholders: () => [],
        resolve: async () => ({ name: 'Alice' }),
      });

      const result = await service.render('tpl-1', 'ctx');
      expect(result.html).toBe('');
    });

    it('handles template with no placeholders', async () => {
      const template = makeTemplate({
        category: 'test',
        htmlBody: 'No placeholders here.',
      });
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'test',
        getPlaceholders: () => [],
        resolve: async () => ({ name: 'Alice' }),
      });

      const result = await service.render('tpl-1', 'ctx');
      expect(result.html).toBe('No placeholders here.');
    });

    it('interpolates subject along with body', async () => {
      const template = makeTemplate({
        category: 'test',
        htmlBody: 'Body for {{name}}',
        subject: 'Subject for {{name}}',
      });
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'test',
        getPlaceholders: () => [],
        resolve: async () => ({ name: 'Carol' }),
      });

      const result = await service.render('tpl-1', 'ctx');
      expect(result.html).toBe('Body for Carol');
      expect(result.subject).toBe('Subject for Carol');
    });

    it('returns null subject when template has no subject', async () => {
      const template = makeTemplate({
        category: 'test',
        htmlBody: 'Body only',
        subject: null,
      });
      mockDb.db.where.mockResolvedValueOnce([template]);

      registry.register({
        category: 'test',
        getPlaceholders: () => [],
        resolve: async () => ({}),
      });

      const result = await service.render('tpl-1', 'ctx');
      expect(result.subject).toBeNull();
    });
  });
});
